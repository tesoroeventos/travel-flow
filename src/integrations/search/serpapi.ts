import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import { SEARCH_MESSAGES } from "./messages";
import type {
  FlightLeg,
  FlightOption,
  FlightQuery,
  FlightsResult,
  HotelQuery,
  HotelsResult,
  Property,
  SearchErrorCode,
  TravelSearch,
} from "./types";

const ENDPOINT = "https://serpapi.com/search.json";
const TIMEOUT_MS = 20_000;
/** La app no guarda edades: un chico cuenta como de 8 años para Google Hotels. */
const CHILD_AGE = 8;

/* ───────── normalización (también la usa el simulado) ───────── */

const legSchema = z
  .object({
    departure_airport: z.object({ id: z.string(), time: z.string() }).loose(),
    arrival_airport: z.object({ id: z.string(), time: z.string() }).loose(),
    duration: z.number().nonnegative(),
    airline: z.string(),
    flight_number: z.string(),
  })
  .loose();

const optionSchema = z
  .object({
    flights: z.array(legSchema).min(1),
    total_duration: z.number().nonnegative(),
    price: z.number().positive().optional(),
    departure_token: z.string().optional(),
  })
  .loose();

function toOption(raw: unknown, best: boolean): FlightOption | null {
  const o = optionSchema.safeParse(raw);
  if (!o.success) return null;
  const legs: FlightLeg[] = o.data.flights.map((f) => ({
    from: f.departure_airport.id,
    to: f.arrival_airport.id,
    depart: f.departure_airport.time,
    arrive: f.arrival_airport.time,
    durationMin: f.duration,
    airline: f.airline,
    flightNumber: f.flight_number,
  }));
  return {
    legs,
    totalMin: o.data.total_duration,
    price: o.data.price ?? null,
    departureToken: o.data.departure_token ?? null,
    best,
  };
}

export function normalizeFlights(json: unknown): FlightsResult {
  const body = (json ?? {}) as { best_flights?: unknown; other_flights?: unknown };
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  const options = [
    ...list(body.best_flights).map((r) => toOption(r, true)),
    ...list(body.other_flights).map((r) => toOption(r, false)),
  ].filter((o): o is FlightOption => o !== null);
  return { options };
}

const rateSchema = z.object({ extracted_lowest: z.number().positive() }).loose();
const propertySchema = z
  .object({
    type: z.string().optional(),
    name: z.string().min(1),
    link: z.string().optional(),
    gps_coordinates: z.object({ latitude: z.number(), longitude: z.number() }).loose().optional(),
    total_rate: rateSchema.optional(),
    prices: z
      .array(z.object({ source: z.string().optional(), free_cancellation: z.boolean().optional() }).loose())
      .optional(),
    overall_rating: z.number().optional(),
    reviews: z.number().optional(),
    essential_info: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    extracted_hotel_class: z.number().optional(),
  })
  .loose();

function capacityOf(info: string[]): number | null {
  for (const s of info) {
    const m = /capacidad para (\d+)/i.exec(s);
    if (m) return Number(m[1]);
  }
  return null;
}

function toProperty(raw: unknown): Property | null {
  const p = propertySchema.safeParse(raw);
  if (!p.success) return null;
  const d = p.data;
  const info = d.essential_info ?? [];
  return {
    kind: d.type === "vacation rental" ? "vacation_rental" : "hotel",
    name: d.name,
    link: d.link ?? null,
    lat: d.gps_coordinates?.latitude ?? null,
    lng: d.gps_coordinates?.longitude ?? null,
    total: d.total_rate?.extracted_lowest ?? null,
    source: d.prices?.[0]?.source ?? null,
    rating5: d.overall_rating ?? null,
    reviews: d.reviews ?? null,
    capacity: capacityOf(info),
    hotelClass: d.extracted_hotel_class ?? null,
    amenities: d.amenities ?? [],
    info,
    freeCancellation: (d.prices ?? []).some((x) => x.free_cancellation === true),
  };
}

export function normalizeHotels(json: unknown): HotelsResult {
  const list = (json as { properties?: unknown })?.properties;
  const properties = (Array.isArray(list) ? list : []).map(toProperty).filter((p): p is Property => p !== null);
  return { properties };
}

/* ───────── pedidos ───────── */

function fail(code: SearchErrorCode): Result<never> {
  return err(code, SEARCH_MESSAGES[code]);
}

/** "Sin resultados" no es un error: es una búsqueda vacía (SerpApi lo manda con status Success). */
const NO_RESULTS = /hasn't returned any results/i;

function classifyBody(body: unknown): SearchErrorCode | null {
  const msg = (body as { error?: unknown })?.error;
  if (typeof msg !== "string" || NO_RESULTS.test(msg)) return null;
  return /run out of searches/i.test(msg) ? "no_credits" : "unavailable";
}

async function getJson(fetchFn: typeof fetch, params: Record<string, string>): Promise<Result<unknown>> {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      continue; // red caída o tiempo agotado: se reintenta una vez
    }
    if (res.status === 401) return fail("bad_key");
    if (res.status === 429) return fail("no_credits");
    if (res.status >= 500) continue;
    const body: unknown = await res.json().catch(() => null);
    const bodyError = classifyBody(body);
    if (bodyError) return fail(bodyError);
    if (!res.ok || body === null) return fail("unavailable");
    return ok(body);
  }
  return fail("unavailable");
}

const common = (key: string, currency: string) => ({ currency, hl: "es", gl: "ar", api_key: key });

function flightParams(key: string, q: FlightQuery): Record<string, string> {
  return {
    engine: "google_flights",
    departure_id: q.departureId,
    arrival_id: q.arrivalId,
    outbound_date: q.outboundDate,
    return_date: q.returnDate,
    type: "1",
    adults: String(q.adults),
    children: String(q.children),
    infants_on_lap: String(q.infants),
    ...common(key, q.currency),
  };
}

export function serpApiSearch(key: string, fetchFn: typeof fetch = fetch): TravelSearch {
  return {
    async flights(q) {
      const r = await getJson(fetchFn, flightParams(key, q));
      return r.ok ? ok(normalizeFlights(r.data)) : r;
    },
    async returnFlights(q, departureToken) {
      const r = await getJson(fetchFn, { ...flightParams(key, q), departure_token: departureToken });
      return r.ok ? ok(normalizeFlights(r.data)) : r;
    },
    async hotels(q: HotelQuery): Promise<Result<HotelsResult>> {
      const params: Record<string, string> = {
        engine: "google_hotels",
        q: q.q,
        check_in_date: q.checkIn,
        check_out_date: q.checkOut,
        adults: String(q.adults),
        children: String(q.children),
        ...(q.children > 0 ? { children_ages: Array(q.children).fill(CHILD_AGE).join(",") } : {}),
        ...common(key, q.currency),
      };
      const r = await getJson(fetchFn, params);
      return r.ok ? ok(normalizeHotels(r.data)) : r;
    },
  };
}

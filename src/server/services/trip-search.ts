import { eq } from "drizzle-orm";
import { err, ok, type Result } from "@/domain/result";
import { buildRadarQuery, type RadarQuery } from "@/domain/radar/query";
import { findAirport } from "@/domain/search/airports";
import { zonedToUtc } from "@/domain/time/calendar";
import { RADAR_MESSAGES } from "@/integrations/radar/messages";
import { findSite } from "@/integrations/radar/sites";
import { SEARCH_MESSAGES } from "@/integrations/search/messages";
import {
  chooseReturn,
  flightToDraft,
  lodgingExtras,
  lodgingToDraft,
  pickFlights,
  pickLodging,
} from "@/integrations/search/to-drafts";
import type {
  FlightQuery,
  FlightsResult,
  HotelQuery,
  HotelsResult,
  SearchCurrency,
  TravelSearch,
} from "@/integrations/search/types";
import type { Db } from "../db/client";
import { priceCache, tripSearches } from "../db/schema";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { saveOffers } from "./offers";
import { deleteOption } from "./options";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface TripSearchSummary {
  flights: number;
  lodging: number;
  missingAirlines: string[];
  searchedAt: string;
  skipped: boolean;
  messages: string[];
}

export function searchCurrency(base: string): SearchCurrency {
  return base === "ARS" || base === "USD" ? base : "USD";
}

/** Une todo lo que cambia el resultado de la búsqueda: si no cambia, no se vuelve a buscar. */
export function searchParamsKey(q: RadarQuery, currency: SearchCurrency): string {
  return [q.originIata, q.destinationIata, q.depart, q.return, q.adults, q.children, q.infants, q.rooms, currency].join(
    "|",
  );
}

export function flightQueryFor(q: RadarQuery, currency: SearchCurrency): FlightQuery {
  const ids = (code: string) => findAirport(code)?.flightIds ?? code;
  return {
    departureId: ids(q.originIata!),
    arrivalId: ids(q.destinationIata!),
    outboundDate: q.depart,
    returnDate: q.return,
    adults: Math.max(1, q.adults),
    children: q.children,
    infants: q.infants,
    currency,
  };
}

export async function getTripSearch(db: Db, ctx: Ctx, tripId: string) {
  await makeRepos(db).trips.require(ctx, tripId);
  const [row] = await db.select().from(tripSearches).where(eq(tripSearches.tripId, tripId));
  return row ?? null;
}

/** Respuesta del proveedor con caché de 6 horas. `force` no lee la caché, pero la renueva. */
async function cached<T>(
  db: Db,
  key: string,
  force: boolean,
  now: Date,
  fetchFn: () => Promise<Result<T>>,
): Promise<Result<T>> {
  if (!force) {
    const [hit] = await db.select().from(priceCache).where(eq(priceCache.key, key));
    if (hit && now.getTime() - hit.fetchedAt.getTime() <= CACHE_TTL_MS) return ok(hit.payload as T);
  }
  const r = await fetchFn();
  if (r.ok) {
    await db
      .insert(priceCache)
      .values({ key, payload: r.data, fetchedAt: now })
      .onConflictDoUpdate({ target: priceCache.key, set: { payload: r.data, fetchedAt: now } });
  }
  return r;
}

/** Borra las ofertas importadas que Matias no tocó ni reservó. */
async function removeUntouched(db: Db, ctx: Ctx, tripId: string, kind: "transport" | "lodging") {
  const r = makeRepos(db);
  const booked = new Set((await r.bookings.list(ctx, tripId)).map((b) => b.ownerId));
  if (kind === "transport") {
    const all = await r.transport.list(ctx, tripId);
    const keep = new Set(all.filter((t) => booked.has(t.id)).map((t) => t.pairId ?? t.id));
    for (const t of all) {
      if (t.source !== "busqueda" || t.leg !== "outbound" || booked.has(t.id)) continue;
      if (t.pairId && keep.has(t.pairId)) continue;
      await deleteOption(db, ctx, "transport_option", t.id);
    }
  } else {
    for (const l of await r.lodging.list(ctx, tripId)) {
      if (l.source === "busqueda" && !booked.has(l.id)) await deleteOption(db, ctx, "lodging_option", l.id);
    }
  }
}

/**
 * Busca vuelos y alojamiento reales para el viaje y los guarda como ofertas.
 * Con los mismos datos que la última vez no vuelve a buscar (salvo `force`).
 */
export async function runTripSearch(
  db: Db,
  ctx: Ctx,
  tripId: string,
  search: TravelSearch,
  opts: { force?: boolean; now?: Date } = {},
): Promise<Result<TripSearchSummary>> {
  const now = opts.now ?? new Date();
  const force = opts.force ?? false;
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  if (!trip.originIata || !trip.destinationIata) return err("no_airports", RADAR_MESSAGES.no_airports);

  const q = buildRadarQuery(trip, await r.travelers.list(ctx, tripId));
  const currency = searchCurrency(trip.baseCurrency);
  const paramsKey = searchParamsKey(q, currency);
  const previous = await getTripSearch(db, ctx, tripId);
  if (previous && previous.paramsKey === paramsKey && !force) {
    return ok({
      flights: previous.flightsCount,
      lodging: previous.lodgingCount,
      missingAirlines: previous.missingAirlines,
      searchedAt: previous.searchedAt.toISOString(),
      skipped: true,
      messages: previous.error ? [previous.error] : [],
    });
  }

  const groupSize = Math.max(1, q.adults + q.children + q.infants);
  const fq = flightQueryFor(q, currency);
  const hq: HotelQuery = {
    q: trip.destinationLabel,
    checkIn: q.depart,
    checkOut: q.return,
    adults: Math.max(1, q.adults),
    children: q.children,
    currency,
  };
  const [fr, hr] = await Promise.all([
    cached<FlightsResult>(db, `serp:flights:${paramsKey}`, force, now, () => search.flights(fq)),
    cached<HotelsResult>(db, `serp:hotels:${paramsKey}`, force, now, () => search.hotels(hq)),
  ]);
  if (!fr.ok && !hr.ok) return fr;

  const consultedAt = now.toISOString();
  const messages: string[] = [];
  let flights = 0;
  let lodging = 0;
  let missingAirlines: string[] = [];

  if (fr.ok) {
    const { picked, missingAirlines: missing } = pickFlights(fr.data);
    missingAirlines = missing;
    await removeUntouched(db, ctx, tripId, "transport");
    if (picked.length === 0) messages.push(SEARCH_MESSAGES.no_flights);
    const url = findSite("google-flights")!.buildUrl(q);
    const saved = await saveOffers(
      db,
      ctx,
      tripId,
      picked.map((o) => flightToDraft(o, currency)),
      { kind: "busqueda", provider: "Google Flights", url, consultedAt },
    );
    // saveOffers devuelve ida y vuelta de cada vuelo, en orden: la ida guarda el token de Google.
    for (const [i, o] of picked.entries()) {
      const outbound = saved[i * 2];
      if (outbound && o.departureToken) await r.transport.update(ctx, outbound.id, { externalRef: o.departureToken });
    }
    flights = picked.length;
  } else {
    messages.push(fr.error.message);
  }

  if (hr.ok) {
    const picked = pickLodging(hr.data, groupSize);
    await removeUntouched(db, ctx, tripId, "lodging");
    if (picked.length === 0) messages.push(SEARCH_MESSAGES.noLodging(groupSize));
    const fallback = findSite("google-hotels")!.buildUrl(q);
    for (const p of picked) {
      const [saved] = await saveOffers(
        db,
        ctx,
        tripId,
        [lodgingToDraft(p, { checkIn: q.depart, checkOut: q.return, currency })],
        { kind: "busqueda", provider: "Google Hotels", url: p.link ?? fallback, consultedAt },
      );
      if (saved) await r.lodging.update(ctx, saved.id, lodgingExtras(p));
    }
    lodging = picked.length;
  } else {
    messages.push(hr.error.message);
  }

  const row = {
    paramsKey,
    searchedAt: now,
    flightsCount: flights,
    lodgingCount: lodging,
    missingAirlines,
    error: messages.length ? messages.join(" ") : null,
  };
  await db
    .insert(tripSearches)
    .values({ tripId, ...row })
    .onConflictDoUpdate({ target: tripSearches.tripId, set: row });

  return ok({ flights, lodging, missingAirlines, searchedAt: consultedAt, skipped: false, messages });
}

/** "YYYY-MM-DD HH:MM" en la zona dada → ISO UTC. */
const utc = (local: string, tz: string) => zonedToUtc(local.slice(0, 10), local.slice(11, 16), tz);

/**
 * Después de elegir una propuesta: pide la vuelta de cada vuelo elegido que vino de la búsqueda
 * y completa sus horarios. Un error no corta nada: deja una nota en la vuelta.
 */
export async function fillReturnFlights(
  db: Db,
  ctx: Ctx,
  tripId: string,
  search: TravelSearch,
): Promise<{ filled: number; failed: number }> {
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  const [bookings, transport] = await Promise.all([r.bookings.list(ctx, tripId), r.transport.list(ctx, tripId)]);
  const booked = new Set(bookings.filter((b) => b.ownerType === "transport_option").map((b) => b.ownerId));
  const pending = transport
    .filter((t) => t.leg === "outbound" && t.externalRef && t.pairId && booked.has(t.id))
    .map((t) => ({
      token: t.externalRef!,
      back: transport.find((x) => x.pairId === t.pairId && x.leg === "return" && x.segments.length === 0),
    }))
    .filter((x): x is { token: string; back: (typeof transport)[number] } => x.back !== undefined);
  if (pending.length === 0 || !trip.originIata || !trip.destinationIata) return { filled: 0, failed: 0 };

  const q = buildRadarQuery(trip, await r.travelers.list(ctx, tripId));
  const fq = flightQueryFor(q, searchCurrency(trip.baseCurrency));
  let filled = 0;
  let failed = 0;
  for (const { token, back } of pending) {
    const res = await search.returnFlights(fq, token);
    const option = res.ok ? chooseReturn(res.data) : null;
    if (!option) {
      failed++;
      const notes = back.notes ?? "";
      if (!notes.includes(SEARCH_MESSAGES.return_failed)) {
        await r.transport.update(ctx, back.id, {
          notes: notes ? `${notes}\n${SEARCH_MESSAGES.return_failed}` : SEARCH_MESSAGES.return_failed,
        });
      }
      continue;
    }
    await r.transport.update(ctx, back.id, {
      provider: option.legs[0]!.airline,
      serviceNumber: option.legs.map((l) => l.flightNumber).join(" + "),
      segments: option.legs.map((l) => ({
        from: l.from,
        to: l.to,
        departUtc: utc(l.depart, trip.endTz),
        departTz: trip.endTz,
        arriveUtc: utc(l.arrive, trip.startTz),
        arriveTz: trip.startTz,
      })),
    });
    filled++;
  }
  return { filled, failed };
}

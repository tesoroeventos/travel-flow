import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import { windowDates } from "@/domain/radar/query";
import type { ReferenceFare, ReferencePlace, ReferencePriceProvider } from "../types";
import { RADAR_MESSAGES } from "./messages";

const API = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const PLACES = "https://autocomplete.travelpayouts.com/places2";
const TIMEOUT_MS = 8000;
const SOURCE = "Travelpayouts";

/** Lo que devuelve Travelpayouts es dato no confiable: se valida entrada por entrada. */
const entrySchema = z
  .object({
    price: z.number().positive(),
    airline: z.string().nullish(),
    transfers: z.number().int().nonnegative().nullish(),
  })
  .loose();
const responseSchema = z.object({ data: z.array(z.unknown()), currency: z.string().optional() }).loose();
const placeSchema = z.object({ code: z.string().min(2), name: z.string(), type: z.enum(["city", "airport"]) }).loose();

type Fail = { kind: "bad_token" | "unavailable" };

/** Un pedido con un reintento ante error de red o 5xx. 401/403 no se reintenta. */
async function getJson(fetchFn: typeof fetch, url: string): Promise<unknown | Fail> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 401 || res.status === 403) return { kind: "bad_token" };
      if (res.ok) return await res.json();
    } catch {
      // red caída o tiempo agotado: se reintenta una vez
    }
  }
  return { kind: "unavailable" };
}

function isFail(x: unknown): x is Fail {
  return typeof x === "object" && x !== null && "kind" in x && Object.keys(x).length === 1;
}

function failResult(f: Fail): Result<never> {
  return err(f.kind, RADAR_MESSAGES[f.kind]);
}

export function travelpayoutsProvider(token: string, fetchFn: typeof fetch = fetch): ReferencePriceProvider {
  /** El precio más bajo de un día; null si no hay datos válidos. */
  async function oneDay(
    params: Record<string, string>,
    date: string,
    oneWay: boolean,
    fallbackCurrency: string,
  ): Promise<ReferenceFare | null | Fail> {
    const url = `${API}?${new URLSearchParams({ ...params, token })}`;
    const json = await getJson(fetchFn, url);
    if (isFail(json)) return json;
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) return null;
    const currency = (parsed.data.currency ?? fallbackCurrency).toUpperCase();
    for (const raw of parsed.data.data) {
      const e = entrySchema.safeParse(raw);
      if (!e.success) continue;
      return {
        date,
        amountCents: Math.round(e.data.price * 100),
        currency,
        airline: e.data.airline ?? null,
        transfers: e.data.transfers ?? null,
        foundAt: null,
        oneWay,
      };
    }
    return null;
  }

  return {
    async calendar(q) {
      const base = {
        origin: q.origin,
        destination: q.destination,
        currency: q.currency.toLowerCase(),
        market: "ar",
        sorting: "price",
        direct: "false",
        limit: "1",
        unique: "false",
      };
      const days = windowDates(q.depart, q.return, q.windowDays, q.today);
      const results = await Promise.all(
        days.map(async (d) => {
          const round = await oneDay(
            { ...base, departure_at: d.depart, return_at: d.return, one_way: "false" },
            d.depart,
            false,
            q.currency,
          );
          if (round !== null) return round;
          return oneDay({ ...base, departure_at: d.depart, one_way: "true" }, d.depart, true, q.currency);
        }),
      );
      const fail = results.find(isFail);
      if (fail) return failResult(fail);
      const fares = results.filter((r): r is ReferenceFare => r !== null && !isFail(r));
      return ok({ data: fares, source: SOURCE, fetchedAt: new Date().toISOString() });
    },

    async places(term) {
      const params = new URLSearchParams({ term, locale: "es" });
      params.append("types[]", "city");
      params.append("types[]", "airport");
      const json = await getJson(fetchFn, `${PLACES}?${params}`);
      if (isFail(json)) return failResult(json);
      const list = Array.isArray(json) ? json : [];
      const places: ReferencePlace[] = [];
      for (const raw of list) {
        const p = placeSchema.safeParse(raw);
        if (p.success) places.push({ code: p.data.code, name: p.data.name, kind: p.data.type });
      }
      return ok({ data: places, source: SOURCE, fetchedAt: new Date().toISOString() });
    },
  };
}

import { eq } from "drizzle-orm";
import { ok, type Result } from "@/domain/result";
import type { ReferenceFare, ReferencePriceProvider } from "@/integrations/types";
import type { Db } from "../db/client";
import { priceCache } from "../db/schema";

const TTL_MS = 6 * 60 * 60 * 1000;
const WINDOW_DAYS = 3;

export interface CalendarQuery {
  origin: string;
  destination: string;
  depart: string;
  return: string;
  currency: string;
  today: string;
}

export interface CalendarResult {
  fares: ReferenceFare[];
  fetchedAt: string;
  source: string;
}

type Cached = { fares: ReferenceFare[]; source: string };

/** Precios de referencia de la ventana de ±3 días, guardados 6 horas. Los errores no se guardan. */
export async function getCalendar(
  db: Db,
  provider: ReferencePriceProvider,
  q: CalendarQuery,
  now: Date = new Date(),
): Promise<Result<CalendarResult>> {
  const key = `tp:${q.origin}:${q.destination}:${q.depart}:${q.return}:${q.currency}`;
  const [hit] = await db.select().from(priceCache).where(eq(priceCache.key, key));
  if (hit && now.getTime() - hit.fetchedAt.getTime() <= TTL_MS) {
    const payload = hit.payload as Cached;
    return ok({ fares: payload.fares, source: payload.source, fetchedAt: hit.fetchedAt.toISOString() });
  }

  const r = await provider.calendar({ ...q, windowDays: WINDOW_DAYS });
  if (!r.ok) return r;

  const payload: Cached = { fares: r.data.data, source: r.data.source };
  await db
    .insert(priceCache)
    .values({ key, payload, fetchedAt: now })
    .onConflictDoUpdate({ target: priceCache.key, set: { payload, fetchedAt: now } });
  return ok({ ...payload, fetchedAt: now.toISOString() });
}

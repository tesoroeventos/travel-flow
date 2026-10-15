import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { requireCtx } from "./auth/session";
import { loadTrip } from "./services/load-trip";
import { analyzeLoaded } from "./services/trip-analysis";
import { NotFoundError } from "./context";

/** Carga el viaje del usuario actual (una vez por request) o responde 404. */
export const getTripData = cache(async (tripId: string) => {
  const ctx = await requireCtx();
  const db = await getDb();
  try {
    return { ctx, db, data: await loadTrip(db, ctx, tripId) };
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});

export const getTripAnalysis = cache(async (tripId: string) => {
  const { data } = await getTripData(tripId);
  return analyzeLoaded(data);
});

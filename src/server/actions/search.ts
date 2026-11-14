"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { err, type Result } from "@/domain/result";
import { getTravelSearch } from "@/integrations/search";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { runTripSearch, type TripSearchSummary } from "../services/trip-search";

const uuid = z.uuid();

/** Busca vuelos y alojamiento del viaje. Sin `force`, no repite una búsqueda con los mismos datos. */
export async function runSearch(tripId: string, force = false): Promise<Result<TripSearchSummary>> {
  const ctx = await requireCtx();
  if (!uuid.safeParse(tripId).success) return err("bad_input", "Viaje inválido");
  const r = await runTripSearch(await getDb(), ctx, tripId, getTravelSearch(), { force: force === true });
  revalidatePath(`/viajes/${tripId}`, "layout");
  return r;
}

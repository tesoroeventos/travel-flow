import { and, eq } from "drizzle-orm";
import { diffItineraries, type ItineraryDiff } from "@/domain/itinerary/diff";
import { orderByProximity } from "@/domain/itinerary/order";
import type { Itinerary } from "@/domain/itinerary/types";
import { err, ok, type Result } from "@/domain/result";
import type { Db } from "../db/client";
import { trips } from "../db/schema";
import type { Ctx } from "../context";
import { makeScenarioParts } from "../repos/scenario-parts";
import { loadTrip } from "./load-trip";
import { itineraryFromLoaded, selectedOf } from "./trip-analysis";

async function saveSnapshot(db: Db, ctx: Ctx, tripId: string, it: Itinerary) {
  // Directo (sin historial): la copia del itinerario no es un cambio del usuario.
  await db
    .update(trips)
    .set({ itinerarySnapshot: it })
    .where(and(eq(trips.id, tripId), eq(trips.workspaceId, ctx.workspaceId)));
}

/** Itinerario actual y, si cambió desde la última vez que se mostró, qué partes cambiaron. */
export async function viewItinerary(db: Db, ctx: Ctx, tripId: string): Promise<{ itinerary: Itinerary; diff: ItineraryDiff | null } | null> {
  const data = await loadTrip(db, ctx, tripId);
  const itinerary = itineraryFromLoaded(data);
  if (!itinerary) return null;
  const snap = data.trip.itinerarySnapshot;
  if (!snap) {
    await saveSnapshot(db, ctx, tripId, itinerary);
    return { itinerary, diff: null };
  }
  const d = diffItineraries(snap, itinerary);
  const empty = d.added.length + d.removed.length + d.changed.length === 0;
  return { itinerary, diff: empty ? null : d };
}

export async function acknowledgeItinerary(db: Db, ctx: Ctx, tripId: string): Promise<void> {
  const itinerary = itineraryFromLoaded(await loadTrip(db, ctx, tripId));
  if (itinerary) await saveSnapshot(db, ctx, tripId, itinerary);
}

/** Guarda el orden manual de actividades (posición dentro de su día). */
export async function moveActivities(db: Db, ctx: Ctx, tripId: string, orderedIds: string[]): Promise<void> {
  const parts = makeScenarioParts(db);
  for (const [i, id] of orderedIds.entries()) await parts.setOverride(ctx, tripId, `activity:${id}:0`, { position: i });
}

export async function setEntryNote(db: Db, ctx: Ctx, tripId: string, entryKey: string, note: string | null): Promise<void> {
  await makeScenarioParts(db).setOverride(ctx, tripId, entryKey, { note: note?.trim() ? note.trim() : null });
}

/** Reordena las actividades de un día por cercanía, partiendo del alojamiento elegido. */
export async function orderDayByProximity(db: Db, ctx: Ctx, tripId: string, date: string): Promise<Result<string[]>> {
  const data = await loadTrip(db, ctx, tripId);
  const chosen = data.trip.chosenScenarioId;
  if (!chosen) return err("no_scenario", "Elegí un escenario antes de ordenar el itinerario");
  const sel = selectedOf(data, chosen);
  const positions = new Map(data.overrides.map((o) => [o.entryKey, o.position]));
  const day = sel.activities
    .filter((a) => a.date === date)
    .sort((x, y) => (positions.get(`activity:${x.id}:0`) ?? 999) - (positions.get(`activity:${y.id}:0`) ?? 999));
  const lodging = sel.lodging.find((l) => l.lat !== null && l.lng !== null);
  const firstWithCoords = day.find((a) => a.lat !== null && a.lng !== null);
  const start = lodging ? { lat: lodging.lat!, lng: lodging.lng! } : firstWithCoords ? { lat: firstWithCoords.lat!, lng: firstWithCoords.lng! } : null;
  if (!start) return err("missing_coordinates", "Cargá coordenadas en las actividades para ordenarlas por cercanía");
  const r = orderByProximity(
    day.map((a) => ({
      id: a.id,
      name: a.name,
      address: a.address,
      date: a.date,
      startTime: a.startTime,
      durationMin: a.durationMin,
      fixedTime: a.fixedTime,
      tz: data.trip.endTz,
      lat: a.lat,
      lng: a.lng,
      travelMinFromPrev: a.travelMinFromPrev,
      costCents: null,
      requiresBooking: a.requiresBooking,
      url: a.url,
      notes: a.notes,
    })),
    start,
  );
  if (!r.ok) return r;
  const ids = r.data.map((a) => a.id);
  await reorderActivities(db, ctx, tripId, ids);
  return ok(ids);
}

/**
 * Reordenamiento hecho por el usuario: si no había cambios externos pendientes,
 * actualiza la referencia para que su propio cambio no se informe como novedad.
 */
export async function reorderActivities(db: Db, ctx: Ctx, tripId: string, orderedIds: string[]): Promise<void> {
  const before = await viewItinerary(db, ctx, tripId);
  await moveActivities(db, ctx, tripId, orderedIds);
  if (before && !before.diff) await acknowledgeItinerary(db, ctx, tripId);
}

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { acknowledgeItinerary, orderDayByProximity, reorderActivities, setEntryNote } from "../services/itinerary-snapshot";

const refresh = (tripId: string) => revalidatePath(`/viajes/${tripId}/itinerario`);

export async function moveActivitiesAction(tripId: string, orderedIds: string[]): Promise<void> {
  const ctx = await requireCtx();
  await reorderActivities(await getDb(), ctx, tripId, orderedIds);
  refresh(tripId);
}

export async function setNoteAction(tripId: string, entryKey: string, fd: FormData): Promise<void> {
  const ctx = await requireCtx();
  await setEntryNote(await getDb(), ctx, tripId, entryKey, String(fd.get("note") ?? ""));
  refresh(tripId);
}

export async function orderByProximityAction(tripId: string, date: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireCtx();
  const r = await orderDayByProximity(await getDb(), ctx, tripId, date);
  refresh(tripId);
  return r.ok ? { ok: true } : { ok: false, message: r.error.message };
}

export async function acknowledgeItineraryAction(tripId: string): Promise<void> {
  const ctx = await requireCtx();
  await acknowledgeItinerary(await getDb(), ctx, tripId);
  refresh(tripId);
}

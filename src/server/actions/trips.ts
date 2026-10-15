"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { makeRepos } from "../repos";
import { createTrip, deleteTrip, updateTrip, type TripForm } from "../services/trips";
import { tripConstraintsSchema, tripCreateSchema, tripPreferencesSchema } from "../validation/trip";
import { formObject, formValues, zodErrors, type FormState } from "./form";

function parseTripForm(fd: FormData): { ok: true; data: TripForm } | { ok: false; state: FormState } {
  const obj = formObject(fd, ["interests", "stops"]);
  const trip = tripCreateSchema.safeParse(obj);
  const prefs = tripPreferencesSchema.safeParse(obj);
  const cons = tripConstraintsSchema.safeParse(obj);
  if (!trip.success || !prefs.success || !cons.success) {
    const fieldErrors = {
      ...(trip.success ? {} : zodErrors(trip.error)),
      ...(prefs.success ? {} : zodErrors(prefs.error)),
      ...(cons.success ? {} : zodErrors(cons.error)),
    };
    return { ok: false, state: { ok: false, message: "Revisá los campos marcados", fieldErrors, values: formValues(fd) } };
  }
  const stops = (obj.stops as string[]).map((s) => s.trim()).filter(Boolean);
  return { ok: true, data: { trip: trip.data, stops, preferences: prefs.data, constraints: cons.data } };
}

export async function createTripAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return parsed.state;
  const trip = await createTrip(await getDb(), ctx, parsed.data);
  redirect(`/viajes/${trip.id}`);
}

export async function updateTripAction(tripId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return parsed.state;
  await updateTrip(await getDb(), ctx, tripId, parsed.data);
  revalidatePath(`/viajes/${tripId}`, "layout");
  redirect(`/viajes/${tripId}`);
}

export async function deleteTripAction(tripId: string): Promise<void> {
  const ctx = await requireCtx();
  await deleteTrip(await getDb(), ctx, tripId);
  redirect("/viajes");
}

export async function renameTravelerAction(travelerId: string, fd: FormData): Promise<void> {
  const ctx = await requireCtx();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const db = await getDb();
  const t = await makeRepos(db).travelers.update(ctx, travelerId, { name });
  revalidatePath(`/viajes/${t.tripId}`, "layout");
}

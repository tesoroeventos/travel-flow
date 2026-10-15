"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { getCtx, requireCtx } from "../auth/session";
import { createShareLink, duplicateSharedTrip, duplicateTrip, revokeShareLink } from "../services/demo";

export async function createShareLinkAction(tripId: string): Promise<void> {
  const ctx = await requireCtx();
  await createShareLink(await getDb(), ctx, tripId);
  revalidatePath(`/viajes/${tripId}`, "layout");
}

export async function revokeShareLinkAction(tripId: string): Promise<void> {
  const ctx = await requireCtx();
  await revokeShareLink(await getDb(), ctx, tripId);
  revalidatePath(`/viajes/${tripId}`, "layout");
}

export async function duplicateTripAction(tripId: string): Promise<void> {
  const ctx = await requireCtx();
  const copy = await duplicateTrip(await getDb(), ctx, tripId);
  redirect(`/viajes/${copy.id}`);
}

export async function duplicateSharedAction(token: string): Promise<void> {
  const ctx = await getCtx();
  if (!ctx) redirect(`/registro?next=${encodeURIComponent(`/share/${token}`)}`);
  const copy = await duplicateSharedTrip(await getDb(), token, ctx);
  redirect(`/viajes/${copy.id}`);
}

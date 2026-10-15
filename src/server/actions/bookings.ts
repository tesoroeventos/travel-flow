"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { chooseScenario, setBookingStatus } from "../services/confirm";
import { invalid, formObject, type FormState } from "./form";

const refresh = (tripId: string) => revalidatePath(`/viajes/${tripId}`, "layout");

export async function chooseScenarioAction(tripId: string, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const scenarioId = String(fd.get("scenarioId") ?? "");
  if (!scenarioId) return { ok: false, message: "Elegí un escenario" };
  await chooseScenario(await getDb(), ctx, tripId, scenarioId);
  refresh(tripId);
  return { ok: true };
}

const bookingSchema = z.object({
  bookingStatus: z.enum(["selected", "booking_pending", "booking_confirmed"]),
  paymentStatus: z.enum(["payment_pending", "paid"]),
  confirmationCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function saveBookingAction(tripId: string, bookingId: string, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = bookingSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  await setBookingStatus(await getDb(), ctx, bookingId, parsed.data);
  refresh(tripId);
  return { ok: true, message: "Guardado" };
}

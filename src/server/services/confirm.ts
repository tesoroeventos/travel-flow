import type { Db } from "../db/client";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";

/**
 * Elige el escenario ganador y crea una reserva "seleccionada / pago pendiente" por cada
 * alternativa que todavía no tenga. Nunca cambia estados que el usuario ya modificó.
 */
export async function chooseScenario(db: Db, ctx: Ctx, tripId: string, scenarioId: string): Promise<void> {
  const r = makeRepos(db);
  const sc = await r.scenarios.require(ctx, scenarioId);
  if (sc.tripId !== tripId) throw new NotFoundError("el escenario", scenarioId);
  const [selections, bookings] = await Promise.all([makeScenarioParts(db).listSelections(ctx, tripId), r.bookings.list(ctx, tripId)]);
  const existing = new Set(bookings.map((b) => `${b.ownerType}:${b.ownerId}`));
  for (const s of selections.filter((x) => x.scenarioId === scenarioId)) {
    if (existing.has(`${s.ownerType}:${s.ownerId}`)) continue;
    await r.bookings.create(ctx, { tripId, ownerType: s.ownerType, ownerId: s.ownerId });
  }
  await r.trips.update(ctx, tripId, { chosenScenarioId: scenarioId, status: "confirmed" });
}

export interface BookingPatch {
  bookingStatus?: "selected" | "booking_pending" | "booking_confirmed";
  paymentStatus?: "payment_pending" | "paid";
  confirmationCode?: string | null;
  notes?: string | null;
}

export async function setBookingStatus(db: Db, ctx: Ctx, bookingId: string, patch: BookingPatch) {
  return makeRepos(db).bookings.update(ctx, bookingId, patch);
}

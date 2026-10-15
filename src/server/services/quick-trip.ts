import { z } from "zod";
import { localDate, zonedToUtc } from "@/domain/time/calendar";
import type { TripContext } from "@/integrations/ai/types";
import { toNumber } from "@/integrations/ai/schemas";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import type { Trip } from "../repos/trips";
import type { TripCreate } from "../validation/trip";
import { createTrip, updateTrip, type TripForm } from "./trips";
import type { LoadedTrip } from "./load-trip";

export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface QuickTrip {
  destination: string;
  origin: string | null;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number | null;
  currency: "ARS" | "USD";
  tz?: string;
  endTz?: string;
}

export const quickTripSchema = z
  .object({
    destination: z.string().trim().min(1, "Falta el destino").max(80),
    origin: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => v || null),
    startDate: z.string().regex(DATE, "Falta la fecha de ida"),
    endDate: z.string().regex(DATE, "Falta la fecha de vuelta"),
    travelers: z.coerce
      .number()
      .int("Entre 1 y 20 personas")
      .min(1, "Entre 1 y 20 personas")
      .max(20, "Entre 1 y 20 personas"),
    budget: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        const n = toNumber(v ?? null);
        return n !== null && n > 0 ? n : null;
      }),
    currency: z.enum(["ARS", "USD"]).default("ARS"),
    tz: z.string().trim().min(1).optional(),
    endTz: z.string().trim().min(1).optional(),
  })
  .superRefine((d, ctx) => {
    if (DATE.test(d.startDate) && DATE.test(d.endDate) && d.endDate < d.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La vuelta tiene que ser después de la ida",
        path: ["endDate"],
      });
    }
  });

export function toTripForm(q: QuickTrip): TripForm {
  const tz = q.tz || DEFAULT_TZ;
  const endTz = q.endTz || tz;
  const trip: TripCreate = {
    name: q.destination,
    originLabel: q.origin ?? "",
    homeLabel: null,
    destinationLabel: q.destination,
    alternativeDestinations: [],
    flexibilityDays: 0,
    adults: q.travelers,
    children: 0,
    infants: 0,
    rooms: 1,
    tripType: "vacaciones",
    baseCurrency: q.currency,
    startAt: new Date(zonedToUtc(q.startDate, "00:00", tz)),
    startTz: tz,
    endAt: new Date(zonedToUtc(q.endDate, "23:59", endTz)),
    endTz,
    budgetCents: q.budget === null ? 0 : Math.round(q.budget * 100),
  };
  return { trip, stops: [], preferences: {}, constraints: {} };
}

export const createQuickTrip = (db: Db, ctx: Ctx, q: QuickTrip): Promise<Trip> => createTrip(db, ctx, toTripForm(q));
export const updateQuickTrip = (db: Db, ctx: Ctx, tripId: string, q: QuickTrip): Promise<Trip> =>
  updateTrip(db, ctx, tripId, toTripForm(q));

export function tripContext(data: LoadedTrip, today: string): TripContext {
  const t = data.trip;
  return {
    origin: t.originLabel.trim() || null,
    destination: t.destinationLabel,
    startDate: localDate(t.startAt.toISOString(), t.startTz),
    endDate: localDate(t.endAt.toISOString(), t.endTz),
    travelers: Math.max(1, data.travelers.length),
    today,
  };
}

/** Valores del formulario corto a partir de un viaje guardado. */
export function quickValues(t: LoadedTrip["trip"], travelers: number): Record<string, string> {
  return {
    destination: t.destinationLabel,
    origin: t.originLabel,
    startDate: localDate(t.startAt.toISOString(), t.startTz),
    endDate: localDate(t.endAt.toISOString(), t.endTz),
    travelers: String(travelers),
    budget: t.budgetCents > 0 ? String(t.budgetCents / 100) : "",
    currency: t.baseCurrency,
    tz: t.startTz,
    endTz: t.endTz,
  };
}

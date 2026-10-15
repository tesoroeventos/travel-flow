import { z } from "zod";
import { zonedToUtc } from "@/domain/time/calendar";
import { amountField, boolField, currencyField, dateField, intField, optInt, optText, text, timeField, tzField } from "./common";

export const TRIP_TYPES = ["vacaciones", "negocios", "escapada", "familiar", "pareja", "grupal"] as const;
export const TRIP_TYPE_LABELS: Record<(typeof TRIP_TYPES)[number], string> = {
  vacaciones: "Vacaciones",
  negocios: "Negocios",
  escapada: "Escapada",
  familiar: "Familiar",
  pareja: "En pareja",
  grupal: "Grupal",
};

const listField = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? "").split(","))
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const tripCreateSchema = z
  .object({
    name: text("Ingresá un nombre para el viaje"),
    originLabel: text("Ingresá el origen"),
    homeLabel: optText,
    destinationLabel: text("Ingresá el destino principal"),
    alternativeDestinations: listField,
    startDate: dateField,
    startTime: timeField,
    endDate: dateField,
    endTime: timeField,
    tz: tzField,
    flexibilityDays: intField(0, "La flexibilidad no puede ser negativa").default(0),
    adults: intField(1, "Tiene que viajar al menos un adulto"),
    children: intField(0, "Cantidad inválida").default(0),
    infants: intField(0, "Cantidad inválida").default(0),
    rooms: intField(1, "Al menos una habitación").default(1),
    tripType: z.enum(TRIP_TYPES).default("vacaciones"),
    budget: amountField,
    baseCurrency: currencyField,
  })
  .superRefine((d, ctx) => {
    if (`${d.endDate}T${d.endTime}` <= `${d.startDate}T${d.startTime}`) {
      ctx.addIssue({ code: "custom", message: "La fecha de regreso debe ser posterior a la salida", path: ["endDate"] });
    }
  })
  .transform(({ startDate, startTime, endDate, endTime, tz, budget, ...rest }) => ({
    ...rest,
    startAt: new Date(zonedToUtc(startDate, startTime, tz)),
    startTz: tz,
    endAt: new Date(zonedToUtc(endDate, endTime, tz)),
    endTz: tz,
    budgetCents: budget,
  }));

export type TripCreate = z.output<typeof tripCreateSchema>;

export const BUDGET_LEVELS = ["economico", "intermedio", "premium"] as const;
export const PRIORITIES = ["precio", "duracion", "comodidad", "equilibrio"] as const;
export const PACES = ["relajado", "equilibrado", "intensivo"] as const;
export const INTERESTS = ["gastronomia", "naturaleza", "cultura", "compras", "deportes", "entretenimiento"] as const;

export const tripPreferencesSchema = z.object({
  budgetLevel: z.enum(BUDGET_LEVELS).default("intermedio"),
  priority: z.enum(PRIORITIES).default("equilibrio"),
  transportPreference: optText,
  lodgingCategory: optText,
  lodgingLocation: optText,
  interests: z
    .union([z.array(z.enum(INTERESTS)), z.enum(INTERESTS)])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  pace: z.enum(PACES).default("equilibrado"),
  accessibility: optText,
  luggage: optText,
  dietary: optText,
  otherNeeds: optText,
});

export const tripConstraintsSchema = z.object({
  noTravelHours: optText,
  maxLegHours: optInt,
  maxPerNight: optText,
  maxStops: optInt,
  maxDistanceKm: optInt,
  needsParking: boolField,
  needsPublicTransport: boolField,
  mandatoryActivities: optText,
});

export type TripPreferences = z.output<typeof tripPreferencesSchema>;
export type TripConstraints = z.output<typeof tripConstraintsSchema>;

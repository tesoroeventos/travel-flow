import { z } from "zod";
import { zonedToUtc } from "@/domain/time/calendar";
import { COST_CATEGORIES } from "@/domain/costs/types";
import {
  amountField,
  boolField,
  currencyField,
  dateField,
  intField,
  optDate,
  optInt,
  optNumber,
  optText,
  optTime,
  positiveDecimal,
  text,
  timeField,
  tzField,
  uuidField,
} from "./common";

export const LEGS = ["outbound", "return", "internal"] as const;
export const LEG_LABELS: Record<(typeof LEGS)[number], string> = { outbound: "Ida", return: "Regreso", internal: "Interno" };
export const MODES = ["flight", "bus", "train", "own_car", "rental_car", "taxi_app", "public_transport", "ferry", "private_transfer", "mixed"] as const;
export const MODE_LABELS: Record<(typeof MODES)[number], string> = {
  flight: "Avión",
  bus: "Micro",
  train: "Tren",
  own_car: "Auto propio",
  rental_car: "Auto alquilado",
  taxi_app: "Taxi / app",
  public_transport: "Transporte público",
  ferry: "Ferry / barco",
  private_transfer: "Traslado privado",
  mixed: "Combinado",
};
export const LODGING_KINDS = ["hotel", "apartment", "hostel", "rental_house", "cabin", "camping", "other"] as const;
export const LODGING_KIND_LABELS: Record<(typeof LODGING_KINDS)[number], string> = {
  hotel: "Hotel",
  apartment: "Departamento",
  hostel: "Hostel",
  rental_house: "Casa temporaria",
  cabin: "Cabaña",
  camping: "Camping",
  other: "Otro",
};
export const AMENITIES = ["breakfast", "parking", "kitchen", "wifi", "ac", "pool", "accessible"] as const;
export const AMENITY_LABELS: Record<(typeof AMENITIES)[number], string> = {
  breakfast: "Desayuno",
  parking: "Estacionamiento",
  kitchen: "Cocina",
  wifi: "Wi-Fi",
  ac: "Aire acondicionado",
  pool: "Piscina",
  accessible: "Accesible",
};

const rating15 = optInt.refine((n) => n === null || (n >= 1 && n <= 5), "Calificá de 1 a 5");

const segmentSchema = z
  .object({
    from: text("Ingresá el origen del tramo"),
    to: text("Ingresá el destino del tramo"),
    departDate: dateField,
    departTime: timeField,
    departTz: tzField,
    arriveDate: dateField,
    arriveTime: timeField,
    arriveTz: tzField,
  })
  .transform((s, ctx) => {
    const departUtc = zonedToUtc(s.departDate, s.departTime, s.departTz);
    const arriveUtc = zonedToUtc(s.arriveDate, s.arriveTime, s.arriveTz);
    if (arriveUtc <= departUtc) {
      ctx.addIssue({ code: "custom", message: "La llegada debe ser posterior a la salida", path: ["arriveDate"] });
      return z.NEVER;
    }
    return { from: s.from, to: s.to, departUtc, departTz: s.departTz, arriveUtc, arriveTz: s.arriveTz };
  });

export const transportOptionSchema = z.object({
  tripId: uuidField,
  leg: z.enum(LEGS),
  mode: z.enum(MODES),
  international: boolField,
  provider: z.string().trim().default(""),
  serviceNumber: optText,
  fromLabel: text("Ingresá el origen"),
  toLabel: text("Ingresá el destino"),
  segments: z.array(segmentSchema).default([]),
  baggageNotes: optText,
  cancellationPolicy: optText,
  flexibleCancellation: boolField,
  distanceKm: optNumber,
  url: optText,
  comfortRating: rating15,
  transferToMin: optInt,
  transferFromMin: optInt,
  advanceMin: optInt,
  notes: optText,
});

export const lodgingOptionSchema = z
  .object({
    tripId: uuidField,
    kind: z.enum(LODGING_KINDS).default("hotel"),
    name: text("Ingresá el nombre del alojamiento"),
    address: z.string().trim().default(""),
    checkInDate: dateField,
    checkInTime: timeField.default("15:00"),
    checkOutDate: dateField,
    checkOutTime: timeField.default("10:00"),
    tz: tzField,
    rating: optNumber,
    reviewCount: optInt,
    amenities: z
      .union([z.array(z.enum(AMENITIES)), z.enum(AMENITIES)])
      .optional()
      .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
    capacity: optInt,
    rooms: optInt,
    beds: optInt,
    distanceCenterKm: optNumber,
    lat: optNumber,
    lng: optNumber,
    cancellationPolicy: optText,
    flexibleCancellation: boolField,
    url: optText,
    qualityRating: rating15,
    notes: optText,
  })
  .superRefine((d, ctx) => {
    if (d.checkOutDate <= d.checkInDate) {
      ctx.addIssue({ code: "custom", message: "El check-out debe ser posterior al check-in", path: ["checkOutDate"] });
    }
  })
  .transform(({ checkInDate, checkInTime, checkOutDate, checkOutTime, rating, ...rest }) => ({
    ...rest,
    rating: rating === null ? null : String(rating),
    checkInAt: new Date(zonedToUtc(checkInDate, checkInTime, rest.tz)),
    checkOutAt: new Date(zonedToUtc(checkOutDate, checkOutTime, rest.tz)),
  }));

export const activitySchema = z.object({
  tripId: uuidField,
  name: text("Ingresá el nombre de la actividad"),
  address: z.string().trim().default(""),
  date: dateField,
  startTime: optTime,
  durationMin: intField(1, "La duración debe ser mayor a 0"),
  fixedTime: boolField,
  requiresBooking: boolField,
  accessMode: optText,
  lat: optNumber,
  lng: optNumber,
  travelMinFromPrev: optInt,
  url: optText,
  notes: optText,
});

export const COST_TYPES = ["fixed", "variable", "optional"] as const;
export const UNITS = ["total", "per_person", "per_night", "per_person_night", "per_day"] as const;

export const costItemSchema = z.object({
  label: text("Ingresá una descripción"),
  amount: amountField,
  currency: currencyField,
  unit: z.enum(UNITS).default("total"),
  quantity: positiveDecimal("Cantidad inválida").default("1"),
  category: z.enum(COST_CATEGORIES),
  costType: z.enum(COST_TYPES).default("fixed"),
  refundable: boolField,
  source: optText,
  consultedAt: optDate,
  includesTaxes: z
    .union([z.boolean(), z.enum(["yes", "no", "unknown", ""])])
    .optional()
    .transform((v) => (v === true || v === "yes" ? true : v === false || v === "no" ? false : null)),
  certainty: z.enum(["estimated", "confirmed"]).default("estimated"),
}).transform(({ amount, ...rest }) => ({ ...rest, amountCents: amount }));

export type CostItemForm = z.output<typeof costItemSchema>;

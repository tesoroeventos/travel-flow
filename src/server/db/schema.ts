import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Segment } from "@/domain/itinerary/types";
import type { Itinerary } from "@/domain/itinerary/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const cents = (name: string) => bigint(name, { mode: "number" });
const tripRef = () =>
  uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" });

/* ───────── Enums ───────── */

export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const tripStatus = pgEnum("trip_status", ["planning", "confirmed", "in_progress", "closed"]);
export const travelerKind = pgEnum("traveler_kind", ["adult", "child", "infant"]);
export const legKind = pgEnum("leg_kind", ["outbound", "return", "internal"]);
export const transportMode = pgEnum("transport_mode", [
  "flight", "bus", "train", "own_car", "rental_car", "taxi_app", "public_transport", "ferry", "private_transfer", "mixed",
]);
export const lodgingKind = pgEnum("lodging_kind", ["hotel", "apartment", "hostel", "rental_house", "cabin", "camping", "other"]);
export const ownerType = pgEnum("owner_type", ["transport_option", "lodging_option", "activity", "scenario"]);
export const selectionOwnerType = pgEnum("selection_owner_type", ["transport_option", "lodging_option", "activity"]);
export const costUnit = pgEnum("cost_unit", ["total", "per_person", "per_night", "per_person_night", "per_day"]);
export const costCategory = pgEnum("cost_category", [
  "transport_outbound", "transport_return", "transport_internal", "lodging", "food", "activities", "insurance",
  "documents_visas", "baggage", "parking_tolls", "shopping_personal", "contingency", "other",
]);
export const costType = pgEnum("cost_type", ["fixed", "variable", "optional"]);
export const certainty = pgEnum("certainty", ["estimated", "confirmed"]);
export const ratingCriterion = pgEnum("rating_criterion", ["comfort", "lodging_quality", "experience"]);
export const decisionCriterion = pgEnum("decision_criterion", [
  "price", "travel_time", "transfers", "location", "flexibility", "comfort", "lodging_quality", "experience",
]);
export const bookingStatus = pgEnum("booking_status", ["selected", "booking_pending", "booking_confirmed"]);
export const paymentStatus = pgEnum("payment_status", ["payment_pending", "paid"]);
export const eventAction = pgEnum("event_action", ["create", "update", "delete"]);

/* ───────── Cuentas ───────── */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("personal"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ───────── Viaje ───────── */

export const trips = pgTable(
  "trips",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    originLabel: text("origin_label").notNull(),
    homeLabel: text("home_label"),
    destinationLabel: text("destination_label").notNull(),
    alternativeDestinations: jsonb("alternative_destinations").$type<string[]>().notNull().default([]),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    startTz: text("start_tz").notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    endTz: text("end_tz").notNull(),
    flexibilityDays: integer("flexibility_days").notNull().default(0),
    rooms: integer("rooms").notNull().default(1),
    tripType: text("trip_type").notNull().default("vacaciones"),
    baseCurrency: text("base_currency").notNull(),
    budgetCents: cents("budget_cents").notNull(),
    contingencyPct: numeric("contingency_pct", { precision: 6, scale: 2 }).notNull().default("10"),
    contingencyCategories: jsonb("contingency_categories")
      .$type<string[]>()
      .notNull()
      .default(["food", "activities", "transport_internal"]),
    tieThresholdPct: numeric("tie_threshold_pct", { precision: 6, scale: 2 }).notNull().default("5"),
    staleDays: integer("stale_days").notNull().default(14),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
    constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),
    status: tripStatus("status").notNull().default("planning"),
    chosenScenarioId: uuid("chosen_scenario_id"),
    referenceScenarioId: uuid("reference_scenario_id"),
    isDemo: boolean("is_demo").notNull().default(false),
    publicShareToken: text("public_share_token"),
    itinerarySnapshot: jsonb("itinerary_snapshot").$type<Itinerary>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("trips_share_token_idx").on(t.publicShareToken)],
);

export const travelers = pgTable("travelers", {
  id: id(),
  tripId: tripRef(),
  name: text("name").notNull(),
  kind: travelerKind("kind").notNull().default("adult"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stops = pgTable("stops", {
  id: id(),
  tripId: tripRef(),
  position: integer("position").notNull(),
  label: text("label").notNull(),
  arriveDate: date("arrive_date"),
  leaveDate: date("leave_date"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Alternativas ───────── */

export const transportOptions = pgTable("transport_options", {
  id: id(),
  tripId: tripRef(),
  leg: legKind("leg").notNull(),
  mode: transportMode("mode").notNull(),
  international: boolean("international").notNull().default(false),
  provider: text("provider").notNull().default(""),
  serviceNumber: text("service_number"),
  fromLabel: text("from_label").notNull(),
  toLabel: text("to_label").notNull(),
  segments: jsonb("segments").$type<Segment[]>().notNull().default([]),
  baggageNotes: text("baggage_notes"),
  cancellationPolicy: text("cancellation_policy"),
  flexibleCancellation: boolean("flexible_cancellation").notNull().default(false),
  distanceKm: doublePrecision("distance_km"),
  url: text("url"),
  comfortRating: integer("comfort_rating"),
  transferToMin: integer("transfer_to_min"),
  transferFromMin: integer("transfer_from_min"),
  advanceMin: integer("advance_min"),
  notes: text("notes"),
  /** Une la ida y la vuelta de una oferta "ida y vuelta" (precio en la ida). */
  pairId: uuid("pair_id"),
  /** "En destino": si se suma a las propuestas. */
  inProposals: boolean("in_proposals").notNull().default(true),
  /** captura | link | auto | manual */
  source: text("source"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lodgingOptions = pgTable("lodging_options", {
  id: id(),
  tripId: tripRef(),
  stopId: uuid("stop_id").references(() => stops.id, { onDelete: "set null" }),
  kind: lodgingKind("kind").notNull().default("hotel"),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  checkInAt: timestamp("check_in_at", { withTimezone: true }).notNull(),
  checkOutAt: timestamp("check_out_at", { withTimezone: true }).notNull(),
  tz: text("tz").notNull(),
  rating: numeric("rating", { precision: 3, scale: 1 }),
  reviewCount: integer("review_count"),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  capacity: integer("capacity"),
  rooms: integer("rooms"),
  beds: integer("beds"),
  distanceCenterKm: doublePrecision("distance_center_km"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  cancellationPolicy: text("cancellation_policy"),
  flexibleCancellation: boolean("flexible_cancellation").notNull().default(false),
  url: text("url"),
  qualityRating: integer("quality_rating"),
  notes: text("notes"),
  source: text("source"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const activities = pgTable("activities", {
  id: id(),
  tripId: tripRef(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  date: date("date").notNull(),
  startTime: text("start_time"),
  durationMin: integer("duration_min").notNull().default(60),
  fixedTime: boolean("fixed_time").notNull().default(false),
  requiresBooking: boolean("requires_booking").notNull().default(false),
  accessMode: text("access_mode"),
  travelMinFromPrev: integer("travel_min_from_prev"),
  distanceKm: doublePrecision("distance_km"),
  url: text("url"),
  notes: text("notes"),
  inProposals: boolean("in_proposals").notNull().default(true),
  source: text("source"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Partidas de costo ───────── */

export const costItems = pgTable("cost_items", {
  id: id(),
  tripId: tripRef(),
  ownerType: ownerType("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  label: text("label").notNull(),
  amountCents: cents("amount_cents").notNull(),
  currency: text("currency").notNull(),
  unit: costUnit("unit").notNull().default("total"),
  quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("1"),
  category: costCategory("category").notNull(),
  costType: costType("cost_type").notNull().default("fixed"),
  refundable: boolean("refundable").notNull().default(false),
  source: text("source"),
  consultedAt: date("consulted_at"),
  includesTaxes: boolean("includes_taxes"),
  certainty: certainty("certainty").notNull().default("estimated"),
  assumptions: jsonb("assumptions").$type<Record<string, string>>(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Escenarios y decisión ───────── */

export const scenarios = pgTable("scenarios", {
  id: id(),
  tripId: tripRef(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const scenarioSelections = pgTable(
  "scenario_selections",
  {
    scenarioId: uuid("scenario_id").notNull().references(() => scenarios.id, { onDelete: "cascade" }),
    ownerType: selectionOwnerType("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.ownerType, t.ownerId] })],
);

export const scenarioItemToggles = pgTable(
  "scenario_item_toggles",
  {
    scenarioId: uuid("scenario_id").notNull().references(() => scenarios.id, { onDelete: "cascade" }),
    costItemId: uuid("cost_item_id").notNull().references(() => costItems.id, { onDelete: "cascade" }),
    included: boolean("included").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.costItemId] })],
);

export const scenarioRatings = pgTable(
  "scenario_ratings",
  {
    scenarioId: uuid("scenario_id").notNull().references(() => scenarios.id, { onDelete: "cascade" }),
    criterion: ratingCriterion("criterion").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scenarioId, t.criterion] })],
);

export const decisionWeights = pgTable(
  "decision_weights",
  {
    tripId: tripRef(),
    criterion: decisionCriterion("criterion").notNull(),
    weight: integer("weight").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.criterion] })],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tripId: tripRef(),
    ownerType: selectionOwnerType("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    bookingStatus: bookingStatus("booking_status").notNull().default("selected"),
    paymentStatus: paymentStatus("payment_status").notNull().default("payment_pending"),
    confirmationCode: text("confirmation_code"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("bookings_owner_idx").on(t.tripId, t.ownerType, t.ownerId)],
);

/* ───────── Durante el viaje ───────── */

export const expenses = pgTable("expenses", {
  id: id(),
  tripId: tripRef(),
  date: date("date").notNull(),
  category: costCategory("category").notNull(),
  description: text("description").notNull(),
  amountCents: cents("amount_cents").notNull(),
  currency: text("currency").notNull(),
  paymentMethod: text("payment_method"),
  paidByTravelerId: uuid("paid_by_traveler_id").references(() => travelers.id, { onDelete: "set null" }),
  participantIds: jsonb("participant_ids").$type<string[]>().notNull().default([]),
  paymentStatus: paymentStatus("payment_status").notNull().default("paid"),
  receiptUrl: text("receipt_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Monedas ───────── */

export const exchangeRates = pgTable("exchange_rates", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
  asOf: date("as_of").notNull(),
  source: text("source").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────── Itinerario e historial ───────── */

export const itineraryOverrides = pgTable(
  "itinerary_overrides",
  {
    tripId: tripRef(),
    entryKey: text("entry_key").notNull(),
    position: integer("position"),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.entryKey] })],
);

export const tripEvents = pgTable("trip_events", {
  id: id(),
  tripId: uuid("trip_id").notNull(),
  userId: uuid("user_id"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: eventAction("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
});

/* ───────── Uso de IA ───────── */

export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

import Decimal from "decimal.js";
import { computeScenarioCosts } from "@/domain/costs/engine";
import { computeCoverage } from "@/domain/costs/coverage";
import { compareScenarios, type Comparison } from "@/domain/costs/compare";
import type { CostItemInput, CostSummary } from "@/domain/costs/types";
import { scoreScenarios } from "@/domain/decision/score";
import { explainScores } from "@/domain/decision/explain";
import { metricsFromScenario } from "@/domain/decision/metrics";
import { CRITERIA, type Criterion, type RatingCriterion, type ScenarioMetrics, type ScoreResult } from "@/domain/decision/types";
import { generateItinerary } from "@/domain/itinerary/generate";
import { haversineKm } from "@/domain/itinerary/order";
import type { Itinerary, TransportLeg } from "@/domain/itinerary/types";
import { localDate, nights, tripDays } from "@/domain/time/calendar";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { toDomainRate } from "../repos/rates";
import { loadTrip, type LoadedTrip } from "./load-trip";

export const DEFAULT_WEIGHTS: Record<Criterion, number> = {
  price: 5,
  travel_time: 3,
  transfers: 2,
  location: 2,
  flexibility: 1,
  comfort: 3,
  lodging_quality: 2,
  experience: 2,
};

export interface ScenarioAnalysis {
  id: string;
  name: string;
  summary: CostSummary;
  metrics: ScenarioMetrics;
  itemIds: string[];
}

export interface TripAnalysis {
  data: LoadedTrip;
  tripDays: number;
  travelerCount: number;
  rateDate: string;
  scenarios: ScenarioAnalysis[];
  comparison: Comparison;
  score: ScoreResult;
  weights: Record<Criterion, number>;
  explanation: string[];
}

const iso = (d: Date) => d.toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

export function weightsFor(data: LoadedTrip): Record<Criterion, number> {
  const w = { ...DEFAULT_WEIGHTS };
  for (const row of data.weights) w[row.criterion] = row.weight;
  return w;
}

export function lodgingNights(l: LoadedTrip["lodging"][number]): number | null {
  try {
    return nights(iso(l.checkInAt), iso(l.checkOutAt), l.tz);
  } catch {
    return null;
  }
}

/** Convierte una partida guardada en la entrada del motor de costos. */
export function toCostInput(data: LoadedTrip, i: LoadedTrip["costItems"][number]): CostItemInput {
  const lodging = i.ownerType === "lodging_option" ? data.lodging.find((l) => l.id === i.ownerId) : undefined;
  const paid = data.bookings.some(
    (b) => b.paymentStatus === "paid" && b.ownerType === i.ownerType && b.ownerId === i.ownerId,
  );
  return {
    id: i.id,
    label: i.label,
    amountCents: i.amountCents,
    currency: i.currency,
    unit: i.unit,
    quantity: i.quantity,
    category: i.category,
    costType: i.costType,
    refundable: i.refundable,
    certainty: i.certainty,
    includesTaxes: i.includesTaxes,
    consultedAt: i.consultedAt,
    nights: lodging ? lodgingNights(lodging) : null,
    paymentStatus: paid ? "paid" : "payment_pending",
  };
}

/** Partidas de un escenario (alternativas seleccionadas + propias), con interruptores aplicados. */
export function scenarioItems(data: LoadedTrip, scenarioId: string): CostItemInput[] {
  const selected = new Set(
    data.selections.filter((s) => s.scenarioId === scenarioId).map((s) => `${s.ownerType}:${s.ownerId}`),
  );
  const off = new Set(
    data.toggles.filter((t) => t.scenarioId === scenarioId && !t.included).map((t) => t.costItemId),
  );
  return data.costItems
    .filter((i) =>
      i.ownerType === "scenario" ? i.ownerId === scenarioId : selected.has(`${i.ownerType}:${i.ownerId}`),
    )
    .filter((i) => !off.has(i.id))
    .map((i) => toCostInput(data, i));
}

export function selectedOf(data: LoadedTrip, scenarioId: string) {
  const ids = (type: string) =>
    new Set(data.selections.filter((s) => s.scenarioId === scenarioId && s.ownerType === type).map((s) => s.ownerId));
  const t = ids("transport_option");
  const l = ids("lodging_option");
  const a = ids("activity");
  return {
    transport: data.transport.filter((x) => t.has(x.id)),
    lodging: data.lodging.filter((x) => l.has(x.id)),
    activities: data.activities.filter((x) => a.has(x.id)),
  };
}

export function toTransportLeg(o: LoadedTrip["transport"][number]): TransportLeg {
  return {
    id: o.id,
    leg: o.leg,
    mode: o.mode,
    international: o.international,
    provider: o.provider,
    serviceNumber: o.serviceNumber,
    segments: o.segments,
    transferToMin: o.transferToMin,
    transferFromMin: o.transferFromMin,
    advanceMin: o.advanceMin,
  };
}

function locationKm(sel: ReturnType<typeof selectedOf>): number | null {
  const lodgings = sel.lodging;
  if (lodgings.length === 0) return null;
  const withCoords = lodgings.filter((l) => l.lat !== null && l.lng !== null);
  const acts = sel.activities.filter((a) => a.lat !== null && a.lng !== null);
  if (withCoords.length > 0 && acts.length > 0) {
    const l = withCoords[0]!;
    const total = acts.reduce((s, a) => s + haversineKm({ lat: l.lat!, lng: l.lng! }, { lat: a.lat!, lng: a.lng! }), 0);
    return Math.round((total / acts.length) * 10) / 10;
  }
  const d = lodgings.map((l) => l.distanceCenterKm).filter((x): x is number => x !== null);
  return d.length > 0 ? d.reduce((s, x) => s + x, 0) / d.length : null;
}

function flexiblePct(data: LoadedTrip, summary: CostSummary): number | null {
  if (summary.totalCents <= 0) return null;
  const flexibleOwners = new Set([
    ...data.transport.filter((t) => t.flexibleCancellation).map((t) => t.id),
    ...data.lodging.filter((l) => l.flexibleCancellation).map((l) => l.id),
  ]);
  const ownerOf = new Map(data.costItems.map((i) => [i.id, i.ownerId]));
  const flexible = summary.lines
    .filter((l) => l.status === "counted" && flexibleOwners.has(ownerOf.get(l.itemId) ?? ""))
    .reduce((s, l) => s + (l.convertedCents ?? 0), 0);
  return new Decimal(flexible).times(100).dividedBy(summary.totalCents).toDecimalPlaces(1).toNumber();
}

export function analyzeLoaded(data: LoadedTrip, opts: { today?: string } = {}): TripAnalysis {
  const { trip } = data;
  const today = opts.today ?? todayIso();
  const days = tripDays(iso(trip.startAt), trip.startTz, iso(trip.endAt), trip.endTz);
  const travelerCount = data.travelers.length;
  const rateDate = trip.status === "planning" ? today : localDate(iso(trip.startAt), trip.startTz);
  const rates = data.rates.map(toDomainRate);

  const scenarios: ScenarioAnalysis[] = data.scenarios.map((sc) => {
    const items = scenarioItems(data, sc.id);
    const sel = selectedOf(data, sc.id);
    const coverage = computeCoverage({
      tripStartUtc: iso(trip.startAt),
      tripStartTz: trip.startTz,
      tripEndUtc: iso(trip.endAt),
      tripEndTz: trip.endTz,
      lodgings: sel.lodging.map((l) => ({ checkInUtc: iso(l.checkInAt), checkOutUtc: iso(l.checkOutAt), tz: l.tz })),
      legs: sel.transport.map((t) => t.leg),
    });
    const summary = computeScenarioCosts({
      travelers: travelerCount,
      tripDays: days,
      baseCurrency: trip.baseCurrency,
      budgetCents: trip.budgetCents,
      contingencyPct: trip.contingencyPct,
      contingencyCategories: trip.contingencyCategories as CostItemInput["category"][],
      rateDate,
      today,
      staleDays: trip.staleDays,
      rates,
      items,
      coverage,
    });
    const ratings: Partial<Record<RatingCriterion, number>> = {};
    for (const r of data.ratings.filter((x) => x.scenarioId === sc.id)) ratings[r.criterion] = r.value;
    const metrics = metricsFromScenario({
      scenarioId: sc.id,
      name: sc.name,
      summary,
      legs: sel.transport.map((t) => ({ leg: t.leg, segments: t.segments })),
      locationKm: locationKm(sel),
      flexiblePct: flexiblePct(data, summary),
      ratings,
    });
    return { id: sc.id, name: sc.name, summary, metrics, itemIds: items.map((i) => i.id) };
  });

  const comparison = compareScenarios(
    scenarios.map((s) => ({ scenarioId: s.id, totalWithContingencyCents: s.summary.totalWithContingencyCents })),
    trip.referenceScenarioId ?? undefined,
  );
  const weights = weightsFor(data);
  const metrics = scenarios.map((s) => s.metrics);
  const score = scoreScenarios(metrics, weights, Number(trip.tieThresholdPct));
  const explanation = scenarios.length > 1 ? explainScores(metrics, score, comparison.referenceId) : [];

  return { data, tripDays: days, travelerCount, rateDate, scenarios, comparison, score, weights, explanation };
}

export async function analyzeTrip(db: Db, ctx: Ctx, tripId: string, opts: { today?: string } = {}): Promise<TripAnalysis> {
  return analyzeLoaded(await loadTrip(db, ctx, tripId), opts);
}

export function itineraryFromLoaded(data: LoadedTrip): Itinerary | null {
  const chosen = data.trip.chosenScenarioId;
  if (!chosen || !data.scenarios.some((s) => s.id === chosen)) return null;
  const sel = selectedOf(data, chosen);
  return generateItinerary({
    tripTz: data.trip.startTz,
    legs: sel.transport.map(toTransportLeg),
    lodgings: sel.lodging.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      checkInUtc: iso(l.checkInAt),
      checkOutUtc: iso(l.checkOutAt),
      tz: l.tz,
    })),
    activities: sel.activities.map((a) => {
      const own = data.costItems.filter((i) => i.ownerType === "activity" && i.ownerId === a.id).map((i) => toCostInput(data, i));
      const cost =
        own.length > 0
          ? computeScenarioCosts({
              travelers: data.travelers.length,
              tripDays: tripDays(iso(data.trip.startAt), data.trip.startTz, iso(data.trip.endAt), data.trip.endTz),
              baseCurrency: data.trip.baseCurrency,
              budgetCents: 0,
              contingencyPct: "0",
              contingencyCategories: [],
              rateDate: localDate(iso(data.trip.startAt), data.trip.startTz),
              today: localDate(iso(data.trip.startAt), data.trip.startTz),
              staleDays: data.trip.staleDays,
              rates: data.rates.map(toDomainRate),
              items: own,
              coverage: { hasOutbound: true, hasReturn: true, uncoveredNights: 0 },
            })
          : null;
      return {
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
        costCents: cost && !cost.incomplete ? cost.totalCents : null,
        requiresBooking: a.requiresBooking,
        url: a.url,
        notes: a.notes,
      };
    }),
    overrides: data.overrides.map((o) => ({ entryKey: o.entryKey, position: o.position, note: o.note })),
  });
}

export async function buildItinerary(db: Db, ctx: Ctx, tripId: string): Promise<Itinerary | null> {
  return itineraryFromLoaded(await loadTrip(db, ctx, tripId));
}

export const ALL_CRITERIA = CRITERIA;

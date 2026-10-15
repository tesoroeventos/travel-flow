import { computeScenarioCosts } from "@/domain/costs/engine";
import type { CostSummary } from "@/domain/costs/types";
import { tripDays } from "@/domain/time/calendar";
import { toDomainRate } from "../repos/rates";
import type { LoadedTrip } from "./load-trip";
import { toCostInput } from "./trip-analysis";

export interface OptionCost {
  totalCents: number;
  perPersonCents: number | null;
  refundableHeldCents: number;
  incomplete: boolean;
  itemCount: number;
  summary: CostSummary;
}

/** Costo de una sola alternativa (todas sus partidas), en la moneda base del viaje. */
export function optionCost(
  data: LoadedTrip,
  ownerType: "transport_option" | "lodging_option" | "activity" | "scenario",
  ownerId: string,
  today = new Date().toISOString().slice(0, 10),
): OptionCost {
  const { trip } = data;
  const items = data.costItems.filter((i) => i.ownerType === ownerType && i.ownerId === ownerId).map((i) => toCostInput(data, i));
  const summary = computeScenarioCosts({
    travelers: data.travelers.length,
    tripDays: tripDays(trip.startAt.toISOString(), trip.startTz, trip.endAt.toISOString(), trip.endTz),
    baseCurrency: trip.baseCurrency,
    budgetCents: 0,
    contingencyPct: "0",
    contingencyCategories: [],
    rateDate: today,
    today,
    staleDays: trip.staleDays,
    rates: data.rates.map(toDomainRate),
    items,
    coverage: { hasOutbound: true, hasReturn: true, uncoveredNights: 0 },
  });
  return {
    totalCents: summary.totalCents,
    perPersonCents: summary.perPersonCents,
    refundableHeldCents: summary.refundableHeldCents,
    incomplete: summary.incomplete,
    itemCount: items.length,
    summary,
  };
}

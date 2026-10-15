import { computeScenarioCosts } from "@/domain/costs/engine";
import { localDate, tripDays } from "@/domain/time/calendar";
import { toDomainRate } from "../repos/rates";
import type { LoadedTrip } from "./load-trip";
import { toCostInput } from "./trip-analysis";

const iso = (d: Date) => d.toISOString();

/** Total de un grupo de partidas en la moneda del viaje, sin imprevistos. null si no hay partidas o falta un tipo de cambio. */
export function itemsTotalCents(data: LoadedTrip, items: LoadedTrip["costItems"], today: string): number | null {
  if (!items.length) return null;
  const { trip } = data;
  const s = computeScenarioCosts({
    travelers: Math.max(1, data.travelers.length),
    tripDays: tripDays(iso(trip.startAt), trip.startTz, iso(trip.endAt), trip.endTz),
    baseCurrency: trip.baseCurrency,
    budgetCents: 0,
    contingencyPct: "0",
    contingencyCategories: [],
    rateDate: trip.status === "planning" ? today : localDate(iso(trip.startAt), trip.startTz),
    today,
    staleDays: trip.staleDays,
    rates: data.rates.map(toDomainRate),
    items: items.map((i) => toCostInput(data, i)),
    coverage: { hasOutbound: true, hasReturn: true, uncoveredNights: 0 },
  });
  return s.incomplete ? null : s.totalCents;
}

export const ownerItems = (data: LoadedTrip, ownerType: string, ownerIds: string[]) =>
  data.costItems.filter((i) => i.ownerType === ownerType && ownerIds.includes(i.ownerId));

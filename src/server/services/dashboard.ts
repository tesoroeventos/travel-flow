import { localDate } from "@/domain/time/calendar";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { toDomainRate } from "../repos/rates";
import { analyzeLoaded } from "./trip-analysis";
import { loadTrip } from "./load-trip";
import { sumExpenses } from "./spend";

export type TripPhase = "active" | "upcoming" | "past";

export interface TripCard {
  id: string;
  name: string;
  originLabel: string;
  destinationLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  travelers: number;
  phase: TripPhase;
  status: string;
  isDemo: boolean;
  baseCurrency: string;
  budgetCents: number;
  estimatedCents: number | null;
  estimateSource: "chosen" | "cheapest" | null;
  estimateIncomplete: boolean;
  actualCents: number;
  actualIncomplete: boolean;
}

/** Tarjetas del dashboard: presupuesto vs. estimado vs. real, por viaje. */
export async function tripCards(db: Db, ctx: Ctx, today = new Date().toISOString().slice(0, 10)): Promise<TripCard[]> {
  const trips = await makeRepos(db).trips.list(ctx);
  const cards: TripCard[] = [];
  for (const t of trips) {
    const data = await loadTrip(db, ctx, t.id);
    const a = analyzeLoaded(data, { today });
    const chosen = a.scenarios.find((s) => s.id === t.chosenScenarioId);
    const cheapest = [...a.scenarios].sort(
      (x, y) => x.summary.totalWithContingencyCents - y.summary.totalWithContingencyCents,
    )[0];
    const est = chosen ?? cheapest;
    const spend = sumExpenses(data.expenses, t.baseCurrency, data.rates.map(toDomainRate));
    const startDate = localDate(t.startAt.toISOString(), t.startTz);
    const endDate = localDate(t.endAt.toISOString(), t.endTz);
    cards.push({
      id: t.id,
      name: t.name,
      originLabel: t.originLabel,
      destinationLabel: t.destinationLabel,
      startDate,
      endDate,
      days: a.tripDays,
      travelers: a.travelerCount,
      phase: today < startDate ? "upcoming" : today > endDate ? "past" : "active",
      status: t.status,
      isDemo: t.isDemo,
      baseCurrency: t.baseCurrency,
      budgetCents: t.budgetCents,
      estimatedCents: est ? est.summary.totalWithContingencyCents : null,
      estimateSource: chosen ? "chosen" : cheapest ? "cheapest" : null,
      estimateIncomplete: est ? est.summary.incomplete : false,
      actualCents: spend.totalCents,
      actualIncomplete: spend.incomplete,
    });
  }
  return cards;
}

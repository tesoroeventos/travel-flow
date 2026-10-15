import { COST_CATEGORIES, type CostCategory, type CostWarning } from "@/domain/costs/types";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { toDomainRate } from "../repos/rates";
import { loadTrip } from "./load-trip";
import { analyzeLoaded } from "./trip-analysis";
import { sumExpenses } from "./spend";

export interface CategoryComparison {
  estimatedCents: number;
  actualCents: number;
  deviationCents: number;
}

export interface ExpenseReport {
  budgetCents: number;
  /** Total con imprevistos del escenario elegido */
  estimatedCents: number | null;
  actualCents: number;
  availableCents: number;
  byCategory: Record<CostCategory, CategoryComparison>;
  incomplete: boolean;
  warnings: CostWarning[];
}

/** Presupuesto inicial vs. estimado del escenario elegido vs. gasto real. */
export async function expenseReport(db: Db, ctx: Ctx, tripId: string, opts: { today?: string } = {}): Promise<ExpenseReport> {
  const data = await loadTrip(db, ctx, tripId);
  const a = analyzeLoaded(data, opts);
  const chosen = a.scenarios.find((s) => s.id === data.trip.chosenScenarioId);
  const spend = sumExpenses(data.expenses, data.trip.baseCurrency, data.rates.map(toDomainRate));
  const byCategory = Object.fromEntries(
    COST_CATEGORIES.map((c) => {
      const est = chosen ? chosen.summary.byCategory[c] : 0;
      const act = spend.byCategory[c];
      return [c, { estimatedCents: est, actualCents: act, deviationCents: act - est }];
    }),
  ) as Record<CostCategory, CategoryComparison>;
  return {
    budgetCents: data.trip.budgetCents,
    estimatedCents: chosen ? chosen.summary.totalWithContingencyCents : null,
    actualCents: spend.totalCents,
    availableCents: data.trip.budgetCents - spend.totalCents,
    byCategory,
    incomplete: spend.incomplete,
    warnings: spend.warnings,
  };
}

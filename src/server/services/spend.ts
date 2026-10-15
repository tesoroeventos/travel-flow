import { emptyByCategory } from "@/domain/costs/engine";
import type { CostCategory, CostWarning } from "@/domain/costs/types";
import { money } from "@/domain/money/money";
import { convert, type ExchangeRate } from "@/domain/money/rates";

export interface ExpenseLike {
  id: string;
  date: string;
  category: CostCategory;
  amountCents: number;
  currency: string;
}

export interface SpendSummary {
  totalCents: number;
  byCategory: Record<CostCategory, number>;
  incomplete: boolean;
  warnings: CostWarning[];
}

/** Suma gastos reales en la moneda base, convirtiendo cada uno con la tasa vigente a su fecha. */
export function sumExpenses(expenses: ExpenseLike[], baseCurrency: string, rates: ExchangeRate[]): SpendSummary {
  const byCategory = emptyByCategory();
  const warnings: CostWarning[] = [];
  let total = 0;
  for (const e of expenses) {
    const c = convert(money(e.amountCents, e.currency), baseCurrency, rates, e.date);
    if (!c.ok) {
      warnings.push({ code: "missing_exchange_rate", itemId: e.id, detail: `${e.currency}→${baseCurrency}` });
      continue;
    }
    total += c.data.money.cents;
    byCategory[e.category] += c.data.money.cents;
  }
  return { totalCents: total, byCategory, incomplete: warnings.length > 0, warnings };
}

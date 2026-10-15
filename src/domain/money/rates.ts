import Decimal from "decimal.js";
import { err, ok, type Result } from "../result";
import { money, multiplyCents, type Currency, type Money } from "./money";

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  /** Decimal como string, p. ej. "1000.50" */
  rate: string;
  /** YYYY-MM-DD */
  asOf: string;
  source: string;
}

export interface FoundRate {
  factor: Decimal;
  inverse: boolean;
  rate: ExchangeRate | null;
}

/**
 * Busca la tasa más reciente con asOf ≤ fecha, directa o inversa (sin encadenar).
 * Ante igual fecha, prefiere la directa.
 */
export function findRate(rates: ExchangeRate[], from: Currency, to: Currency, asOf: string): FoundRate | null {
  if (from === to) return { factor: new Decimal(1), inverse: false, rate: null };
  let best: { rate: ExchangeRate; inverse: boolean } | null = null;
  for (const r of rates) {
    if (r.asOf > asOf) continue;
    let inverse: boolean;
    if (r.from === from && r.to === to) inverse = false;
    else if (r.from === to && r.to === from) inverse = true;
    else continue;
    if (new Decimal(r.rate).lte(0)) continue;
    if (
      !best ||
      r.asOf > best.rate.asOf ||
      (r.asOf === best.rate.asOf && best.inverse && !inverse)
    ) {
      best = { rate: r, inverse };
    }
  }
  if (!best) return null;
  const factor = best.inverse ? new Decimal(1).dividedBy(best.rate.rate) : new Decimal(best.rate.rate);
  return { factor, inverse: best.inverse, rate: best.rate };
}

export interface Conversion {
  money: Money;
  factor: string;
  rateAsOf: string | null;
  rateSource: string | null;
}

export function convert(m: Money, to: Currency, rates: ExchangeRate[], asOf: string): Result<Conversion> {
  const found = findRate(rates, m.currency, to, asOf);
  if (!found) return err("missing_exchange_rate", `Falta tipo de cambio ${m.currency}→${to}`);
  return ok({
    money: money(multiplyCents(m.cents, found.factor), to),
    factor: found.factor.toString(),
    rateAsOf: found.rate?.asOf ?? null,
    rateSource: found.rate?.source ?? null,
  });
}

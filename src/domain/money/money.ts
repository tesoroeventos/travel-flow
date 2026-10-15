import Decimal from "decimal.js";

export type Currency = string;

export interface Money {
  cents: number;
  currency: Currency;
}

export const SUPPORTED_CURRENCIES = [
  "ARS", "BOB", "BRL", "CLP", "COP", "CRC", "DOP", "GTQ", "HNL", "MXN",
  "NIO", "PAB", "PEN", "PYG", "UYU", "VES", "USD", "EUR",
] as const;

const CURRENCY_RE = /^[A-Z]{3}$/;

export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Importe en centavos inválido: ${cents}`);
  }
}

export function money(cents: number, currency: Currency): Money {
  assertCents(cents);
  if (!CURRENCY_RE.test(currency)) {
    throw new RangeError(`Moneda inválida: ${currency}`);
  }
  return { cents, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`No se pueden sumar ${a.currency} y ${b.currency} sin convertir`);
  }
  return money(a.cents + b.cents, a.currency);
}

export function roundHalfEven(value: Decimal): number {
  const rounded = value.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
  assertCents(rounded);
  return rounded;
}

export function multiplyCents(cents: number, factor: Decimal.Value): number {
  return roundHalfEven(new Decimal(cents).times(factor));
}

export function divideCents(cents: number, divisor: number): number | null {
  if (!(divisor > 0)) return null;
  return roundHalfEven(new Decimal(cents).dividedBy(divisor));
}

/**
 * Formato de visualización: miles con punto y decimales con coma (igual que la carga).
 * Se usa es-AR porque Intl "es-419" aplica el formato 1,234.56.
 */
export const DISPLAY_LOCALE = "es-AR";

export function formatMoney(m: Money, locale = DISPLAY_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(new Decimal(m.cents).dividedBy(100).toNumber());
}

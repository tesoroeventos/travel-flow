import type { Currency } from "../money/money";
import type { ExchangeRate } from "../money/rates";

export type CostUnit = "total" | "per_person" | "per_night" | "per_person_night" | "per_day";

export const COST_CATEGORIES = [
  "transport_outbound",
  "transport_return",
  "transport_internal",
  "lodging",
  "food",
  "activities",
  "insurance",
  "documents_visas",
  "baggage",
  "parking_tolls",
  "shopping_personal",
  "contingency",
  "other",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  transport_outbound: "Transporte de ida",
  transport_return: "Transporte de regreso",
  transport_internal: "Transporte interno",
  lodging: "Alojamiento",
  food: "Alimentación",
  activities: "Actividades y entradas",
  insurance: "Seguros",
  documents_visas: "Documentación y visados",
  baggage: "Equipaje",
  parking_tolls: "Estacionamiento y peajes",
  shopping_personal: "Compras y gastos personales",
  contingency: "Imprevistos",
  other: "Otros gastos",
};

export const COST_UNIT_LABELS: Record<CostUnit, string> = {
  total: "Total",
  per_person: "Por persona",
  per_night: "Por noche",
  per_person_night: "Por persona por noche",
  per_day: "Por día",
};

export type CostType = "fixed" | "variable" | "optional";
export type Certainty = "estimated" | "confirmed";
export type PaymentStatus = "payment_pending" | "paid";

export interface CostItemInput {
  id: string;
  label: string;
  amountCents: number;
  currency: Currency;
  unit: CostUnit;
  /** Decimal como string */
  quantity: string;
  category: CostCategory;
  costType: CostType;
  refundable: boolean;
  certainty: Certainty;
  includesTaxes: boolean | null;
  /** YYYY-MM-DD */
  consultedAt: string | null;
  /** Noches del alojamiento dueño; null = noches del viaje (días − 1) */
  nights: number | null;
  paymentStatus: PaymentStatus;
}

export interface Coverage {
  hasOutbound: boolean;
  hasReturn: boolean;
  uncoveredNights: number;
}

export interface ScenarioCostInput {
  travelers: number;
  tripDays: number;
  baseCurrency: Currency;
  budgetCents: number;
  /** Porcentaje como string decimal, p. ej. "10" */
  contingencyPct: string;
  contingencyCategories: CostCategory[];
  /** Fecha de referencia para tipos de cambio (YYYY-MM-DD) */
  rateDate: string;
  /** Hoy (YYYY-MM-DD) para detectar precios viejos */
  today: string;
  staleDays: number;
  rates: ExchangeRate[];
  items: CostItemInput[];
  coverage: Coverage;
}

export type CostWarningCode =
  | "missing_outbound_transport"
  | "missing_return_transport"
  | "uncovered_nights"
  | "missing_exchange_rate"
  | "stale_price"
  | "unknown_taxes";

export interface CostWarning {
  code: CostWarningCode;
  itemId?: string;
  detail?: string;
}

export interface CostLine {
  itemId: string;
  multiplier: string;
  /** Importe de la línea (unitario × multiplicador × cantidad) en la moneda original */
  originalCents: number;
  originalCurrency: Currency;
  convertedCents: number | null;
  factor: string | null;
  status: "counted" | "refundable" | "missing_rate";
}

export interface CostSummary {
  totalCents: number;
  contingencyCents: number;
  totalWithContingencyCents: number;
  perPersonCents: number | null;
  perPersonPerDayCents: number | null;
  deviationCents: number;
  byCategory: Record<CostCategory, number>;
  byCostType: Record<CostType, number>;
  confirmedCents: number;
  estimatedCents: number;
  paidCents: number;
  pendingCents: number;
  refundableHeldCents: number;
  incomplete: boolean;
  lines: CostLine[];
  warnings: CostWarning[];
}

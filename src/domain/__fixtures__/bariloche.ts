import type { CostItemInput, ScenarioCostInput } from "../costs/types";

/**
 * Caso de referencia calculado a mano (ver plan, Task 5).
 * Buenos Aires → Bariloche, 2027-01-10 08:00 a 2027-01-16 20:00 (7 días), 2 adultos, ARS.
 * Total esperado: $ 1.255.030,00
 */
export function barilocheItems(): CostItemInput[] {
  const base = {
    quantity: "1",
    costType: "fixed" as const,
    refundable: false,
    certainty: "estimated" as const,
    includesTaxes: true,
    consultedAt: "2027-01-01",
    nights: null,
    paymentStatus: "payment_pending" as const,
  };
  return [
    { ...base, id: "flight-out", label: "Vuelo ida", amountCents: 12000000, currency: "ARS", unit: "per_person", category: "transport_outbound", certainty: "confirmed", paymentStatus: "paid" },
    { ...base, id: "flight-back", label: "Vuelo vuelta", amountCents: 11000000, currency: "ARS", unit: "per_person", category: "transport_return" },
    { ...base, id: "hotel", label: "Hotel", amountCents: 8000000, currency: "ARS", unit: "per_night", category: "lodging", nights: 6 },
    { ...base, id: "hotel-deposit", label: "Depósito hotel", amountCents: 5000000, currency: "ARS", unit: "total", category: "lodging", refundable: true },
    { ...base, id: "food", label: "Comida", amountCents: 2500000, currency: "ARS", unit: "per_day", category: "food", costType: "variable" },
    { ...base, id: "insurance", label: "Seguro", amountCents: 3000, currency: "USD", unit: "per_person", category: "insurance" },
    { ...base, id: "excursion", label: "Excursión", amountCents: 4000000, currency: "ARS", unit: "per_person", category: "activities", costType: "optional" },
  ];
}

export function barilocheScenarioA(): ScenarioCostInput {
  return {
    travelers: 2,
    tripDays: 7,
    baseCurrency: "ARS",
    budgetCents: 150000000,
    contingencyPct: "10",
    contingencyCategories: ["food", "activities"],
    rateDate: "2027-01-10",
    today: "2027-01-05",
    staleDays: 14,
    rates: [{ from: "USD", to: "ARS", rate: "1000.50", asOf: "2027-01-01", source: "Banco Nación" }],
    items: barilocheItems(),
    coverage: { hasOutbound: true, hasReturn: true, uncoveredNights: 0 },
  };
}

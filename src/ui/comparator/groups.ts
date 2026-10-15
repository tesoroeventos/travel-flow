import type { CostCategory, CostSummary, CostWarning } from "@/domain/costs/types";

/** Grupos para el gráfico (máximo 6 colores categóricos, en orden fijo). */
export const GROUPS = [
  { key: "transport", label: "Transporte", cats: ["transport_outbound", "transport_return", "transport_internal", "parking_tolls", "baggage"] },
  { key: "lodging", label: "Alojamiento", cats: ["lodging"] },
  { key: "food", label: "Alimentación", cats: ["food"] },
  { key: "activities", label: "Actividades", cats: ["activities"] },
  { key: "insurance", label: "Seguros y trámites", cats: ["insurance", "documents_visas"] },
  { key: "other", label: "Otros e imprevistos", cats: ["shopping_personal", "contingency", "other"] },
] as const satisfies readonly { key: string; label: string; cats: readonly CostCategory[] }[];

export function groupTotals(s: CostSummary): { key: string; label: string; cents: number }[] {
  return GROUPS.map((g, i) => ({
    key: g.key,
    label: g.label,
    cents: g.cats.reduce((sum, c) => sum + s.byCategory[c], 0) + (i === GROUPS.length - 1 ? s.contingencyCents : 0),
  }));
}

export function warningText(w: CostWarning, labelOf: (itemId: string) => string, base: string): string {
  switch (w.code) {
    case "missing_outbound_transport":
      return "Falta transporte de ida";
    case "missing_return_transport":
      return "Falta transporte de regreso";
    case "uncovered_nights":
      return `${w.detail} ${w.detail === "1" ? "noche" : "noches"} sin alojamiento`;
    case "missing_exchange_rate":
      return `Incompleto: falta tipo de cambio ${w.detail ?? `→${base}`}`;
    case "stale_price":
      return `Precio consultado hace ${w.detail} días: ${labelOf(w.itemId ?? "")}`;
    case "unknown_taxes":
      return `Sin confirmar si incluye impuestos: ${labelOf(w.itemId ?? "")}`;
  }
}

/** Avisos sin repetir (un solo aviso por par de monedas faltante). */
export function uniqueWarnings(ws: CostWarning[], labelOf: (id: string) => string, base: string): string[] {
  return [...new Set(ws.map((w) => warningText(w, labelOf, base)))];
}

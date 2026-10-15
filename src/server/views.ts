import type { CostSummary } from "@/domain/costs/types";
import type { CostItemView } from "@/ui/CostItemsEditor";
import type { LoadedTrip } from "./services/load-trip";

/** Partidas de un dueño con su importe de línea ya calculado (para mostrar). */
export function costItemViews(data: LoadedTrip, ownerType: string, ownerId: string, summary: CostSummary): CostItemView[] {
  const lines = new Map(summary.lines.map((l) => [l.itemId, l]));
  return data.costItems
    .filter((i) => i.ownerType === ownerType && i.ownerId === ownerId)
    .map((i) => {
      const l = lines.get(i.id);
      return {
        id: i.id,
        label: i.label,
        amountCents: i.amountCents,
        currency: i.currency,
        unit: i.unit,
        quantity: i.quantity,
        category: i.category,
        costType: i.costType,
        refundable: i.refundable,
        source: i.source,
        consultedAt: i.consultedAt,
        includesTaxes: i.includesTaxes,
        certainty: i.certainty,
        isDemo: i.isDemo,
        multiplier: l?.multiplier ?? null,
        lineCents: l?.convertedCents ?? null,
        lineStatus: l?.status ?? null,
        assumptions: i.assumptions ?? null,
      };
    });
}

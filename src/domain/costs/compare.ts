import Decimal from "decimal.js";

export interface ComparisonRow {
  scenarioId: string;
  /** Referencia − escenario (positivo = ahorro) */
  savingCents: number;
  /** Porcentaje con 1 decimal, o null si la referencia es 0 */
  savingPct: string | null;
}

export interface Comparison {
  referenceId: string;
  rows: ComparisonRow[];
}

export function compareScenarios(
  items: { scenarioId: string; totalWithContingencyCents: number }[],
  referenceId?: string,
): Comparison {
  const reference =
    items.find((i) => i.scenarioId === referenceId) ??
    items.reduce<(typeof items)[number] | undefined>(
      (max, i) => (!max || i.totalWithContingencyCents > max.totalWithContingencyCents ? i : max),
      undefined,
    );
  if (!reference) return { referenceId: referenceId ?? "", rows: [] };

  const refTotal = reference.totalWithContingencyCents;
  return {
    referenceId: reference.scenarioId,
    rows: items.map((i) => {
      const saving = refTotal - i.totalWithContingencyCents;
      return {
        scenarioId: i.scenarioId,
        savingCents: saving,
        savingPct: refTotal === 0 ? null : new Decimal(saving).times(100).dividedBy(refTotal).toFixed(1),
      };
    }),
  };
}

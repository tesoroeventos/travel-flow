import type { TripAnalysis } from "@/server/services/trip-analysis";
import { fmtMoney } from "../format";
import { groupTotals, uniqueWarnings } from "./groups";

/** Tabla comparativa de escenarios (también es la vista accesible del gráfico). */
export function ScenarioTable({ a, base, labelOf }: { a: TripAnalysis; base: string; labelOf: (itemId: string) => string }) {
  const savingsById = new Map(a.comparison.rows.map((r) => [r.scenarioId, r]));
  const scoreById = new Map(a.score.scores.map((s) => [s.scenarioId, s.score]));
  const ref = a.scenarios.find((s) => s.id === a.comparison.referenceId);

  type Row = { label: string; cell: (s: (typeof a.scenarios)[number]) => import("react").ReactNode; strong?: boolean };
  const money = (c: number | null) => fmtMoney(c, base);
  const rows: Row[] = [
    { label: "Subtotal", cell: (s) => money(s.summary.totalCents) },
    { label: "Imprevistos", cell: (s) => money(s.summary.contingencyCents) },
    { label: "Total con imprevistos", cell: (s) => money(s.summary.totalWithContingencyCents), strong: true },
    { label: "Por persona", cell: (s) => money(s.summary.perPersonCents) },
    { label: "Por día y persona", cell: (s) => money(s.summary.perPersonPerDayCents) },
    {
      label: "Contra el presupuesto",
      cell: (s) => (
        <span className={s.summary.deviationCents > 0 ? "font-semibold text-alert" : "text-ok"}>
          {s.summary.deviationCents > 0 ? `Excede ${money(s.summary.deviationCents)}` : `Sobran ${money(-s.summary.deviationCents)}`}
        </span>
      ),
    },
    {
      label: ref ? `Ahorro frente a ${ref.name}` : "Ahorro",
      cell: (s) => {
        const r = savingsById.get(s.id);
        if (!r || s.id === a.comparison.referenceId) return "Referencia";
        return `${money(r.savingCents)}${r.savingPct !== null ? ` (${r.savingPct.replace(".", ",")} %)` : ""}`;
      },
    },
    { label: "Confirmado", cell: (s) => money(s.summary.confirmedCents) },
    { label: "Estimado", cell: (s) => money(s.summary.estimatedCents) },
    { label: "Pagado", cell: (s) => money(s.summary.paidCents) },
    { label: "Pendiente de pago", cell: (s) => money(s.summary.pendingCents) },
    { label: "Fijo", cell: (s) => money(s.summary.byCostType.fixed) },
    { label: "Variable", cell: (s) => money(s.summary.byCostType.variable) },
    { label: "Opcional", cell: (s) => money(s.summary.byCostType.optional) },
    { label: "Retenido en depósitos", cell: (s) => money(s.summary.refundableHeldCents) },
    ...(a.scenarios[0] ? groupTotals(a.scenarios[0].summary) : []).map((g, gi) => ({
      label: g.label,
      cell: (s: (typeof a.scenarios)[number]) => money(groupTotals(s.summary)[gi]!.cents),
    })),
    {
      label: "Puntaje",
      cell: (s) => (a.score.recommendedId || a.scenarios.length > 1 ? `${Math.round((scoreById.get(s.id) ?? 0) * 100)} / 100` : "—"),
    },
    {
      label: "Avisos",
      cell: (s) => {
        const ws = uniqueWarnings(s.summary.warnings, labelOf, base);
        return ws.length === 0 ? (
          <span className="text-ink-soft">Sin avisos</span>
        ) : (
          <ul className="space-y-1 text-left">
            {ws.map((w) => (
              <li key={w} className="text-sm">
                {w}
              </li>
            ))}
          </ul>
        );
      },
    },
  ];

  return (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table aria-label="Comparación de escenarios" className="num w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="sticky left-0 w-32 bg-surface px-3 py-2 text-left font-medium text-ink-soft">
                    <span className="sr-only">Concepto</span>
                  </th>
                  {a.scenarios.map((s) => (
                    <th key={s.id} scope="col" className="px-3 py-2 text-right font-display text-lg font-semibold">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-0">
                    <th scope="row" className="sticky left-0 w-32 min-w-32 bg-surface px-3 py-2 text-left font-normal leading-snug text-ink-soft">
                      {r.label}
                    </th>
                    {a.scenarios.map((s) => (
                      <td key={s.id} className={`min-w-36 max-w-56 whitespace-normal px-3 py-2 text-right align-top ${r.strong ? "font-semibold" : ""}`}>
                        {r.cell(s)}
                        {r.strong && s.summary.incomplete ? <div className="text-xs font-normal text-alert">Incompleto: falta tipo de cambio</div> : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
  );
}

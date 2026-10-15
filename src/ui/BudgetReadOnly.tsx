import { CATEGORY_LABELS, COST_CATEGORIES, type CostSummary } from "@/domain/costs/types";
import { fmtMoney } from "./format";

/** Presupuesto de un escenario: por categoría y totales (solo lectura). */
export function BudgetReadOnly({ summary, budgetCents, currency, scenarioName }: { summary: CostSummary; budgetCents: number; currency: string; scenarioName: string }) {
  const m = (c: number | null) => fmtMoney(c, currency);
  const cats = COST_CATEGORIES.filter((c) => summary.byCategory[c] !== 0);
  return (
    <div>
      <p className="text-ink-soft">Escenario: {scenarioName}</p>
      <table className="num mt-2 w-full text-sm">
        <tbody>
          {cats.map((c) => (
            <tr key={c} className="border-b border-line">
              <th scope="row" className="py-1.5 text-left font-normal">
                {CATEGORY_LABELS[c]}
              </th>
              <td className="py-1.5 text-right">{m(summary.byCategory[c])}</td>
            </tr>
          ))}
          <tr className="border-b border-line">
            <th scope="row" className="py-1.5 text-left font-normal">
              Imprevistos
            </th>
            <td className="py-1.5 text-right">{m(summary.contingencyCents)}</td>
          </tr>
          <tr className="border-b-2 border-ink">
            <th scope="row" className="py-1.5 text-left font-semibold">
              Total con imprevistos
            </th>
            <td className="py-1.5 text-right font-semibold">{m(summary.totalWithContingencyCents)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
              Por persona
            </th>
            <td className="py-1.5 text-right">{m(summary.perPersonCents)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
              Presupuesto
            </th>
            <td className="py-1.5 text-right">{m(budgetCents)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
              {summary.deviationCents > 0 ? "Excede" : "Sobran"}
            </th>
            <td className="py-1.5 text-right">{m(Math.abs(summary.deviationCents))}</td>
          </tr>
          {summary.refundableHeldCents > 0 ? (
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
                Retenido en depósitos
              </th>
              <td className="py-1.5 text-right">{m(summary.refundableHeldCents)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {summary.incomplete ? <p className="mt-2 text-sm font-semibold">Total incompleto: falta algún tipo de cambio.</p> : null}
    </div>
  );
}

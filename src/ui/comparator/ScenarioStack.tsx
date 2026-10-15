import { fmtMoney } from "../format";

export interface StackRow {
  id: string;
  name: string;
  totalCents: number;
  incomplete: boolean;
  groups: { key: string; label: string; cents: number }[];
}

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

/** Barras apiladas horizontales: composición del costo por escenario, con marca de presupuesto. */
export function ScenarioStack({ rows, budgetCents, currency }: { rows: StackRow[]; budgetCents: number; currency: string }) {
  const max = Math.max(budgetCents, ...rows.map((r) => r.totalCents), 1);
  const budgetPct = (budgetCents / max) * 100;
  const legend = rows[0]?.groups ?? [];
  return (
    <figure className="rounded-2xl bg-surface shadow-card p-4">
      <figcaption className="font-display text-xl font-semibold">Cómo se reparte el costo</figcaption>
      <p className="text-sm text-ink-soft">Total con imprevistos por escenario. La línea marca el presupuesto.</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Referencias">
        {legend.map((g, i) => (
          <li key={g.key} className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm" style={{ background: SERIES[i] }} aria-hidden />
            {g.label}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{r.name}</span>
              <span className="num">
                {fmtMoney(r.totalCents, currency)}
                {r.incomplete ? " *" : ""}
              </span>
            </div>
            <div className="relative mt-1 h-6">
              <div className="flex h-full gap-[2px]">
                {r.groups
                  .map((g, i) => ({ ...g, color: SERIES[i]! }))
                  .filter((g) => g.cents > 0)
                  .map((g, i, arr) => (
                    <div
                      key={g.key}
                      title={`${g.label}: ${fmtMoney(g.cents, currency)}`}
                      aria-label={`${g.label}: ${fmtMoney(g.cents, currency)}`}
                      className={`h-full hover:opacity-85 ${i === 0 ? "rounded-l" : ""} ${i === arr.length - 1 ? "rounded-r" : ""}`}
                      style={{ width: `${(g.cents / max) * 100}%`, background: g.color }}
                    />
                  ))}
              </div>
              {budgetCents > 0 ? (
                <div className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: `${Math.min(budgetPct, 100)}%` }} aria-hidden />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">Presupuesto: {fmtMoney(budgetCents, currency)}. El detalle de cada valor está en la tabla.</p>
    </figure>
  );
}

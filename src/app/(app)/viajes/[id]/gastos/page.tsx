import { getTripData } from "@/server/queries";
import { expenseReport } from "@/server/services/expenses";
import { deleteExpenseAction } from "@/server/actions/expenses";
import { CATEGORY_LABELS, COST_CATEGORIES } from "@/domain/costs/types";
import { localDate } from "@/domain/time/calendar";
import { Disclosure } from "@/ui/Disclosure";
import { ExpenseForm } from "@/ui/ExpenseForm";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { EmptyState, NoticeBanner } from "@/ui/Feedback";
import { fmtDay, fmtMoney } from "@/ui/format";

export const metadata = { title: "Gastos · TravelFlow" };

export default async function ExpensesPage({ params }: PageProps<"/viajes/[id]/gastos">) {
  const { id } = await params;
  const { db, ctx, data } = await getTripData(id);
  const rep = await expenseReport(db, ctx, id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);
  const start = localDate(trip.startAt.toISOString(), trip.startTz);
  const end = localDate(trip.endAt.toISOString(), trip.endTz);
  const defaultDate = today < start ? start : today > end ? end : today;
  const travelerName = new Map(data.travelers.map((t) => [t.id, t.name]));
  const rows = COST_CATEGORIES.filter((c) => rep.byCategory[c].estimatedCents !== 0 || rep.byCategory[c].actualCents !== 0);
  const expenses = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-semibold">Gastos</h2>

      <section aria-label="Resumen de gastos" className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface shadow-card p-4 md:grid-cols-4">
          <div>
            <dt className="text-sm text-ink-soft">Presupuesto inicial</dt>
            <dd className="num font-display text-2xl font-semibold">{fmtMoney(rep.budgetCents, base)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Estimado final</dt>
            <dd className="num font-display text-2xl font-semibold">{rep.estimatedCents === null ? "Sin elegir" : fmtMoney(rep.estimatedCents, base)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Gastado</dt>
            <dd className="num font-display text-2xl font-semibold">{fmtMoney(rep.actualCents, base)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Disponible</dt>
            <dd className={`num font-display text-2xl font-semibold ${rep.availableCents < 0 ? "text-alert" : ""}`}>{fmtMoney(rep.availableCents, base)}</dd>
          </div>
        </dl>
        {rep.incomplete ? (
          <NoticeBanner>
            Hay gastos sin convertir: {[...new Set(rep.warnings.map((w) => w.detail))].join(", ")}. Cargá el tipo de cambio en Configuración.
          </NoticeBanner>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
            <table aria-label="Desvío por categoría" className="num w-full text-sm">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Categoría
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Estimado
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Real
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Desvío
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const r = rep.byCategory[c];
                  return (
                    <tr key={c} className="border-b border-line last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        {CATEGORY_LABELS[c]}
                      </th>
                      <td className="px-3 py-2 text-right">{fmtMoney(r.estimatedCents, base)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(r.actualCents, base)}</td>
                      <td className={`px-3 py-2 text-right ${r.deviationCents > 0 ? "font-semibold text-alert" : "text-ink-soft"}`}>
                        {r.deviationCents > 0 ? "+" : ""}
                        {fmtMoney(r.deviationCents, base)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <Disclosure label="Agregar gasto" variant="primary">
        <ExpenseForm tripId={id} expense={null} travelers={data.travelers} baseCurrency={base} defaultDate={defaultDate} />
      </Disclosure>

      {expenses.length === 0 ? (
        <EmptyState title="Sin gastos registrados">Durante el viaje, cargá cada gasto en la moneda en que lo pagaste. Se convierte con el tipo de cambio vigente a esa fecha.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
          {expenses.map((x) => (
            <li key={x.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{x.description}</p>
                  <p className="text-sm text-ink-soft">
                    {fmtDay(x.date)}, {CATEGORY_LABELS[x.category]}
                    {x.paidByTravelerId ? `, pagó ${travelerName.get(x.paidByTravelerId) ?? "—"}` : ""}
                    {x.paymentStatus === "payment_pending" ? ", pendiente" : ""}
                  </p>
                </div>
                <p className="num shrink-0 font-semibold">{fmtMoney(x.amountCents, x.currency)}</p>
              </div>
              <div className="mt-1 flex gap-2">
                <Disclosure label="Editar" variant="ghost" className="w-full">
                  <ExpenseForm tripId={id} expense={x} travelers={data.travelers} baseCurrency={base} defaultDate={defaultDate} />
                </Disclosure>
                <ConfirmButton variant="ghost" action={deleteExpenseAction.bind(null, id, x.id)} label="Quitar" confirm={`¿Quitar "${x.description}"?`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

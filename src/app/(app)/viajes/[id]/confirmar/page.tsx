import { getTripAnalysis, getTripData } from "@/server/queries";
import { selectedOf } from "@/server/services/trip-analysis";
import { optionCost } from "@/server/services/option-costs";
import { LEG_LABELS, MODE_LABELS } from "@/server/validation/options";
import { ChooseScenario } from "@/ui/ChooseScenario";
import { BookingRow } from "@/ui/BookingRow";
import { EmptyState, NoticeBanner } from "@/ui/Feedback";
import { LinkButton } from "@/ui/Button";
import { fmtMoney } from "@/ui/format";

export const metadata = { title: "Confirmar mi viaje · TravelFlow" };

export default async function ConfirmPage({ params }: PageProps<"/viajes/[id]/confirmar">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const a = await getTripAnalysis(id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const chosen = a.scenarios.find((s) => s.id === trip.chosenScenarioId);

  if (a.scenarios.length === 0) {
    return (
      <main className="px-4 py-6 md:px-0">
        <h2 className="font-display text-3xl font-semibold">Confirmar mi viaje</h2>
        <div className="mt-4">
          <EmptyState
            title="Primero armá escenarios"
            action={<LinkButton href={`/viajes/${id}/comparador`}>Ir al comparador</LinkButton>}
          >
            Para confirmar, combiná transporte y alojamiento en al menos un escenario.
          </EmptyState>
        </div>
      </main>
    );
  }

  const elements = chosen
    ? (() => {
        const sel = selectedOf(data, chosen.id);
        return [
          ...sel.transport.map((t) => ({
            ownerType: "transport_option" as const,
            id: t.id,
            group: `Transporte de ${LEG_LABELS[t.leg].toLowerCase()}`,
            name: `${t.provider || MODE_LABELS[t.mode]} (${t.fromLabel} → ${t.toLabel})`,
          })),
          ...sel.lodging.map((l) => ({
            ownerType: "lodging_option" as const,
            id: l.id,
            group: "Alojamiento",
            name: l.name,
          })),
          ...sel.activities.map((x) => ({
            ownerType: "activity" as const,
            id: x.id,
            group: "Actividad",
            name: x.name,
          })),
        ];
      })()
    : [];

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-semibold">Confirmar mi viaje</h2>

      <section className="space-y-3">
        <h3 className="font-display text-xl font-semibold">{chosen ? "Escenario elegido" : "Elegí el escenario"}</h3>
        <ChooseScenario
          tripId={id}
          scenarios={a.scenarios.map((s) => ({
            id: s.id,
            name: s.name,
            totalCents: s.summary.totalWithContingencyCents,
            incomplete: s.summary.incomplete,
          }))}
          chosenId={trip.chosenScenarioId}
          recommendedId={a.scenarios.length > 1 ? a.score.recommendedId : null}
          currency={base}
        />
      </section>

      {chosen ? (
        <section aria-label="Resumen final" className="space-y-4">
          <h3 className="font-display text-2xl font-semibold">Resumen final</h3>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface shadow-card p-4 md:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-soft">Presupuesto definitivo</dt>
              <dd className="num font-display text-xl font-bold whitespace-nowrap sm:text-2xl">
                {fmtMoney(chosen.summary.totalWithContingencyCents, base)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Presupuesto inicial</dt>
              <dd className="num font-display text-xl font-bold whitespace-nowrap sm:text-2xl">
                {fmtMoney(trip.budgetCents, base)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Pagado</dt>
              <dd className="num font-display text-xl font-bold whitespace-nowrap sm:text-2xl">
                {fmtMoney(chosen.summary.paidCents, base)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Pendiente de pago</dt>
              <dd className="num font-display text-xl font-bold whitespace-nowrap sm:text-2xl">
                {fmtMoney(chosen.summary.pendingCents, base)}
              </dd>
            </div>
          </dl>
          {chosen.summary.incomplete ? (
            <NoticeBanner>El total está incompleto: falta algún tipo de cambio.</NoticeBanner>
          ) : null}

          <NoticeBanner>
            TravelFlow no hace reservas ni pagos. Marcá cada estado cuando reserves o pagues por tu cuenta.
          </NoticeBanner>

          <ul className="space-y-3">
            {elements.map((e) => {
              const booking = data.bookings.find((b) => b.ownerType === e.ownerType && b.ownerId === e.id);
              const cost = optionCost(data, e.ownerType, e.id);
              return (
                <li key={e.id} className="rounded-2xl bg-surface shadow-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-soft">{e.group}</p>
                      <p className="font-semibold">{e.name}</p>
                    </div>
                    <p className="num shrink-0 font-semibold">
                      {cost.itemCount ? fmtMoney(cost.totalCents, base) : "Sin costo"}
                    </p>
                  </div>
                  {booking ? (
                    <BookingRow tripId={id} booking={booking} />
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">
                      Volvé a elegir el escenario para registrar esta alternativa.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <LinkButton href={`/viajes/${id}/itinerario`}>Generar itinerario</LinkButton>
        </section>
      ) : null}
    </main>
  );
}

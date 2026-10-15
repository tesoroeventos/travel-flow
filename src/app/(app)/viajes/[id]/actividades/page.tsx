import { getTripData } from "@/server/queries";
import { optionCost } from "@/server/services/option-costs";
import { costItemViews } from "@/server/views";
import { deleteOptionAction } from "@/server/actions/options";
import { localDate } from "@/domain/time/calendar";
import { Disclosure } from "@/ui/Disclosure";
import { ActivityForm } from "@/ui/ActivityForm";
import { CostItemsEditor } from "@/ui/CostItemsEditor";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { EmptyState } from "@/ui/Feedback";
import { fmtDayLong, fmtDuration, fmtMoney } from "@/ui/format";

export const metadata = { title: "Actividades · TravelFlow" };

export default async function ActivitiesPage({ params }: PageProps<"/viajes/[id]/actividades">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const startDate = localDate(trip.startAt.toISOString(), trip.startTz);
  const byDate = new Map<string, typeof data.activities>();
  for (const a of [...data.activities].sort((x, y) => x.date.localeCompare(y.date) || (x.startTime ?? "99").localeCompare(y.startTime ?? "99"))) {
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  }

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-semibold">Actividades</h2>
      <p className="max-w-prose text-ink-soft">Cargá lo que querés hacer. En cada escenario elegís cuáles entran; las elegidas pasan al itinerario.</p>
      <Disclosure label="Agregar actividad" variant="primary">
        <ActivityForm tripId={id} option={null} defaultDate={startDate} baseCurrency={base} />
      </Disclosure>
      {data.activities.length === 0 ? (
        <EmptyState title="Sin actividades">Excursiones, entradas, restaurantes con reserva: todo lo que tenga horario o costo.</EmptyState>
      ) : (
        [...byDate.entries()].map(([date, list]) => (
          <section key={date} className="space-y-3">
            <h3 className="font-display text-2xl font-semibold">{fmtDayLong(date)}</h3>
            {list.map((a) => {
              const cost = optionCost(data, "activity", a.id);
              return (
                <article key={a.id} className="rounded-lg border border-line bg-surface p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-display text-xl font-semibold leading-tight">{a.name}</h4>
                      <p className="text-sm text-ink-soft">
                        {a.startTime ? `${a.startTime}, ` : ""}
                        {fmtDuration(a.durationMin)}
                        {a.requiresBooking ? ", requiere reserva" : ""}
                        {a.fixedTime ? ", horario fijo" : ""}
                      </p>
                      {a.address ? <p className="text-sm text-ink-soft">{a.address}</p> : null}
                    </div>
                    <p className="num shrink-0 font-display text-2xl font-semibold">{cost.itemCount ? fmtMoney(cost.totalCents, base) : "Sin costo"}</p>
                  </header>
                  <div className="mt-3">
                    <CostItemsEditor tripId={id} owner={{ ownerType: "activity", ownerId: a.id }} items={costItemViews(data, "activity", a.id, cost.summary)} baseCurrency={base} defaultCategory="activities" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Disclosure label="Editar actividad" variant="ghost" className="w-full">
                      <ActivityForm tripId={id} option={a} defaultDate={startDate} baseCurrency={base} />
                    </Disclosure>
                    <ConfirmButton variant="ghost" action={deleteOptionAction.bind(null, id, "activity", a.id)} label="Borrar actividad" confirm="¿Borrar esta actividad y sus costos?" />
                  </div>
                </article>
              );
            })}
          </section>
        ))
      )}
    </main>
  );
}

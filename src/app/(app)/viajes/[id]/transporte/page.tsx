import Link from "next/link";
import { getTripData } from "@/server/queries";
import { optionCost } from "@/server/services/option-costs";
import { costItemViews } from "@/server/views";
import { deleteOptionAction } from "@/server/actions/options";
import { LEG_LABELS, MODE_LABELS } from "@/server/validation/options";
import { localDate, localTime, minutesBetween } from "@/domain/time/calendar";
import type { CostCategory } from "@/domain/costs/types";
import { Disclosure } from "@/ui/Disclosure";
import { TransportForm } from "@/ui/TransportForm";
import { CarCalculator } from "@/ui/CarCalculator";
import { CostItemsEditor } from "@/ui/CostItemsEditor";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { EmptyState } from "@/ui/Feedback";
import { fmtDay, fmtDuration, fmtMoney } from "@/ui/format";
import { sortTransport, TRANSPORT_SORT_LABELS, type TransportSort } from "@/ui/sort";

export const metadata = { title: "Transporte · TravelFlow" };

const SORTS = Object.keys(TRANSPORT_SORT_LABELS) as TransportSort[];

export default async function TransportPage({ params, searchParams }: PageProps<"/viajes/[id]/transporte">) {
  const { id } = await params;
  const { orden } = await searchParams;
  const sort: TransportSort = SORTS.includes(orden as TransportSort) ? (orden as TransportSort) : "price";
  const { data } = await getTripData(id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const startDate = localDate(trip.startAt.toISOString(), trip.startTz);

  const rows = data.transport.map((o) => {
    const cost = optionCost(data, "transport_option", o.id);
    const segs = [...o.segments].sort((a, b) => a.departUtc.localeCompare(b.departUtc));
    const first = segs[0];
    const last = segs[segs.length - 1];
    const durationMin = first && last ? minutesBetween(first.departUtc, last.arriveUtc) : null;
    return {
      o,
      cost,
      segs,
      id: o.id,
      totalCents: cost.itemCount > 0 ? cost.totalCents : null,
      durationMin,
      transfers: segs.length > 0 ? segs.length - 1 : null,
      comfort: o.comfortRating,
    };
  });

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold">Transporte</h2>
      </div>
      <p className="max-w-prose text-ink-soft">
        Cargá cada forma posible de ir, volver y moverte allá. Sumá todos los costos: pasaje, equipaje, traslados a la terminal, combustible o peajes. Así el
        comparador mide el costo puerta a puerta.
      </p>

      <Disclosure label="Agregar transporte" variant="primary">
        <TransportForm tripId={id} option={null} startTz={trip.startTz} endTz={trip.endTz} defaultDate={startDate} baseCurrency={base} />
      </Disclosure>

      {rows.length === 0 ? (
        <EmptyState title="Sin alternativas de transporte">Agregá al menos una forma de ir y otra de volver.</EmptyState>
      ) : (
        <>
          <nav aria-label="Ordenar" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex min-w-max gap-2">
              {SORTS.map((s) => (
                <li key={s}>
                  <Link
                    href={`?orden=${s}`}
                    scroll={false}
                    aria-current={s === sort ? "true" : undefined}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${
                      s === sort ? "border-route bg-route-soft font-semibold" : "border-line text-ink-soft"
                    }`}
                  >
                    {TRANSPORT_SORT_LABELS[s]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {(["outbound", "return", "internal"] as const).map((leg) => {
            const list = sortTransport(
              rows.filter((r) => r.o.leg === leg),
              sort,
            );
            if (list.length === 0) return null;
            return (
              <section key={leg} className="space-y-3">
                <h3 className="font-display text-2xl font-semibold">{LEG_LABELS[leg]}</h3>
                {list.map(({ o, cost, segs, durationMin }) => (
                  <article key={o.id} className="rounded-lg border border-line bg-surface p-4">
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink-soft">{MODE_LABELS[o.mode]}</p>
                        <h4 className="font-display text-xl font-semibold leading-tight">
                          {o.provider || MODE_LABELS[o.mode]} {o.serviceNumber ? <span className="font-normal text-ink-soft">{o.serviceNumber}</span> : null}
                        </h4>
                        <p className="mt-1">
                          {o.fromLabel} → {o.toLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm text-ink-soft">Total del grupo</p>
                        <p className="num font-display text-2xl font-semibold">{cost.itemCount ? fmtMoney(cost.totalCents, base) : "Sin precio"}</p>
                        {cost.itemCount && cost.perPersonCents !== null ? <p className="num text-sm text-ink-soft">{fmtMoney(cost.perPersonCents, base)} por persona</p> : null}
                      </div>
                    </header>

                    {segs.length > 0 ? (
                      <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
                        <p className="num">
                          {fmtDay(localDate(segs[0]!.departUtc, segs[0]!.departTz))}, {localTime(segs[0]!.departUtc, segs[0]!.departTz)} →{" "}
                          {fmtDay(localDate(segs[segs.length - 1]!.arriveUtc, segs[segs.length - 1]!.arriveTz))}, {localTime(segs[segs.length - 1]!.arriveUtc, segs[segs.length - 1]!.arriveTz)}
                        </p>
                        <p className="text-ink-soft">
                          {durationMin !== null ? fmtDuration(durationMin) : ""}
                          {segs.length === 1 ? ", directo" : `, ${segs.length - 1} ${segs.length === 2 ? "escala" : "escalas"} (${segs.slice(1).map((s) => s.from).join(", ")})`}
                        </p>
                      </div>
                    ) : null}

                    {cost.refundableHeldCents > 0 ? <p className="mt-2 text-sm text-ink-soft">Retenido en depósitos: {fmtMoney(cost.refundableHeldCents, base)}</p> : null}

                    <div className="mt-3">
                      <CostItemsEditor
                        tripId={id}
                        owner={{ ownerType: "transport_option", ownerId: o.id }}
                        items={costItemViews(data, "transport_option", o.id, cost.summary)}
                        baseCurrency={base}
                        defaultCategory={`transport_${o.leg}` as CostCategory}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                      {o.mode === "own_car" || o.mode === "rental_car" ? (
                        <Disclosure label="Calcular costo del auto" className="w-full">
                          <CarCalculator tripId={id} optionId={o.id} rental={o.mode === "rental_car"} />
                        </Disclosure>
                      ) : null}
                      <Disclosure label="Editar alternativa" variant="ghost" className="w-full">
                        <TransportForm
                          tripId={id}
                          option={{ ...o, segments: o.segments }}
                          startTz={trip.startTz}
                          endTz={trip.endTz}
                          defaultDate={startDate}
                          baseCurrency={base}
                        />
                      </Disclosure>
                      <ConfirmButton
                        variant="ghost"
                        action={deleteOptionAction.bind(null, id, "transport_option", o.id)}
                        label="Borrar alternativa"
                        confirm="¿Borrar esta alternativa, sus costos y su uso en escenarios?"
                      />
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}

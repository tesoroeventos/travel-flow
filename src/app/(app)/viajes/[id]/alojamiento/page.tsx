import Link from "next/link";
import { getTripData } from "@/server/queries";
import { optionCost } from "@/server/services/option-costs";
import { lodgingNights } from "@/server/services/trip-analysis";
import { costItemViews } from "@/server/views";
import { deleteOptionAction } from "@/server/actions/options";
import { AMENITIES, AMENITY_LABELS, LODGING_KIND_LABELS } from "@/server/validation/options";
import { localDate } from "@/domain/time/calendar";
import { Disclosure } from "@/ui/Disclosure";
import { LodgingForm } from "@/ui/LodgingForm";
import { CostItemsEditor } from "@/ui/CostItemsEditor";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { EmptyState } from "@/ui/Feedback";
import { fmtDay, fmtMoney, plural } from "@/ui/format";

export const metadata = { title: "Alojamiento · TravelFlow" };

type Sort = "total" | "night" | "distance" | "quality";
const SORT_LABELS: Record<Sort, string> = { total: "Menor total", night: "Menor por noche", distance: "Más cerca del centro", quality: "Mejor calidad" };

export default async function LodgingPage({ params, searchParams }: PageProps<"/viajes/[id]/alojamiento">) {
  const { id } = await params;
  const sp = await searchParams;
  const sort: Sort = (Object.keys(SORT_LABELS) as Sort[]).includes(sp.orden as Sort) ? (sp.orden as Sort) : "total";
  const want = typeof sp.servicio === "string" ? sp.servicio : null;
  const minCap = Number(typeof sp.capacidad === "string" ? sp.capacidad : 0) || 0;

  const { data } = await getTripData(id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const tripStart = localDate(trip.startAt.toISOString(), trip.startTz);
  const tripEnd = localDate(trip.endAt.toISOString(), trip.endTz);

  const rows = data.lodging
    .filter((l) => (want ? l.amenities.includes(want) : true))
    .filter((l) => (minCap ? (l.capacity ?? 0) >= minCap : true))
    .map((l) => {
      const cost = optionCost(data, "lodging_option", l.id);
      const n = lodgingNights(l);
      return { l, cost, nights: n, perNight: cost.itemCount && n ? Math.round(cost.totalCents / n) : null };
    })
    .sort((a, b) => {
      const k = (r: (typeof a)) =>
        sort === "total" ? (r.cost.itemCount ? r.cost.totalCents : null) : sort === "night" ? r.perNight : sort === "distance" ? r.l.distanceCenterKm : r.l.qualityRating === null ? null : -r.l.qualityRating;
      const ka = k(a);
      const kb = k(b);
      if (ka === null) return kb === null ? 0 : 1;
      if (kb === null) return -1;
      return ka - kb;
    });

  const q = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { orden: sort, servicio: want, capacidad: minCap ? String(minCap) : null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-semibold">Alojamiento</h2>
      <p className="max-w-prose text-ink-soft">
        Sumá el precio por noche, impuestos, limpieza y cargos. Los depósitos reembolsables se muestran aparte porque no son gasto.
      </p>

      <Disclosure label="Agregar alojamiento" variant="primary">
        <LodgingForm tripId={id} option={null} tz={trip.endTz} tripStart={tripStart} tripEnd={tripEnd} baseCurrency={base} />
      </Disclosure>

      {data.lodging.length > 0 ? (
        <div className="space-y-2">
          <nav aria-label="Ordenar alojamientos" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex min-w-max gap-2">
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <li key={s}>
                  <Link href={q({ orden: s })} scroll={false} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${s === sort ? "border-route bg-route-soft font-semibold" : "border-line text-ink-soft"}`}>
                    {SORT_LABELS[s]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Filtrar por servicio" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex min-w-max gap-2">
              <li>
                <Link href={q({ servicio: null })} scroll={false} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${!want ? "border-route bg-route-soft font-semibold" : "border-line text-ink-soft"}`}>
                  Todos
                </Link>
              </li>
              {AMENITIES.map((a) => (
                <li key={a}>
                  <Link href={q({ servicio: a })} scroll={false} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${want === a ? "border-route bg-route-soft font-semibold" : "border-line text-ink-soft"}`}>
                    {AMENITY_LABELS[a]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <form className="flex items-end gap-2">
            <input type="hidden" name="orden" value={sort} />
            {want ? <input type="hidden" name="servicio" value={want} /> : null}
            <label className="text-sm">
              Capacidad mínima
              <input name="capacidad" type="number" min={0} defaultValue={minCap || ""} className="ml-2 w-20 rounded-md border border-line bg-surface px-2 py-1.5" />
            </label>
            <button className="min-h-9 rounded-md border border-line px-3 text-sm">Filtrar</button>
          </form>
        </div>
      ) : null}

      {data.lodging.length === 0 ? (
        <EmptyState title="Sin alternativas de alojamiento">Agregá las opciones que estás evaluando: hoteles, departamentos, cabañas…</EmptyState>
      ) : rows.length === 0 ? (
        <p className="text-ink-soft">Ningún alojamiento cumple el filtro.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ l, cost, nights, perNight }) => (
            <article key={l.id} className="rounded-lg border border-line bg-surface p-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft">{LODGING_KIND_LABELS[l.kind]}</p>
                  <h3 className="font-display text-xl font-semibold leading-tight">{l.name}</h3>
                  {l.address ? <p className="text-sm text-ink-soft">{l.address}</p> : null}
                  <p className="mt-1 text-sm">
                    {fmtDay(localDate(l.checkInAt.toISOString(), l.tz))} → {fmtDay(localDate(l.checkOutAt.toISOString(), l.tz))}
                    {nights ? `, ${plural(nights, "noche", "noches")}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-ink-soft">Total estadía</p>
                  <p className="num font-display text-2xl font-semibold">{cost.itemCount ? fmtMoney(cost.totalCents, base) : "Sin precio"}</p>
                  {cost.itemCount && cost.perPersonCents !== null ? <p className="num text-sm text-ink-soft">Por persona {fmtMoney(cost.perPersonCents, base)}</p> : null}
                  {perNight !== null ? <p className="num text-sm text-ink-soft">{fmtMoney(perNight, base)} por noche</p> : null}
                </div>
              </header>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {l.amenities.map((a) => (
                  <span key={a} className="rounded bg-surface-2 px-1.5 py-0.5">
                    {AMENITY_LABELS[a as keyof typeof AMENITY_LABELS] ?? a}
                  </span>
                ))}
                {l.distanceCenterKm !== null ? <span className="rounded bg-surface-2 px-1.5 py-0.5">{String(l.distanceCenterKm).replace(".", ",")} km del centro</span> : null}
                {l.rating ? <span className="rounded bg-surface-2 px-1.5 py-0.5">Calificación {l.rating.replace(".", ",")}{l.reviewCount ? ` (${l.reviewCount} opiniones)` : ""}</span> : null}
                {l.flexibleCancellation ? <span className="rounded bg-route-soft px-1.5 py-0.5">Cancelación flexible</span> : null}
              </div>
              {cost.refundableHeldCents > 0 ? <p className="mt-2 text-sm text-ink-soft">Retenido en depósitos (se devuelve): {fmtMoney(cost.refundableHeldCents, base)}</p> : null}
              <div className="mt-3">
                <CostItemsEditor tripId={id} owner={{ ownerType: "lodging_option", ownerId: l.id }} items={costItemViews(data, "lodging_option", l.id, cost.summary)} baseCurrency={base} defaultCategory="lodging" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Disclosure label="Editar alternativa" variant="ghost" className="w-full">
                  <LodgingForm
                    tripId={id}
                    option={{ ...l, checkInAt: l.checkInAt.toISOString(), checkOutAt: l.checkOutAt.toISOString() }}
                    tz={l.tz}
                    tripStart={tripStart}
                    tripEnd={tripEnd}
                    baseCurrency={base}
                  />
                </Disclosure>
                <ConfirmButton variant="ghost" action={deleteOptionAction.bind(null, id, "lodging_option", l.id)} label="Borrar alternativa" confirm="¿Borrar este alojamiento, sus costos y su uso en escenarios?" />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

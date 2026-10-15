import Link from "next/link";
import { getTripData } from "@/server/queries";
import { deleteTripAction, renameTravelerAction } from "@/server/actions/trips";
import { TRIP_TYPE_LABELS } from "@/server/validation/trip";
import { fmtMoney } from "@/ui/format";
import { LinkButton } from "@/ui/Button";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { PREF_VALUE_LABELS } from "@/ui/labels";
import { createShareLinkAction, duplicateTripAction, revokeShareLinkAction } from "@/server/actions/share";
import { CopyLink } from "@/ui/CopyLink";

export const metadata = { title: "Resumen del viaje · TravelFlow" };

const KIND = { adult: "Adulto", child: "Niño", infant: "Bebé" } as const;
const PREF_LABELS: Record<string, string> = {
  budgetLevel: "Nivel de gasto",
  priority: "Prioridad",
  pace: "Ritmo",
  interests: "Intereses",
  transportPreference: "Transporte preferido",
  lodgingCategory: "Alojamiento",
  lodgingLocation: "Ubicación del alojamiento",
  luggage: "Equipaje",
  accessibility: "Accesibilidad",
  dietary: "Alimentación",
  otherNeeds: "Otras necesidades",
  noTravelHours: "No viajar",
  maxLegHours: "Trayecto máximo (h)",
  maxPerNight: "Máximo por noche",
  maxStops: "Escalas máximas",
  maxDistanceKm: "Distancia máxima (km)",
  needsParking: "Estacionamiento",
  needsPublicTransport: "Transporte público",
  mandatoryActivities: "Actividades obligatorias",
};

function show(key: string, v: unknown): string | null {
  if (v === null || v === undefined || v === "" || v === false) return null;
  if (v === true) return "Sí";
  const label = (x: unknown) => PREF_VALUE_LABELS[key]?.[String(x)] ?? String(x);
  if (Array.isArray(v)) return v.length ? v.map(label).join(", ") : null;
  return label(v);
}

function Facts({ obj }: { obj: Record<string, unknown> }) {
  const rows = Object.entries(obj)
    .map(([k, v]) => [PREF_LABELS[k] ?? k, show(k, v)] as const)
    .filter(([, v]) => v !== null);
  if (rows.length === 0) return <p className="text-ink-soft">Sin datos cargados.</p>;
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function TripSummaryPage({ params }: PageProps<"/viajes/[id]">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const { trip, travelers } = data;
  const hasOptions = data.transport.length + data.lodging.length > 0;

  return (
    <main className="space-y-4 px-4 py-6 md:px-0">
      {!hasOptions ? (
        <section className="rounded-2xl border border-route/40 bg-route-soft p-4">
          <h2 className="font-display text-xl font-semibold">Siguiente paso: cargá alternativas</h2>
          <p className="mt-1">Sumá opciones de transporte y alojamiento con sus costos. Después las combinás en escenarios para compararlas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href={`/viajes/${id}/transporte`}>Cargar transporte</LinkButton>
            <LinkButton href={`/viajes/${id}/alojamiento`} variant="secondary">
              Cargar alojamiento
            </LinkButton>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-surface shadow-card p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Ficha del viaje</h2>
          <Link href={`/viajes/${id}/editar`} className="min-h-11 font-semibold text-route underline">
            Editar datos
          </Link>
        </div>
        <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-soft">Presupuesto</dt>
          <dd className="num font-semibold">{fmtMoney(trip.budgetCents, trip.baseCurrency)}</dd>
          <dt className="text-ink-soft">Tipo</dt>
          <dd>{TRIP_TYPE_LABELS[trip.tripType as keyof typeof TRIP_TYPE_LABELS] ?? trip.tripType}</dd>
          <dt className="text-ink-soft">Habitaciones</dt>
          <dd>{trip.rooms}</dd>
          {trip.flexibilityDays > 0 ? (
            <>
              <dt className="text-ink-soft">Flexibilidad</dt>
              <dd>± {trip.flexibilityDays} días</dd>
            </>
          ) : null}
          {trip.alternativeDestinations.length > 0 ? (
            <>
              <dt className="text-ink-soft">Alternativas</dt>
              <dd>{trip.alternativeDestinations.join(", ")}</dd>
            </>
          ) : null}
          {trip.homeLabel ? (
            <>
              <dt className="text-ink-soft">Partida</dt>
              <dd>{trip.homeLabel}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl bg-surface shadow-card p-4">
        <h2 className="font-display text-xl font-semibold">Viajeros</h2>
        <ul className="mt-2 divide-y divide-line">
          {travelers.map((t) => (
            <li key={t.id} className="py-2">
              <form action={renameTravelerAction.bind(null, t.id)} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-ink-soft">{KIND[t.kind]}</span>
                <input
                  name="name"
                  defaultValue={t.name}
                  aria-label={`Nombre de ${t.name}`}
                  className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 hover:border-line focus:border-route"
                />
                <button type="submit" className="min-h-11 px-2 text-sm font-semibold text-route">
                  Guardar
                </button>
              </form>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">Para cambiar la cantidad de viajeros, editá los datos del viaje.</p>
      </section>

      <section className="rounded-2xl bg-surface shadow-card p-4">
        <h2 className="font-display text-xl font-semibold">Preferencias</h2>
        <div className="mt-2">
          <Facts obj={trip.preferences} />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Restricciones</h2>
        <div className="mt-2">
          <Facts obj={trip.constraints} />
        </div>
      </section>

      <section className="rounded-2xl bg-surface shadow-card p-4">
        <h2 className="font-display text-xl font-semibold">Compartir</h2>
        {trip.publicShareToken ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">Cualquiera con el enlace puede ver el viaje, sin editarlo.</p>
            <CopyLink path={`/share/${trip.publicShareToken}`} />
            <form action={revokeShareLinkAction.bind(null, id)} className="mt-2">
              <button className="min-h-11 font-semibold text-alert">Dejar de compartir</button>
            </form>
          </>
        ) : (
          <form action={createShareLinkAction.bind(null, id)} className="mt-2">
            <p className="text-sm text-ink-soft">Creá un enlace de solo lectura para mostrar escenarios e itinerario.</p>
            <button className="mt-2 min-h-11 rounded-xl border border-line-strong px-4 font-semibold hover:border-route">Crear enlace para compartir</button>
          </form>
        )}
      </section>

      <section className="flex flex-wrap gap-2 pt-2">
        <form action={duplicateTripAction.bind(null, id)}>
          <button className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold hover:border-route">Duplicar viaje</button>
        </form>
        <ConfirmButton action={deleteTripAction.bind(null, id)} label="Borrar viaje" confirm="¿Borrar este viaje y todo lo cargado? No se puede deshacer." />
      </section>
    </main>
  );
}

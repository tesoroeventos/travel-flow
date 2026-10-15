import Link from "next/link";
import { getTripAnalysis, getTripData } from "@/server/queries";
import { viewItinerary } from "@/server/services/itinerary-snapshot";
import { EmptyState } from "@/ui/Feedback";
import { LinkButton } from "@/ui/Button";
import { ItineraryView } from "@/ui/itinerary/ItineraryView";
import { ChangesBanner } from "@/ui/itinerary/ChangesBanner";

export const metadata = { title: "Itinerario · TravelFlow" };

export default async function ItineraryPage({ params, searchParams }: PageProps<"/viajes/[id]/itinerario">) {
  const { id } = await params;
  const { vista } = await searchParams;
  const view = vista === "dia" ? "day" : "chrono";
  const { db, ctx, data } = await getTripData(id);
  const result = await viewItinerary(db, ctx, id);

  if (!result) {
    return (
      <main className="px-4 py-6 md:px-0">
        <h2 className="font-display text-3xl font-semibold">Itinerario</h2>
        <div className="mt-4">
          <EmptyState title="Elegí un escenario para generar el itinerario" action={<LinkButton href={`/viajes/${id}/confirmar`}>Ir a Confirmar</LinkButton>}>
            El itinerario se arma con el transporte, el alojamiento y las actividades del escenario elegido.
          </EmptyState>
        </div>
      </main>
    );
  }

  const a = await getTripAnalysis(id);
  const chosen = a.scenarios.find((s) => s.id === data.trip.chosenScenarioId);
  const { itinerary, diff } = result;
  const titleOf = new Map(itinerary.days.flatMap((d) => d.entries).map((e) => [e.key, e.title]));
  const uniq = (keys: string[]) => [...new Set(keys.map((k) => titleOf.get(k)).filter((t): t is string => !!t))];

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold">Itinerario</h2>
        <nav aria-label="Vista" className="flex gap-1 rounded-md border border-line bg-surface p-1">
          {(
            [
              ["chrono", "Cronológica", "?"],
              ["day", "Por día", "?vista=dia"],
            ] as const
          ).map(([v, label, href]) => (
            <Link key={v} href={href} aria-current={view === v ? "page" : undefined} className={`rounded px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-route text-route-ink" : "text-ink-soft"}`}>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <a href={`/viajes/${id}/exportar/itinerario.ics`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-semibold hover:border-route">
          Agregar al calendario (.ics)
        </a>
        <a href={`/viajes/${id}/exportar/presupuesto.csv`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-semibold hover:border-route">
          Descargar presupuesto (CSV)
        </a>
        <Link href={`/viajes/${id}/imprimir`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-semibold hover:border-route">
          Imprimir o guardar PDF
        </Link>
      </div>

      {diff ? <ChangesBanner tripId={id} changed={uniq(diff.changed)} added={uniq(diff.added)} removedCount={diff.removed.length} /> : null}

      {itinerary.alerts.length > 0 ? (
        <p className="rounded-md border border-signal/50 bg-signal-soft px-3 py-2 text-sm">
          Hay {itinerary.alerts.length === 1 ? "1 alerta" : `${itinerary.alerts.length} alertas`} en el itinerario: revisá las marcas en amarillo.
        </p>
      ) : null}

      <ItineraryView
        tripId={id}
        itinerary={itinerary}
        view={view}
        tripTz={data.trip.startTz}
        currency={data.trip.baseCurrency}
        pendingCents={chosen?.summary.pendingCents ?? 0}
      />
    </main>
  );
}

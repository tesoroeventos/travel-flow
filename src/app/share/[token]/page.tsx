import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { loadSharedTrip } from "@/server/services/demo";
import { itineraryFromLoaded } from "@/server/services/trip-analysis";
import { duplicateSharedAction } from "@/server/actions/share";
import { localDate } from "@/domain/time/calendar";
import { DemoBanner } from "@/ui/Feedback";
import { RouteStrip } from "@/ui/RouteStrip";
import { ScenarioTable } from "@/ui/comparator/ScenarioTable";
import { ScenarioStack } from "@/ui/comparator/ScenarioStack";
import { groupTotals } from "@/ui/comparator/groups";
import { ItineraryReadOnly } from "@/ui/itinerary/ItineraryReadOnly";
import { SubmitButton } from "@/ui/Button";
import { fmtRange, plural } from "@/ui/format";

export const metadata = { title: "Viaje compartido · TravelFlow", robots: { index: false } };

export default async function SharedTripPage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const shared = await loadSharedTrip(await getDb(), token);
  if (!shared) notFound();
  const { data, analysis: a } = shared;
  const { trip } = data;
  const itinerary = itineraryFromLoaded(data);
  const chosen = a.scenarios.find((s) => s.id === trip.chosenScenarioId);
  const labelOf = (id: string) => data.costItems.find((i) => i.id === id)?.label ?? "";

  return (
    <div className="min-h-dvh">
      {trip.isDemo ? <DemoBanner /> : null}
      <div className="mx-auto max-w-4xl px-4 pb-16">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight text-route">
            TravelFlow
          </Link>
          <span className="text-sm text-ink-soft">Solo lectura</span>
        </header>

        <h1 className="mt-4 font-display text-4xl font-bold leading-none tracking-tight">{trip.name}</h1>
        <RouteStrip points={[trip.originLabel, ...data.stops.map((s) => s.label), trip.destinationLabel]} />
        <p className="mt-3 text-ink-soft">
          {fmtRange(localDate(trip.startAt.toISOString(), trip.startTz), localDate(trip.endAt.toISOString(), trip.endTz))}, {plural(a.tripDays, "día", "días")},{" "}
          {plural(a.travelerCount, "viajero", "viajeros")}
        </p>

        <form action={duplicateSharedAction.bind(null, token)} className="mt-6 rounded-2xl border border-route/40 bg-route-soft p-4">
          <p className="font-semibold">¿Querés usarlo como punto de partida?</p>
          <p className="mt-1 text-sm">Se copia a tu cuenta con todos los escenarios. Los precios de demostración siguen marcados hasta que los edites.</p>
          <SubmitButton className="mt-3" pendingText="Copiando…">
            Duplicar como mío
          </SubmitButton>
        </form>

        {a.scenarios.length > 1 && a.explanation.length > 0 ? (
          <section aria-label="Recomendación" className="mt-8 rounded-2xl border-2 border-route bg-surface p-4">
            <h2 className="font-display text-xl font-semibold">Recomendación</h2>
            <ul className="mt-2 space-y-1">
              {a.explanation.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8 space-y-4">
          <h2 className="font-display text-2xl font-semibold">Escenarios comparados</h2>
          {a.scenarios.length > 0 ? (
            <>
              <ScenarioTable a={a} base={trip.baseCurrency} labelOf={labelOf} />
              <ScenarioStack
                budgetCents={trip.budgetCents}
                currency={trip.baseCurrency}
                rows={a.scenarios.map((s) => ({ id: s.id, name: s.name, totalCents: s.summary.totalWithContingencyCents, incomplete: s.summary.incomplete, groups: groupTotals(s.summary) }))}
              />
            </>
          ) : (
            <p className="text-ink-soft">Todavía no hay escenarios.</p>
          )}
        </section>

        {itinerary ? (
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">Itinerario{chosen ? `: ${chosen.name}` : ""}</h2>
            <div className="mt-3">
              <ItineraryReadOnly itinerary={itinerary} tripTz={trip.startTz} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

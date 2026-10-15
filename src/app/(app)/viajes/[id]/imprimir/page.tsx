import { getTripAnalysis, getTripData } from "@/server/queries";
import { itineraryFromLoaded } from "@/server/services/trip-analysis";
import { ItineraryReadOnly } from "@/ui/itinerary/ItineraryReadOnly";
import { BudgetReadOnly } from "@/ui/BudgetReadOnly";
import { PrintButton } from "@/ui/PrintButton";
import { EmptyState } from "@/ui/Feedback";

export const metadata = { title: "Imprimir · TravelFlow" };

export default async function PrintPage({ params }: PageProps<"/viajes/[id]/imprimir">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const a = await getTripAnalysis(id);
  const chosen = a.scenarios.find((s) => s.id === data.trip.chosenScenarioId);
  const itinerary = itineraryFromLoaded(data);
  return (
    <main className="space-y-8 px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">Vista para imprimir o guardar como PDF desde el navegador.</p>
        <PrintButton />
      </div>
      <section>
        <h2 className="font-display text-2xl font-semibold">Presupuesto</h2>
        {chosen ? (
          <BudgetReadOnly summary={chosen.summary} budgetCents={data.trip.budgetCents} currency={data.trip.baseCurrency} scenarioName={chosen.name} />
        ) : (
          <EmptyState title="Sin escenario elegido">Elegí un escenario en Confirmar para imprimir su presupuesto.</EmptyState>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">Itinerario</h2>
        {itinerary ? <ItineraryReadOnly itinerary={itinerary} tripTz={data.trip.startTz} /> : <p className="text-ink-soft">Todavía no hay itinerario.</p>}
      </section>
    </main>
  );
}

import { getTripAnalysis, getTripData } from "@/server/queries";
import { costItemViews } from "@/server/views";
import { scenarioItems } from "@/server/services/trip-analysis";
import { LEG_LABELS, MODE_LABELS } from "@/server/validation/options";
import type { RatingCriterion } from "@/domain/decision/types";
import { Disclosure } from "@/ui/Disclosure";
import { EmptyState } from "@/ui/Feedback";
import { ScenarioBuilder, type BuilderOption } from "@/ui/comparator/ScenarioBuilder";
import { SettingsForm } from "@/ui/comparator/SettingsForm";
import { NewScenario } from "@/ui/comparator/NewScenario";
import { ScenarioStack } from "@/ui/comparator/ScenarioStack";
import { groupTotals } from "@/ui/comparator/groups";
import { ScenarioTable } from "@/ui/comparator/ScenarioTable";

export const metadata = { title: "Comparador · TravelFlow" };

export default async function ComparatorPage({ params }: PageProps<"/viajes/[id]/comparador">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const a = await getTripAnalysis(id);
  const { trip } = data;
  const base = trip.baseCurrency;
  const labelOf = (itemId: string) => data.costItems.find((i) => i.id === itemId)?.label ?? "";

  const options: BuilderOption[] = [
    ...data.transport.map((t) => ({
      ownerType: "transport_option" as const,
      id: t.id,
      label: `${t.provider || MODE_LABELS[t.mode]} (${t.fromLabel} → ${t.toLabel})`,
      group: `Transporte de ${LEG_LABELS[t.leg].toLowerCase()}`,
    })),
    ...data.lodging.map((l) => ({ ownerType: "lodging_option" as const, id: l.id, label: l.name, group: "Alojamiento" })),
    ...data.activities.map((x) => ({ ownerType: "activity" as const, id: x.id, label: x.name, group: "Actividades" })),
  ];

  return (
    <main className="space-y-6 px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold">Comparador</h2>
      </div>
      <p className="max-w-prose text-ink-soft">
        Cada escenario combina transporte de ida y vuelta, alojamiento, actividades y gastos propios. Los totales se recalculan con cada cambio de precio.
      </p>

      <div className="flex flex-wrap gap-2">
        <Disclosure label="Nuevo escenario" variant="primary" className="w-full sm:w-auto">
          <NewScenario tripId={id} suggested={String.fromCharCode(65 + data.scenarios.length)} />
        </Disclosure>
        {a.scenarios.length > 0 ? (
          <a href={`/viajes/${id}/exportar/presupuesto.csv`} className="inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-route hover:bg-route-soft">
            Descargar presupuesto (CSV)
          </a>
        ) : null}
        <Disclosure label="Prioridades" className="w-full sm:w-auto">
          <SettingsForm
            tripId={id}
            weights={a.weights}
            tieThresholdPct={trip.tieThresholdPct}
            contingencyPct={trip.contingencyPct}
            contingencyCategories={trip.contingencyCategories}
            referenceScenarioId={trip.referenceScenarioId}
            scenarios={data.scenarios.map((s) => ({ id: s.id, name: s.name }))}
          />
        </Disclosure>
      </div>

      {a.scenarios.length === 0 ? (
        <EmptyState title="Todavía no hay escenarios">Creá al menos tres para comparar, por ejemplo: avión + hotel céntrico, auto + departamento, micro + hostel.</EmptyState>
      ) : (
        <>
          {a.scenarios.length > 1 ? (
            <section aria-label="Recomendación" className="rounded-lg border-2 border-route bg-route-soft p-4">
              <h3 className="font-display text-xl font-semibold">Recomendación</h3>
              {a.explanation.length === 0 ? (
                <p className="mt-1">Con las prioridades actuales no hay un escenario que se destaque.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {a.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm text-ink-soft">Es una sugerencia: podés elegir cualquier escenario en Confirmar.</p>
            </section>
          ) : null}

          <ScenarioTable a={a} base={base} labelOf={labelOf} />
          <ScenarioStack
            budgetCents={trip.budgetCents}
            currency={base}
            rows={a.scenarios.map((s) => ({
              id: s.id,
              name: s.name,
              totalCents: s.summary.totalWithContingencyCents,
              incomplete: s.summary.incomplete,
              groups: groupTotals(s.summary),
            }))}
          />

          <div className="space-y-3">
            <h3 className="font-display text-2xl font-semibold">Escenarios</h3>
            {a.scenarios.map((s) => {
              const sel = data.selections.filter((x) => x.scenarioId === s.id).map((x) => x.ownerId);
              const itemsIn = scenarioItems({ ...data, toggles: [] }, s.id);
              const off = new Set(data.toggles.filter((t) => t.scenarioId === s.id && !t.included).map((t) => t.costItemId));
              const ratings: Partial<Record<RatingCriterion, number>> = {};
              for (const r of data.ratings.filter((x) => x.scenarioId === s.id)) ratings[r.criterion] = r.value;
              return (
                <ScenarioBuilder
                  key={s.id}
                  tripId={id}
                  scenario={{ id: s.id, name: s.name }}
                  totalCents={s.summary.totalWithContingencyCents}
                  incomplete={s.summary.incomplete}
                  chosen={trip.chosenScenarioId === s.id}
                  recommended={a.score.recommendedId === s.id && a.scenarios.length > 1}
                  options={options}
                  selectedIds={sel}
                  optionalItems={itemsIn.filter((i) => i.costType === "optional").map((i) => ({ id: i.id, label: i.label, included: !off.has(i.id) }))}
                  ownItems={costItemViews(data, "scenario", s.id, s.summary)}
                  ratings={ratings}
                  baseCurrency={base}
                />
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

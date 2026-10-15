"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { RatingCriterion } from "@/domain/decision/types";
import {
  deleteScenarioAction,
  duplicateScenarioAction,
  renameScenarioAction,
  setRatingAction,
  setSelectionAction,
  setToggleAction,
} from "@/server/actions/scenarios";
import { CostItemsEditor, type CostItemView } from "../CostItemsEditor";
import { ConfirmButton } from "../ConfirmButton";
import { Button } from "../Button";
import { fmtMoney } from "../format";

type OwnerType = "transport_option" | "lodging_option" | "activity";

export interface BuilderOption {
  ownerType: OwnerType;
  id: string;
  label: string;
  group: string;
}

export interface BuilderProps {
  tripId: string;
  scenario: { id: string; name: string };
  totalCents: number;
  incomplete: boolean;
  chosen: boolean;
  recommended: boolean;
  options: BuilderOption[];
  selectedIds: string[];
  optionalItems: { id: string; label: string; included: boolean }[];
  ownItems: CostItemView[];
  ratings: Partial<Record<RatingCriterion, number>>;
  baseCurrency: string;
}

const RATING_LABELS: Record<RatingCriterion, string> = { comfort: "Comodidad", lodging_quality: "Calidad del alojamiento", experience: "Experiencia general" };

function OptionCheck({ tripId, scenarioId, o, checked }: { tripId: string; scenarioId: string; o: BuilderOption; checked: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        className="size-5 accent-route"
        checked={optimistic}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setOptimistic(next);
            await setSelectionAction(tripId, scenarioId, o.ownerType, o.id, next);
          });
        }}
      />
      <span>{o.label}</span>
      {pending ? <span className="text-xs text-ink-soft">Guardando…</span> : null}
    </label>
  );
}

function ToggleCheck({ tripId, scenarioId, item }: { tripId: string; scenarioId: string; item: { id: string; label: string; included: boolean } }) {
  const [optimistic, setOptimistic] = useOptimistic(item.included);
  const [, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        className="size-5 accent-route"
        checked={optimistic}
        aria-label={`Incluir ${item.label}`}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setOptimistic(next);
            await setToggleAction(tripId, scenarioId, item.id, next);
          });
        }}
      />
      <span>Incluir {item.label}</span>
    </label>
  );
}

export function ScenarioBuilder(p: BuilderProps) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const groups = [...new Set(p.options.map((o) => o.group))];
  return (
    <section aria-label={`Escenario ${p.scenario.name}`} className="rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold leading-tight">{p.scenario.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {p.chosen ? <span className="rounded bg-route px-1.5 py-0.5 font-semibold text-route-ink">Elegido</span> : null}
            {p.recommended ? <span className="rounded bg-route-soft px-1.5 py-0.5 font-semibold">Recomendado</span> : null}
          </div>
        </div>
        <p className="num shrink-0 font-display text-2xl font-semibold">
          {fmtMoney(p.totalCents, p.baseCurrency)}
          {p.incomplete ? " *" : ""}
        </p>
      </header>
      <p className="mt-1 text-sm text-ink-soft">
        {p.selectedIds.length === 0
          ? "Todavía no elegiste alternativas."
          : `${p.selectedIds.length} ${p.selectedIds.length === 1 ? "alternativa elegida" : "alternativas elegidas"}.`}
      </p>

      {!open ? (
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Armar escenario
        </Button>
      ) : (
        <div className="mt-3 space-y-5 border-t border-line pt-3">
          {groups.map((g) => (
            <fieldset key={g}>
              <legend className="font-semibold">{g}</legend>
              {p.options
                .filter((o) => o.group === g)
                .map((o) => (
                  <OptionCheck key={o.id} tripId={p.tripId} scenarioId={p.scenario.id} o={o} checked={p.selectedIds.includes(o.id)} />
                ))}
            </fieldset>
          ))}
          {p.options.length === 0 ? <p className="text-ink-soft">Cargá alternativas en Transporte, Alojamiento o Actividades para armar el escenario.</p> : null}

          <div>
            <h4 className="font-semibold">Gastos propios del escenario</h4>
            <p className="text-sm text-ink-soft">Comidas, seguros, compras: lo que no depende de una alternativa.</p>
            <CostItemsEditor tripId={p.tripId} owner={{ ownerType: "scenario", ownerId: p.scenario.id }} items={p.ownItems} baseCurrency={p.baseCurrency} defaultCategory="food" />
          </div>

          {p.optionalItems.length > 0 ? (
            <fieldset>
              <legend className="font-semibold">Gastos opcionales</legend>
              {p.optionalItems.map((i) => (
                <ToggleCheck key={i.id} tripId={p.tripId} scenarioId={p.scenario.id} item={i} />
              ))}
            </fieldset>
          ) : null}

          <fieldset>
            <legend className="font-semibold">Tu evaluación</legend>
            <p className="text-sm text-ink-soft">De 1 a 5. Vacío si no querés que cuente.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(RATING_LABELS) as RatingCriterion[]).map((c) => (
                <label key={c} className="text-sm">
                  {RATING_LABELS[c]}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-2"
                    defaultValue={p.ratings[c] ?? ""}
                    onChange={(e) => start(() => setRatingAction(p.tripId, p.scenario.id, c, e.target.value ? Number(e.target.value) : null))}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <form action={renameScenarioAction.bind(null, p.tripId, p.scenario.id)} className="flex items-end gap-2">
            <label className="flex-1 text-sm">
              Nombre
              <input name="name" defaultValue={p.scenario.name} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" />
            </label>
            <button className="min-h-11 rounded-md border border-line px-3 font-semibold">Renombrar</button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(false)}>Listo</Button>
            <Button variant="secondary" onClick={() => start(() => duplicateScenarioAction(p.tripId, p.scenario.id, p.scenario.name))}>
              Duplicar
            </Button>
            <ConfirmButton variant="ghost" action={deleteScenarioAction.bind(null, p.tripId, p.scenario.id)} label="Borrar escenario" confirm={`¿Borrar el escenario "${p.scenario.name}"?`} />
          </div>
        </div>
      )}
    </section>
  );
}

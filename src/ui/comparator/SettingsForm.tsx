"use client";

import { useActionState, useEffect } from "react";
import { CATEGORY_LABELS, COST_CATEGORIES, type CostCategory } from "@/domain/costs/types";
import { CRITERIA, CRITERION_LABELS, type Criterion } from "@/domain/decision/types";
import { saveSettingsAction } from "@/server/actions/scenarios";
import type { FormState } from "@/server/actions/form";
import { CheckField, Field, SelectField } from "../Field";
import { Button, SubmitButton } from "../Button";
import { ErrorBanner } from "../Feedback";
import { useCloseDisclosure } from "../Disclosure";

export function SettingsForm({
  tripId,
  weights,
  tieThresholdPct,
  contingencyPct,
  contingencyCategories,
  referenceScenarioId,
  scenarios,
}: {
  tripId: string;
  weights: Record<Criterion, number>;
  tieThresholdPct: string;
  contingencyPct: string;
  contingencyCategories: string[];
  referenceScenarioId: string | null;
  scenarios: { id: string; name: string }[];
}) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(saveSettingsAction.bind(null, tripId), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  const e = state.fieldErrors ?? {};
  const pct = (s: string) => String(Number(s));
  return (
    <form action={action} aria-label="Prioridades y supuestos" className="space-y-4 rounded-lg border border-line bg-surface p-4">
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <fieldset>
        <legend className="font-semibold">¿Cuánto pesa cada criterio? (0 a 10)</legend>
        <p className="text-sm text-ink-soft">0 = no se tiene en cuenta.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {CRITERIA.map((c) => (
            <Field key={c} label={CRITERION_LABELS[c]} name={`w_${c}`} type="number" min={0} max={10} inputMode="numeric" defaultValue={String(weights[c])} error={e[`w_${c}`]} />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Umbral de empate (%)" name="tieThresholdPct" inputMode="decimal" defaultValue={pct(tieThresholdPct)} error={e.tieThresholdPct} hint="Diferencias menores cuentan como empate." />
        <Field label="Imprevistos (%)" name="contingencyPct" inputMode="decimal" defaultValue={pct(contingencyPct)} error={e.contingencyPct} />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Imprevistos se calculan sobre</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {COST_CATEGORIES.filter((c) => c !== "contingency").map((c) => (
            <CheckField key={c} label={CATEGORY_LABELS[c as CostCategory]} name="contingencyCategories" value={c} defaultChecked={contingencyCategories.includes(c)} />
          ))}
        </div>
      </fieldset>
      <SelectField
        label="Comparar ahorro contra"
        name="referenceScenarioId"
        options={[{ value: "", label: "El escenario más caro" }, ...scenarios.map((s) => ({ value: s.id, label: s.name }))]}
        defaultValue={referenceScenarioId ?? ""}
      />
      <div className="flex gap-2">
        <SubmitButton>Guardar prioridades</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

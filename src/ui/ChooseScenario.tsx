"use client";

import { useActionState } from "react";
import { chooseScenarioAction } from "@/server/actions/bookings";
import type { FormState } from "@/server/actions/form";
import { SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { fmtMoney } from "./format";

export function ChooseScenario({
  tripId,
  scenarios,
  chosenId,
  recommendedId,
  currency,
}: {
  tripId: string;
  scenarios: { id: string; name: string; totalCents: number; incomplete: boolean }[];
  chosenId: string | null;
  recommendedId: string | null;
  currency: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(chooseScenarioAction.bind(null, tripId), {});
  return (
    <form action={action} className="space-y-2">
      {state.message && !state.ok ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <fieldset className="space-y-2">
        <legend className="sr-only">Escenario</legend>
        {scenarios.map((s) => (
          <label key={s.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-surface shadow-card px-4 has-[:checked]:border-route has-[:checked]:bg-route-soft">
            <input type="radio" name="scenarioId" value={s.id} defaultChecked={s.id === (chosenId ?? recommendedId)} className="size-5 accent-route" />
            <span className="flex-1 font-semibold">
              {s.name}
              {s.id === recommendedId ? <span className="ml-2 rounded bg-route-soft px-1.5 py-0.5 text-xs">Recomendado</span> : null}
            </span>
            <span className="num">
              {fmtMoney(s.totalCents, currency)}
              {s.incomplete ? " *" : ""}
            </span>
          </label>
        ))}
      </fieldset>
      <SubmitButton>Elegir este escenario</SubmitButton>
    </form>
  );
}

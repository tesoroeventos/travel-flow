"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveRateAction } from "@/server/actions/expenses";
import type { FormState } from "@/server/actions/form";
import { Field, SelectField } from "./Field";
import { SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { CURRENCY_OPTIONS } from "./options";

export function RateForm() {
  const [state, action] = useActionState<FormState, FormData>(saveRateAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const e = state.fieldErrors ?? {};
  const v = (k: string, d?: string) => state.values?.[k] ?? d;
  return (
    <form ref={ref} action={action} aria-label="Nuevo tipo de cambio" className="mt-3 space-y-3">
      {state.message && !state.ok ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Moneda de origen" name="fromCurrency" options={CURRENCY_OPTIONS} defaultValue={v("fromCurrency", "USD")} />
        <SelectField label="Moneda de destino" name="toCurrency" options={CURRENCY_OPTIONS} defaultValue={v("toCurrency", "ARS")} error={e.toCurrency} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tasa" name="rate" required inputMode="decimal" placeholder="1.000,50" defaultValue={v("rate")} error={e.rate} hint="Cuánto vale 1 unidad de origen" />
        <Field label="Vigente desde" name="asOf" type="date" required defaultValue={v("asOf", new Date().toISOString().slice(0, 10))} error={e.asOf} />
      </div>
      <Field label="Fuente" name="source" required defaultValue={v("source")} error={e.source} placeholder="Banco, casa de cambio…" />
      <SubmitButton>Guardar tipo de cambio</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { carCalculatorAction } from "@/server/actions/options";
import type { FormState } from "@/server/actions/form";
import { Field } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { useCloseDisclosure } from "./Disclosure";

export function CarCalculator({ tripId, optionId, rental }: { tripId: string; optionId: string; rental: boolean }) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(carCalculatorAction.bind(null, tripId, optionId), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  const e = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k];
  return (
    <form action={action} aria-label="Calculadora de auto" className="mt-2 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <p className="text-sm text-ink-soft">Cada concepto se guarda como una partida con sus supuestos a la vista.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kilómetros totales" name="km" required inputMode="decimal" defaultValue={v("km")} error={e.km} />
        <Field label="Consumo (l/100 km)" name="consumptionLPer100" required inputMode="decimal" defaultValue={v("consumptionLPer100")} error={e.consumptionLPer100} />
      </div>
      <Field label="Precio del combustible por litro" name="fuelPrice" required inputMode="decimal" defaultValue={v("fuelPrice")} error={e.fuelPrice} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Peajes" name="tolls" inputMode="decimal" defaultValue={v("tolls")} error={e.tolls} />
        <Field label="Estacionamiento" name="parking" inputMode="decimal" defaultValue={v("parking")} error={e.parking} />
      </div>
      {rental ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alquiler" name="rental" inputMode="decimal" defaultValue={v("rental")} error={e.rental} />
            <Field label="Seguro" name="insurance" inputMode="decimal" defaultValue={v("insurance")} error={e.insurance} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Depósito / franquicia" name="deposit" inputMode="decimal" defaultValue={v("deposit")} error={e.deposit} hint="Reembolsable" />
            <Field label="Devolución en otro lugar" name="dropOff" inputMode="decimal" defaultValue={v("dropOff")} error={e.dropOff} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Km adicionales" name="extraKm" inputMode="decimal" defaultValue={v("extraKm")} />
            <Field label="Precio por km adicional" name="extraKmPrice" inputMode="decimal" defaultValue={v("extraKmPrice")} error={e.extraKmPrice} />
          </div>
        </>
      ) : null}
      <Field label="Desgaste por km (opcional)" name="wearPerKm" inputMode="decimal" defaultValue={v("wearPerKm")} error={e.wearPerKm} hint="Mantenimiento y desgaste; se suma como gasto opcional." />
      <div className="flex gap-2">
        <SubmitButton>Agregar costos del auto</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

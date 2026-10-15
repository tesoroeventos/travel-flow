"use client";

import { useActionState, useEffect } from "react";
import { saveActivityAction } from "@/server/actions/options";
import type { FormState } from "@/server/actions/form";
import { CheckField, Field, TextAreaField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { QuickPrice } from "./QuickPrice";
import { useCloseDisclosure } from "./Disclosure";

export interface ActivityFormValues {
  id: string;
  name: string;
  address: string;
  date: string;
  startTime: string | null;
  durationMin: number;
  fixedTime: boolean;
  requiresBooking: boolean;
  accessMode: string | null;
  lat: number | null;
  lng: number | null;
  travelMinFromPrev: number | null;
  url: string | null;
  notes: string | null;
}

export function ActivityForm({ tripId, option, defaultDate, baseCurrency }: { tripId: string; option: ActivityFormValues | null; defaultDate: string; baseCurrency: string }) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(saveActivityAction.bind(null, tripId, option?.id ?? null), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  const v = (k: string, d?: string | null) => state.values?.[k] ?? d ?? undefined;
  const n = (x: number | null | undefined) => (x === null || x === undefined ? undefined : String(x));
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} aria-label={option ? `Editar ${option.name}` : "Nueva actividad"} className="space-y-4 rounded-2xl bg-surface shadow-card p-4">
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <Field label="Nombre" name="name" required defaultValue={v("name", option?.name)} error={e.name} />
      <Field label="Dirección" name="address" defaultValue={v("address", option?.address)} />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Fecha" name="date" type="date" required defaultValue={v("date", option?.date ?? defaultDate)} error={e.date} />
        <Field label="Hora" name="startTime" type="time" defaultValue={v("startTime", option?.startTime)} hint="Opcional" error={e.startTime} />
        <Field label="Duración (min)" name="durationMin" type="number" min={1} required defaultValue={v("durationMin", n(option?.durationMin) ?? "60")} error={e.durationMin} />
      </div>
      <CheckField label="Horario fijo (no se reordena)" name="fixedTime" defaultChecked={option?.fixedTime} />
      <CheckField label="Requiere reserva" name="requiresBooking" defaultChecked={option?.requiresBooking} />
      {!option ? <QuickPrice baseCurrency={baseCurrency} defaultUnit="per_person" error={e.price} /> : null}
      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer font-medium">Más detalles</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cómo llegar" name="accessMode" defaultValue={v("accessMode", option?.accessMode)} placeholder="A pie, colectivo…" />
            <Field label="Traslado desde la anterior (min)" name="travelMinFromPrev" type="number" min={0} defaultValue={v("travelMinFromPrev", n(option?.travelMinFromPrev))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud" name="lat" inputMode="decimal" defaultValue={v("lat", n(option?.lat))} />
            <Field label="Longitud" name="lng" inputMode="decimal" defaultValue={v("lng", n(option?.lng))} />
          </div>
          <Field label="Enlace" name="url" type="url" defaultValue={v("url", option?.url)} />
          <TextAreaField label="Notas" name="notes" defaultValue={v("notes", option?.notes)} />
        </div>
      </details>
      <div className="flex gap-2">
        <SubmitButton>Guardar actividad</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

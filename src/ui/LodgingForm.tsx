"use client";

import { useActionState, useEffect } from "react";
import { localDate, localTime } from "@/domain/time/calendar";
import { saveLodgingAction } from "@/server/actions/options";
import type { FormState } from "@/server/actions/form";
import { AMENITIES, AMENITY_LABELS, LODGING_KINDS, LODGING_KIND_LABELS } from "@/server/validation/options";
import { CheckField, Field, SelectField, TextAreaField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { QuickPrice } from "./QuickPrice";
import { useCloseDisclosure } from "./Disclosure";

export interface LodgingFormValues {
  id: string;
  kind: string;
  name: string;
  address: string;
  checkInAt: string;
  checkOutAt: string;
  tz: string;
  rating: string | null;
  reviewCount: number | null;
  amenities: string[];
  capacity: number | null;
  rooms: number | null;
  beds: number | null;
  distanceCenterKm: number | null;
  lat: number | null;
  lng: number | null;
  cancellationPolicy: string | null;
  flexibleCancellation: boolean;
  url: string | null;
  qualityRating: number | null;
  notes: string | null;
}

export function LodgingForm({
  tripId,
  option,
  tz,
  tripStart,
  tripEnd,
  baseCurrency,
}: {
  tripId: string;
  option: LodgingFormValues | null;
  tz: string;
  tripStart: string;
  tripEnd: string;
  baseCurrency: string;
}) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(saveLodgingAction.bind(null, tripId, option?.id ?? null), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  const v = (k: string, d?: string | null) => state.values?.[k] ?? d ?? undefined;
  const n = (x: number | string | null | undefined) => (x === null || x === undefined ? undefined : String(x));
  const e = state.fieldErrors ?? {};
  const otz = option?.tz ?? tz;

  return (
    <form action={action} aria-label={option ? `Editar ${option.name}` : "Nueva alternativa de alojamiento"} className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <input type="hidden" name="tz" value={otz} />
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <Field label="Nombre" name="name" required defaultValue={v("name", option?.name)} error={e.name} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo" name="kind" options={LODGING_KINDS.map((k) => ({ value: k, label: LODGING_KIND_LABELS[k] }))} defaultValue={v("kind", option?.kind ?? "hotel")} />
        <Field label="Capacidad (personas)" name="capacity" type="number" min={1} defaultValue={v("capacity", n(option?.capacity))} />
      </div>
      <Field label="Dirección" name="address" defaultValue={v("address", option?.address)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in" name="checkInDate" type="date" required defaultValue={v("checkInDate", option ? localDate(option.checkInAt, otz) : tripStart)} error={e.checkInDate} />
        <Field label="Hora de check-in" name="checkInTime" type="time" defaultValue={v("checkInTime", option ? localTime(option.checkInAt, otz) : "15:00")} />
        <Field label="Check-out" name="checkOutDate" type="date" required defaultValue={v("checkOutDate", option ? localDate(option.checkOutAt, otz) : tripEnd)} error={e.checkOutDate} />
        <Field label="Hora de check-out" name="checkOutTime" type="time" defaultValue={v("checkOutTime", option ? localTime(option.checkOutAt, otz) : "10:00")} />
      </div>

      {!option ? <QuickPrice baseCurrency={baseCurrency} defaultUnit="per_night" error={e.price} /> : null}

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Servicios</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {AMENITIES.map((a) => (
            <CheckField key={a} label={AMENITY_LABELS[a]} name="amenities" value={a} defaultChecked={option?.amenities.includes(a)} />
          ))}
        </div>
      </fieldset>

      <details className="rounded-md border border-line p-3">
        <summary className="cursor-pointer font-medium">Más detalles</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Habitaciones" name="rooms" type="number" min={0} defaultValue={v("rooms", n(option?.rooms))} />
            <Field label="Camas" name="beds" type="number" min={0} defaultValue={v("beds", n(option?.beds))} />
            <Field label="Calidad (1 a 5)" name="qualityRating" type="number" min={1} max={5} defaultValue={v("qualityRating", n(option?.qualityRating))} error={e.qualityRating} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calificación" name="rating" inputMode="decimal" defaultValue={v("rating", option?.rating)} hint="Según la fuente (ej. 8,7)" />
            <Field label="Cantidad de opiniones" name="reviewCount" type="number" min={0} defaultValue={v("reviewCount", n(option?.reviewCount))} />
          </div>
          <Field label="Distancia al centro (km)" name="distanceCenterKm" inputMode="decimal" defaultValue={v("distanceCenterKm", n(option?.distanceCenterKm))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud" name="lat" inputMode="decimal" defaultValue={v("lat", n(option?.lat))} />
            <Field label="Longitud" name="lng" inputMode="decimal" defaultValue={v("lng", n(option?.lng))} />
          </div>
          <Field label="Política de cancelación" name="cancellationPolicy" defaultValue={v("cancellationPolicy", option?.cancellationPolicy)} />
          <CheckField label="Cancelación flexible" name="flexibleCancellation" defaultChecked={option?.flexibleCancellation} />
          <Field label="Enlace" name="url" type="url" defaultValue={v("url", option?.url)} />
          <TextAreaField label="Notas" name="notes" defaultValue={v("notes", option?.notes)} />
        </div>
      </details>

      <div className="flex gap-2">
        <SubmitButton>Guardar alternativa</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

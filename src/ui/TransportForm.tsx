"use client";

import { useActionState, useEffect, useState } from "react";
import { localDate, localTime } from "@/domain/time/calendar";
import type { Segment } from "@/domain/itinerary/types";
import { saveTransportAction } from "@/server/actions/options";
import type { FormState } from "@/server/actions/form";
import { LEGS, LEG_LABELS, MODES, MODE_LABELS } from "@/server/validation/options";
import { CheckField, Field, SelectField, TextAreaField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { QuickPrice } from "./QuickPrice";
import { TZ_OPTIONS } from "./options";
import { useCloseDisclosure } from "./Disclosure";

export interface TransportFormValues {
  id: string;
  leg: string;
  mode: string;
  international: boolean;
  provider: string;
  serviceNumber: string | null;
  fromLabel: string;
  toLabel: string;
  segments: Segment[];
  baggageNotes: string | null;
  cancellationPolicy: string | null;
  flexibleCancellation: boolean;
  distanceKm: number | null;
  url: string | null;
  comfortRating: number | null;
  transferToMin: number | null;
  transferFromMin: number | null;
  advanceMin: number | null;
  notes: string | null;
}

interface SegDraft {
  key: number;
  via: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  arriveTz: string;
}

export function TransportForm({
  tripId,
  option,
  startTz,
  endTz,
  defaultDate,
  baseCurrency,
}: {
  tripId: string;
  option: TransportFormValues | null;
  startTz: string;
  endTz: string;
  defaultDate: string;
  baseCurrency: string;
}) {
  const [leg, setLeg] = useState(option?.leg ?? "outbound");
  const departDefault = leg === "outbound" ? startTz : endTz;
  const arriveDefault = leg === "return" ? startTz : endTz;
  const [departTz, setDepartTz] = useState<string | null>(option?.segments[0]?.departTz ?? null);
  const tz = departTz ?? departDefault;
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(saveTransportAction.bind(null, tripId, option?.id ?? null), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);

  const initial: SegDraft[] = option?.segments.length
    ? option.segments.map((s, i) => ({
        key: i,
        via: s.from,
        departDate: localDate(s.departUtc, s.departTz),
        departTime: localTime(s.departUtc, s.departTz),
        arriveDate: localDate(s.arriveUtc, s.arriveTz),
        arriveTime: localTime(s.arriveUtc, s.arriveTz),
        arriveTz: s.arriveTz,
      }))
    : [{ key: 0, via: "", departDate: "", departTime: "", arriveDate: "", arriveTime: "", arriveTz: "" }];
  const [segs, setSegs] = useState<SegDraft[]>(initial);
  const v = (k: string, d?: string | null) => state.values?.[k] ?? d ?? undefined;
  const e = state.fieldErrors ?? {};
  const n = (x: number | null | undefined) => (x === null || x === undefined ? undefined : String(x));

  return (
    <form action={action} aria-label={option ? `Editar ${option.provider || "transporte"}` : "Nueva alternativa de transporte"} className="space-y-4 rounded-2xl bg-surface shadow-card p-4">
      <input type="hidden" name="tz" value={tz} />
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tramo" name="leg" options={LEGS.map((l) => ({ value: l, label: LEG_LABELS[l] }))} value={leg} onChange={(e) => setLeg(e.target.value)} />
        <SelectField label="Medio" name="mode" options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))} defaultValue={v("mode", option?.mode ?? "flight")} />
      </div>
      <Field label="Empresa o proveedor" name="provider" defaultValue={v("provider", option?.provider)} placeholder="Aerolínea, empresa de micros…" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" name="fromLabel" required defaultValue={v("fromLabel", option?.fromLabel)} error={e.fromLabel} />
        <Field label="Hasta" name="toLabel" required defaultValue={v("toLabel", option?.toLabel)} error={e.toLabel} />
      </div>
      <Field label="Número de servicio" name="serviceNumber" defaultValue={v("serviceNumber", option?.serviceNumber)} placeholder="Vuelo, tren o micro" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Horarios</legend>
        <p className="text-sm text-ink-soft">Opcional para auto o traslados. Con escalas, agregá un tramo por cada conexión.</p>
        {segs.map((s, i) => (
          <div key={s.key} className="space-y-2 rounded-xl border border-line p-3">
            {i > 0 ? <Field label="Escala en" name={`seg_via_${i}`} required defaultValue={s.via} /> : null}
            {i === 0 ? (
              <SelectField label="Zona horaria de salida" name="seg_departTz_0" options={TZ_OPTIONS} value={tz} onChange={(e) => setDepartTz(e.target.value)} />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sale el día" name={`seg_departDate_${i}`} type="date" defaultValue={s.departDate || (i === 0 ? undefined : "")} placeholder={defaultDate} />
              <Field label="Sale a las" name={`seg_departTime_${i}`} type="time" defaultValue={s.departTime} />
              <Field label="Llega el día" name={`seg_arriveDate_${i}`} type="date" defaultValue={s.arriveDate} error={i === 0 ? e.seg_arriveDate_0 : undefined} />
              <Field label="Llega a las" name={`seg_arriveTime_${i}`} type="time" defaultValue={s.arriveTime} />
            </div>
            <SelectField key={`${leg}-${s.key}`} label="Zona horaria de llegada" name={`seg_arriveTz_${i}`} options={TZ_OPTIONS} defaultValue={s.arriveTz || arriveDefault} />
            {i > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setSegs((all) => all.filter((x) => x.key !== s.key))}>
                Quitar tramo
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setSegs((all) => [...all, { key: Date.now(), via: "", departDate: "", departTime: "", arriveDate: "", arriveTime: "", arriveTz: "" }])}
        >
          Agregar escala
        </Button>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutos de traslado a la terminal" name="transferToMin" type="number" min={0} inputMode="numeric" defaultValue={v("transferToMin", n(option?.transferToMin))} error={e.transferToMin} />
        <Field label="Minutos de traslado al llegar" name="transferFromMin" type="number" min={0} inputMode="numeric" defaultValue={v("transferFromMin", n(option?.transferFromMin))} error={e.transferFromMin} />
      </div>

      {!option ? <QuickPrice baseCurrency={baseCurrency} defaultUnit="per_person" error={e.price} /> : null}

      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer font-medium">Más detalles</summary>
        <div className="mt-3 space-y-3">
          <CheckField label="Viaje internacional" name="international" defaultChecked={option?.international} />
          <Field label="Anticipación (min)" name="advanceMin" type="number" min={0} inputMode="numeric" defaultValue={v("advanceMin", n(option?.advanceMin))} hint="Vacío: sugerida (vuelo 2 h, internacional 3 h, micro o tren 30 min)." />
          <Field label="Equipaje incluido" name="baggageNotes" defaultValue={v("baggageNotes", option?.baggageNotes)} />
          <Field label="Política de cancelación" name="cancellationPolicy" defaultValue={v("cancellationPolicy", option?.cancellationPolicy)} />
          <CheckField label="Cancelación flexible" name="flexibleCancellation" defaultChecked={option?.flexibleCancellation} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distancia (km)" name="distanceKm" inputMode="decimal" defaultValue={v("distanceKm", n(option?.distanceKm))} />
            <Field label="Comodidad (1 a 5)" name="comfortRating" type="number" min={1} max={5} defaultValue={v("comfortRating", n(option?.comfortRating))} error={e.comfortRating} />
          </div>
          <Field label="Enlace a la fuente o reserva" name="url" type="url" defaultValue={v("url", option?.url)} />
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

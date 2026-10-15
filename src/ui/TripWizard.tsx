"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/server/actions/form";
import {
  BUDGET_LEVELS,
  INTERESTS,
  PACES,
  PRIORITIES,
  TRIP_TYPES,
  TRIP_TYPE_LABELS,
} from "@/server/validation/trip";
import { CheckField, Field, SelectField, TextAreaField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { CURRENCY_OPTIONS, TZ_OPTIONS } from "./options";
import { zonedToUtc } from "@/domain/time/calendar";
import { PREF_VALUE_LABELS } from "./labels";

export interface WizardDefaults {
  [k: string]: string | string[] | boolean | undefined;
}

const STEP_FIELDS: string[][] = [
  ["name", "originLabel", "homeLabel", "destinationLabel", "alternativeDestinations", "startDate", "startTime", "endDate", "endTime", "tz", "endTz", "flexibilityDays", "adults", "children", "infants", "rooms", "tripType", "budget", "baseCurrency"],
  ["budgetLevel", "priority", "transportPreference", "lodgingCategory", "lodgingLocation", "interests", "pace", "accessibility", "luggage", "dietary", "otherNeeds"],
  ["noTravelHours", "maxLegHours", "maxPerNight", "maxStops", "maxDistanceKm", "needsParking", "needsPublicTransport", "mandatoryActivities"],
];
const STEP_TITLES = ["Datos generales", "Preferencias", "Restricciones"];

const LABELS = PREF_VALUE_LABELS as {
  budgetLevel: Record<(typeof BUDGET_LEVELS)[number], string>;
  priority: Record<(typeof PRIORITIES)[number], string>;
  pace: Record<(typeof PACES)[number], string>;
  interests: Record<(typeof INTERESTS)[number], string>;
};

function Radios<T extends string>({ name, legend, values, labels, value }: { name: string; legend: string; values: readonly T[]; labels: Record<T, string>; value?: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 has-[:checked]:border-route has-[:checked]:bg-route-soft">
            <input type="radio" name={name} value={v} defaultChecked={value ? value === v : undefined} className="accent-route" />
            {labels[v]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TripWizard({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: WizardDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [stops, setStops] = useState<string[]>((defaults.stops as string[] | undefined) ?? []);
  const formRef = useRef<HTMLFormElement>(null);
  const [shownState, setShownState] = useState(state);

  // Si el servidor devuelve errores, ir al primer paso que los tiene.
  if (state !== shownState) {
    setShownState(state);
    const keys = Object.keys(state.fieldErrors ?? {});
    const errStep = STEP_FIELDS.findIndex((f) => keys.some((k) => f.includes(k.split(".")[0]!)));
    if (errStep >= 0) setStep(errStep);
  }

  const v = (k: string) => {
    const s = state.values?.[k];
    if (s !== undefined) return s;
    const d = defaults[k];
    return typeof d === "string" ? d : undefined;
  };
  const e = state.fieldErrors ?? {};

  function next() {
    const form = formRef.current;
    if (!form) return;
    const section = form.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalid = section ? Array.from(section.querySelectorAll<HTMLInputElement>("input,select,textarea")).find((el) => !el.checkValidity()) : null;
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (step === 0) {
      const fd = new FormData(form);
      const tz = String(fd.get("tz") || "America/Argentina/Buenos_Aires");
      const endTz = String(fd.get("endTz") || tz);
      let invalidRange = true;
      try {
        invalidRange =
          zonedToUtc(String(fd.get("endDate")), String(fd.get("endTime")), endTz) <= zonedToUtc(String(fd.get("startDate")), String(fd.get("startTime")), tz);
      } catch {
        invalidRange = true;
      }
      if (invalidRange) {
        setLocalError("La fecha de regreso debe ser posterior a la salida");
        return;
      }
    }
    setLocalError(null);
    setStep((s) => Math.min(s + 1, 2));
    window.scrollTo({ top: 0 });
  }

  return (
    <form ref={formRef} action={formAction} noValidate={false} className="mt-4">
      <ol className="mb-6 flex gap-2" aria-label="Pasos">
        {STEP_TITLES.map((t, i) => (
          <li key={t} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-route" : "bg-line"}`} />
            <p className={`mt-1 text-xs ${i === step ? "font-semibold text-ink" : "text-ink-soft"}`}>
              {i + 1}. {t}
            </p>
          </li>
        ))}
      </ol>

      {state.message && Object.keys(e).length > 0 ? <ErrorBanner>{state.message}</ErrorBanner> : null}

      <section data-step="0" hidden={step !== 0} className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Datos generales</h2>
        <Field label="Nombre del viaje" name="name" required defaultValue={v("name")} error={e.name} placeholder="Vacaciones de verano" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origen" name="originLabel" required defaultValue={v("originLabel")} error={e.originLabel} placeholder="Ciudad de salida" />
          <Field label="Destino principal" name="destinationLabel" required defaultValue={v("destinationLabel")} error={e.destinationLabel} />
        </div>
        <Field label="Dirección de partida" name="homeLabel" defaultValue={v("homeLabel")} hint="Opcional. Se usa en el itinerario para la salida y la llegada a casa." />

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Paradas intermedias</legend>
          <p className="mb-2 text-sm text-ink-soft">Para viajes con varias ciudades, en el orden en que las visitás.</p>
          <ul className="space-y-2">
            {stops.map((s, i) => (
              <li key={i} className="flex gap-2">
                <input
                  name="stops"
                  aria-label={`Parada ${i + 1}`}
                  value={s}
                  onChange={(ev) => setStops((all) => all.map((x, j) => (j === i ? ev.target.value : x)))}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5"
                />
                <Button type="button" variant="ghost" aria-label={`Subir parada ${i + 1}`} disabled={i === 0} onClick={() => setStops((all) => { const c = [...all]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; return c; })}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" aria-label={`Quitar parada ${i + 1}`} onClick={() => setStops((all) => all.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" className="mt-2" onClick={() => setStops((all) => [...all, ""])}>
            Agregar parada
          </Button>
        </fieldset>

        <Field label="Destinos alternativos" name="alternativeDestinations" defaultValue={v("alternativeDestinations")} hint="Opcional, separados por coma." />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de salida" name="startDate" type="date" required defaultValue={v("startDate")} error={e.startDate} />
          <Field label="Hora de salida" name="startTime" type="time" required defaultValue={v("startTime") ?? "08:00"} error={e.startTime} />
          <Field label="Fecha de regreso" name="endDate" type="date" required defaultValue={v("endDate")} error={localError ?? e.endDate} />
          <Field label="Hora de regreso" name="endTime" type="time" required defaultValue={v("endTime") ?? "20:00"} error={e.endTime} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Zona horaria de salida" name="tz" options={TZ_OPTIONS} defaultValue={v("tz") ?? "America/Argentina/Buenos_Aires"} />
          <SelectField label="Zona horaria del destino" name="endTz" options={TZ_OPTIONS} defaultValue={v("endTz") ?? v("tz") ?? "America/Argentina/Buenos_Aires"} hint="La del regreso; cambiala si viajás a otro huso horario." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Flexibilidad de fechas (días)" name="flexibilityDays" type="number" min={0} inputMode="numeric" defaultValue={v("flexibilityDays") ?? "0"} error={e.flexibilityDays} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Adultos" name="adults" type="number" min={1} required inputMode="numeric" defaultValue={v("adults") ?? "1"} error={e.adults} />
          <Field label="Niños" name="children" type="number" min={0} inputMode="numeric" defaultValue={v("children") ?? "0"} error={e.children} />
          <Field label="Bebés" name="infants" type="number" min={0} inputMode="numeric" defaultValue={v("infants") ?? "0"} error={e.infants} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Habitaciones" name="rooms" type="number" min={1} inputMode="numeric" defaultValue={v("rooms") ?? "1"} error={e.rooms} />
          <SelectField label="Tipo de viaje" name="tripType" options={TRIP_TYPES.map((t) => ({ value: t, label: TRIP_TYPE_LABELS[t] }))} defaultValue={v("tripType") ?? "vacaciones"} />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Presupuesto total" name="budget" required inputMode="decimal" placeholder="1.500.000" defaultValue={v("budget")} error={e.budget} hint="Para todo el grupo. Ejemplo: 1.500.000" />
          <SelectField label="Moneda" name="baseCurrency" options={CURRENCY_OPTIONS} defaultValue={v("baseCurrency") ?? "ARS"} error={e.baseCurrency} />
        </div>
      </section>

      <section data-step="1" hidden={step !== 1} className="space-y-5">
        <h2 className="font-display text-2xl font-semibold">Preferencias</h2>
        <Radios name="budgetLevel" legend="Nivel de gasto" values={BUDGET_LEVELS} labels={LABELS.budgetLevel} value={v("budgetLevel") ?? "intermedio"} />
        <Radios name="priority" legend="Prioridad" values={PRIORITIES} labels={LABELS.priority} value={v("priority") ?? "equilibrio"} />
        <Radios name="pace" legend="Ritmo del viaje" values={PACES} labels={LABELS.pace} value={v("pace") ?? "equilibrado"} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Intereses</legend>
          <div className="grid grid-cols-2 gap-x-4">
            {INTERESTS.map((i) => (
              <CheckField key={i} label={LABELS.interests[i]} name="interests" value={i} defaultChecked={((defaults.interests as string[] | undefined) ?? []).includes(i)} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transporte preferido" name="transportPreference" defaultValue={v("transportPreference")} placeholder="Avión, micro, auto…" />
          <Field label="Categoría de alojamiento" name="lodgingCategory" defaultValue={v("lodgingCategory")} placeholder="Hotel 3★, departamento…" />
        </div>
        <Field label="Ubicación deseada del alojamiento" name="lodgingLocation" defaultValue={v("lodgingLocation")} placeholder="Centro, cerca del lago…" />
        <Field label="Equipaje previsto" name="luggage" defaultValue={v("luggage")} />
        <Field label="Accesibilidad" name="accessibility" defaultValue={v("accessibility")} />
        <Field label="Preferencias alimentarias" name="dietary" defaultValue={v("dietary")} />
        <TextAreaField label="Otras necesidades" name="otherNeeds" defaultValue={v("otherNeeds")} />
      </section>

      <section data-step="2" hidden={step !== 2} className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Restricciones</h2>
        <Field label="Horarios en los que no se puede viajar" name="noTravelHours" defaultValue={v("noTravelHours")} placeholder="Ej.: no antes de las 7" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración máxima por trayecto (h)" name="maxLegHours" type="number" min={0} inputMode="numeric" defaultValue={v("maxLegHours")} error={e.maxLegHours} />
          <Field label="Escalas máximas" name="maxStops" type="number" min={0} inputMode="numeric" defaultValue={v("maxStops")} error={e.maxStops} />
          <Field label="Máximo por noche" name="maxPerNight" inputMode="decimal" defaultValue={v("maxPerNight")} />
          <Field label="Distancia máx. a puntos de interés (km)" name="maxDistanceKm" type="number" min={0} inputMode="numeric" defaultValue={v("maxDistanceKm")} error={e.maxDistanceKm} />
        </div>
        <CheckField label="Necesito estacionamiento" name="needsParking" defaultChecked={defaults.needsParking === true} />
        <CheckField label="Necesito transporte público cerca" name="needsPublicTransport" defaultChecked={defaults.needsPublicTransport === true} />
        <TextAreaField label="Actividades obligatorias (fecha y hora)" name="mandatoryActivities" defaultValue={v("mandatoryActivities")} />
      </section>

      <div className="mt-8 flex gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Atrás
          </Button>
        ) : null}
        {step < 2 ? (
          <Button type="button" className="flex-1 sm:flex-none" onClick={next}>
            Siguiente
          </Button>
        ) : (
          <SubmitButton className="flex-1 sm:flex-none">{submitLabel}</SubmitButton>
        )}
      </div>
    </form>
  );
}

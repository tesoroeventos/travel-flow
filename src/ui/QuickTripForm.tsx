"use client";

import { useActionState, useState } from "react";
import { parseTripAction, saveQuickTripAction } from "@/server/actions/quick";
import type { FormState } from "@/server/actions/form";
import { Button, SubmitButton } from "./Button";
import { Field, SelectField } from "./Field";
import { Icon } from "./icons";

type Values = Record<string, string>;
type FieldKey =
  "destination" | "origin" | "startDate" | "endDate" | "travelers" | "budget";
const fmtBudget = (n: number | null) =>
  n === null
    ? ""
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

/** Viaje nuevo: frase que lee la IA o formulario corto. En edición, solo el formulario. */
export function QuickTripForm({
  tripId,
  defaults,
}: {
  tripId?: string;
  defaults?: Values;
}) {
  const editing = Boolean(tripId);
  const [state, action] = useActionState<FormState, FormData>(
    saveQuickTripAction,
    {},
  );
  const [text, setText] = useState("");
  const [values, setValues] = useState<Values>(defaults ?? {});
  const [doubt, setDoubt] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(editing);
  const [reading, setReading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  async function readSentence() {
    setParseError(null);
    if (!text.trim()) {
      setParseError("Escribí a dónde vas y cuándo, o usá el formulario.");
      return;
    }
    setReading(true);
    try {
      const r = await parseTripAction(text);
      if (!r.ok) {
        setParseError(
          r.error.code === "bad_response"
            ? "No entendí la frase. Probá con destino, fechas y cuántos van, o usá el formulario."
            : r.error.message,
        );
        if (r.error.code === "not_configured") setShowForm(true);
        return;
      }
      const d = r.data;
      setValues({
        destination: d.destination ?? "",
        origin: d.origin ?? "",
        startDate: d.startDate ?? "",
        endDate: d.endDate ?? "",
        travelers: d.travelers ? String(d.travelers) : "",
        budget: fmtBudget(d.budget),
        currency: d.currency,
      });
      setDoubt(d.doubtful);
      setVersion((v) => v + 1);
      setShowForm(true);
    } catch {
      setParseError(
        "No se pudo leer ahora. Probá de nuevo en un rato o usá el formulario.",
      );
    } finally {
      setReading(false);
    }
  }

  const shown = { ...values, ...(state.values ?? {}) };
  const err = state.fieldErrors ?? {};
  const doubtful = (k: string) => doubt.includes(k);
  const fieldProps = (k: FieldKey) => ({
    name: k,
    defaultValue: shown[k] ?? "",
    error: err[k],
    hint: doubtful(k) ? (
      <span className="font-semibold text-signal">Revisá este dato</span>
    ) : undefined,
    className: doubtful(k) ? "doubt" : "",
    onInput: () => setDoubt((d) => d.filter((x) => x !== k)),
  });

  return (
    <div className="flex flex-col gap-5">
      {!editing ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <label
            htmlFor="trip-sentence"
            className="text-xs font-bold tracking-wider text-ink-soft uppercase"
          >
            Tu viaje en una frase
          </label>
          <textarea
            id="trip-sentence"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                void readSentence();
            }}
            rows={3}
            maxLength={1500}
            placeholder="Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate, presupuesto 1,5 millones"
            className="min-h-24 w-full resize-y bg-transparent font-display text-xl leading-snug font-medium outline-none placeholder:text-ink-soft/60"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-3">
            <button
              type="button"
              className="min-h-11 font-bold text-route underline underline-offset-4"
              onClick={() => setShowForm(true)}
            >
              Prefiero completar un formulario
            </button>
            <Button type="button" onClick={readSentence} disabled={reading}>
              {reading ? "Leyendo…" : "Armar mi viaje"}
              {!reading ? <Icon name="arrow" /> : null}
            </Button>
          </div>
          {parseError ? (
            <p className="font-semibold text-alert" role="alert">
              {parseError}
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <form
          key={version}
          action={action}
          aria-label="Datos del viaje"
          className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-card md:p-5"
        >
          {!editing ? (
            <div>
              <h2 className="font-display text-2xl font-bold">
                {doubt.length || values.destination
                  ? "Así entendí tu viaje"
                  : "Tu viaje"}
              </h2>
              <p className="text-ink-soft">
                {doubt.length
                  ? "Tocá cualquier dato para corregirlo. Lo marcado en amarillo lo supuse yo."
                  : "Destino, fechas y cuántos van. El presupuesto es opcional."}
              </p>
            </div>
          ) : null}
          {tripId ? <input type="hidden" name="tripId" value={tripId} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Destino"
              autoComplete="off"
              required
              {...fieldProps("destination")}
            />
            <Field
              label="Salís desde"
              autoComplete="off"
              placeholder="Tu ciudad"
              {...fieldProps("origin")}
            />
            <Field
              label="Ida"
              type="date"
              required
              {...fieldProps("startDate")}
            />
            <Field
              label="Vuelta"
              type="date"
              required
              {...fieldProps("endDate")}
            />
            <Field
              label="Personas"
              type="number"
              min={1}
              max={20}
              inputMode="numeric"
              required
              {...fieldProps("travelers")}
            />
            <Field
              label="Presupuesto (opcional)"
              inputMode="decimal"
              placeholder="1.500.000"
              {...fieldProps("budget")}
            />
            <SelectField
              label="Moneda"
              name="currency"
              defaultValue={shown.currency ?? "ARS"}
              options={[
                { value: "ARS", label: "Pesos argentinos" },
                { value: "USD", label: "Dólares" },
              ]}
            />
          </div>
          {state.message ? (
            <p className="font-semibold text-alert" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <SubmitButton pendingText="Guardando…">
              {editing ? "Guardar cambios" : "Sumar opciones"}
              <Icon name="arrow" />
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

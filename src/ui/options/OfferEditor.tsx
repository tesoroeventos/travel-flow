"use client";

import { useState } from "react";
import { toNumber } from "@/integrations/ai/schemas";
import type { OfferCard, OfferEdit } from "@/server/services/offers";
import { Button } from "../Button";

const KINDS = {
  vuelo: "Vuelo",
  micro: "Micro",
  tren: "Tren",
  auto_alquiler: "Auto de alquiler",
  alojamiento: "Alojamiento",
  actividad: "Actividad",
  otro: "Otro gasto",
} as const;
const DIRS = {
  ida: "Ida",
  vuelta: "Vuelta",
  ida_y_vuelta: "Ida y vuelta",
} as const;
const BASES = {
  total: "Total",
  por_persona: "Por persona",
  por_noche: "Por noche",
  por_persona_por_noche: "Por persona y noche",
  por_dia: "Por día",
} as const;
const COMFORT = {
  1: "1 · Básico",
  2: "2 · Aceptable",
  3: "3 · Bueno",
  4: "4 · Muy bueno",
  5: "5 · Excelente",
} as const;

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? "" : nf.format(n));
const fmtDur = (m: number | null | undefined) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");
function parseDur(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d+)\s*(?:[:h]|hs?)\s*(\d{1,2})?/i.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  const n = toNumber(t);
  return n === null ? null : Math.round(n * 60);
}

const input =
  "w-full min-h-12 rounded-xl border-[1.5px] border-line bg-surface-2 px-3 text-base focus:border-route focus:outline-none";
const labelCls = "mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase";

function F({ id, label, doubt, children }: { id: string; label: string; doubt?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${doubt ? "doubt" : ""}`}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {doubt ? <p className="mt-1 text-sm font-semibold text-signal">Revisá este dato</p> : null}
    </div>
  );
}

/** Edición de una opción dentro de su tarjeta. */
export function OfferEditor({
  card,
  onSave,
  onCancel,
}: {
  card: OfferCard;
  onSave: (edit: OfferEdit) => Promise<string | null>;
  onCancel: () => void;
}) {
  const e = card.edit;
  const isCar = card.kind === "auto_propio";
  const [kind, setKind] = useState<string>(isCar ? "auto_propio" : (e.kind ?? "otro"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = (k: string) => `ed-${k}-${card.id}`;
  const isT = kind === "vuelo" || kind === "micro" || kind === "tren";
  const dateOnly = kind === "actividad" || kind === "otro";
  const d = (k: string) => card.doubtful.includes(k);

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    let edit: OfferEdit;
    if (isCar) {
      const km = toNumber(s("km"));
      const hours = toNumber(s("hours"));
      const cons = toNumber(s("consumption"));
      const fuel = toNumber(s("fuelPrice"));
      const tolls = toNumber(s("tolls")) ?? 0;
      if (!km || !hours || !cons || !fuel) {
        setError("Completá km, horas, consumo y precio del litro.");
        return;
      }
      edit = {
        name: s("name"),
        comfort: Number(s("comfort")) || 3,
        car: { km, hours, consumptionLPer100: cons, fuelPrice: fuel, tolls },
      };
    } else {
      const depart = s("depart") || null;
      const arrive = s("arrive") || null;
      const price = s("price") ? toNumber(s("price")) : null;
      if (s("price") && price === null) {
        setError("El precio no se entiende. Escribilo así: 80.000");
        return;
      }
      edit = {
        kind: kind as OfferEdit["kind"],
        direction: isT ? (s("direction") as OfferEdit["direction"]) : null,
        name: s("name"),
        company: s("company"),
        depart,
        arrive: dateOnly ? null : arrive,
        durationMin: isT ? parseDur(s("duration")) : (e.durationMin ?? null),
        price,
        currency: s("currency") === "USD" ? "USD" : "ARS",
        basis: (s("basis") || "total") as OfferEdit["basis"],
        comfort: Number(s("comfort")) || 3,
        detail: s("detail"),
        ...(kind === "alojamiento" ? { score: s("score") || null } : {}),
      };
    }
    setSaving(true);
    setError(null);
    const msg = await onSave(edit);
    setSaving(false);
    if (msg) setError(msg);
  }

  return (
    <form onSubmit={submit} aria-label="Editar opción" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {!isCar ? (
          <F id={id("kind")} label="Tipo">
            <select id={id("kind")} className={input} value={kind} onChange={(ev) => setKind(ev.target.value)}>
              {Object.entries(KINDS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </F>
        ) : null}
        {isT ? (
          <F id={id("direction")} label="Sentido" doubt={d("direction")}>
            <select id={id("direction")} name="direction" className={input} defaultValue={e.direction ?? "ida"}>
              {Object.entries(DIRS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </F>
        ) : null}
        <F id={id("name")} label={isCar ? "Modelo" : "Nombre"} doubt={d("name")}>
          <input
            id={id("name")}
            name="name"
            className={input}
            defaultValue={e.name ?? ""}
            autoComplete="off"
            placeholder={kind === "alojamiento" ? "Hotel…" : "Ej.: AR 1672 directo"}
          />
        </F>
        {!isCar ? (
          <F id={id("company")} label="Empresa o sitio">
            <input
              id={id("company")}
              name="company"
              className={input}
              defaultValue={e.company ?? ""}
              autoComplete="off"
            />
          </F>
        ) : null}
        {isCar ? (
          <>
            <F id={id("km")} label="Km por tramo">
              <input id={id("km")} name="km" inputMode="decimal" className={input} defaultValue={fmtNum(e.car?.km)} />
            </F>
            <F id={id("hours")} label="Horas de manejo por tramo">
              <input
                id={id("hours")}
                name="hours"
                inputMode="decimal"
                className={input}
                defaultValue={fmtNum(e.car?.hours)}
              />
            </F>
            <F id={id("consumption")} label="Consumo (litros cada 100 km)">
              <input
                id={id("consumption")}
                name="consumption"
                inputMode="decimal"
                className={input}
                defaultValue={fmtNum(e.car?.consumptionLPer100)}
              />
            </F>
            <F id={id("fuelPrice")} label="Precio del litro ($)" doubt={d("fuelPrice")}>
              <input
                id={id("fuelPrice")}
                name="fuelPrice"
                inputMode="decimal"
                className={input}
                defaultValue={fmtNum(e.car?.fuelPrice)}
              />
            </F>
            <F id={id("tolls")} label="Peajes por tramo ($)" doubt={d("tolls")}>
              <input
                id={id("tolls")}
                name="tolls"
                inputMode="decimal"
                className={input}
                defaultValue={fmtNum(e.car?.tolls)}
              />
            </F>
          </>
        ) : (
          <>
            <F
              id={id("depart")}
              label={kind === "alojamiento" ? "Check-in" : dateOnly ? "Fecha" : "Salida"}
              doubt={d("depart")}
            >
              {dateOnly ? (
                <input
                  id={id("depart")}
                  name="depart"
                  type="date"
                  className={input}
                  defaultValue={(e.depart ?? "").slice(0, 10)}
                />
              ) : (
                <input
                  id={id("depart")}
                  name="depart"
                  type="datetime-local"
                  className={input}
                  defaultValue={e.depart && e.depart.length > 10 ? e.depart : e.depart ? `${e.depart}T12:00` : ""}
                />
              )}
            </F>
            {!dateOnly ? (
              <F id={id("arrive")} label={kind === "alojamiento" ? "Check-out" : "Llegada"} doubt={d("arrive")}>
                <input
                  id={id("arrive")}
                  name="arrive"
                  type="datetime-local"
                  className={input}
                  defaultValue={e.arrive && e.arrive.length > 10 ? e.arrive : e.arrive ? `${e.arrive}T12:00` : ""}
                />
              </F>
            ) : null}
            {isT ? (
              <F id={id("duration")} label="Duración por tramo (h:mm)" doubt={d("durationMin")}>
                <input
                  id={id("duration")}
                  name="duration"
                  className={input}
                  defaultValue={fmtDur(e.durationMin)}
                  placeholder="2:20"
                />
              </F>
            ) : null}
            <F id={id("price")} label="Precio" doubt={d("price")}>
              <input
                id={id("price")}
                name="price"
                inputMode="decimal"
                className={input}
                defaultValue={fmtNum(e.price)}
                placeholder="80.000"
              />
            </F>
            <F id={id("currency")} label="Moneda">
              <select id={id("currency")} name="currency" className={input} defaultValue={e.currency ?? "ARS"}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </F>
            <F id={id("basis")} label="Cómo se cobra" doubt={d("basis")}>
              <select id={id("basis")} name="basis" className={input} defaultValue={e.basis ?? "total"}>
                {Object.entries(BASES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </F>
            {kind === "alojamiento" ? (
              <F id={id("score")} label="Puntaje">
                <input
                  id={id("score")}
                  name="score"
                  className={input}
                  defaultValue={e.score ?? ""}
                  placeholder="8,6/10"
                />
              </F>
            ) : null}
          </>
        )}
        <F id={id("comfort")} label="Confort">
          <select id={id("comfort")} name="comfort" className={input} defaultValue={String(e.comfort ?? 3)}>
            {Object.entries(COMFORT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </F>
        {!isCar ? (
          <F id={id("detail")} label="Detalle">
            <input
              id={id("detail")}
              name="detail"
              className={input}
              defaultValue={e.detail ?? ""}
              placeholder="Equipaje, desayuno, cancelación…"
            />
          </F>
        ) : null}
      </div>
      {error ? (
        <p className="font-semibold text-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReferencePlace } from "@/integrations/types";
import { saveAirports, suggestPlaces } from "@/server/actions/radar";
import { Button } from "../Button";

function Field({
  id,
  label,
  searchLabel,
  place,
  value,
  onChange,
}: {
  id: string;
  label: string;
  searchLabel: string;
  place: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [term, setTerm] = useState(place);
  const [hints, setHints] = useState<ReferencePlace[]>([]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      suggestPlaces(term)
        .then((r) => alive && setHints(r.ok ? r.data.slice(0, 4) : []))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label} {place && <span className="font-normal text-ink-soft">({place})</span>}
      </label>
      <input
        id={id}
        value={value}
        maxLength={3}
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 3))}
        placeholder="3 letras"
        autoCapitalize="characters"
        className="min-h-12 w-28 rounded-xl border-[1.5px] border-line bg-surface px-3 font-bold uppercase tracking-wider placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
      />
      <input
        type="search"
        aria-label={searchLabel}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar ciudad o aeropuerto"
        autoComplete="off"
        className="min-h-11 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
      />
      {term.trim().length >= 2 && hints.length === 0 && (
        <p className="text-xs text-ink-soft">Sin sugerencias. Probá con la ciudad grande más cercana.</p>
      )}
      {hints.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hints.map((h) => (
            <button
              key={h.code}
              type="button"
              onClick={() => onChange(h.code)}
              className={`rounded-full border px-3 py-1 text-sm ${value === h.code ? "border-route bg-route-soft" : "border-line bg-surface"}`}
            >
              {h.code} · {h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AirportPicker({
  tripId,
  originLabel,
  destinationLabel,
  originIata,
  destinationIata,
  onDone,
}: {
  tripId: string;
  originLabel: string;
  destinationLabel: string;
  originIata: string | null;
  destinationIata: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState(originIata ?? "");
  const [dest, setDest] = useState(destinationIata ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl bg-surface-2 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const r = await saveAirports(tripId, origin, dest);
          if (!r.ok) setMsg(r.error.message);
          else {
            onDone?.();
            router.refresh();
          }
        } catch {
          setMsg("No se pudo guardar. Probá de nuevo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="radar-origin"
          label="Aeropuerto de salida"
          searchLabel="Buscar ciudad o aeropuerto de salida"
          place={originLabel}
          value={origin}
          onChange={setOrigin}
        />
        <Field
          id="radar-dest"
          label="Aeropuerto de destino"
          searchLabel="Buscar ciudad o aeropuerto de destino"
          place={destinationLabel}
          value={dest}
          onChange={setDest}
        />
      </div>
      {msg && (
        <p role="alert" className="text-sm text-alert">
          {msg}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "Guardando…" : "Guardar aeropuertos"}
      </Button>
    </form>
  );
}

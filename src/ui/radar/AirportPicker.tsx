"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReferencePlace } from "@/integrations/types";
import { saveAirports, suggestPlaces } from "@/server/actions/radar";
import { Button } from "../Button";

function Field({
  id,
  label,
  place,
  value,
  onChange,
}: {
  id: string;
  label: string;
  place: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hints, setHints] = useState<ReferencePlace[]>([]);
  useEffect(() => {
    let alive = true;
    suggestPlaces(place)
      .then((r) => alive && r.ok && setHints(r.data.slice(0, 4)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [place]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label} <span className="font-normal text-ink-soft">({place})</span>
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 3))}
        placeholder="BUE"
        autoCapitalize="characters"
        className="min-h-12 w-28 rounded-xl border-[1.5px] border-line bg-surface px-3 font-bold uppercase tracking-wider"
      />
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
          place={originLabel || "origen"}
          value={origin}
          onChange={setOrigin}
        />
        <Field id="radar-dest" label="Aeropuerto de destino" place={destinationLabel} value={dest} onChange={setDest} />
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

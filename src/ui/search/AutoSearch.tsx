"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runSearch } from "@/server/actions/search";
import { missingText, summaryText } from "./view";

export function AutoSearch({
  tripId,
  configured,
  configMessage,
  needsSearch,
  paramsKey,
  summary,
  messages,
  missingAirlines,
  airlineLinks,
}: {
  tripId: string;
  configured: boolean;
  configMessage: string;
  needsSearch: boolean;
  paramsKey: string;
  summary: { flights: number; lodging: number; searchedAt: string } | null;
  messages: string[];
  missingAirlines: string[];
  airlineLinks: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Última clave disparada: un doble montaje de React no busca dos veces.
  const fired = useRef<string | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const r = await runSearch(tripId, force);
        if (!r.ok) setError(r.error.message);
      } catch {
        setError("No pude buscar ahora. Probá de nuevo en un rato.");
      } finally {
        setBusy(false);
        router.refresh();
      }
    },
    [tripId, router],
  );

  useEffect(() => {
    if (!configured || !needsSearch || fired.current === paramsKey) return;
    fired.current = paramsKey;
    void run(false);
  }, [configured, needsSearch, paramsKey, run]);

  const missing = missingText(missingAirlines);

  return (
    <section
      aria-label="Búsqueda automática"
      className="mb-5 space-y-2 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-xl font-bold">Búsqueda automática</h2>
        <span className="text-sm text-ink-soft">Google Flights y Google Hotels</span>
      </div>

      {!configured ? (
        <p className="text-sm text-ink-soft">{configMessage}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm font-bold">
              {busy ? "Buscando vuelos y alojamiento…" : summary ? summaryText(summary) : ""}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(true)}
              className="min-h-11 rounded-xl border-[1.5px] border-line px-3 text-sm font-bold disabled:opacity-50"
            >
              Volver a buscar
            </button>
          </div>
          {!busy &&
            [...(error ? [error] : []), ...messages].map((m) => (
              <p key={m} className="text-sm text-signal">
                {m}
              </p>
            ))}
          {!busy && missing && (
            <p className="text-sm text-ink-soft">
              {missing}
              {missingAirlines.map((a) =>
                airlineLinks[a] ? (
                  <a
                    key={a}
                    href={airlineLinks[a]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-bold text-route"
                  >
                    Ver en {a} ↗
                  </a>
                ) : null,
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

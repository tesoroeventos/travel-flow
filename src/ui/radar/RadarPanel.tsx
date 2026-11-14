"use client";

import { useState } from "react";
import { shiftDeparture, type RadarQuery } from "@/domain/radar/query";
import { RADAR_MESSAGES } from "@/integrations/radar/messages";
import { RADAR_SITES } from "@/integrations/radar/sites";
import { markSiteOpened, resetRadarChecks } from "@/server/actions/radar";
import { fmtDay, fmtRange, plural } from "../format";
import { Icon } from "../icons";
import { AirportPicker } from "./AirportPicker";
import { FareCalendar } from "./FareCalendar";
import { KIDS_NOTE, siteButtons } from "./view";

type Check = { siteId: string; openedAt: string };

function people(q: RadarQuery): string {
  const parts = [plural(q.adults, "adulto", "adultos")];
  if (q.children) parts.push(plural(q.children, "chico", "chicos"));
  if (q.infants) parts.push(plural(q.infants, "bebé", "bebés"));
  return parts.join(", ");
}

export function RadarPanel({
  tripId,
  query,
  checks: initialChecks,
  hasOptions,
  baseCurrency,
  usdRate,
}: {
  tripId: string;
  query: RadarQuery;
  checks: Check[];
  hasOptions: boolean;
  baseCurrency: string;
  usdRate: number | null;
}) {
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [depart, setDepart] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const hasAirports = Boolean(query.originIata && query.destinationIata);
  const q = depart ? shiftDeparture(query, depart) : query;
  const groups = siteButtons(q, checks);
  const visible = hasAirports ? groups : groups.filter((g) => g.group === "micros" || g.group === "alojamiento");
  const total = RADAR_SITES.length;

  const mark = (siteId: string) => {
    const now = new Date().toISOString();
    setChecks((cs) => [...cs.filter((c) => c.siteId !== siteId), { siteId, openedAt: now }]);
    void markSiteOpened(tripId, siteId).catch(() => {});
  };

  const routeText = `${query.originIata ?? query.originLabel} → ${query.destinationIata ?? query.destinationLabel}`;

  return (
    <details
      open={!hasOptions}
      className="group mb-5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-display text-xl font-bold">Buscar en otros sitios</span>
        <span className="text-sm text-ink-soft">
          {routeText} · {fmtRange(q.depart, q.return)} · {people(q)}
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        {hasAirports && (
          <div className="flex justify-end">
            <button type="button" className="text-sm font-bold text-route" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cerrar" : "Cambiar"}
            </button>
          </div>
        )}

        {(!hasAirports || editing) && (
          <div className="space-y-2">
            {!hasAirports && <p className="font-bold">{RADAR_MESSAGES.no_airports}</p>}
            <AirportPicker
              tripId={tripId}
              originLabel={query.originLabel}
              destinationLabel={query.destinationLabel}
              originIata={query.originIata}
              destinationIata={query.destinationIata}
              onDone={() => {
                setEditing(false);
                setDepart(null);
              }}
            />
          </div>
        )}

        {hasAirports && (
          <FareCalendar
            key={`${query.originIata}-${query.destinationIata}`}
            tripId={tripId}
            tripDepart={query.depart}
            tripReturn={query.return}
            selected={q.depart}
            baseCurrency={baseCurrency}
            usdRate={usdRate}
            onPick={(day) => setDepart(day === query.depart ? null : day)}
          />
        )}

        {depart && (
          <p role="status" className="flex flex-wrap items-center gap-x-3 rounded-xl bg-signal-soft px-3 py-2 text-sm">
            <span>Enlaces con salida el {fmtDay(depart)}</span>
            <button type="button" className="font-bold text-route" onClick={() => setDepart(null)}>
              Volver a las fechas del viaje
            </button>
          </p>
        )}

        <div className="space-y-3">
          {visible.map((g) => (
            <section key={g.group} aria-label={g.label}>
              <h3 className="mb-1.5 text-sm font-bold text-ink-soft">{g.label}</h3>
              <ul className="flex flex-wrap gap-2">
                {g.sites.map((s) =>
                  s.url ? (
                    <li key={s.id} className="flex flex-col">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => mark(s.id)}
                        data-site={s.id}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] px-3 font-bold ${
                          s.checked
                            ? "border-route bg-route-soft text-route"
                            : "border-line bg-surface hover:border-ink-soft"
                        }`}
                      >
                        {s.checked && <Icon name="check" className="size-4" />}
                        {s.name}
                        {s.note === RADAR_MESSAGES.no_prefill && (
                          <span title={s.note} className="text-ink-soft">
                            <Icon name="info" className="size-4" />
                            <span className="sr-only">{s.note}</span>
                          </span>
                        )}
                        {s.checked && <span className="sr-only">(revisado)</span>}
                      </a>
                      {s.note === KIDS_NOTE && <span className="pt-0.5 text-xs text-signal">{s.note}</span>}
                    </li>
                  ) : null,
                )}
              </ul>
              {g.sites.some((s) => s.url && s.note === RADAR_MESSAGES.no_prefill) && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-signal">
                  <Icon name="info" className="size-3.5" />
                  {RADAR_MESSAGES.no_prefill}
                </p>
              )}
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <span>
            Revisaste {checks.length} de {total}
            {checks.length > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  className="font-bold text-route"
                  onClick={async () => {
                    const r = await resetRadarChecks(tripId).catch(() => null);
                    if (r?.ok) setChecks([]);
                  }}
                >
                  Empezar de nuevo
                </button>
              </>
            )}
          </span>
          <span className="text-ink-soft">Lo que encuentres, pegalo como link o captura acá abajo ↓</span>
        </div>
      </div>
    </details>
  );
}

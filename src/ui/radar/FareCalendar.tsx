"use client";

import { useEffect, useState } from "react";
import { windowDates } from "@/domain/radar/query";
import { RADAR_MESSAGES } from "@/integrations/radar/messages";
import type { ReferenceFare } from "@/integrations/types";
import { loadCalendar } from "@/server/actions/radar";
import { fmtDay } from "../format";
import { agoText, cheapestDay, displayFare, fareDetail } from "./view";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; fares: ReferenceFare[]; fetchedAt: string };

const LABEL = "Precios de referencia · vistos por otros usuarios hace 1 a 7 días, no son precio final";
const amountFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FareCalendar({
  tripId,
  tripDepart,
  tripReturn,
  selected,
  baseCurrency,
  usdRate,
  onPick,
}: {
  tripId: string;
  tripDepart: string;
  tripReturn: string;
  selected: string;
  baseCurrency: string;
  usdRate: number | null;
  onPick: (day: string) => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    loadCalendar(tripId)
      .then((r) => {
        if (!alive) return;
        if (!r.ok) setState({ status: "error", message: r.error.message });
        else if (r.data.fares.length === 0) setState({ status: "error", message: RADAR_MESSAGES.no_data });
        else setState({ status: "ok", fares: r.data.fares, fetchedAt: r.data.fetchedAt });
      })
      .catch(() => alive && setState({ status: "error", message: RADAR_MESSAGES.unavailable }));
    return () => {
      alive = false;
    };
  }, [tripId]);

  if (state.status === "loading") return <p className="text-sm text-ink-soft">Buscando precios de referencia…</p>;
  if (state.status === "error")
    return (
      <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">
        {state.message}
      </p>
    );

  const byDay = new Map(state.fares.map((f) => [f.date, f]));
  const days = windowDates(tripDepart, tripReturn, 3, localToday()).map((d) => d.depart);
  const best = cheapestDay(state.fares);
  const bestFare = best ? byDay.get(best) : undefined;
  const shown = state.fares.map((f) => displayFare(f, baseCurrency, usdRate).currency);
  const currency = shown[0] ?? baseCurrency;

  return (
    <section aria-label="Precios de referencia" className="space-y-2">
      <p className="text-sm text-ink-soft">
        {LABEL} <span className="whitespace-nowrap">({currency})</span>
      </p>
      <ol className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const f = byDay.get(day);
          const shownFare = f ? displayFare(f, baseCurrency, usdRate) : null;
          const isSel = day === selected;
          const isTrip = day === tripDepart;
          return (
            <li key={day} className="min-w-[4.25rem] flex-1">
              <button
                type="button"
                onClick={() => onPick(day)}
                aria-pressed={isSel}
                aria-label={`${fmtDay(day)}: ${shownFare ? `${amountFmt.format(shownFare.amountCents / 100)} ${shownFare.currency}` : "sin datos"}`}
                className={`flex w-full flex-col items-center gap-0.5 rounded-xl border-[1.5px] px-1 py-2 text-center transition ${
                  isSel
                    ? "border-route bg-route-soft"
                    : isTrip
                      ? "border-line-strong bg-surface"
                      : "border-line bg-surface hover:border-ink-soft"
                }`}
              >
                <span className="text-xs font-bold">{fmtDay(day)}</span>
                <span className={`text-sm tabular-nums ${shownFare ? "" : "text-ink-soft"}`}>
                  {shownFare ? amountFmt.format(shownFare.amountCents / 100) : "sin datos"}
                </span>
                {day === best && <span className="text-[0.7rem] font-bold text-route">más bajo</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {bestFare && (
        <p className="text-sm">
          <span className="font-bold">{fmtDay(bestFare.date)}</span>
          {fareDetail(bestFare) && `: ${fareDetail(bestFare)}`} · {agoText(state.fetchedAt)}
        </p>
      )}
    </section>
  );
}

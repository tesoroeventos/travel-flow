import type { Itinerary } from "@/domain/itinerary/types";
import { ALERT_LABELS } from "@/domain/itinerary/types";
import { fmtDayLong, fmtDuration } from "../format";

/** Itinerario de solo lectura (impresión y enlace público). */
export function ItineraryReadOnly({ itinerary, tripTz }: { itinerary: Itinerary; tripTz: string }) {
  return (
    <div className="space-y-6">
      {itinerary.days.map((day) => (
        <section key={day.date} className="break-inside-avoid-page">
          <h3 className="font-display text-xl font-semibold">{fmtDayLong(day.date)}</h3>
          <ol className="stop-rail mt-2">
            {day.entries.map((e) => (
              <li key={e.key} className="relative pb-4 pl-8">
                <span className="stop-dot" data-kind={e.kind} data-alert={e.alerts.length ? "true" : undefined} aria-hidden />
                <div className="flex gap-3">
                  <p className="num w-12 shrink-0 font-semibold">{e.localTime}</p>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {e.title}
                      {e.tz !== tripTz ? <span className="ml-1 text-xs font-normal text-ink-soft">(hora local)</span> : null}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {[e.details.address, e.details.durationMin ? fmtDuration(Number(e.details.durationMin)) : "", e.suggested ? "sugerido" : ""].filter(Boolean).join(", ")}
                    </p>
                    {e.alerts.length ? <p className="text-sm font-semibold">{e.alerts.map((a) => ALERT_LABELS[a]).join(", ")}</p> : null}
                    {e.note ? <p className="text-sm">Nota: {e.note}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

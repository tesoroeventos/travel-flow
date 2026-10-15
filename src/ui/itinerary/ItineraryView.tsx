"use client";

import { useOptimistic, useState, useTransition } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Itinerary, ItineraryEntry } from "@/domain/itinerary/types";
import { ALERT_LABELS } from "@/domain/itinerary/types";
import { moveActivitiesAction, orderByProximityAction, setNoteAction } from "@/server/actions/itinerary";
import { fmtDayLong, fmtDuration, fmtMoney } from "../format";

const BLOCKS = [
  ["morning", "Mañana"],
  ["midday", "Mediodía"],
  ["afternoon", "Tarde"],
  ["night", "Noche"],
] as const;

function detailLine(e: ItineraryEntry, currency: string): string {
  const d = e.details;
  switch (e.kind) {
    case "leave_home":
      return [d.transferMin ? `Traslado ${fmtDuration(Number(d.transferMin))}` : "Sin tiempo de traslado cargado", `anticipación ${fmtDuration(Number(d.advanceMin))}`].join(", ");
    case "transfer":
      return fmtDuration(Number(d.durationMin));
    case "departure":
      return `Duración ${fmtDuration(Number(d.durationMin))}`;
    case "connection":
      return `${fmtDuration(Number(d.minutes))} para conectar`;
    case "activity":
      return [
        d.address,
        fmtDuration(Number(d.durationMin)),
        d.costCents ? fmtMoney(Number(d.costCents), currency) : "",
        d.requiresBooking === "true" ? "requiere reserva" : "",
      ]
        .filter(Boolean)
        .join(", ");
    default:
      return d.address ?? "";
  }
}

function NoteEditor({ tripId, entry }: { tripId: string; entry: ItineraryEntry }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="text-sm font-semibold text-route" onClick={() => setOpen(true)}>
        {entry.note ? "Editar nota" : "Agregar nota"}
      </button>
    );
  return (
    <form
      action={async (fd) => {
        await setNoteAction(tripId, entry.key, fd);
        setOpen(false);
      }}
      className="mt-1 flex gap-2"
    >
      <input name="note" defaultValue={entry.note ?? ""} aria-label={`Nota para ${entry.title}`} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5" />
      <button className="rounded-md border border-line px-2 text-sm font-semibold">Guardar</button>
    </form>
  );
}

function EntryBody({ e, tripId, tripTz, currency, controls }: { e: ItineraryEntry; tripId: string; tripTz: string; currency: string; controls?: React.ReactNode }) {
  const alert = e.alerts.length > 0;
  return (
    <>
      <span className="stop-dot" data-kind={e.kind} data-alert={alert ? "true" : undefined} aria-hidden />
      <div className="flex items-start gap-3">
        <p className="num w-12 shrink-0 font-display text-lg font-semibold leading-6">
          {e.localTime}
          {e.tz !== tripTz ? <span className="block text-[10px] font-normal leading-3 text-ink-soft">hora local</span> : null}
        </p>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-6">{e.title}</p>
          {detailLine(e, currency) ? <p className="text-sm text-ink-soft">{detailLine(e, currency)}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {e.suggested ? <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">Sugerido</span> : null}
            {e.alerts.map((a) => (
              <span key={a} className="rounded bg-signal-soft px-1.5 py-0.5 text-xs font-semibold">
                {ALERT_LABELS[a]}
              </span>
            ))}
          </div>
          {e.note ? <p className="mt-1 rounded bg-surface-2 px-2 py-1 text-sm">{e.note}</p> : null}
          <div className="no-print mt-1 flex flex-wrap items-center gap-3">
            <NoteEditor tripId={tripId} entry={e} />
            {controls}
          </div>
        </div>
      </div>
    </>
  );
}

function SortableActivity({ e, children }: { e: ItineraryEntry; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: e.sourceId });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative pl-8 pb-5 ${isDragging ? "z-10 opacity-80" : ""}`}>
      {children}
      <button
        type="button"
        className="no-print absolute right-0 top-0 min-h-11 min-w-11 cursor-grab touch-none text-ink-soft"
        aria-label={`Arrastrar ${e.title}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
    </li>
  );
}

export function ItineraryView({
  tripId,
  itinerary,
  view,
  tripTz,
  currency,
  pendingCents,
}: {
  tripId: string;
  itinerary: Itinerary;
  view: "chrono" | "day";
  tripTz: string;
  currency: string;
  pendingCents: number;
}) {
  const [days, setDays] = useOptimistic(itinerary.days);
  const [, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function reorder(date: string, ids: string[]) {
    start(async () => {
      setDays((ds) =>
        ds.map((d) => {
          if (d.date !== date) return d;
          const acts = ids.map((id) => d.entries.find((e) => e.kind === "activity" && e.sourceId === id)!).filter(Boolean);
          let k = 0;
          return { ...d, entries: d.entries.map((e) => (e.kind === "activity" ? acts[k++]! : e)) };
        }),
      );
      await moveActivitiesAction(tripId, ids);
    });
  }

  const lastDate = days[days.length - 1]?.date;

  return (
    <div className="space-y-8">
      {message ? (
        <p role="status" className="rounded-md border border-signal/50 bg-signal-soft px-3 py-2">
          {message}
        </p>
      ) : null}
      {days.map((day) => {
        const activityIds = day.entries.filter((e) => e.kind === "activity").map((e) => e.sourceId);
        const move = (id: string, delta: number) => {
          const i = activityIds.indexOf(id);
          const j = i + delta;
          if (j < 0 || j >= activityIds.length) return;
          reorder(day.date, arrayMove(activityIds, i, j));
        };
        const renderEntry = (e: ItineraryEntry) => {
          const body = (
            <EntryBody
              e={e}
              tripId={tripId}
              tripTz={tripTz}
              currency={currency}
              controls={
                e.kind === "activity" && activityIds.length > 1 ? (
                  <>
                    <button type="button" className="text-sm font-semibold text-route disabled:opacity-40" disabled={activityIds[0] === e.sourceId} aria-label={`Subir ${e.title}`} onClick={() => move(e.sourceId, -1)}>
                      Subir
                    </button>
                    <button type="button" className="text-sm font-semibold text-route disabled:opacity-40" disabled={activityIds[activityIds.length - 1] === e.sourceId} aria-label={`Bajar ${e.title}`} onClick={() => move(e.sourceId, 1)}>
                      Bajar
                    </button>
                  </>
                ) : null
              }
            />
          );
          return e.kind === "activity" ? (
            <SortableActivity key={e.key} e={e}>
              {body}
            </SortableActivity>
          ) : (
            <li key={e.key} className="relative pl-8 pb-5">
              {body}
            </li>
          );
        };

        return (
          <section key={day.date} aria-label={fmtDayLong(day.date)}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl font-semibold">{fmtDayLong(day.date)}</h3>
              {activityIds.length > 1 ? (
                <button
                  type="button"
                  className="no-print text-sm font-semibold text-route"
                  onClick={() =>
                    start(async () => {
                      const r = await orderByProximityAction(tripId, day.date);
                      setMessage(r.ok ? null : (r.message ?? null));
                    })
                  }
                >
                  Ordenar por cercanía
                </button>
              ) : null}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(ev: DragEndEvent) => {
                const { active, over } = ev;
                if (!over || active.id === over.id) return;
                reorder(day.date, arrayMove(activityIds, activityIds.indexOf(String(active.id)), activityIds.indexOf(String(over.id))));
              }}
            >
              <SortableContext items={activityIds} strategy={verticalListSortingStrategy}>
                {view === "day" ? (
                  BLOCKS.map(([b, label]) => {
                    const list = day.entries.filter((e) => e.block === b);
                    if (list.length === 0) return null;
                    return (
                      <div key={b} className="mb-2">
                        <h4 className="mb-2 text-sm font-semibold text-ink-soft">{label}</h4>
                        <ol className="stop-rail">{list.map(renderEntry)}</ol>
                      </div>
                    );
                  })
                ) : (
                  <ol className="stop-rail">{day.entries.map(renderEntry)}</ol>
                )}
              </SortableContext>
            </DndContext>
            {day.date === lastDate && pendingCents > 0 ? (
              <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                Pendiente de pago al cierre del viaje: <span className="num font-semibold">{fmtMoney(pendingCents, currency)}</span>
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

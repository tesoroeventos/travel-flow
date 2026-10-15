"use client";

import { useTransition } from "react";
import { acknowledgeItineraryAction } from "@/server/actions/itinerary";
import { Button } from "../Button";

export function ChangesBanner({ tripId, changed, added, removedCount }: { tripId: string; changed: string[]; added: string[]; removedCount: number }) {
  const [pending, start] = useTransition();
  return (
    <section aria-label="Cambió tu itinerario" className="rounded-lg border-2 border-signal bg-signal-soft p-4">
      <h3 className="font-display text-xl font-semibold">Cambió tu itinerario</h3>
      <p className="mt-1 text-sm">Revisá estas partes: cambió un horario, un alojamiento o una actividad.</p>
      <ul className="mt-2 list-disc pl-5">
        {changed.map((t) => (
          <li key={`c-${t}`}>{t}: nuevo horario</li>
        ))}
        {added.map((t) => (
          <li key={`a-${t}`}>{t}: agregado</li>
        ))}
        {removedCount > 0 ? <li>{removedCount === 1 ? "1 elemento quitado" : `${removedCount} elementos quitados`}</li> : null}
      </ul>
      <Button className="mt-3" variant="secondary" disabled={pending} onClick={() => start(() => acknowledgeItineraryAction(tripId))}>
        Entendido
      </Button>
    </section>
  );
}

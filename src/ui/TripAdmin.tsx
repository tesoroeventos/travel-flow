import { deleteTripAction, renameTravelerAction } from "@/server/actions/trips";
import { createShareLinkAction, duplicateTripAction, revokeShareLinkAction } from "@/server/actions/share";
import type { LoadedTrip } from "@/server/services/load-trip";
import { ConfirmButton } from "./ConfirmButton";
import { CopyLink } from "./CopyLink";

const KIND = { adult: "Adulto", child: "Niño", infant: "Bebé" } as const;
const card = "rounded-2xl bg-surface p-4 shadow-card";
const outline = "min-h-11 rounded-xl border-[1.5px] border-line px-4 font-bold hover:border-ink-soft";

/** Viajeros, compartir, duplicar y borrar: lo que antes estaba en el resumen del viaje. */
export function TripAdmin({ data }: { data: LoadedTrip }) {
  const { trip, travelers } = data;
  const id = trip.id;
  return (
    <>
      <section className={card}>
        <h2 className="font-display text-xl font-bold">Viajeros</h2>
        <ul className="mt-2 divide-y divide-line">
          {travelers.map((t) => (
            <li key={t.id} className="py-2">
              <form action={renameTravelerAction.bind(null, t.id)} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-ink-soft">{KIND[t.kind]}</span>
                <input
                  name="name"
                  defaultValue={t.name}
                  aria-label={`Nombre de ${t.name}`}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 hover:border-line focus:border-route"
                />
                <button type="submit" className="min-h-11 px-2 text-sm font-bold text-route">
                  Guardar
                </button>
              </form>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">Para cambiar cuántos van, cambiá “Personas” arriba.</p>
      </section>

      <section id="compartir" className={card}>
        <h2 className="font-display text-xl font-bold">Compartir</h2>
        {trip.publicShareToken ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">Cualquiera con el enlace puede ver el viaje, sin editarlo.</p>
            <CopyLink path={`/share/${trip.publicShareToken}`} />
            <form action={revokeShareLinkAction.bind(null, id)} className="mt-2">
              <button className="min-h-11 font-bold text-alert">Dejar de compartir</button>
            </form>
          </>
        ) : (
          <form action={createShareLinkAction.bind(null, id)} className="mt-2">
            <p className="text-sm text-ink-soft">
              Creá un enlace de solo lectura para mostrar las opciones y el itinerario.
            </p>
            <button className={`mt-2 ${outline}`}>Crear enlace para compartir</button>
          </form>
        )}
      </section>

      <section className="flex flex-wrap gap-2 pt-1">
        <form action={duplicateTripAction.bind(null, id)}>
          <button className={outline}>Duplicar viaje</button>
        </form>
        <ConfirmButton
          action={deleteTripAction.bind(null, id)}
          label="Borrar viaje"
          confirm="¿Borrar este viaje y todo lo cargado? No se puede deshacer."
        />
      </section>
    </>
  );
}

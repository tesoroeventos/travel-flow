import { getDb } from "@/server/db";
import { requireCtx } from "@/server/auth/session";
import { tripCards } from "@/server/services/dashboard";
import { TripCardView } from "@/ui/TripCardView";
import { LinkButton } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";

export const metadata = { title: "Mis viajes · TravelFlow" };

export default async function TripsPage() {
  const ctx = await requireCtx();
  const cards = await tripCards(await getDb(), ctx);
  return (
    <main className="px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight">Mis viajes</h1>
        <LinkButton href="/viajes/nuevo">Crear viaje</LinkButton>
      </div>
      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No hay viajes guardados" action={<LinkButton href="/viajes/nuevo">Crear viaje</LinkButton>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <TripCardView key={c.id} card={c} />
          ))}
        </div>
      )}
    </main>
  );
}

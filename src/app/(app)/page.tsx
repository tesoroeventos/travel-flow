import { getDb } from "@/server/db";
import { currentUser, requireCtx } from "@/server/auth/session";
import { tripCards, type TripCard } from "@/server/services/dashboard";
import { TripCardView } from "@/ui/TripCardView";
import { LinkButton } from "@/ui/Button";
import { EmptyState } from "@/ui/Feedback";

export const metadata = { title: "Inicio · TravelFlow" };

function Section({ title, cards, empty }: { title: string; cards: TripCard[]; empty: string }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {cards.length === 0 ? (
        <p className="mt-2 text-ink-soft">{empty}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <TripCardView key={c.id} card={c} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function Dashboard() {
  const ctx = await requireCtx();
  const [user, cards] = await Promise.all([currentUser(), getDb().then((db) => tripCards(db, ctx))]);
  const active = cards.filter((c) => c.phase === "active");
  const upcoming = cards.filter((c) => c.phase === "upcoming");
  const past = cards.filter((c) => c.phase === "past");

  return (
    <main className="px-4 py-6 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-ink-soft">Hola{user ? `, ${user.name.split(" ")[0]}` : ""}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">Tus viajes</h1>
        </div>
        <LinkButton href="/viajes/nuevo">Crear viaje</LinkButton>
      </div>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Todavía no armaste ningún viaje" action={<LinkButton href="/viajes/nuevo">Crear viaje</LinkButton>}>
            Cargá origen, destino y fechas. Después comparás transporte y alojamiento con el costo real de punta a punta.
          </EmptyState>
        </div>
      ) : null}

      <Section title="Viajes activos" cards={active} empty="No estás viajando ahora." />
      <Section title="Próximos viajes" cards={upcoming} empty="No hay viajes programados." />
      {past.length > 0 ? <Section title="Viajes anteriores" cards={past} empty="" /> : null}
    </main>
  );
}

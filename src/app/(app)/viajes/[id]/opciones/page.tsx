import { getTripData } from "@/server/queries";
import { offerCardsFromLoaded } from "@/server/services/offers";
import { proposalsFromLoaded } from "@/server/services/proposals";
import { OptionsBoard } from "@/ui/options/OptionsBoard";

export const metadata = { title: "Opciones · TravelFlow" };

export default async function OptionsPage({ params }: PageProps<"/viajes/[id]/opciones">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const cards = offerCardsFromLoaded(data);
  const p = proposalsFromLoaded(data);
  return (
    <main className="mx-auto max-w-3xl px-4 py-5 md:px-0">
      <h2 className="sr-only">Opciones</h2>
      <OptionsBoard
        tripId={id}
        cards={cards}
        status={{
          missing: p.missing,
          pending: p.pending,
          comboCount: p.comboCount,
          needsUsdRate: p.needsUsdRate,
        }}
        hasOrigin={Boolean(data.trip.originLabel.trim())}
      />
    </main>
  );
}

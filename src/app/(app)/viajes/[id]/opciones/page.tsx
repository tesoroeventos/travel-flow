import { buildRadarQuery } from "@/domain/radar/query";
import { getTripData } from "@/server/queries";
import { makeRepos } from "@/server/repos";
import { offerCardsFromLoaded } from "@/server/services/offers";
import { proposalsFromLoaded } from "@/server/services/proposals";
import { OptionsBoard } from "@/ui/options/OptionsBoard";
import { RadarPanel } from "@/ui/radar/RadarPanel";

export const metadata = { title: "Opciones · TravelFlow" };

export default async function OptionsPage({ params }: PageProps<"/viajes/[id]/opciones">) {
  const { id } = await params;
  const { ctx, db, data } = await getTripData(id);
  const cards = offerCardsFromLoaded(data);
  const p = proposalsFromLoaded(data);
  const checks = await makeRepos(db).radar.listChecks(ctx, id);
  const base = data.trip.baseCurrency;
  const usd = data.rates
    .filter((r) => r.fromCurrency === "USD" && r.toCurrency === base)
    .sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  return (
    <main className="mx-auto max-w-3xl px-4 py-5 md:px-0">
      <h2 className="sr-only">Opciones</h2>
      <RadarPanel
        tripId={id}
        query={buildRadarQuery(data.trip, data.travelers)}
        checks={checks.map((c) => ({ siteId: c.siteId, openedAt: c.openedAt.toISOString() }))}
        hasOptions={cards.length > 0}
        baseCurrency={base}
        usdRate={usd ? Number(usd.rate) : null}
      />
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

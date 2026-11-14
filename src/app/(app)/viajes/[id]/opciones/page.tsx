import { buildRadarQuery } from "@/domain/radar/query";
import { getTripData } from "@/server/queries";
import { makeRepos } from "@/server/repos";
import { offerCardsFromLoaded } from "@/server/services/offers";
import { proposalsFromLoaded } from "@/server/services/proposals";
import { OptionsBoard } from "@/ui/options/OptionsBoard";
import { RadarPanel } from "@/ui/radar/RadarPanel";
import { RADAR_SITES } from "@/integrations/radar/sites";
import { SEARCH_MESSAGES, searchConfigured } from "@/integrations/search";
import { getTripSearch, searchCurrency, searchParamsKey } from "@/server/services/trip-search";
import { AutoSearch } from "@/ui/search/AutoSearch";

export const metadata = { title: "Opciones · TravelFlow" };

export default async function OptionsPage({ params }: PageProps<"/viajes/[id]/opciones">) {
  const { id } = await params;
  const { ctx, db, data } = await getTripData(id);
  const cards = offerCardsFromLoaded(data);
  const p = proposalsFromLoaded(data);
  const checks = await makeRepos(db).radar.listChecks(ctx, id);
  const base = data.trip.baseCurrency;
  const query = buildRadarQuery(data.trip, data.travelers);
  const hasAirports = Boolean(query.originIata && query.destinationIata);
  const paramsKey = searchParamsKey(query, searchCurrency(data.trip.baseCurrency));
  const last = hasAirports ? await getTripSearch(db, ctx, id) : null;
  const configured = searchConfigured();
  // Enlace a cada aerolínea que Google mostró sin precio (por ejemplo, Flybondi).
  const airlineLinks = Object.fromEntries(
    (last?.missingAirlines ?? []).flatMap((a) => {
      const site = RADAR_SITES.find((s) => s.name.toLowerCase() === a.toLowerCase());
      const url = site?.buildUrl(query);
      return url ? [[a, url]] : [];
    }),
  );
  const usd = data.rates
    .filter((r) => r.fromCurrency === "USD" && r.toCurrency === base)
    .sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  return (
    <main className="mx-auto max-w-3xl px-4 py-5 md:px-0">
      <h2 className="sr-only">Opciones</h2>
      <RadarPanel
        tripId={id}
        query={query}
        checks={checks.map((c) => ({ siteId: c.siteId, openedAt: c.openedAt.toISOString() }))}
        hasOptions={cards.length > 0}
        baseCurrency={base}
        usdRate={usd ? Number(usd.rate) : null}
      />
      {hasAirports && (
        <AutoSearch
          tripId={id}
          configured={configured}
          configMessage={SEARCH_MESSAGES.not_configured}
          needsSearch={configured && last?.paramsKey !== paramsKey}
          paramsKey={paramsKey}
          summary={
            last
              ? { flights: last.flightsCount, lodging: last.lodgingCount, searchedAt: last.searchedAt.toISOString() }
              : null
          }
          messages={last?.error ? [last.error] : []}
          missingAirlines={last?.missingAirlines ?? []}
          airlineLinks={airlineLinks}
        />
      )}
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

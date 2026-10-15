import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";

/** Carga todo lo que necesita el dominio para un viaje (lanza NotFoundError si no es del workspace). */
export async function loadTrip(db: Db, ctx: Ctx, tripId: string) {
  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  const trip = await r.trips.require(ctx, tripId);
  const [
    travelers,
    transport,
    lodging,
    activities,
    costItems,
    scenarios,
    selections,
    toggles,
    ratings,
    weights,
    bookings,
    rates,
    overrides,
    expenses,
    stops,
  ] = await Promise.all([
    r.travelers.list(ctx, tripId),
    r.transport.list(ctx, tripId),
    r.lodging.list(ctx, tripId),
    r.activities.list(ctx, tripId),
    r.costItems.list(ctx, tripId),
    r.scenarios.list(ctx, tripId),
    parts.listSelections(ctx, tripId),
    parts.listToggles(ctx, tripId),
    parts.listRatings(ctx, tripId),
    parts.listWeights(ctx, tripId),
    r.bookings.list(ctx, tripId),
    r.rates.list(ctx),
    parts.listOverrides(ctx, tripId),
    r.expenses.list(ctx, tripId),
    r.stops.list(ctx, tripId),
  ]);
  return {
    trip,
    travelers,
    transport,
    lodging,
    activities,
    costItems,
    scenarios,
    selections,
    toggles,
    ratings,
    weights,
    bookings,
    rates,
    overrides,
    expenses,
    stops,
  };
}

export type LoadedTrip = Awaited<ReturnType<typeof loadTrip>>;

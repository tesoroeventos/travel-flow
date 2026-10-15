import type { Db } from "../db/client";
import {
  activities,
  bookings,
  costItems,
  expenses,
  lodgingOptions,
  scenarios,
  stops,
  transportOptions,
  travelers,
} from "../db/schema";
import { makeChildRepo } from "./child";
import { makeEventsRepo } from "./events";
import { makeRatesRepo } from "./rates";
import { makeTripsRepo } from "./trips";

export function makeRepos(db: Db) {
  const events = makeEventsRepo(db);
  return {
    events,
    trips: makeTripsRepo(db, events),
    travelers: makeChildRepo(db, travelers, "traveler", events),
    stops: makeChildRepo(db, stops, "stop", events),
    transport: makeChildRepo(db, transportOptions, "transport_option", events),
    lodging: makeChildRepo(db, lodgingOptions, "lodging_option", events),
    activities: makeChildRepo(db, activities, "activity", events),
    costItems: makeChildRepo(db, costItems, "cost_item", events),
    scenarios: makeChildRepo(db, scenarios, "scenario", events),
    bookings: makeChildRepo(db, bookings, "booking", events),
    expenses: makeChildRepo(db, expenses, "expense", events),
    rates: makeRatesRepo(db),
  };
}

export type Repos = ReturnType<typeof makeRepos>;

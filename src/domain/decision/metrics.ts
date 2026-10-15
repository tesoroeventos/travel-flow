import type { CostSummary } from "../costs/types";
import { minutesBetween } from "../time/calendar";
import type { RatingCriterion, ScenarioMetrics } from "./types";

export interface MetricsArgs {
  scenarioId: string;
  name: string;
  summary: CostSummary;
  legs: { leg: "outbound" | "return" | "internal"; segments: { departUtc: string; arriveUtc: string }[] }[];
  locationKm: number | null;
  flexiblePct: number | null;
  ratings: Partial<Record<RatingCriterion, number>>;
}

export function metricsFromScenario(a: MetricsArgs): ScenarioMetrics {
  const values: ScenarioMetrics["values"] = { price: a.summary.totalWithContingencyCents };

  const longLegs = a.legs.filter((l) => (l.leg === "outbound" || l.leg === "return") && l.segments.length > 0);
  if (longLegs.length > 0) {
    let minutes = 0;
    let transfers = 0;
    for (const l of longLegs) {
      const sorted = [...l.segments].sort((x, y) => x.departUtc.localeCompare(y.departUtc));
      minutes += minutesBetween(sorted[0]!.departUtc, sorted[sorted.length - 1]!.arriveUtc);
      transfers += sorted.length - 1;
    }
    values.travel_time = minutes;
    values.transfers = transfers;
  }
  if (a.locationKm !== null) values.location = a.locationKm;
  if (a.flexiblePct !== null) values.flexibility = a.flexiblePct;
  for (const [k, v] of Object.entries(a.ratings)) {
    if (v !== undefined) values[k as RatingCriterion] = v;
  }
  return { scenarioId: a.scenarioId, name: a.name, values };
}

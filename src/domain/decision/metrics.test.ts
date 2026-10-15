import { describe, expect, it } from "vitest";
import { metricsFromScenario } from "./metrics";
import { computeScenarioCosts } from "../costs/engine";
import { barilocheScenarioA } from "../__fixtures__/bariloche";
import { zonedToUtc } from "../time/calendar";

const BA = "America/Argentina/Buenos_Aires";
const seg = (d: string, a: string, b: string) => ({ departUtc: zonedToUtc(d, a, BA), arriveUtc: zonedToUtc(d, b, BA) });

describe("metricsFromScenario", () => {
  const summary = computeScenarioCosts(barilocheScenarioA());

  it("suma tiempo y transbordos de ida y vuelta", () => {
    const r = metricsFromScenario({
      scenarioId: "A",
      name: "A",
      summary,
      legs: [
        { leg: "outbound", segments: [seg("2027-01-10", "10:00", "12:20")] },
        { leg: "return", segments: [seg("2027-01-16", "17:00", "18:00"), seg("2027-01-16", "18:30", "19:10")] },
        { leg: "internal", segments: [seg("2027-01-12", "09:00", "11:00")] },
      ],
      locationKm: 1.2,
      flexiblePct: null,
      ratings: { comfort: 4 },
    });
    expect(r.values).toEqual({
      price: 128053000,
      travel_time: 270,
      transfers: 1,
      location: 1.2,
      comfort: 4,
    });
  });

  it("sin ida ni vuelta no informa tiempo ni transbordos", () => {
    const r = metricsFromScenario({ scenarioId: "A", name: "A", summary, legs: [], locationKm: null, flexiblePct: 30, ratings: {} });
    expect(r.values.travel_time).toBeUndefined();
    expect(r.values.transfers).toBeUndefined();
    expect(r.values.flexibility).toBe(30);
  });
});

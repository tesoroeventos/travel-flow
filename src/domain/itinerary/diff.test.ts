import { describe, expect, it } from "vitest";
import { diffItineraries } from "./diff";
import { generateItinerary } from "./generate";
import { activity, at, BA, input, outbound, back } from "../__fixtures__/itinerary";

describe("diffItineraries", () => {
  it("detecta un vuelo que cambió de horario", () => {
    const prev = generateItinerary(input());
    const next = generateItinerary(
      input({
        legs: [
          outbound({
            segments: [{ from: "AEP", to: "BRC", departUtc: at("2027-01-10", "12:00"), departTz: BA, arriveUtc: at("2027-01-10", "14:20"), arriveTz: BA }],
          }),
          back(),
        ],
      }),
    );
    const d = diffItineraries(prev, next);
    expect(d.changed).toContain("departure:out:0");
    expect(d.changed).toContain("leave_home:out:0");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("detecta actividades agregadas y borradas", () => {
    const prev = generateItinerary(input({ activities: [activity({ id: "a1" })] }));
    const next = generateItinerary(input({ activities: [activity({ id: "a2" })] }));
    const d = diffItineraries(prev, next);
    expect(d.removed).toEqual(["activity:a1:0"]);
    expect(d.added).toEqual(["activity:a2:0"]);
  });

  it("sin cambios devuelve listas vacías", () => {
    expect(diffItineraries(generateItinerary(input()), generateItinerary(input()))).toEqual({ added: [], removed: [], changed: [] });
  });
});

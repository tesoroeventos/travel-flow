import { describe, expect, it } from "vitest";
import { generateItinerary } from "./generate";
import { activity, at, back, BA, hotel, input, outbound } from "../__fixtures__/itinerary";

describe("alertas del itinerario", () => {
  it("superposición de actividades", () => {
    const it = generateItinerary(
      input({
        activities: [
          activity({ id: "a1", startTime: "10:00", durationMin: 120 }),
          activity({ id: "a2", startTime: "11:00", durationMin: 60 }),
        ],
      }),
    );
    expect(it.alerts).toContainEqual({ code: "overlap", entryKeys: ["activity:a1:0", "activity:a2:0"] });
  });

  it("tiempo de traslado insuficiente entre actividades", () => {
    const it = generateItinerary(
      input({
        activities: [
          activity({ id: "a1", startTime: "09:00", durationMin: 60 }),
          activity({ id: "a2", startTime: "10:20", travelMinFromPrev: 30 }),
        ],
      }),
    );
    expect(it.alerts).toContainEqual({ code: "insufficient_travel_time", entryKeys: ["activity:a1:0", "activity:a2:0"] });
  });

  const twoSegments = (mode: "flight" | "bus", secondDepart: string) =>
    outbound({
      mode,
      segments: [
        { from: "A", to: "B", departUtc: at("2027-01-10", "10:00"), departTz: BA, arriveUtc: at("2027-01-10", "12:00"), arriveTz: BA },
        { from: "B", to: "C", departUtc: at("2027-01-10", secondDepart), departTz: BA, arriveUtc: at("2027-01-10", "15:00"), arriveTz: BA },
      ],
    });

  it("conexión de vuelo menor a 60 min es ajustada", () => {
    expect(generateItinerary(input({ legs: [twoSegments("flight", "12:40"), back()] })).alerts).toContainEqual({
      code: "tight_connection",
      entryKeys: ["connection:out:0"],
    });
    expect(
      generateItinerary(input({ legs: [twoSegments("flight", "13:00"), back()] })).alerts.find((a) => a.code === "tight_connection"),
    ).toBeUndefined();
  });

  it("conexión de micro menor a 15 min es ajustada", () => {
    expect(
      generateItinerary(input({ legs: [twoSegments("bus", "12:10"), back()] })).alerts.find((a) => a.code === "tight_connection"),
    ).toBeDefined();
    expect(
      generateItinerary(input({ legs: [twoSegments("bus", "12:15"), back()] })).alerts.find((a) => a.code === "tight_connection"),
    ).toBeUndefined();
  });

  it("actividad fuera de las fechas de alojamiento", () => {
    const it = generateItinerary(input({ lodgings: [hotel()], activities: [activity({ id: "late", date: "2027-01-20" })] }));
    expect(it.alerts).toContainEqual({ code: "outside_lodging_dates", entryKeys: ["activity:late:0"] });
  });

  it("las alertas se copian en la entrada", () => {
    const it = generateItinerary(
      input({ activities: [activity({ id: "a1", startTime: "10:00", durationMin: 120 }), activity({ id: "a2", startTime: "11:00" })] }),
    );
    const a2 = it.days.flatMap((d) => d.entries).find((e) => e.key === "activity:a2:0");
    expect(a2?.alerts).toContain("overlap");
  });
});

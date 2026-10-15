import { describe, expect, it } from "vitest";
import { defaultAdvanceMin, generateItinerary } from "./generate";
import type { ItineraryEntry } from "./types";
import { activity, at, BA, back, input, outbound } from "../__fixtures__/itinerary";

const all = (i: ReturnType<typeof generateItinerary>): ItineraryEntry[] => i.days.flatMap((d) => d.entries);
const find = (i: ReturnType<typeof generateItinerary>, key: string) => all(i).find((e) => e.key === key);

describe("defaultAdvanceMin", () => {
  it.each([
    ["flight", false, 120],
    ["flight", true, 180],
    ["bus", false, 30],
    ["train", false, 30],
    ["own_car", false, 0],
  ] as const)("%s internacional=%s → %d", (mode, intl, min) => {
    expect(defaultAdvanceMin(mode, intl)).toBe(min);
  });
});

describe("generateItinerary — día de salida", () => {
  it("calcula la salida de casa hacia atrás", () => {
    const it = generateItinerary(input());
    expect(find(it, "leave_home:out:0")).toMatchObject({ localTime: "07:15", suggested: true, localDate: "2027-01-10" });
    expect(find(it, "transfer:out:0")).toMatchObject({ localTime: "07:15", endUtc: at("2027-01-10", "08:00") });
    expect(find(it, "departure:out:0")).toMatchObject({ localTime: "10:00" });
    expect(find(it, "arrival:out:0")).toMatchObject({ localTime: "12:20" });
  });

  it("sin traslado avisa y no lo descuenta", () => {
    const it = generateItinerary(input({ legs: [outbound({ transferToMin: null }), back()] }));
    expect(find(it, "leave_home:out:0")).toMatchObject({ localTime: "08:00" });
    expect(find(it, "leave_home:out:0")?.alerts).toContain("missing_transfer_time");
  });

  it("vuelo internacional usa 3 h de anticipación", () => {
    const it = generateItinerary(input({ legs: [outbound({ international: true }), back()] }));
    expect(find(it, "leave_home:out:0")?.localTime).toBe("06:15");
  });

  it("anticipación elegida por el usuario no es sugerida", () => {
    const it = generateItinerary(input({ legs: [outbound({ advanceMin: 90 }), back()] }));
    expect(find(it, "leave_home:out:0")).toMatchObject({ localTime: "07:45", suggested: false });
  });

  it("incluye traslado al alojamiento y check-in", () => {
    const it = generateItinerary(input());
    expect(find(it, "transfer:out:1")).toMatchObject({ localTime: "12:20", endUtc: at("2027-01-10", "12:50") });
    expect(find(it, "check_in:hotel:0")).toMatchObject({ localTime: "15:00" });
  });

  it("llegada antes del check-in genera alerta", () => {
    const it = generateItinerary(input());
    expect(find(it, "arrival:out:0")?.alerts).toContain("arrival_before_checkin");
  });
});

describe("generateItinerary — estadía", () => {
  it("encadena actividades sin hora desde las 09:00", () => {
    const it = generateItinerary(
      input({
        activities: [
          activity({ id: "a1", durationMin: 60 }),
          activity({ id: "a2", durationMin: 90, travelMinFromPrev: 30 }),
        ],
      }),
    );
    expect(find(it, "activity:a1:0")).toMatchObject({ localTime: "09:00", block: "morning" });
    expect(find(it, "activity:a2:0")).toMatchObject({ localTime: "10:30" });
  });

  it("aplica notas y posiciones de los overrides", () => {
    const it = generateItinerary(
      input({
        activities: [activity({ id: "a1" }), activity({ id: "a2" })],
        overrides: [
          { entryKey: "activity:a2:0", position: 0, note: "Llevar abrigo" },
          { entryKey: "activity:a1:0", position: 1, note: null },
        ],
      }),
    );
    expect(find(it, "activity:a2:0")).toMatchObject({ localTime: "09:00", note: "Llevar abrigo" });
    expect(find(it, "activity:a1:0")?.localTime).toBe("10:00");
  });
});

describe("generateItinerary — regreso", () => {
  it("incluye check-out, vuelo y llegada a casa", () => {
    const it = generateItinerary(input());
    expect(find(it, "check_out:hotel:0")?.localTime).toBe("10:00");
    expect(find(it, "departure:back:0")?.localTime).toBe("17:00");
    expect(find(it, "arrival:back:0")?.localTime).toBe("19:10");
    expect(find(it, "return_home:back:0")).toMatchObject({ localTime: "19:50", localDate: "2027-01-16" });
  });
});

describe("generateItinerary — husos horarios", () => {
  it("agrupa por fecha local y calcula la duración real", () => {
    const it = generateItinerary(
      input({
        legs: [
          outbound({
            international: true,
            segments: [
              { from: "EZE", to: "MAD", departUtc: at("2027-03-01", "13:00"), departTz: BA, arriveUtc: at("2027-03-02", "06:30", "Europe/Madrid"), arriveTz: "Europe/Madrid" },
            ],
          }),
        ],
        lodgings: [],
      }),
    );
    const arrival = find(it, "arrival:out:0");
    expect(arrival).toMatchObject({ localDate: "2027-03-02", localTime: "06:30", tz: "Europe/Madrid" });
    expect(find(it, "departure:out:0")?.details.durationMin).toBe("810");
    expect(it.days.map((d) => d.date)).toEqual(["2027-03-01", "2027-03-02"]);
  });
});

describe("generateItinerary — orden", () => {
  it("días ordenados y entradas por hora", () => {
    const it = generateItinerary(input({ activities: [activity({ id: "a1" })] }));
    const dates = it.days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    for (const d of it.days) {
      const starts = d.entries.map((e) => e.startUtc);
      expect(starts).toEqual([...starts].sort());
    }
  });
});

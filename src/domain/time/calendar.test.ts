import { describe, expect, it } from "vitest";
import {
  addDays,
  blockOf,
  datesBetween,
  localDate,
  localTime,
  minutesBetween,
  nights,
  tripDays,
  zonedToUtc,
} from "./calendar";

const BA = "America/Argentina/Buenos_Aires";

describe("zonedToUtc / localDate / localTime", () => {
  it("convierte hora local a UTC", () => {
    expect(zonedToUtc("2027-01-10", "10:00", BA)).toBe("2027-01-10T13:00:00.000Z");
  });
  it("usa la fecha local aunque en UTC ya sea el día siguiente", () => {
    const utc = zonedToUtc("2027-01-10", "23:30", BA);
    expect(utc.startsWith("2027-01-11")).toBe(true);
    expect(localDate(utc, BA)).toBe("2027-01-10");
    expect(localTime(utc, BA)).toBe("23:30");
  });
});

describe("tripDays", () => {
  it("cuenta días de calendario inclusive", () => {
    expect(
      tripDays(zonedToUtc("2027-01-10", "08:00", BA), BA, zonedToUtc("2027-01-16", "20:00", BA), BA),
    ).toBe(7);
  });
  it("lanza si el regreso es anterior a la salida", () => {
    expect(() =>
      tripDays(zonedToUtc("2027-01-16", "08:00", BA), BA, zonedToUtc("2027-01-10", "20:00", BA), BA),
    ).toThrow(RangeError);
  });
});

describe("nights", () => {
  it("cuenta noches entre check-in y check-out", () => {
    expect(nights(zonedToUtc("2027-01-10", "15:00", BA), zonedToUtc("2027-01-16", "10:00", BA), BA)).toBe(6);
  });
  it("lanza si el check-out es el mismo día o antes", () => {
    expect(() => nights(zonedToUtc("2027-01-10", "08:00", BA), zonedToUtc("2027-01-10", "20:00", BA), BA)).toThrow(
      "El check-out debe ser posterior al check-in",
    );
  });
});

describe("minutesBetween", () => {
  it("calcula duración real entre husos horarios", () => {
    expect(
      minutesBetween(zonedToUtc("2027-03-01", "13:00", BA), zonedToUtc("2027-03-02", "06:30", "Europe/Madrid")),
    ).toBe(810);
  });
});

describe("blockOf", () => {
  it.each([
    ["05:59", "night"],
    ["06:00", "morning"],
    ["11:59", "morning"],
    ["12:00", "midday"],
    ["15:00", "afternoon"],
    ["20:00", "night"],
  ] as const)("%s → %s", (t, b) => {
    expect(blockOf(t)).toBe(b);
  });
});

describe("addDays / datesBetween", () => {
  it("suma días cruzando meses", () => {
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
  });
  it("lista fechas inclusive", () => {
    expect(datesBetween("2027-01-10", "2027-01-12")).toEqual(["2027-01-10", "2027-01-11", "2027-01-12"]);
  });
});

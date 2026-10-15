import { describe, expect, it } from "vitest";
import { computeCoverage } from "./coverage";
import { zonedToUtc } from "../time/calendar";

const BA = "America/Argentina/Buenos_Aires";
const trip = {
  tripStartUtc: zonedToUtc("2027-01-10", "08:00", BA),
  tripStartTz: BA,
  tripEndUtc: zonedToUtc("2027-01-16", "20:00", BA),
  tripEndTz: BA,
};
const stay = (a: string, b: string) => ({
  checkInUtc: zonedToUtc(a, "15:00", BA),
  checkOutUtc: zonedToUtc(b, "10:00", BA),
  tz: BA,
});

describe("computeCoverage", () => {
  it("detecta noches sin alojamiento", () => {
    const c = computeCoverage({ ...trip, lodgings: [stay("2027-01-10", "2027-01-13"), stay("2027-01-14", "2027-01-16")], legs: ["outbound", "return"] });
    expect(c).toEqual({ hasOutbound: true, hasReturn: true, uncoveredNights: 1 });
  });

  it("detecta falta de regreso", () => {
    const c = computeCoverage({ ...trip, lodgings: [stay("2027-01-10", "2027-01-16")], legs: ["outbound", "internal"] });
    expect(c.hasReturn).toBe(false);
    expect(c.uncoveredNights).toBe(0);
  });

  it("sin alojamientos todas las noches quedan sin cubrir", () => {
    const c = computeCoverage({ ...trip, lodgings: [], legs: [] });
    expect(c.uncoveredNights).toBe(6);
  });

  it("alojamientos superpuestos no cuentan doble", () => {
    const c = computeCoverage({ ...trip, lodgings: [stay("2027-01-10", "2027-01-14"), stay("2027-01-12", "2027-01-16")], legs: [] });
    expect(c.uncoveredNights).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { fmtAmount, fmtDuration, fmtMoney, fmtRange, plural } from "./format";

describe("formatos de la interfaz", () => {
  it("dinero", () => {
    expect(fmtMoney(150000000, "ARS")).toBe("$ 1.500.000,00");
    expect(fmtMoney(null, "ARS")).toBe("—");
    expect(fmtMoney(-21947000, "ARS")).toBe("-$ 219.470,00");
  });
  it("importe sin símbolo", () => {
    expect(fmtAmount(123456)).toBe("1.234,56");
    expect(fmtAmount(-5)).toBe("-0,05");
  });
  it("rangos de fechas", () => {
    expect(fmtRange("2027-01-10", "2027-01-16")).toBe("10 ene – 16 ene 2027");
  });
  it("duraciones y plurales", () => {
    expect(fmtDuration(270)).toBe("4 h 30 min");
    expect(fmtDuration(45)).toBe("45 min");
    expect(plural(1, "viajero", "viajeros")).toBe("1 viajero");
    expect(plural(2, "viajero", "viajeros")).toBe("2 viajeros");
  });
});

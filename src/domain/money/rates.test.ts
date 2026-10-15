import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { convert, findRate, type ExchangeRate } from "./rates";
import { money } from "./money";

const usdArs: ExchangeRate = { from: "USD", to: "ARS", rate: "1000.50", asOf: "2027-01-01", source: "BNA" };

describe("convert", () => {
  it("convierte con la tasa directa", () => {
    const r = convert(money(6000, "USD"), "ARS", [usdArs], "2027-01-10");
    expect(r.ok && r.data.money).toEqual({ cents: 6003000, currency: "ARS" });
    expect(r.ok && r.data.rateAsOf).toBe("2027-01-01");
    expect(r.ok && r.data.rateSource).toBe("BNA");
  });

  it("usa la inversa si no hay tasa directa", () => {
    const r = convert(money(100050, "ARS"), "USD", [usdArs], "2027-01-10");
    expect(r.ok && r.data.money).toEqual({ cents: 100, currency: "USD" });
    expect(r.ok && r.data.factor).toBe(new Decimal(1).dividedBy("1000.50").toString());
  });

  it("toma la tasa más reciente con fecha menor o igual", () => {
    const old: ExchangeRate = { ...usdArs, rate: "900", asOf: "2026-12-01" };
    const a = convert(money(100, "USD"), "ARS", [usdArs, old], "2026-12-15");
    const b = convert(money(100, "USD"), "ARS", [old, usdArs], "2027-01-02");
    expect(a.ok && a.data.money.cents).toBe(90000);
    expect(b.ok && b.data.money.cents).toBe(100050);
  });

  it("no usa tasas con fecha posterior", () => {
    expect(convert(money(100, "USD"), "ARS", [usdArs], "2026-12-31")).toEqual({
      ok: false,
      error: { code: "missing_exchange_rate", message: "Falta tipo de cambio USD→ARS" },
    });
  });

  it("no encadena conversiones", () => {
    const arsClp: ExchangeRate = { from: "ARS", to: "CLP", rate: "0.9", asOf: "2027-01-01", source: "x" };
    const r = convert(money(100, "USD"), "CLP", [usdArs, arsClp], "2027-01-10");
    expect(r.ok).toBe(false);
  });

  it("misma moneda devuelve el mismo importe", () => {
    const r = convert(money(123, "ARS"), "ARS", [], "2027-01-10");
    expect(r.ok && r.data.money).toEqual({ cents: 123, currency: "ARS" });
    expect(r.ok && r.data.rateSource).toBeNull();
  });
});

describe("findRate", () => {
  it("prefiere la directa sobre la inversa en la misma fecha", () => {
    const inverse: ExchangeRate = { from: "ARS", to: "USD", rate: "0.002", asOf: "2027-01-01", source: "x" };
    const found = findRate([inverse, usdArs], "USD", "ARS", "2027-01-10");
    expect(found?.inverse).toBe(false);
    expect(found?.factor.toString()).toBe("1000.5");
  });
});

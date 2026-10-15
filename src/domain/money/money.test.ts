import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { addMoney, divideCents, formatMoney, money, multiplyCents, roundHalfEven } from "./money";

describe("multiplyCents redondea half-even", () => {
  it("0,5 centavos baja a 0 (par)", () => {
    expect(multiplyCents(1, "0.5")).toBe(0);
  });
  it("1,5 centavos sube a 2 (par)", () => {
    expect(multiplyCents(3, "0.5")).toBe(2);
  });
  it("2,5 centavos baja a 2 (par)", () => {
    expect(multiplyCents(5, "0.5")).toBe(2);
  });
});

describe("roundHalfEven", () => {
  it("redondea al entero par en .5", () => {
    expect(roundHalfEven(new Decimal("50.5"))).toBe(50);
    expect(roundHalfEven(new Decimal("51.5"))).toBe(52);
    expect(roundHalfEven(new Decimal("51.49"))).toBe(51);
  });
});

describe("divideCents", () => {
  it("divide en centavos", () => {
    expect(divideCents(125503000, 14)).toBe(8964500);
  });
  it("devuelve null con divisor 0", () => {
    expect(divideCents(100, 0)).toBeNull();
  });
});

describe("money y addMoney", () => {
  it("rechaza centavos no enteros", () => {
    expect(() => money(1.5, "ARS")).toThrow();
  });
  it("rechaza monedas inválidas", () => {
    expect(() => money(1, "ar")).toThrow();
  });
  it("suma misma moneda", () => {
    expect(addMoney(money(100, "ARS"), money(50, "ARS"))).toEqual({ cents: 150, currency: "ARS" });
  });
  it("lanza al sumar monedas distintas", () => {
    expect(() => addMoney(money(100, "ARS"), money(1, "USD"))).toThrow();
  });
});

describe("formatMoney", () => {
  it("formatea con punto de miles y coma decimal", () => {
    const s = formatMoney(money(150000000, "ARS"));
    expect(s.replace(/\s/g, " ")).toBe("$ 1.500.000,00");
    expect(formatMoney(money(6000, "USD")).replace(/\s/g, " ")).toBe("US$ 60,00");
  });
});

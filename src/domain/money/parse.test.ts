import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse";
import { err, ok } from "../result";

describe("parseAmount (formato latinoamericano)", () => {
  it.each([
    ["1.234,56", 123456],
    ["1500000", 150000000],
    ["1.500.000", 150000000],
    ["1234,5", 123450],
    ["0", 0],
    [" 12 ", 1200],
  ])("%s → %d centavos", (input, cents) => {
    expect(parseAmount(input)).toEqual(ok(cents));
  });

  it("rechaza más de 2 decimales", () => {
    expect(parseAmount("12,345")).toEqual(err("too_many_decimals", "Usá como máximo 2 decimales"));
  });
  it("rechaza negativos", () => {
    expect(parseAmount("-5")).toEqual(err("negative", "El importe no puede ser negativo"));
  });
  it("rechaza vacío", () => {
    expect(parseAmount("")).toEqual(err("empty", "Ingresá un importe"));
  });
  it.each(["1.23.4", "abc", "12.5"])("rechaza formato inválido %s", (input) => {
    expect(parseAmount(input)).toEqual(err("invalid", "Formato inválido. Ejemplo: 1.234,56"));
  });
});

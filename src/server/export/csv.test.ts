import { describe, expect, it } from "vitest";
import { computeScenarioCosts } from "@/domain/costs/engine";
import { barilocheScenarioA } from "@/domain/__fixtures__/bariloche";
import { budgetCsv } from "./csv";

describe("budgetCsv", () => {
  const input = barilocheScenarioA();
  const summary = computeScenarioCosts(input);
  const csv = budgetCsv({ name: "A", summary, baseCurrency: "ARS" }, input.items.map((i) => ({ ...i, source: "Banco Nación" })));
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("empieza con BOM y encabezado separado por punto y coma", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Partida;Categoría;Importe original;Moneda;Multiplicador;Importe convertido;Moneda base;Estado;Certeza;Fuente;Fecha de consulta");
  });

  it("muestra la conversión del seguro", () => {
    const row = lines.find((l) => l.startsWith("Seguro;"));
    expect(row).toContain("30,00;USD;2;60.030,00;ARS");
  });

  it("marca el depósito como retenido", () => {
    expect(lines.find((l) => l.startsWith("Depósito hotel;"))).toContain(";Retenido;");
  });

  it("incluye los totales al final", () => {
    expect(lines.find((l) => l.startsWith("Total;"))).toContain("1.255.030,00");
    expect(lines.find((l) => l.startsWith("Imprevistos;"))).toContain("25.500,00");
    expect(lines.find((l) => l.startsWith("Total con imprevistos;"))).toContain("1.280.530,00");
    expect(lines.find((l) => l.startsWith("Por persona;"))).toContain("627.515,00");
    expect(lines.find((l) => l.startsWith("Desvío;"))).toContain("-219.470,00");
  });

  it("escapa campos con punto y coma o comillas", () => {
    const c = budgetCsv({ name: "A", summary, baseCurrency: "ARS" }, [{ ...input.items[0]!, label: 'Vuelo; "promo"', source: null }]);
    expect(c).toContain('"Vuelo; ""promo"""');
  });
});

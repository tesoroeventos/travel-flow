import { describe, expect, it } from "vitest";
import { computeScenarioCosts } from "@/domain/costs/engine";
import { barilocheScenarioA } from "@/domain/__fixtures__/bariloche";
import { groupTotals, uniqueWarnings } from "./groups";

describe("grupos del gráfico", () => {
  it("agrupa categorías y suma imprevistos en 'Otros'", () => {
    const s = computeScenarioCosts(barilocheScenarioA());
    const g = Object.fromEntries(groupTotals(s).map((x) => [x.key, x.cents]));
    expect(g).toEqual({ transport: 46000000, lodging: 48000000, food: 17500000, activities: 8000000, insurance: 6003000, other: 2550000 });
    expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(s.totalWithContingencyCents);
  });

  it("avisos sin duplicados", () => {
    const s = computeScenarioCosts({ ...barilocheScenarioA(), rates: [], items: [...barilocheScenarioA().items, { ...barilocheScenarioA().items[5]!, id: "ins2" }] });
    expect(uniqueWarnings(s.warnings, () => "", "ARS")).toEqual(["Incompleto: falta tipo de cambio USD→ARS"]);
  });
});

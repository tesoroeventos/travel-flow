import { describe, expect, it } from "vitest";
import { compareScenarios } from "./compare";

describe("compareScenarios", () => {
  it("usa el más caro como referencia por defecto", () => {
    const r = compareScenarios([
      { scenarioId: "A", totalWithContingencyCents: 100000000 },
      { scenarioId: "B", totalWithContingencyCents: 88000000 },
    ]);
    expect(r.referenceId).toBe("A");
    expect(r.rows).toEqual([
      { scenarioId: "A", savingCents: 0, savingPct: "0.0" },
      { scenarioId: "B", savingCents: 12000000, savingPct: "12.0" },
    ]);
  });

  it("respeta la referencia elegida", () => {
    const r = compareScenarios(
      [
        { scenarioId: "A", totalWithContingencyCents: 100000000 },
        { scenarioId: "B", totalWithContingencyCents: 80000000 },
      ],
      "B",
    );
    expect(r.rows.find((x) => x.scenarioId === "A")).toEqual({ scenarioId: "A", savingCents: -20000000, savingPct: "-25.0" });
  });

  it("referencia en cero no calcula porcentaje", () => {
    const r = compareScenarios([
      { scenarioId: "A", totalWithContingencyCents: 0 },
      { scenarioId: "B", totalWithContingencyCents: 0 },
    ]);
    expect(r.rows[1]?.savingPct).toBeNull();
  });
});

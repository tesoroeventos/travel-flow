import { describe, expect, it } from "vitest";
import { explainScores } from "./explain";
import { scoreScenarios } from "./score";
import { CRITERIA, type Criterion, type ScenarioMetrics } from "./types";

const w = (x: Partial<Record<Criterion, number>>) =>
  Object.fromEntries(CRITERIA.map((c) => [c, x[c] ?? 0])) as Record<Criterion, number>;
const m = (id: string, values: ScenarioMetrics["values"]): ScenarioMetrics => ({ scenarioId: id, name: id, values });

describe("explainScores", () => {
  it("explica ahorro y tiempo adicional", () => {
    const metrics = [m("A", { price: 100000000, travel_time: 120 }), m("B", { price: 88000000, travel_time: 300 })];
    const r = scoreScenarios(metrics, w({ price: 10, travel_time: 5 }), 5);
    expect(explainScores(metrics, r, "A")).toContain("B cuesta 12 % menos que A, pero suma unas 3 h de viaje.");
  });

  it("abre con la recomendación", () => {
    const metrics = [m("A", { price: 100000000, travel_time: 120 }), m("B", { price: 88000000, travel_time: 300 })];
    const r = scoreScenarios(metrics, w({ price: 10, travel_time: 5 }), 5);
    expect(explainScores(metrics, r, "A")[0]).toBe("Con tus prioridades, conviene B.");
  });

  it("explica empates", () => {
    const metrics = [m("A", { price: 100000000 }), m("B", { price: 97000000 })];
    const r = scoreScenarios(metrics, w({ price: 10 }), 5);
    expect(explainScores(metrics, r, "A")).toContain("En precio total, A y B empatan.");
  });

  it("explica cuando es más caro y más rápido", () => {
    const metrics = [m("A", { price: 100000000, travel_time: 600 }), m("B", { price: 120000000, travel_time: 120 })];
    const r = scoreScenarios(metrics, w({ price: 10, travel_time: 10 }), 5);
    expect(explainScores(metrics, r, "A")).toContain("B cuesta 20 % más que A, pero ahorra unas 8 h de viaje.");
  });

  it("menciona criterios excluidos por falta de datos", () => {
    const metrics = [m("A", { price: 1, comfort: 4 }), m("B", { price: 2 })];
    const r = scoreScenarios(metrics, w({ price: 1, comfort: 1 }), 5);
    expect(explainScores(metrics, r, "A")).toContain("No se consideró comodidad porque falta el dato en algún escenario.");
  });
});

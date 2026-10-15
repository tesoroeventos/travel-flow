import { describe, expect, it } from "vitest";
import { scoreScenarios } from "./score";
import { CRITERIA, type Criterion, type ScenarioMetrics } from "./types";

function weights(w: Partial<Record<Criterion, number>>): Record<Criterion, number> {
  return Object.fromEntries(CRITERIA.map((c) => [c, w[c] ?? 0])) as Record<Criterion, number>;
}
const m = (id: string, values: ScenarioMetrics["values"]): ScenarioMetrics => ({ scenarioId: id, name: id, values });
const score = (r: ReturnType<typeof scoreScenarios>, id: string) => r.scores.find((s) => s.scenarioId === id)!;

describe("scoreScenarios", () => {
  it("pondera criterios normalizados", () => {
    const r = scoreScenarios(
      [m("A", { price: 100000000, travel_time: 120 }), m("B", { price: 88000000, travel_time: 300 })],
      weights({ price: 10, travel_time: 5 }),
      5,
    );
    expect(score(r, "A").score).toBeCloseTo(0.3333, 4);
    expect(score(r, "B").score).toBeCloseTo(0.6667, 4);
    expect(r.recommendedId).toBe("B");
  });

  it("diferencia menor al umbral es empate", () => {
    const r = scoreScenarios([m("A", { price: 100000000 }), m("B", { price: 97000000 })], weights({ price: 10 }), 5);
    expect(r.ties).toContain("price");
    expect(score(r, "A").perCriterion.price).toBe(1);
    expect(score(r, "B").perCriterion.price).toBe(1);
  });

  it("mejor valor cero no produce NaN", () => {
    const r = scoreScenarios([m("A", { transfers: 0 }), m("B", { transfers: 1 })], weights({ transfers: 5 }), 5);
    expect(score(r, "A").perCriterion.transfers).toBe(1);
    expect(score(r, "B").perCriterion.transfers).toBe(0);
    expect(Number.isNaN(score(r, "A").score)).toBe(false);
  });

  it("todos iguales en cero es empate", () => {
    const r = scoreScenarios([m("A", { transfers: 0 }), m("B", { transfers: 0 })], weights({ transfers: 5 }), 5);
    expect(r.ties).toContain("transfers");
    expect(score(r, "B").score).toBe(1);
  });

  it("mayor es mejor en calificaciones", () => {
    const r = scoreScenarios([m("A", { comfort: 5 }), m("B", { comfort: 2 })], weights({ comfort: 3 }), 5);
    expect(score(r, "A").perCriterion.comfort).toBe(1);
    expect(score(r, "B").perCriterion.comfort).toBe(0);
  });

  it("un solo escenario tiene puntaje 1", () => {
    const r = scoreScenarios([m("A", { price: 5 })], weights({ price: 10 }), 5);
    expect(score(r, "A").score).toBe(1);
    expect(r.recommendedId).toBe("A");
  });

  it("criterio sin datos en algún escenario se excluye para todos", () => {
    const r = scoreScenarios(
      [m("A", { price: 100, comfort: 5 }), m("B", { price: 200 })],
      weights({ price: 10, comfort: 10 }),
      5,
    );
    expect(r.excluded).toContain("comfort");
    expect(r.warnings).toContainEqual({ code: "criterion_missing_data", criterion: "comfort" });
    expect(score(r, "A").score).toBe(1);
    expect(score(r, "A").perCriterion.comfort).toBeUndefined();
  });

  it("criterio con peso 0 no se reporta como faltante", () => {
    const r = scoreScenarios([m("A", { price: 100 }), m("B", { price: 200 })], weights({ price: 10 }), 5);
    expect(r.warnings).toEqual([]);
  });

  it("todos los pesos en cero no recomiendan nada", () => {
    const r = scoreScenarios([m("A", { price: 100 }), m("B", { price: 200 })], weights({}), 5);
    expect(r.scores.every((s) => s.score === 0)).toBe(true);
    expect(r.recommendedId).toBeNull();
  });
});

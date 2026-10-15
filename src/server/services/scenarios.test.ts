import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { analyzeTrip } from "./trip-analysis";
import { createScenario, deleteScenario, duplicateScenario, saveDecisionSettings } from "./scenarios";

describe("escenarios", () => {
  it("crear asigna la siguiente posición", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const b = await createScenario(db, ctx, seed.tripId, "B · Auto");
    expect(b.position).toBe(1);
  });

  it("duplicar copia selecciones, interruptores, calificaciones y partidas propias", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const parts = makeScenarioParts(db);
    await parts.setToggle(ctx, seed.scenarioId, seed.items.excursion.id, false);
    await parts.setRating(ctx, seed.scenarioId, "comfort", 4);
    const copy = await duplicateScenario(db, ctx, seed.scenarioId, "A (copia)");
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    const original = a.scenarios.find((s) => s.id === seed.scenarioId)!;
    const dup = a.scenarios.find((s) => s.id === copy.id)!;
    expect(dup.summary.totalCents).toBe(original.summary.totalCents);
    expect(dup.summary.totalCents).toBe(117503000);
    expect(dup.metrics.values.comfort).toBe(4);
  });

  it("borrar el escenario elegido limpia la elección y la referencia", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.trips.update(ctx, seed.tripId, { referenceScenarioId: seed.scenarioId });
    await deleteScenario(db, ctx, seed.scenarioId);
    const trip = await r.trips.get(ctx, seed.tripId);
    expect(trip).toMatchObject({ chosenScenarioId: null, referenceScenarioId: null });
    expect(await r.costItems.get(ctx, seed.items.food.id)).toBeNull();
  });

  it("el escenario de referencia tiene que ser del mismo viaje", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const other = await makeRepos(db).trips.create(ctx, {
      name: "Otro", originLabel: "A", destinationLabel: "B", startAt: new Date("2027-02-01T12:00:00Z"), startTz: "UTC",
      endAt: new Date("2027-02-02T12:00:00Z"), endTz: "UTC", baseCurrency: "ARS", budgetCents: 1,
    });
    const foreign = await createScenario(db, ctx, other.id, "X");
    const base = {
      weights: { price: 5, travel_time: 3, transfers: 2, location: 2, flexibility: 1, comfort: 3, lodging_quality: 2, experience: 2 },
      tieThresholdPct: "5",
      contingencyPct: "10",
      contingencyCategories: ["food"],
    };
    await expect(saveDecisionSettings(db, ctx, seed.tripId, { ...base, referenceScenarioId: foreign.id })).rejects.toThrow();
    await expect(saveDecisionSettings(db, ctx, seed.tripId, { ...base, referenceScenarioId: "no-es-un-id" })).rejects.toThrow();
    await saveDecisionSettings(db, ctx, seed.tripId, { ...base, referenceScenarioId: seed.scenarioId });
    expect((await makeRepos(db).trips.get(ctx, seed.tripId))?.referenceScenarioId).toBe(seed.scenarioId);
  });

  it("guarda pesos, umbral e imprevistos", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await saveDecisionSettings(db, ctx, seed.tripId, {
      weights: { price: 10, travel_time: 0, transfers: 0, location: 0, flexibility: 0, comfort: 0, lodging_quality: 0, experience: 0 },
      tieThresholdPct: "3",
      contingencyPct: "15",
      contingencyCategories: ["food"],
      referenceScenarioId: null,
    });
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    expect(a.weights.price).toBe(10);
    expect(a.weights.comfort).toBe(0);
    expect(a.scenarios[0]!.summary.contingencyCents).toBe(2625000);
  });
});

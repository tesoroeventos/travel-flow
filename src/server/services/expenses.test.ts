import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { expenseReport } from "./expenses";

describe("expenseReport", () => {
  it("compara presupuesto, estimado y real por categoría", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.expenses.create(ctx, { tripId: seed.tripId, date: "2027-01-11", category: "food", description: "Cena", amountCents: 3000000, currency: "ARS" });
    await r.expenses.create(ctx, { tripId: seed.tripId, date: "2027-01-11", category: "food", description: "Café", amountCents: 2000, currency: "USD" });

    const rep = await expenseReport(db, ctx, seed.tripId, { today: "2027-01-12" });
    expect(rep).toMatchObject({
      budgetCents: 150000000,
      estimatedCents: 128053000,
      actualCents: 5001000,
      availableCents: 144999000,
      incomplete: false,
    });
    expect(rep.byCategory.food).toEqual({ estimatedCents: 17500000, actualCents: 5001000, deviationCents: -12499000 });
    expect(rep.byCategory.lodging).toEqual({ estimatedCents: 48000000, actualCents: 0, deviationCents: -48000000 });
  });

  it("gasto sin tipo de cambio queda fuera y avisa", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await makeRepos(db).expenses.create(ctx, { tripId: seed.tripId, date: "2027-01-11", category: "shopping_personal", description: "Recuerdos", amountCents: 5000, currency: "EUR" });
    const rep = await expenseReport(db, ctx, seed.tripId, { today: "2027-01-12" });
    expect(rep.incomplete).toBe(true);
    expect(rep.actualCents).toBe(0);
    expect(rep.warnings).toContainEqual(expect.objectContaining({ code: "missing_exchange_rate", detail: "EUR→ARS" }));
  });

  it("sin escenario elegido el estimado es null", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await makeRepos(db).trips.update(ctx, seed.tripId, { chosenScenarioId: null });
    const rep = await expenseReport(db, ctx, seed.tripId);
    expect(rep.estimatedCents).toBeNull();
    expect(rep.byCategory.food.estimatedCents).toBe(0);
  });
});

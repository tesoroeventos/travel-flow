import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { tripCards } from "./dashboard";

describe("tripCards", () => {
  it("resume presupuesto, estimado del escenario elegido y gasto real convertido", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.expenses.create(ctx, { tripId: seed.tripId, date: "2027-01-11", category: "food", description: "Cena", amountCents: 3000000, currency: "ARS" });
    await r.expenses.create(ctx, { tripId: seed.tripId, date: "2027-01-11", category: "food", description: "Café", amountCents: 2000, currency: "USD" });

    const cards = await tripCards(db, ctx, "2027-01-05");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: seed.tripId,
      name: "Bariloche 2027",
      phase: "upcoming",
      budgetCents: 150000000,
      estimatedCents: 128053000,
      estimateSource: "chosen",
      actualCents: 5001000,
      actualIncomplete: false,
      days: 7,
      travelers: 2,
    });
  });

  it("sin escenario elegido usa el más barato y clasifica por fecha", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await makeRepos(db).trips.update(ctx, seed.tripId, { chosenScenarioId: null });
    const during = await tripCards(db, ctx, "2027-01-12");
    expect(during[0]).toMatchObject({ phase: "active", estimateSource: "cheapest" });
    const after = await tripCards(db, ctx, "2027-02-01");
    expect(after[0]!.phase).toBe("past");
  });

  it("viaje sin escenarios no tiene estimado", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    await makeRepos(db).trips.create(ctx, {
      name: "Sin datos",
      originLabel: "A",
      destinationLabel: "B",
      startAt: new Date("2027-03-01T12:00:00Z"),
      startTz: "UTC",
      endAt: new Date("2027-03-02T12:00:00Z"),
      endTz: "UTC",
      baseCurrency: "ARS",
      budgetCents: 100,
    });
    const cards = await tripCards(db, ctx, "2027-01-01");
    expect(cards[0]).toMatchObject({ estimatedCents: null, estimateSource: null, actualCents: 0 });
  });
});

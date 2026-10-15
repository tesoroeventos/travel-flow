import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { analyzeTrip, buildItinerary } from "./trip-analysis";
import { deleteOption, updateCostItem } from "./options";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { makeScenarioParts } from "../repos/scenario-parts";
import { makeRepos } from "../repos";

describe("deleteOption", () => {
  it("borrar el hotel del escenario elegido limpia selecciones y reservas y recalcula", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.bookings.create(ctx, { tripId: seed.tripId, ownerType: "lodging_option", ownerId: seed.hotel.id });

    await deleteOption(db, ctx, "lodging_option", seed.hotel.id);

    const parts = makeScenarioParts(db);
    const selections = await parts.listSelections(ctx, seed.tripId);
    expect(selections.find((s) => s.ownerId === seed.hotel.id)).toBeUndefined();
    const bookings = await r.bookings.list(ctx, seed.tripId);
    expect(bookings.find((b) => b.ownerId === seed.hotel.id)).toBeUndefined();
    expect(await r.costItems.get(ctx, seed.items.hotel.id)).toBeNull();

    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    expect(a.scenarios[0]!.summary.warnings).toContainEqual({ code: "uncovered_nights", detail: "6" });

    const itinerary = await buildItinerary(db, ctx, seed.tripId);
    expect(itinerary!.days.flatMap((d) => d.entries).some((e) => e.kind === "check_in")).toBe(false);
  });

  it("no permite borrar alternativas de otro workspace", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const other = await makeCtx(db, "otro@x.com");
    await expect(deleteOption(db, other, "lodging_option", seed.hotel.id)).rejects.toThrow();
    expect(await makeRepos(db).lodging.get(ctx, seed.hotel.id)).not.toBeNull();
  });
});

describe("updateCostItem", () => {
  it("editar una partida demo le quita la marca demo", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx, { isDemo: true });
    const updated = await updateCostItem(db, ctx, seed.items.food.id, { amountCents: 3000000 });
    expect(updated.isDemo).toBe(false);
    expect(updated.amountCents).toBe(3000000);
    const untouched = await makeRepos(db).costItems.get(ctx, seed.items.hotel.id);
    expect(untouched?.isDemo).toBe(true);
  });
});

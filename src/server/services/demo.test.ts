import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeCtx } from "./demo-data";
import { analyzeTrip } from "./trip-analysis";
import { createShareLink, duplicateSharedTrip, duplicateTrip, loadSharedTrip, revokeShareLink, seedDemo } from "./demo";
import { updateCostItem } from "./options";
import { proposalsFromLoaded } from "./proposals";

describe("viaje demo", () => {
  it("muestra las 3 propuestas: barata, rápida y cómoda", async () => {
    const db = await createTestDb();
    const { token } = { token: (await seedDemo(db)).shareToken };
    const shared = await loadSharedTrip(db, token);
    const p = proposalsFromLoaded(shared!.data, { today: "2026-10-15" });
    expect(p.missing).toEqual([]);
    expect(p.cards.flatMap((c) => c.tags).sort()).toEqual(["barata", "comoda", "rapida"]);
    expect(p.cards.length).toBe(3);
  });

  it("se siembra una sola vez con tres escenarios y el A elegido", async () => {
    const db = await createTestDb();
    const first = await seedDemo(db, { shareToken: "demo-token" });
    const second = await seedDemo(db, { shareToken: "demo-token" });
    expect(second.tripId).toBe(first.tripId);
    expect(first.shareToken).toBe("demo-token");

    const shared = await loadSharedTrip(db, "demo-token");
    expect(shared).not.toBeNull();
    const { data, analysis } = shared!;
    expect(data.trip.isDemo).toBe(true);
    expect(data.scenarios.map((s) => s.name)).toHaveLength(3);
    expect(data.costItems.every((i) => i.isDemo && i.source === "Dato de demostración")).toBe(true);
    const a = analysis.scenarios.find((s) => s.id === data.trip.chosenScenarioId)!;
    expect(a.summary.totalCents).toBe(125503000);
    for (const s of analysis.scenarios) expect(s.summary.warnings.filter((w) => w.code !== "stale_price")).toEqual([]);
  });

  it("duplicar como mío copia al workspace del usuario y mantiene la marca demo hasta editar", async () => {
    const db = await createTestDb();
    const { tripId: demoId } = await seedDemo(db, { shareToken: "demo-token" });
    const ctx = await makeCtx(db, "ana@x.com");
    const copy = await duplicateSharedTrip(db, "demo-token", ctx);
    const r = makeRepos(db);

    const mine = await r.trips.get(ctx, copy.id);
    expect(mine).toMatchObject({
      workspaceId: ctx.workspaceId,
      isDemo: true,
      publicShareToken: null,
      status: "planning",
    });
    expect(await r.bookings.list(ctx, copy.id)).toEqual([]);

    const a = await analyzeTrip(db, ctx, copy.id, { today: "2027-01-05" });
    const chosen = a.scenarios.find((s) => s.id === mine!.chosenScenarioId)!;
    expect(chosen.summary.totalCents).toBe(125503000);
    expect(chosen.summary.incomplete).toBe(false);

    const rates = await r.rates.list(ctx);
    expect(rates).toHaveLength(1);
    expect(rates[0]!.source).toBe("Copiado de «Buenos Aires → Bariloche (demo)»: Banco Nación");

    const items = await r.costItems.list(ctx, copy.id);
    expect(items.every((i) => i.isDemo)).toBe(true);
    const edited = await updateCostItem(db, ctx, items[0]!.id, {
      amountCents: 1,
    });
    expect(edited.isDemo).toBe(false);

    const original = await loadSharedTrip(db, "demo-token");
    expect(original!.data.trip.id).toBe(demoId);
    expect(original!.data.costItems.every((i) => i.isDemo)).toBe(true);
  });

  it("duplicar un viaje propio crea una copia con nombre distinto", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const { seedBarilocheA } = await import("./demo-data");
    const seed = await seedBarilocheA(db, ctx);
    const copy = await duplicateTrip(db, ctx, seed.tripId);
    expect(copy.name).toBe("Bariloche 2027 (copia)");
    const a = await analyzeTrip(db, ctx, copy.id, { today: "2027-01-05" });
    expect(a.scenarios[0]!.summary.totalCents).toBe(125503000);
  });

  it("los enlaces se pueden crear y revocar", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const { seedBarilocheA } = await import("./demo-data");
    const seed = await seedBarilocheA(db, ctx);
    const token = await createShareLink(db, ctx, seed.tripId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await loadSharedTrip(db, token)).not.toBeNull();
    await revokeShareLink(db, ctx, seed.tripId);
    expect(await loadSharedTrip(db, token)).toBeNull();
  });
});

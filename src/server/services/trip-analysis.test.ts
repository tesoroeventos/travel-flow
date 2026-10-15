import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { analyzeTrip, buildItinerary } from "./trip-analysis";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { makeScenarioParts } from "../repos/scenario-parts";
import { makeRepos } from "../repos";

describe("analyzeTrip", () => {
  let db: Db;
  let ctx: Ctx;
  let seed: Awaited<ReturnType<typeof seedBarilocheA>>;

  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
    seed = await seedBarilocheA(db, ctx);
  });

  it("calcula el mismo total que el caso hecho a mano", async () => {
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    const s = a.scenarios.find((x) => x.id === seed.scenarioId)!;
    expect(s.summary.totalCents).toBe(125503000);
    expect(s.summary.contingencyCents).toBe(2550000);
    expect(s.summary.paidCents).toBe(24000000);
    expect(s.summary.refundableHeldCents).toBe(5000000);
    expect(s.summary.warnings).toEqual([]);
  });

  it("aplica los interruptores de partidas opcionales", async () => {
    await makeScenarioParts(db).setToggle(ctx, seed.scenarioId, seed.items.excursion.id, false);
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    expect(a.scenarios[0]!.summary.totalCents).toBe(117503000);
  });

  it("calcula métricas de decisión del escenario", async () => {
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    expect(a.scenarios[0]!.metrics.values).toMatchObject({ price: 128053000, travel_time: 270, transfers: 0 });
  });

  it("devuelve null para un viaje ajeno", async () => {
    const other = await makeCtx(db, "otro@x.com");
    await expect(analyzeTrip(db, other, seed.tripId)).rejects.toThrow();
  });
});

describe("buildItinerary", () => {
  it("arma el itinerario del escenario elegido", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const it = await buildItinerary(db, ctx, seed.tripId);
    const keys = it!.days.flatMap((d) => d.entries).map((e) => e.key);
    expect(keys).toContain(`leave_home:${seed.flightOut.id}:0`);
    expect(keys).toContain(`check_in:${seed.hotel.id}:0`);
    expect(keys).toContain(`activity:${seed.excursion.id}:0`);
    expect(keys).toContain(`return_home:${seed.flightBack.id}:0`);
    const leave = it!.days.flatMap((d) => d.entries).find((e) => e.kind === "leave_home");
    expect(leave?.localTime).toBe("07:15");
  });

  it("sin escenario elegido devuelve null", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await makeRepos(db).trips.update(ctx, seed.tripId, { chosenScenarioId: null });
    expect(await buildItinerary(db, ctx, seed.tripId)).toBeNull();
  });
});

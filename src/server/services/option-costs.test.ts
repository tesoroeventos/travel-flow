import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { loadTrip } from "./load-trip";
import { optionCost } from "./option-costs";
import { makeRepos } from "../repos";

describe("optionCost", () => {
  it("costo total de la estadía y por persona; el depósito queda aparte", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const data = await loadTrip(db, ctx, seed.tripId);
    const c = optionCost(data, "lodging_option", seed.hotel.id, "2027-01-05");
    expect(c).toMatchObject({ totalCents: 48000000, perPersonCents: 24000000, refundableHeldCents: 5000000, incomplete: false, itemCount: 2 });
  });

  it("vuelo por persona se multiplica por los viajeros", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const data = await loadTrip(db, ctx, seed.tripId);
    expect(optionCost(data, "transport_option", seed.flightOut.id, "2027-01-05").totalCents).toBe(24000000);
  });

  it("alternativa sin partidas cuesta cero y lo indica", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const bus = await makeRepos(db).transport.create(ctx, { tripId: seed.tripId, leg: "outbound", mode: "bus", fromLabel: "Retiro", toLabel: "Bariloche" });
    const data = await loadTrip(db, ctx, seed.tripId);
    expect(optionCost(data, "transport_option", bus.id, "2027-01-05")).toMatchObject({ totalCents: 0, itemCount: 0 });
  });
});

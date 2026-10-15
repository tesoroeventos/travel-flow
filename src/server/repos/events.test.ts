import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { users, workspaces } from "../db/schema";
import { makeRepos } from "./index";

describe("historial de cambios", () => {
  it("registra creación, edición y borrado con antes y después", async () => {
    const db = await createTestDb();
    const r = makeRepos(db);
    const [u] = await db.insert(users).values({ email: "a@x.com", name: "A", passwordHash: "x" }).returning();
    const [w] = await db.insert(workspaces).values({ name: "W" }).returning();
    const ctx = { userId: u!.id, workspaceId: w!.id };

    const trip = await r.trips.create(ctx, {
      name: "Viejo",
      originLabel: "A",
      destinationLabel: "B",
      startAt: new Date("2027-01-10T11:00:00Z"),
      startTz: "UTC",
      endAt: new Date("2027-01-12T11:00:00Z"),
      endTz: "UTC",
      baseCurrency: "ARS",
      budgetCents: 1,
    });
    await r.trips.update(ctx, trip.id, { name: "Nuevo" });
    const traveler = await r.travelers.create(ctx, { tripId: trip.id, name: "Ana", kind: "adult" });
    await r.travelers.remove(ctx, traveler.id);

    const events = await r.events.list(ctx, trip.id);
    const update = events.find((e) => e.entity === "trip" && e.action === "update");
    expect(update?.before).toMatchObject({ name: "Viejo" });
    expect(update?.after).toMatchObject({ name: "Nuevo" });
    expect(update?.userId).toBe(ctx.userId);
    expect(events.map((e) => `${e.entity}:${e.action}`)).toEqual([
      "trip:create",
      "trip:update",
      "traveler:create",
      "traveler:delete",
    ]);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./test-db";
import type { Db } from "./client";
import { priceCache, radarChecks, trips, users, workspaces } from "./schema";

describe("esquema del radar", () => {
  let db: Db;
  let tripId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const [w] = await db.insert(workspaces).values({ name: "w" }).returning();
    await db.insert(users).values({ email: "a@x.com", name: "a", passwordHash: "x" });
    const [t] = await db
      .insert(trips)
      .values({
        workspaceId: w!.id,
        name: "Bariloche",
        originLabel: "Zárate",
        destinationLabel: "Bariloche",
        originIata: "BUE",
        destinationIata: "BRC",
        startAt: new Date("2027-01-10T03:00:00Z"),
        startTz: "America/Argentina/Buenos_Aires",
        endAt: new Date("2027-01-17T02:59:00Z"),
        endTz: "America/Argentina/Buenos_Aires",
        baseCurrency: "ARS",
        budgetCents: 0,
      })
      .returning();
    tripId = t!.id;
  });

  it("guarda códigos IATA en el viaje", async () => {
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
    expect(trip!.originIata).toBe("BUE");
    expect(trip!.destinationIata).toBe("BRC");
  });

  it("radar_checks no admite dos filas para el mismo sitio y viaje", async () => {
    await db.insert(radarChecks).values({ tripId, siteId: "booking", openedAt: new Date() });
    await expect(db.insert(radarChecks).values({ tripId, siteId: "booking", openedAt: new Date() })).rejects.toThrow();
  });

  it("price_cache guarda payload y fecha", async () => {
    await db.insert(priceCache).values({ key: "k", payload: { a: 1 }, fetchedAt: new Date("2026-11-14T12:00:00Z") });
    const [row] = await db.select().from(priceCache);
    expect(row!.payload).toEqual({ a: 1 });
    expect(row!.fetchedAt.toISOString()).toBe("2026-11-14T12:00:00.000Z");
  });

  it("borrar el viaje borra sus marcas", async () => {
    await db.delete(trips).where(eq(trips.id, tripId));
    expect(await db.select().from(radarChecks)).toHaveLength(0);
  });
});

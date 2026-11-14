import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./test-db";
import type { Db } from "./client";
import { transportOptions, trips, tripSearches, workspaces } from "./schema";

describe("esquema de la búsqueda", () => {
  let db: Db;
  let tripId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const [w] = await db.insert(workspaces).values({ name: "w" }).returning();
    const [t] = await db
      .insert(trips)
      .values({
        workspaceId: w!.id,
        name: "Bariloche",
        originLabel: "Zárate",
        destinationLabel: "Bariloche",
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

  it("tripSearches guarda una fila por viaje", async () => {
    await db
      .insert(tripSearches)
      .values({ tripId, paramsKey: "k", searchedAt: new Date(), flightsCount: 5, lodgingCount: 6 });
    const [row] = await db.select().from(tripSearches);
    expect(row).toMatchObject({ paramsKey: "k", flightsCount: 5, lodgingCount: 6, missingAirlines: [], error: null });
    await expect(
      db
        .insert(tripSearches)
        .values({ tripId, paramsKey: "k2", searchedAt: new Date(), flightsCount: 0, lodgingCount: 0 }),
    ).rejects.toThrow();
  });

  it("transport_options guarda externalRef", async () => {
    const [t] = await db
      .insert(transportOptions)
      .values({ tripId, leg: "outbound", mode: "flight", fromLabel: "EZE", toLabel: "BRC", externalRef: "tok-1" })
      .returning();
    expect(t!.externalRef).toBe("tok-1");
  });

  it("se borra con el viaje", async () => {
    await db.delete(trips).where(eq(trips.id, tripId));
    expect(await db.select().from(tripSearches)).toHaveLength(0);
  });
});

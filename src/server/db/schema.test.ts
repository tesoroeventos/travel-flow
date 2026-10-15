import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./test-db";
import { costItems, trips, users, workspaces } from "./schema";

describe("esquema", () => {
  it("guarda un viaje con partidas y borra en cascada", async () => {
    const db = await createTestDb();
    const [u] = await db.insert(users).values({ email: "a@b.com", name: "Ana", passwordHash: "x" }).returning();
    const [w] = await db.insert(workspaces).values({ name: "Mi espacio" }).returning();
    const [t] = await db
      .insert(trips)
      .values({
        workspaceId: w!.id,
        name: "Bariloche",
        originLabel: "Zárate",
        destinationLabel: "Bariloche",
        startAt: new Date("2027-01-10T11:00:00Z"),
        startTz: "America/Argentina/Buenos_Aires",
        endAt: new Date("2027-01-16T23:00:00Z"),
        endTz: "America/Argentina/Buenos_Aires",
        baseCurrency: "ARS",
        budgetCents: 150000000,
      })
      .returning();
    await db.insert(costItems).values({
      tripId: t!.id,
      ownerType: "scenario",
      ownerId: t!.id,
      label: "Comida",
      amountCents: 2500000,
      currency: "ARS",
      unit: "per_day",
      category: "food",
    });

    const items = await db.select().from(costItems).where(eq(costItems.tripId, t!.id));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ amountCents: 2500000, quantity: "1.0000", costType: "fixed", certainty: "estimated", isDemo: false });
    expect(u!.email).toBe("a@b.com");

    await db.delete(trips).where(eq(trips.id, t!.id));
    expect(await db.select().from(costItems)).toHaveLength(0);
  });

  it("los importes grandes se guardan sin perder precisión", async () => {
    const db = await createTestDb();
    const [w] = await db.insert(workspaces).values({ name: "W" }).returning();
    const [t] = await db
      .insert(trips)
      .values({
        workspaceId: w!.id,
        name: "X",
        originLabel: "A",
        destinationLabel: "B",
        startAt: new Date(),
        startTz: "UTC",
        endAt: new Date(),
        endTz: "UTC",
        baseCurrency: "ARS",
        budgetCents: 9_000_000_000_000,
      })
      .returning();
    expect(t!.budgetCents).toBe(9_000_000_000_000);
  });
});

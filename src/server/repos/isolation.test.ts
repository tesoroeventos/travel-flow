import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { users, workspaces } from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos, type Repos } from "./index";

async function ctxFor(db: Db, email: string): Promise<Ctx> {
  const [u] = await db.insert(users).values({ email, name: email, passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: email }).returning();
  return { userId: u!.id, workspaceId: w!.id };
}

const tripInput = {
  name: "Bariloche",
  originLabel: "Zárate",
  destinationLabel: "Bariloche",
  startAt: new Date("2027-01-10T11:00:00Z"),
  startTz: "America/Argentina/Buenos_Aires",
  endAt: new Date("2027-01-16T23:00:00Z"),
  endTz: "America/Argentina/Buenos_Aires",
  baseCurrency: "ARS",
  budgetCents: 150000000,
};

describe("aislamiento entre workspaces", () => {
  let db: Db;
  let r: Repos;
  let w1: Ctx;
  let w2: Ctx;
  let tripId: string;
  let itemId: string;

  beforeAll(async () => {
    db = await createTestDb();
    r = makeRepos(db);
    w1 = await ctxFor(db, "uno@x.com");
    w2 = await ctxFor(db, "dos@x.com");
    const trip = await r.trips.create(w1, tripInput);
    tripId = trip.id;
    const scenario = await r.scenarios.create(w1, { tripId, name: "A" });
    const item = await r.costItems.create(w1, {
      tripId,
      ownerType: "scenario",
      ownerId: scenario.id,
      label: "Comida",
      amountCents: 100,
      currency: "ARS",
      category: "food",
    });
    itemId = item.id;
  });

  it("el dueño ve su viaje", async () => {
    expect((await r.trips.get(w1, tripId))?.name).toBe("Bariloche");
    expect(await r.trips.list(w1)).toHaveLength(1);
  });

  it("otro workspace no ve el viaje", async () => {
    expect(await r.trips.get(w2, tripId)).toBeNull();
    expect(await r.trips.list(w2)).toHaveLength(0);
  });

  it("otro workspace no ve las partidas", async () => {
    expect(await r.costItems.list(w2, tripId)).toEqual([]);
    expect(await r.costItems.get(w2, itemId)).toBeNull();
  });

  it("otro workspace no puede modificar ni borrar", async () => {
    await expect(r.costItems.update(w2, itemId, { label: "hack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(r.trips.update(w2, tripId, { name: "hack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(r.trips.remove(w2, tripId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(r.costItems.remove(w2, itemId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("otro workspace no puede crear hijos en un viaje ajeno", async () => {
    await expect(
      r.travelers.create(w2, { tripId, name: "Intruso", kind: "adult" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("los tipos de cambio son por workspace", async () => {
    await r.rates.create(w1, { fromCurrency: "USD", toCurrency: "ARS", rate: "1000.50", asOf: "2027-01-01", source: "BNA" });
    expect(await r.rates.list(w1)).toHaveLength(1);
    expect(await r.rates.list(w2)).toHaveLength(0);
  });

  it("los datos siguen intactos", async () => {
    expect((await r.costItems.get(w1, itemId))?.label).toBe("Comida");
    expect((await r.trips.get(w1, tripId))?.name).toBe("Bariloche");
  });
});

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
  startAt: new Date("2027-01-10T03:00:00Z"),
  startTz: "America/Argentina/Buenos_Aires",
  endAt: new Date("2027-01-17T02:59:00Z"),
  endTz: "America/Argentina/Buenos_Aires",
  baseCurrency: "ARS",
  budgetCents: 0,
};

describe("marcas del radar", () => {
  let db: Db;
  let r: Repos;
  let w1: Ctx;
  let w2: Ctx;
  let tripId: string;
  let otherTripId: string;

  beforeAll(async () => {
    db = await createTestDb();
    r = makeRepos(db);
    w1 = await ctxFor(db, "uno@x.com");
    w2 = await ctxFor(db, "dos@x.com");
    tripId = (await r.trips.create(w1, tripInput)).id;
    otherTripId = (await r.trips.create(w1, { ...tripInput, name: "Otro" })).id;
  });

  it("marca, actualiza la hora y lista", async () => {
    await r.radar.markOpened(w1, tripId, "booking", new Date("2026-11-14T10:00:00Z"));
    await r.radar.markOpened(w1, tripId, "booking", new Date("2026-11-14T11:00:00Z"));
    const checks = await r.radar.listChecks(w1, tripId);
    expect(checks).toHaveLength(1);
    expect(checks[0]!.siteId).toBe("booking");
    expect(checks[0]!.openedAt.toISOString()).toBe("2026-11-14T11:00:00.000Z");
  });

  it("reset borra solo las marcas de ese viaje", async () => {
    await r.radar.markOpened(w1, tripId, "kayak", new Date());
    await r.radar.markOpened(w1, otherTripId, "kayak", new Date());
    await r.radar.reset(w1, tripId);
    expect(await r.radar.listChecks(w1, tripId)).toEqual([]);
    expect(await r.radar.listChecks(w1, otherTripId)).toHaveLength(1);
  });

  it("otro workspace no ve, no marca ni reinicia", async () => {
    await r.radar.markOpened(w1, tripId, "airbnb", new Date());
    expect(await r.radar.listChecks(w2, tripId)).toEqual([]);
    await expect(r.radar.markOpened(w2, tripId, "booking", new Date())).rejects.toBeInstanceOf(NotFoundError);
    await expect(r.radar.reset(w2, tripId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await r.radar.listChecks(w1, tripId)).toHaveLength(1);
  });
});

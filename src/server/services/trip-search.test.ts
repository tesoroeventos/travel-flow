import { beforeEach, describe, expect, it } from "vitest";
import { err } from "@/domain/result";
import { fakeTravelSearch } from "@/integrations/search/fake";
import type { FlightQuery, HotelQuery, TravelSearch } from "@/integrations/search/types";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos } from "../repos";
import { users, workspaces } from "../db/schema";
import { makeCtx } from "./demo-data";
import { loadTrip } from "./load-trip";
import { updateOffer } from "./offers";
import { proposalsFromLoaded } from "./proposals";
import { getTripSearch, runTripSearch } from "./trip-search";

const TZ = "America/Argentina/Buenos_Aires";
const now = new Date("2026-11-14T19:05:00Z");

/** El simulado con contador de llamadas y registro de lo pedido. */
function counting(base: TravelSearch = fakeTravelSearch) {
  const c = {
    calls: 0,
    flightQueries: [] as FlightQuery[],
    hotelQueries: [] as HotelQuery[],
    flights: async (q: FlightQuery) => {
      c.calls++;
      c.flightQueries.push(q);
      return base.flights(q);
    },
    returnFlights: async (q: FlightQuery, t: string) => {
      c.calls++;
      return base.returnFlights(q, t);
    },
    hotels: async (q: HotelQuery) => {
      c.calls++;
      c.hotelQueries.push(q);
      return base.hotels(q);
    },
  };
  return c;
}

async function makeTrip(
  db: Db,
  ctx: Ctx,
  o: { dest?: string; destIata?: string | null; currency?: string; people?: number } = {},
) {
  const r = makeRepos(db);
  const t = await r.trips.create(ctx, {
    name: "Viaje",
    originLabel: "Zárate",
    destinationLabel: o.dest ?? "Bariloche",
    originIata: "BUE",
    destinationIata: o.destIata === undefined ? "BRC" : o.destIata,
    startAt: new Date("2027-01-10T03:00:00Z"),
    startTz: TZ,
    endAt: new Date("2027-01-17T02:59:00Z"),
    endTz: TZ,
    baseCurrency: o.currency ?? "ARS",
    budgetCents: 0,
  });
  for (let i = 0; i < (o.people ?? 2); i++) await r.travelers.create(ctx, { tripId: t.id, name: `Viajero ${i + 1}` });
  return t.id;
}

describe("runTripSearch", () => {
  let db: Db;
  let ctx: Ctx;
  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
  });

  it("importa 5 vuelos y 6 alojamientos y deja listas las 3 opciones", async () => {
    const tripId = await makeTrip(db, ctx);
    const c = counting();
    const r = await runTripSearch(db, ctx, tripId, c, { now });
    expect(r.ok && r.data).toMatchObject({
      flights: 5,
      lodging: 6,
      missingAirlines: ["Flybondi"],
      skipped: false,
      messages: [],
    });
    expect(c.flightQueries[0]).toMatchObject({
      departureId: "EZE,AEP",
      arrivalId: "BRC",
      outboundDate: "2027-01-10",
      returnDate: "2027-01-16",
      adults: 2,
      currency: "ARS",
    });
    expect(c.hotelQueries[0]).toMatchObject({
      q: "Bariloche",
      checkIn: "2027-01-10",
      checkOut: "2027-01-16",
      adults: 2,
    });
    const data = await loadTrip(db, ctx, tripId);
    expect(data.transport.filter((t) => t.leg === "outbound")).toHaveLength(5);
    expect(data.transport.find((t) => t.serviceNumber === "AR 1682")).toMatchObject({
      source: "busqueda",
      externalRef: "tok-AR1682",
    });
    expect(data.lodging).toHaveLength(6);
    expect(data.lodging.find((l) => l.name === "Nahuel Departamentos")).toMatchObject({
      capacity: 6,
      kind: "apartment",
      reviewCount: 32,
    });
    expect(proposalsFromLoaded(data).missing).toEqual([]);
    expect(await getTripSearch(db, ctx, tripId)).toMatchObject({
      flightsCount: 5,
      lodgingCount: 6,
      missingAirlines: ["Flybondi"],
    });
  });

  it("con los mismos datos no vuelve a buscar ni duplica", async () => {
    const tripId = await makeTrip(db, ctx);
    const c = counting();
    await runTripSearch(db, ctx, tripId, c, { now });
    const r = await runTripSearch(db, ctx, tripId, c, { now });
    expect(r.ok && r.data.skipped).toBe(true);
    expect(c.calls).toBe(2);
    expect((await loadTrip(db, ctx, tripId)).transport.filter((t) => t.leg === "outbound")).toHaveLength(5);
  });

  it("force reemplaza solo lo que no se tocó", async () => {
    const tripId = await makeTrip(db, ctx);
    const rp = makeRepos(db);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    let data = await loadTrip(db, ctx, tripId);
    const edited = data.transport.find((t) => t.leg === "outbound")!;
    await updateOffer(db, ctx, { ownerType: "transport_option", id: edited.id }, { price: 1 });
    const booked = data.lodging[0]!;
    await rp.bookings.create(ctx, { tripId, ownerType: "lodging_option", ownerId: booked.id });

    const c = counting();
    const r = await runTripSearch(db, ctx, tripId, c, { force: true, now });
    expect(r.ok && r.data.skipped).toBe(false);
    expect(c.calls).toBe(2);
    data = await loadTrip(db, ctx, tripId);
    expect(data.transport.find((t) => t.id === edited.id)?.source).toBe("busqueda_editada");
    expect(data.lodging.find((l) => l.id === booked.id)).toBeDefined();
    expect(data.transport.filter((t) => t.leg === "outbound")).toHaveLength(6);
    expect(data.lodging).toHaveLength(7);
  });

  it("viaje en BRL busca en USD", async () => {
    const tripId = await makeTrip(db, ctx, { currency: "BRL" });
    const c = counting();
    await runTripSearch(db, ctx, tripId, c, { now });
    expect(c.flightQueries[0]!.currency).toBe("USD");
    expect(c.hotelQueries[0]!.currency).toBe("USD");
    const items = await makeRepos(db).costItems.list(ctx, tripId);
    expect(new Set(items.map((i) => i.currency))).toEqual(new Set(["USD"]));
  });

  it("sin aeropuertos devuelve no_airports", async () => {
    const tripId = await makeTrip(db, ctx, { destIata: null });
    const r = await runTripSearch(db, ctx, tripId, counting(), { now });
    expect(!r.ok && r.error.code).toBe("no_airports");
  });

  it("si fallan los dos no borra lo anterior", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const down: TravelSearch = {
      flights: async () => err("unavailable", "No pude buscar ahora. Probá de nuevo en un rato."),
      returnFlights: async () => err("unavailable", "x"),
      hotels: async () => err("unavailable", "No pude buscar ahora. Probá de nuevo en un rato."),
    };
    const r = await runTripSearch(db, ctx, tripId, down, { force: true, now });
    expect(!r.ok && r.error.code).toBe("unavailable");
    expect((await loadTrip(db, ctx, tripId)).lodging).toHaveLength(6);
  });

  it("otro workspace no puede buscar en el viaje", async () => {
    const tripId = await makeTrip(db, ctx);
    const [u] = await db.insert(users).values({ email: "otro@x.com", name: "o", passwordHash: "x" }).returning();
    const [w] = await db.insert(workspaces).values({ name: "otro" }).returning();
    await expect(
      runTripSearch(db, { userId: u!.id, workspaceId: w!.id }, tripId, counting(), { now }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ruta sin resultados deja los dos mensajes", async () => {
    const tripId = await makeTrip(db, ctx, { dest: "Mendoza", destIata: "MDZ" });
    const r = await runTripSearch(db, ctx, tripId, counting(), { now });
    expect(r.ok && r.data.messages).toEqual([
      "Google no mostró vuelos con precio para estas fechas.",
      "No encontré alojamiento para 2 personas en esas fechas.",
    ]);
  });

  it("el grupo grande descarta alojamientos chicos", async () => {
    const tripId = await makeTrip(db, ctx, { people: 4 });
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const names = (await loadTrip(db, ctx, tripId)).lodging.map((l) => l.name);
    expect(names).not.toContain("Lagos del Sur");
    expect(names).toContain("Nahuel Departamentos");
  });
});

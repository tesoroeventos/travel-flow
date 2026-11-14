import { beforeEach, describe, expect, it } from "vitest";
import { err } from "@/domain/result";
import { fakeTravelSearch } from "@/integrations/search/fake";
import type { FlightQuery, HotelQuery, TravelSearch } from "@/integrations/search/types";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos } from "../repos";
import { tripSearches, users, workspaces } from "../db/schema";
import { makeCtx } from "./demo-data";
import { loadTrip } from "./load-trip";
import { updateOffer } from "./offers";
import { proposalsFromLoaded } from "./proposals";
import { fillReturnFlights, getTripSearch, runTripSearch } from "./trip-search";

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
    expect(data.transport.find((t) => t.serviceNumber === "AR 1682" && t.leg === "outbound")).toMatchObject({
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

  it("dos búsquedas a la vez gastan una sola vez y no duplican", async () => {
    const tripId = await makeTrip(db, ctx);
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const slow = counting({
      ...fakeTravelSearch,
      flights: async (q) => {
        await gate;
        return fakeTravelSearch.flights(q);
      },
    });
    const first = runTripSearch(db, ctx, tripId, slow, { now });
    await new Promise((res) => setTimeout(res, 50));
    const second = await runTripSearch(db, ctx, tripId, slow, { now });
    expect(second.ok && second.data).toMatchObject({ skipped: true, running: true });
    release();
    await first;
    expect(slow.calls).toBe(2);
    expect((await loadTrip(db, ctx, tripId)).transport.filter((t) => t.leg === "outbound")).toHaveLength(5);
    expect((await getTripSearch(db, ctx, tripId))!.runningSince).toBeNull();
  });

  it("una búsqueda colgada hace más de 2 minutos se puede retomar", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    await db.update(tripSearches).set({ paramsKey: "viejo", runningSince: new Date(now.getTime() - 3 * 60_000) });
    const r = await runTripSearch(db, ctx, tripId, counting(), { now });
    expect(r.ok && r.data.skipped).toBe(false);
  });

  it("si fallan los dos queda registrado y no se reintenta solo", async () => {
    const tripId = await makeTrip(db, ctx);
    const down = counting({
      flights: async () => err("bad_key", "La clave de SerpApi no es válida. Revisá SERPAPI_KEY."),
      returnFlights: async () => err("bad_key", "x"),
      hotels: async () => err("bad_key", "La clave de SerpApi no es válida. Revisá SERPAPI_KEY."),
    });
    const r = await runTripSearch(db, ctx, tripId, down, { now });
    expect(!r.ok && r.error.code).toBe("bad_key");
    expect(await getTripSearch(db, ctx, tripId)).toMatchObject({
      error: "La clave de SerpApi no es válida. Revisá SERPAPI_KEY.",
      runningSince: null,
    });
    const again = await runTripSearch(db, ctx, tripId, down, { now });
    expect(again.ok && again.data.skipped).toBe(true);
    expect(down.calls).toBe(2);
  });

  it("un viaje con fechas pasadas no busca", async () => {
    const tripId = await makeTrip(db, ctx);
    const c = counting();
    const r = await runTripSearch(db, ctx, tripId, c, { now: new Date("2027-02-01T12:00:00Z") });
    expect(!r.ok && r.error).toEqual({
      code: "past_trip",
      message: "Las fechas del viaje ya pasaron: no busco vuelos ni alojamiento.",
    });
    expect(c.calls).toBe(0);
  });

  it("el grupo grande descarta alojamientos chicos", async () => {
    const tripId = await makeTrip(db, ctx, { people: 4 });
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const names = (await loadTrip(db, ctx, tripId)).lodging.map((l) => l.name);
    expect(names).not.toContain("Lagos del Sur");
    expect(names).toContain("Nahuel Departamentos");
  });
});

describe("fillReturnFlights", () => {
  let db: Db;
  let ctx: Ctx;
  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
  });

  async function chooseCheapest(tripId: string) {
    const data = await loadTrip(db, ctx, tripId);
    const out = data.transport.find((t) => t.serviceNumber === "AR 1682" && t.leg === "outbound")!;
    await makeRepos(db).bookings.create(ctx, { tripId, ownerType: "transport_option", ownerId: out.id });
    return out;
  }

  it("al elegir completa la vuelta con un solo pedido", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const out = await chooseCheapest(tripId);
    const c = counting();
    expect(await fillReturnFlights(db, ctx, tripId, c)).toEqual({ filled: 1, failed: 0 });
    expect(c.calls).toBe(1);
    const back = (await loadTrip(db, ctx, tripId)).transport.find((t) => t.pairId === out.pairId && t.leg === "return")!;
    expect(back.segments).toEqual([
      {
        from: "BRC",
        to: "EZE",
        departUtc: "2027-01-16T21:20:00.000Z",
        departTz: TZ,
        arriveUtc: "2027-01-16T23:45:00.000Z",
        arriveTz: TZ,
      },
    ]);
    expect(back.serviceNumber).toBe("AR 1682");
  });

  it("si ninguna vuelta da el precio de la tarjeta, toma la más barata y actualiza el total", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const out = await chooseCheapest(tripId);
    const pricier: TravelSearch = {
      ...fakeTravelSearch,
      returnFlights: async (q, t) => {
        const r = await fakeTravelSearch.returnFlights(q, t);
        if (!r.ok) return r;
        return { ok: true, data: { options: r.data.options.map((o) => ({ ...o, price: o.price && o.price + 100000 })) } };
      },
    };
    expect(await fillReturnFlights(db, ctx, tripId, pricier)).toEqual({ filled: 1, failed: 0 });
    const item = (await makeRepos(db).costItems.list(ctx, tripId)).find((i) => i.ownerId === out.id)!;
    expect(item.amountCents).toBe(83392000);
    const back = (await loadTrip(db, ctx, tripId)).transport.find((t) => t.pairId === out.pairId && t.leg === "return")!;
    expect(back.notes).toContain("El total cambió con esta vuelta: $ 833.920");
  });

  it("si falla deja la nota y no rompe", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const out = await chooseCheapest(tripId);
    const down: TravelSearch = { ...fakeTravelSearch, returnFlights: async () => err("unavailable", "x") };
    expect(await fillReturnFlights(db, ctx, tripId, down)).toEqual({ filled: 0, failed: 1 });
    await fillReturnFlights(db, ctx, tripId, down);
    const back = (await loadTrip(db, ctx, tripId)).transport.find((t) => t.pairId === out.pairId && t.leg === "return")!;
    expect(back.segments).toEqual([]);
    expect(back.notes?.match(/Vuelta: confirmala en Google Flights\./g)).toHaveLength(1);
  });

  it("no vuelve a pedir una vuelta ya completa", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    await chooseCheapest(tripId);
    await fillReturnFlights(db, ctx, tripId, counting());
    const c = counting();
    expect(await fillReturnFlights(db, ctx, tripId, c)).toEqual({ filled: 0, failed: 0 });
    expect(c.calls).toBe(0);
  });

  it("sin ofertas elegidas de la búsqueda no hace nada", async () => {
    const tripId = await makeTrip(db, ctx);
    await runTripSearch(db, ctx, tripId, counting(), { now });
    const c = counting();
    expect(await fillReturnFlights(db, ctx, tripId, c)).toEqual({ filled: 0, failed: 0 });
    expect(c.calls).toBe(0);
  });
});

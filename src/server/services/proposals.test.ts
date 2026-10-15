import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeCtx } from "./demo-data";
import { loadTrip } from "./load-trip";
import {
  chooseProposal,
  PROPOSAL_MARK,
  proposalsFromLoaded,
} from "./proposals";

const TODAY = "2026-10-15";

async function seed(db: Db, ctx: Ctx, opts: { noLodging?: boolean } = {}) {
  const r = makeRepos(db);
  const trip = await r.trips.create(ctx, {
    name: "Bariloche",
    originLabel: "Zárate",
    destinationLabel: "Bariloche",
    startAt: new Date("2027-01-10T03:00:00Z"),
    startTz: "America/Argentina/Buenos_Aires",
    endAt: new Date("2027-01-17T02:59:00Z"),
    endTz: "America/Argentina/Buenos_Aires",
    baseCurrency: "ARS",
    budgetCents: 150_000_000,
  });
  const tripId = trip.id;
  for (const n of [1, 2])
    await r.travelers.create(ctx, { tripId, name: `Viajero ${n}` });
  const tz = "America/Argentina/Buenos_Aires";
  const seg = (from: string, to: string, d: string, a: string) => [
    { from, to, departUtc: d, departTz: tz, arriveUtc: a, arriveTz: tz },
  ];
  const transport = async (
    leg: "outbound" | "return",
    mode: "flight" | "bus",
    provider: string,
    segments: ReturnType<typeof seg>,
    comfortRating: number,
    amount: number,
    unit: "total" | "per_person",
  ) => {
    const t = await r.transport.create(ctx, {
      tripId,
      leg,
      mode,
      provider,
      fromLabel: segments[0]!.from,
      toLabel: segments[0]!.to,
      segments,
      comfortRating,
    });
    await r.costItems.create(ctx, {
      tripId,
      ownerType: "transport_option",
      ownerId: t.id,
      label: provider,
      amountCents: amount,
      currency: "ARS",
      unit,
      category: leg === "outbound" ? "transport_outbound" : "transport_return",
    });
    return t;
  };
  const idaVuelo = await transport(
    "outbound",
    "flight",
    "Aerolíneas",
    seg("AEP", "BRC", "2027-01-10T13:00:00Z", "2027-01-10T15:20:00Z"),
    4,
    24_000_000,
    "total",
  );
  const vtaVuelo = await transport(
    "return",
    "flight",
    "Aerolíneas",
    seg("BRC", "AEP", "2027-01-16T20:00:00Z", "2027-01-16T22:10:00Z"),
    4,
    22_000_000,
    "total",
  );
  const idaMicro = await transport(
    "outbound",
    "bus",
    "Vía Bariloche",
    seg("Retiro", "Bariloche", "2027-01-09T23:00:00Z", "2027-01-10T21:00:00Z"),
    2,
    6_000_000,
    "per_person",
  );
  const vtaMicro = await transport(
    "return",
    "bus",
    "Vía Bariloche",
    seg("Bariloche", "Retiro", "2027-01-16T15:00:00Z", "2027-01-17T13:00:00Z"),
    2,
    6_000_000,
    "per_person",
  );
  const lodging = async (
    name: string,
    amount: number,
    quality: number,
    currency = "ARS",
  ) => {
    const l = await r.lodging.create(ctx, {
      tripId,
      name,
      checkInAt: new Date("2027-01-10T17:00:00Z"),
      checkOutAt: new Date("2027-01-16T13:00:00Z"),
      tz,
      qualityRating: quality,
      rating: "8.6",
    });
    await r.costItems.create(ctx, {
      tripId,
      ownerType: "lodging_option",
      ownerId: l.id,
      label: name,
      amountCents: amount,
      currency,
      unit: "per_night",
      category: "lodging",
    });
    return l;
  };
  const hotel = opts.noLodging
    ? null
    : await lodging("Hotel Centro", 8_000_000, 4);
  const hostel = opts.noLodging
    ? null
    : await lodging("Hostel Lago", 3_000_000, 2);
  const act = await r.activities.create(ctx, {
    tripId,
    name: "Cerro Catedral",
    date: "2027-01-12",
  });
  await r.costItems.create(ctx, {
    tripId,
    ownerType: "activity",
    ownerId: act.id,
    label: "Cerro Catedral",
    amountCents: 4_000_000,
    currency: "ARS",
    unit: "per_person",
    category: "activities",
  });
  return { tripId, idaVuelo, vtaVuelo, idaMicro, vtaMicro, hotel, hostel };
}

describe("propuestas del viaje", () => {
  let db: Db;
  let ctx: Ctx;
  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
  });

  it("tres propuestas con costos del motor", async () => {
    const s = await seed(db, ctx);
    const res = proposalsFromLoaded(await loadTrip(db, ctx, s.tripId), {
      today: TODAY,
    });
    // imprevisto 10% solo sobre "activities" (80.000 → 8.000)
    expect(res.cards.map((c) => [c.tags.join(","), c.costCents])).toEqual([
      ["barata", 50_800_000],
      ["rapida", 72_800_000],
      ["comoda", 102_800_000],
    ]);
    expect(res.comboCount).toBe(8);
    expect(res.missing).toEqual([]);
    expect(res.cards[0]!.perPersonCents).toBe(25_400_000);
    expect(res.cards[0]!.budgetDiffCents).toBe(150_000_000 - 50_800_000);
    expect(res.cards[0]!.why).toBe(
      "Ahorrás $ 220.000,00 frente a la más rápida.",
    );
    expect(res.cards[1]!.why).toMatch(/^9 h 30 de viaje sumando ida y vuelta/);
    expect(res.cards[2]!.why).toBe(
      "Combina vuelo directo con Hotel Centro (8,6/10).",
    );
  });

  it("precio en USD sin tipo de cambio: la combinación no compite y pide el dólar", async () => {
    const s = await seed(db, ctx, { noLodging: true });
    const r = makeRepos(db);
    const l = await r.lodging.create(ctx, {
      tripId: s.tripId,
      name: "Airbnb",
      checkInAt: new Date("2027-01-10T17:00:00Z"),
      checkOutAt: new Date("2027-01-16T13:00:00Z"),
      tz: "America/Argentina/Buenos_Aires",
    });
    await r.costItems.create(ctx, {
      tripId: s.tripId,
      ownerType: "lodging_option",
      ownerId: l.id,
      label: "Airbnb",
      amountCents: 50_000,
      currency: "USD",
      unit: "per_night",
      category: "lodging",
    });
    const res = proposalsFromLoaded(await loadTrip(db, ctx, s.tripId), {
      today: TODAY,
    });
    expect(res.needsUsdRate).toBe(true);
    expect(res.cards).toEqual([]);
  });

  it("elegir dos veces deja un solo escenario de propuesta y es el elegido", async () => {
    const s = await seed(db, ctx);
    await chooseProposal(db, ctx, s.tripId, {
      legIds: [s.idaVuelo.id, s.vtaVuelo.id],
      lodgingId: s.hotel!.id,
      name: "La más rápida",
    });
    const b = await chooseProposal(db, ctx, s.tripId, {
      legIds: [s.idaMicro.id, s.vtaMicro.id],
      lodgingId: s.hostel!.id,
      name: "La más barata",
    });
    const t = await loadTrip(db, ctx, s.tripId);
    expect(
      t.scenarios
        .filter((x) => x.description === PROPOSAL_MARK)
        .map((x) => x.id),
    ).toEqual([b]);
    expect(t.trip.chosenScenarioId).toBe(b);
    const owners = t.bookings.map((x) => x.ownerId).sort();
    expect(owners).toEqual(
      [s.idaMicro.id, s.vtaMicro.id, s.hostel!.id, t.activities[0]!.id].sort(),
    );
  });

  it("ajuste: swaps cambia la combinación de una tarjeta y la marca ajustada", async () => {
    const s = await seed(db, ctx);
    const data = await loadTrip(db, ctx, s.tripId);
    const base = proposalsFromLoaded(data, { today: TODAY });
    const plan = base.plans.findIndex(
      (p) => p[0]!.id === s.idaMicro.id && p[1]!.id === s.vtaMicro.id,
    );
    const lodging = base.lodgings.findIndex((l) => l.id === s.hotel!.id);
    const res = proposalsFromLoaded(data, {
      today: TODAY,
      swaps: { barata: { plan, lodging } },
    });
    expect(res.cards[0]).toMatchObject({
      adjusted: true,
      costCents: 80_800_000,
      why: "Combinación ajustada por vos.",
    });
  });

  it("sin alojamiento: missing incluye 'dónde te alojás' y no hay tarjetas", async () => {
    const s = await seed(db, ctx, { noLodging: true });
    expect(
      proposalsFromLoaded(await loadTrip(db, ctx, s.tripId), { today: TODAY }),
    ).toMatchObject({ missing: ["dónde te alojás"], cards: [] });
  });

  it("lo que va en destino y se excluye no suma", async () => {
    const s = await seed(db, ctx);
    const r = makeRepos(db);
    const act = (await r.activities.list(ctx, s.tripId))[0]!;
    await r.activities.update(ctx, act.id, { inProposals: false });
    const res = proposalsFromLoaded(await loadTrip(db, ctx, s.tripId), {
      today: TODAY,
    });
    expect(res.cards[0]!.costCents).toBe(42_000_000);
  });
});

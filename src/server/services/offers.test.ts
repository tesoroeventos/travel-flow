import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import type { OfferDraft } from "@/integrations/ai/types";
import { makeCtx } from "./demo-data";
import { loadTrip } from "./load-trip";
import {
  offerCardsFromLoaded,
  saveCarOffer,
  saveOffers,
  setInProposals,
  setUsdRate,
  updateOffer,
} from "./offers";
import { proposalsFromLoaded } from "./proposals";

const TZ = "America/Argentina/Buenos_Aires";
const draft = (o: Partial<OfferDraft>): OfferDraft => ({
  kind: "vuelo",
  direction: "ida",
  name: "AR 1672 · directo",
  company: "Aerolíneas",
  from: "AEP",
  to: "BRC",
  depart: null,
  arrive: null,
  durationMin: null,
  stops: 0,
  price: 240000,
  currency: "ARS",
  basis: "total",
  nights: null,
  score: null,
  comfort: 4,
  detail: "",
  doubtful: [],
  ...o,
});

describe("ofertas", () => {
  let db: Db;
  let ctx: Ctx;
  let tripId: string;
  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
    const r = makeRepos(db);
    const t = await r.trips.create(ctx, {
      name: "Bariloche",
      originLabel: "Zárate",
      destinationLabel: "Bariloche",
      startAt: new Date("2027-01-10T03:00:00Z"),
      startTz: TZ,
      endAt: new Date("2027-01-17T02:59:00Z"),
      endTz: TZ,
      baseCurrency: "ARS",
      budgetCents: 0,
    });
    tripId = t.id;
    for (const n of [1, 2])
      await r.travelers.create(ctx, { tripId, name: `Viajero ${n}` });
  });

  it("vuelo de ida con horarios crea transporte con un segmento y su partida", async () => {
    const [saved] = await saveOffers(
      db,
      ctx,
      tripId,
      [draft({ depart: "2027-01-10T10:00", arrive: "2027-01-10T12:20" })],
      { kind: "captura" },
    );
    const data = await loadTrip(db, ctx, tripId);
    const t = data.transport.find((x) => x.id === saved!.id)!;
    expect(t).toMatchObject({
      leg: "outbound",
      mode: "flight",
      provider: "Aerolíneas",
      serviceNumber: "AR 1672 · directo",
      comfortRating: 4,
      source: "captura",
    });
    expect(t.segments[0]!.departUtc).toBe("2027-01-10T13:00:00.000Z");
    expect(t.segments[0]!.arriveUtc).toBe("2027-01-10T15:20:00.000Z");
    const item = data.costItems.find((i) => i.ownerId === t.id)!;
    expect(item).toMatchObject({
      category: "transport_outbound",
      amountCents: 24_000_000,
      unit: "total",
      source: "Captura",
      certainty: "estimated",
    });
  });

  it("si solo hay salida y duración, la llegada es salida + duración", async () => {
    const [s] = await saveOffers(
      db,
      ctx,
      tripId,
      [
        draft({
          kind: "micro",
          depart: "2027-01-10T06:00",
          durationMin: 22 * 60,
        }),
      ],
      { kind: "captura" },
    );
    const t = (await loadTrip(db, ctx, tripId)).transport.find(
      (x) => x.id === s!.id,
    )!;
    expect(t.segments[0]!.arriveUtc).toBe("2027-01-11T07:00:00.000Z");
  });

  it("ida y vuelta crea dos filas con el mismo pairId y una sola partida", async () => {
    const saved = await saveOffers(
      db,
      ctx,
      tripId,
      [draft({ direction: "ida_y_vuelta" })],
      { kind: "link", url: "https://www.despegar.com.ar/x" },
    );
    const data = await loadTrip(db, ctx, tripId);
    expect(data.transport).toHaveLength(2);
    expect(data.transport[0]!.pairId).toBeTruthy();
    expect(data.transport[0]!.pairId).toBe(data.transport[1]!.pairId);
    expect(data.costItems).toHaveLength(1);
    expect(data.costItems[0]!.source).toBe("despegar.com.ar");
    expect(saved).toHaveLength(2);
    expect(
      offerCardsFromLoaded(data).filter((c) => c.group === "ida_y_vuelta"),
    ).toHaveLength(1);
  });

  it("alojamiento sin horarios toma 14:00 y 10:00; '4 estrellas' guarda rating 8", async () => {
    await saveOffers(
      db,
      ctx,
      tripId,
      [
        draft({
          kind: "alojamiento",
          direction: null,
          name: "Hotel Lago",
          score: "4 estrellas",
          price: 80000,
          basis: "por_noche",
        }),
      ],
      { kind: "captura" },
    );
    const l = (await loadTrip(db, ctx, tripId)).lodging[0]!;
    expect(l.checkInAt.toISOString()).toBe("2027-01-10T17:00:00.000Z");
    expect(l.checkOutAt.toISOString()).toBe("2027-01-16T13:00:00.000Z");
    expect(Number(l.rating)).toBe(8);
    expect(l.qualityRating).toBe(4);
  });

  it("puntaje '8,6/10' se guarda como 8.6", async () => {
    await saveOffers(
      db,
      ctx,
      tripId,
      [draft({ kind: "alojamiento", direction: null, score: "8,6/10" })],
      { kind: "captura" },
    );
    expect(Number((await loadTrip(db, ctx, tripId)).lodging[0]!.rating)).toBe(
      8.6,
    );
  });

  it("actividad sin fecha va al primer día completo", async () => {
    await saveOffers(
      db,
      ctx,
      tripId,
      [
        draft({
          kind: "actividad",
          direction: null,
          name: "Cerro Catedral",
          basis: "por_persona",
          price: 40000,
        }),
      ],
      { kind: "captura" },
    );
    const data = await loadTrip(db, ctx, tripId);
    expect(data.activities[0]).toMatchObject({
      date: "2027-01-11",
      name: "Cerro Catedral",
    });
    expect(data.costItems[0]).toMatchObject({
      category: "activities",
      unit: "per_person",
    });
  });

  it("auto propio: dos filas own_car con partidas de nafta y peajes por tramo", async () => {
    await saveCarOffer(
      db,
      ctx,
      tripId,
      {
        km: 1650,
        hours: 19,
        tolls: 15000,
        consumptionLPer100: 7,
        fuelPrice: 1300,
        route: "RN 5",
        doubtful: ["fuelPrice", "tolls"],
      },
      "Peugeot 208",
    );
    const data = await loadTrip(db, ctx, tripId);
    expect(data.transport.map((t) => [t.leg, t.mode])).toEqual(
      expect.arrayContaining([
        ["outbound", "own_car"],
        ["return", "own_car"],
      ]),
    );
    expect(data.transport[0]!.pairId).toBe(data.transport[1]!.pairId);
    const fuel = data.costItems.filter(
      (i) => i.assumptions?.concept === "fuel",
    );
    const tolls = data.costItems.filter(
      (i) => i.assumptions?.concept === "tolls",
    );
    expect(fuel).toHaveLength(2);
    expect(fuel[0]!.amountCents).toBe(
      Math.round(((1650 * 7) / 100) * 1300 * 100),
    );
    expect(tolls[0]!.amountCents).toBe(1_500_000);
    const card = offerCardsFromLoaded(data).find(
      (c) => c.kind === "auto_propio",
    )!;
    expect(card).toMatchObject({
      group: "ida_y_vuelta",
      totalCents: 2 * (15_015_000 + 1_500_000),
    });
    expect(card.doubtful).toEqual(["fuelPrice", "tolls"]);
  });

  it("la marca [revisar:…] se muestra como dudosa y desaparece al editar", async () => {
    const [s] = await saveOffers(
      db,
      ctx,
      tripId,
      [draft({ detail: "Valija 15 kg", doubtful: ["price"] })],
      { kind: "captura" },
    );
    const card = offerCardsFromLoaded(await loadTrip(db, ctx, tripId))[0]!;
    expect(card.doubtful).toEqual(["price"]);
    expect(card.detail).toBe("Valija 15 kg");
    await updateOffer(
      db,
      ctx,
      { ownerType: s!.ownerType, id: s!.id },
      { price: 250000 },
    );
    const card2 = offerCardsFromLoaded(await loadTrip(db, ctx, tripId))[0]!;
    expect(card2.doubtful).toEqual([]);
    expect(card2.totalCents).toBe(25_000_000);
  });

  it("editar el auto recalcula las partidas de los dos tramos", async () => {
    const [ida] = await saveCarOffer(
      db,
      ctx,
      tripId,
      {
        km: 100,
        hours: 1,
        tolls: 0,
        consumptionLPer100: 10,
        fuelPrice: 1000,
        route: "",
        doubtful: [],
      },
      null,
    );
    await updateOffer(
      db,
      ctx,
      { ownerType: "transport_option", id: ida!.id },
      {
        car: {
          km: 200,
          hours: 2,
          consumptionLPer100: 10,
          fuelPrice: 1000,
          tolls: 500,
        },
      },
    );
    const card = offerCardsFromLoaded(await loadTrip(db, ctx, tripId)).find(
      (c) => c.kind === "auto_propio",
    )!;
    expect(card.totalCents).toBe(2 * (20 * 1000 * 100 + 500 * 100));
  });

  it("cambiar el tipo de vuelo a alojamiento mueve la opción de tabla", async () => {
    const [s] = await saveOffers(db, ctx, tripId, [draft({})], {
      kind: "manual",
    });
    await updateOffer(
      db,
      ctx,
      { ownerType: s!.ownerType, id: s!.id },
      { kind: "alojamiento", name: "Cabaña" },
    );
    const data = await loadTrip(db, ctx, tripId);
    expect(data.transport).toHaveLength(0);
    expect(data.lodging.map((l) => l.name)).toEqual(["Cabaña"]);
  });

  it("precio faltante: la tarjeta lo muestra y la propuesta lo pide", async () => {
    await saveOffers(
      db,
      ctx,
      tripId,
      [
        draft({ price: null }),
        draft({ direction: "vuelta" }),
        draft({ kind: "alojamiento", direction: null, name: "Hotel" }),
      ],
      { kind: "captura" },
    );
    const data = await loadTrip(db, ctx, tripId);
    expect(
      offerCardsFromLoaded(data).find((c) => c.group === "ida")!.totalCents,
    ).toBeNull();
    expect(proposalsFromLoaded(data, { today: "2026-10-15" }).missing).toEqual([
      "el precio de “AR 1672 · directo”",
    ]);
  });

  it("setUsdRate guarda USD→ARS con fecha de hoy y la propuesta deja de pedir el dólar", async () => {
    await saveOffers(
      db,
      ctx,
      tripId,
      [
        draft({ direction: "ida_y_vuelta" }),
        draft({
          kind: "alojamiento",
          direction: null,
          price: 70,
          currency: "USD",
          basis: "por_noche",
        }),
      ],
      { kind: "captura" },
    );
    expect(
      proposalsFromLoaded(await loadTrip(db, ctx, tripId), {
        today: "2026-10-15",
      }).needsUsdRate,
    ).toBe(true);
    await setUsdRate(db, ctx, tripId, 1200, "2026-10-15");
    const data = await loadTrip(db, ctx, tripId);
    expect(data.rates[0]).toMatchObject({
      fromCurrency: "USD",
      toCurrency: "ARS",
      asOf: "2026-10-15",
      source: "Ingresado por vos",
    });
    const res = proposalsFromLoaded(data, { today: "2026-10-15" });
    expect(res.needsUsdRate).toBe(false);
    expect(res.cards[0]!.costCents).toBe(24_000_000 + 70 * 1200 * 6 * 100);
  });

  it("excluir una actividad de las propuestas", async () => {
    const [a] = await saveOffers(
      db,
      ctx,
      tripId,
      [draft({ kind: "actividad", direction: null })],
      { kind: "captura" },
    );
    await setInProposals(db, ctx, { ownerType: "activity", id: a!.id }, false);
    expect(
      offerCardsFromLoaded(await loadTrip(db, ctx, tripId))[0]!.inProposals,
    ).toBe(false);
  });
});

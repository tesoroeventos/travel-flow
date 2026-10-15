import { zonedToUtc } from "@/domain/time/calendar";
import type { Db } from "../db/client";
import { users, workspaces } from "../db/schema";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";

const BA = "America/Argentina/Buenos_Aires";
const at = (d: string, t: string) => new Date(zonedToUtc(d, t, BA));

export async function makeCtx(db: Db, email = "ana@x.com"): Promise<Ctx> {
  const [u] = await db.insert(users).values({ email, name: "Ana", passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Mi espacio" }).returning();
  return { userId: u!.id, workspaceId: w!.id };
}

/**
 * Carga en la base el caso de referencia Bariloche A (mismos números que
 * src/domain/__fixtures__/bariloche.ts): total esperado $ 1.255.030,00.
 */
export async function seedBarilocheA(db: Db, ctx: Ctx, opts: { isDemo?: boolean } = {}) {
  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  const isDemo = opts.isDemo ?? false;
  const source = isDemo ? "Dato de demostración" : "Carga manual";
  const common = { includesTaxes: true, consultedAt: "2027-01-01", source, isDemo };

  const trip = await r.trips.create(ctx, {
    name: "Bariloche 2027",
    originLabel: "Zárate",
    homeLabel: "Casa",
    destinationLabel: "Bariloche",
    startAt: at("2027-01-10", "08:00"),
    startTz: BA,
    endAt: at("2027-01-16", "20:00"),
    endTz: BA,
    baseCurrency: "ARS",
    budgetCents: 150000000,
    contingencyPct: "10",
    contingencyCategories: ["food", "activities"],
    isDemo,
  });
  await r.travelers.create(ctx, { tripId: trip.id, name: "Adulto 1", kind: "adult", position: 0 });
  await r.travelers.create(ctx, { tripId: trip.id, name: "Adulto 2", kind: "adult", position: 1 });
  await r.rates.create(ctx, { fromCurrency: "USD", toCurrency: "ARS", rate: "1000.50", asOf: "2026-01-01", source: "Banco Nación" });

  const flightOut = await r.transport.create(ctx, {
    tripId: trip.id,
    leg: "outbound",
    mode: "flight",
    provider: "Aerolíneas Argentinas",
    serviceNumber: "AR 1672",
    fromLabel: "Aeroparque (AEP)",
    toLabel: "Bariloche (BRC)",
    segments: [{ from: "AEP", to: "BRC", departUtc: zonedToUtc("2027-01-10", "10:00", BA), departTz: BA, arriveUtc: zonedToUtc("2027-01-10", "12:20", BA), arriveTz: BA }],
    transferToMin: 45,
    transferFromMin: 30,
  });
  const flightBack = await r.transport.create(ctx, {
    tripId: trip.id,
    leg: "return",
    mode: "flight",
    provider: "Aerolíneas Argentinas",
    serviceNumber: "AR 1673",
    fromLabel: "Bariloche (BRC)",
    toLabel: "Aeroparque (AEP)",
    segments: [{ from: "BRC", to: "AEP", departUtc: zonedToUtc("2027-01-16", "17:00", BA), departTz: BA, arriveUtc: zonedToUtc("2027-01-16", "19:10", BA), arriveTz: BA }],
    transferToMin: 30,
    transferFromMin: 40,
  });
  const hotel = await r.lodging.create(ctx, {
    tripId: trip.id,
    kind: "hotel",
    name: "Hotel Centro",
    address: "Mitre 100, Bariloche",
    checkInAt: at("2027-01-10", "15:00"),
    checkOutAt: at("2027-01-16", "10:00"),
    tz: BA,
    distanceCenterKm: 0.3,
    lat: -41.1335,
    lng: -71.3103,
  });
  const excursion = await r.activities.create(ctx, {
    tripId: trip.id,
    name: "Excursión Cerro Catedral",
    address: "Cerro Catedral",
    date: "2027-01-12",
    durationMin: 240,
    lat: -41.1703,
    lng: -71.4393,
  });
  const scenario = await r.scenarios.create(ctx, { tripId: trip.id, name: "A · Avión + hotel céntrico", position: 0 });

  const items = {
    flightOut: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "transport_option", ownerId: flightOut.id, label: "Vuelo ida", amountCents: 12000000, currency: "ARS", unit: "per_person", category: "transport_outbound", certainty: "confirmed" }),
    flightBack: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "transport_option", ownerId: flightBack.id, label: "Vuelo vuelta", amountCents: 11000000, currency: "ARS", unit: "per_person", category: "transport_return" }),
    hotel: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "lodging_option", ownerId: hotel.id, label: "Hotel", amountCents: 8000000, currency: "ARS", unit: "per_night", category: "lodging" }),
    deposit: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "lodging_option", ownerId: hotel.id, label: "Depósito hotel", amountCents: 5000000, currency: "ARS", unit: "total", category: "lodging", refundable: true }),
    food: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "scenario", ownerId: scenario.id, label: "Comida", amountCents: 2500000, currency: "ARS", unit: "per_day", category: "food", costType: "variable" }),
    insurance: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "scenario", ownerId: scenario.id, label: "Seguro", amountCents: 3000, currency: "USD", unit: "per_person", category: "insurance" }),
    excursion: await r.costItems.create(ctx, { ...common, tripId: trip.id, ownerType: "activity", ownerId: excursion.id, label: "Excursión", amountCents: 4000000, currency: "ARS", unit: "per_person", category: "activities", costType: "optional" }),
  };

  for (const [ownerType, ownerId] of [
    ["transport_option", flightOut.id],
    ["transport_option", flightBack.id],
    ["lodging_option", hotel.id],
    ["activity", excursion.id],
  ] as const) {
    await parts.setSelection(ctx, scenario.id, ownerType, ownerId, true);
  }
  await r.bookings.create(ctx, { tripId: trip.id, ownerType: "transport_option", ownerId: flightOut.id, bookingStatus: "booking_confirmed", paymentStatus: "paid" });
  await r.trips.update(ctx, trip.id, { chosenScenarioId: scenario.id });

  return { tripId: trip.id, scenarioId: scenario.id, flightOut, flightBack, hotel, excursion, items };
}

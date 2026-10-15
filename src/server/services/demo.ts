import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { carCostItems } from "@/domain/costs/car";
import { zonedToUtc } from "@/domain/time/calendar";
import type { Db } from "../db/client";
import { trips, users, workspaceMembers, workspaces } from "../db/schema";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";
import type { Trip } from "../repos/trips";
import { seedBarilocheA } from "./demo-data";
import { loadTrip } from "./load-trip";
import { analyzeLoaded } from "./trip-analysis";

const BA = "America/Argentina/Buenos_Aires";
const DEMO_EMAIL = "demo@travelflow.local";
const DEMO_SOURCE = "Dato de demostración";
const at = (d: string, t: string) => zonedToUtc(d, t, BA);

async function demoCtx(db: Db): Promise<Ctx> {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) {
    const [m] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, existing.id));
    return { userId: existing.id, workspaceId: m!.workspaceId };
  }
  // Usuario de sistema sin contraseña válida: no se puede iniciar sesión con él.
  const [u] = await db.insert(users).values({ email: DEMO_EMAIL, name: "Demo", passwordHash: "!" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Demo" }).returning();
  await db.insert(workspaceMembers).values({ workspaceId: w!.id, userId: u!.id, role: "owner" });
  return { userId: u!.id, workspaceId: w!.id };
}

/** Siembra (una sola vez) el viaje de demostración Buenos Aires → Bariloche con 3 escenarios. */
export async function seedDemo(db: Db, opts: { shareToken?: string } = {}): Promise<{ tripId: string; shareToken: string }> {
  const ctx = await demoCtx(db);
  const r = makeRepos(db);
  const existing = (await r.trips.list(ctx)).find((t) => t.isDemo);
  if (existing?.publicShareToken) return { tripId: existing.id, shareToken: existing.publicShareToken };

  const seed = await seedBarilocheA(db, ctx, { isDemo: true });
  const parts = makeScenarioParts(db);
  const tripId = seed.tripId;
  const common = { tripId, isDemo: true, source: DEMO_SOURCE, consultedAt: "2027-01-01", includesTaxes: true };
  await r.trips.update(ctx, tripId, { name: "Buenos Aires → Bariloche (demo)", originLabel: "Buenos Aires" });

  // Actividades gratuitas, con coordenadas, en todos los escenarios
  const chico = await r.activities.create(ctx, { tripId, name: "Circuito Chico", address: "Av. Bustillo", date: "2027-01-13", durationMin: 180, lat: -41.06, lng: -71.52 });
  const otto = await r.activities.create(ctx, { tripId, name: "Cerro Otto (a pie)", address: "Cerro Otto", date: "2027-01-14", durationMin: 240, lat: -41.145, lng: -71.34 });
  await r.scenarios.update(ctx, seed.scenarioId, { name: "A · Avión + hotel céntrico", description: "Transporte público en destino" });
  await parts.setRating(ctx, seed.scenarioId, "comfort", 5);
  await parts.setRating(ctx, seed.scenarioId, "lodging_quality", 4);
  await parts.setRating(ctx, seed.scenarioId, "experience", 4);
  for (const a of [chico, otto]) await parts.setSelection(ctx, seed.scenarioId, "activity", a.id, true);

  // B · Auto propio + departamento alejado
  const b = await r.scenarios.create(ctx, { tripId, name: "B · Auto propio + departamento", position: 1 });
  const carOut = await r.transport.create(ctx, {
    tripId, leg: "outbound", mode: "own_car", provider: "Auto propio", fromLabel: "Buenos Aires", toLabel: "Bariloche",
    segments: [{ from: "Buenos Aires", to: "Bariloche", departUtc: at("2027-01-09", "06:00"), departTz: BA, arriveUtc: at("2027-01-10", "13:00"), arriveTz: BA }],
    distanceKm: 1600, comfortRating: 3,
  });
  const carBack = await r.transport.create(ctx, {
    tripId, leg: "return", mode: "own_car", provider: "Auto propio (vuelta)", fromLabel: "Bariloche", toLabel: "Buenos Aires",
    segments: [{ from: "Bariloche", to: "Buenos Aires", departUtc: at("2027-01-16", "08:00"), departTz: BA, arriveUtc: at("2027-01-17", "12:00"), arriveTz: BA }],
    distanceKm: 1600,
  });
  for (const { nights: _n, paymentStatus: _p, ...item } of carCostItems({
    km: "3200", consumptionLPer100: "8", fuelPriceCents: 120000, currency: "ARS", tollsCents: 2500000, parkingCents: 0,
    rentalCents: 0, insuranceCents: 0, depositCents: 0, extraKm: "0", extraKmPriceCents: 0, dropOffCents: 0, wearPerKmCents: 1500, leg: "outbound",
  })) {
    void _n;
    void _p;
    await r.costItems.create(ctx, { ...item, ...common, ownerType: "transport_option", ownerId: carOut.id });
  }
  const depto = await r.lodging.create(ctx, {
    tripId, kind: "apartment", name: "Departamento Melipal", address: "Av. Bustillo km 6", tz: BA,
    checkInAt: new Date(at("2027-01-10", "15:00")), checkOutAt: new Date(at("2027-01-16", "10:00")),
    distanceCenterKm: 6, lat: -41.12, lng: -71.39, amenities: ["kitchen", "parking", "wifi"], qualityRating: 4, flexibleCancellation: true,
  });
  await r.costItems.create(ctx, { ...common, ownerType: "lodging_option", ownerId: depto.id, label: "Noche", amountCents: 5500000, currency: "ARS", unit: "per_night", category: "lodging" });
  await r.costItems.create(ctx, { ...common, ownerType: "lodging_option", ownerId: depto.id, label: "Limpieza", amountCents: 3000000, currency: "ARS", unit: "total", category: "lodging" });
  await r.costItems.create(ctx, { ...common, ownerType: "scenario", ownerId: b.id, label: "Comida (cocinando)", amountCents: 1800000, currency: "ARS", unit: "per_day", category: "food", costType: "variable" });
  await r.costItems.create(ctx, { ...common, ownerType: "scenario", ownerId: b.id, label: "Nafta en destino", amountCents: 6000000, currency: "ARS", unit: "total", category: "transport_internal", costType: "variable" });
  for (const [t, id] of [["transport_option", carOut.id], ["transport_option", carBack.id], ["lodging_option", depto.id], ["activity", seed.excursion.id], ["activity", chico.id], ["activity", otto.id]] as const) {
    await parts.setSelection(ctx, b.id, t, id, true);
  }
  await parts.setRating(ctx, b.id, "comfort", 3);
  await parts.setRating(ctx, b.id, "lodging_quality", 4);
  await parts.setRating(ctx, b.id, "experience", 5);

  // C · Micro + hostel + traslados puntuales
  const c = await r.scenarios.create(ctx, { tripId, name: "C · Micro + hostel", position: 2 });
  const busOut = await r.transport.create(ctx, {
    tripId, leg: "outbound", mode: "bus", provider: "Vía Bariloche", serviceNumber: "Cama suite", fromLabel: "Retiro", toLabel: "Terminal Bariloche",
    segments: [{ from: "Retiro", to: "Bariloche", departUtc: at("2027-01-09", "15:00"), departTz: BA, arriveUtc: at("2027-01-10", "13:30"), arriveTz: BA }],
    transferToMin: 40, transferFromMin: 20, comfortRating: 2,
  });
  const busBack = await r.transport.create(ctx, {
    tripId, leg: "return", mode: "bus", provider: "Vía Bariloche", serviceNumber: "Cama", fromLabel: "Terminal Bariloche", toLabel: "Retiro",
    segments: [{ from: "Bariloche", to: "Retiro", departUtc: at("2027-01-16", "14:00"), departTz: BA, arriveUtc: at("2027-01-17", "12:00"), arriveTz: BA }],
    transferToMin: 20, transferFromMin: 40,
  });
  await r.costItems.create(ctx, { ...common, ownerType: "transport_option", ownerId: busOut.id, label: "Pasaje", amountCents: 6000000, currency: "ARS", unit: "per_person", category: "transport_outbound" });
  await r.costItems.create(ctx, { ...common, ownerType: "transport_option", ownerId: busBack.id, label: "Pasaje", amountCents: 6000000, currency: "ARS", unit: "per_person", category: "transport_return" });
  const hostel = await r.lodging.create(ctx, {
    tripId, kind: "hostel", name: "Hostel del Lago", address: "Moreno 300", tz: BA,
    checkInAt: new Date(at("2027-01-10", "14:00")), checkOutAt: new Date(at("2027-01-16", "10:00")),
    distanceCenterKm: 0.8, lat: -41.136, lng: -71.302, amenities: ["breakfast", "wifi"], qualityRating: 3,
  });
  await r.costItems.create(ctx, { ...common, ownerType: "lodging_option", ownerId: hostel.id, label: "Habitación privada", amountCents: 3000000, currency: "ARS", unit: "per_night", category: "lodging" });
  await r.costItems.create(ctx, { ...common, ownerType: "scenario", ownerId: c.id, label: "Comida", amountCents: 2500000, currency: "ARS", unit: "per_day", category: "food", costType: "variable" });
  await r.costItems.create(ctx, { ...common, ownerType: "scenario", ownerId: c.id, label: "Remises a excursiones", amountCents: 1500000, currency: "ARS", unit: "total", quantity: "4", category: "transport_internal" });
  await r.costItems.create(ctx, { ...common, ownerType: "scenario", ownerId: c.id, label: "Seguro", amountCents: 3000, currency: "USD", unit: "per_person", category: "insurance" });
  for (const [t, id] of [["transport_option", busOut.id], ["transport_option", busBack.id], ["lodging_option", hostel.id], ["activity", seed.excursion.id], ["activity", chico.id], ["activity", otto.id]] as const) {
    await parts.setSelection(ctx, c.id, t, id, true);
  }
  await parts.setRating(ctx, c.id, "comfort", 2);
  await parts.setRating(ctx, c.id, "lodging_quality", 3);
  await parts.setRating(ctx, c.id, "experience", 3);

  const shareToken = opts.shareToken ?? randomBytes(32).toString("base64url");
  await r.trips.update(ctx, tripId, { publicShareToken: shareToken });
  return { tripId, shareToken };
}

/** Datos y análisis de un viaje por su enlace público (solo lectura), o null. */
export async function loadSharedTrip(db: Db, token: string) {
  if (!token) return null;
  const [trip] = await db.select().from(trips).where(eq(trips.publicShareToken, token));
  if (!trip) return null;
  const readCtx: Ctx = { userId: "00000000-0000-0000-0000-000000000000", workspaceId: trip.workspaceId };
  const data = await loadTrip(db, readCtx, trip.id);
  return { data, analysis: analyzeLoaded(data) };
}

export async function getDemoShareToken(db: Db): Promise<string | null> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (!u) return null;
  const [m] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, u.id));
  if (!m) return null;
  const [t] = await db
    .select({ token: trips.publicShareToken })
    .from(trips)
    .where(and(eq(trips.workspaceId, m.workspaceId), eq(trips.isDemo, true)));
  return t?.token ?? null;
}

export async function createShareLink(db: Db, ctx: Ctx, tripId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await makeRepos(db).trips.update(ctx, tripId, { publicShareToken: token });
  return token;
}

export async function revokeShareLink(db: Db, ctx: Ctx, tripId: string): Promise<void> {
  await makeRepos(db).trips.update(ctx, tripId, { publicShareToken: null });
}

/** Copia un viaje (de cualquier workspace legible por srcCtx) al workspace de dstCtx. */
async function copyTrip(db: Db, srcCtx: Ctx, tripId: string, dstCtx: Ctx, name: string): Promise<Trip> {
  const src = await loadTrip(db, srcCtx, tripId);
  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  const strip = <T extends Record<string, unknown>>(row: T) => {
    const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = row;
    void _i;
    void _t;
    void _c;
    void _u;
    return rest;
  };
  const { id: _id, workspaceId: _w, createdAt: _c, updatedAt: _u, ...tripRest } = src.trip;
  void _id;
  void _w;
  void _c;
  void _u;
  const trip = await r.trips.create(dstCtx, {
    ...tripRest,
    name,
    status: "planning",
    publicShareToken: null,
    itinerarySnapshot: null,
    chosenScenarioId: null,
    referenceScenarioId: null,
  });
  const ids = new Map<string, string>();
  for (const t of src.travelers) ids.set(t.id, (await r.travelers.create(dstCtx, { ...strip(t), tripId: trip.id } as never)).id);
  for (const s of src.stops) await r.stops.create(dstCtx, { ...strip(s), tripId: trip.id } as never);
  for (const o of src.transport) ids.set(o.id, (await r.transport.create(dstCtx, { ...strip(o), tripId: trip.id } as never)).id);
  for (const o of src.lodging) ids.set(o.id, (await r.lodging.create(dstCtx, { ...strip(o), stopId: null, tripId: trip.id } as never)).id);
  for (const o of src.activities) ids.set(o.id, (await r.activities.create(dstCtx, { ...strip(o), tripId: trip.id } as never)).id);
  for (const s of src.scenarios) ids.set(s.id, (await r.scenarios.create(dstCtx, { ...strip(s), tripId: trip.id } as never)).id);
  for (const i of src.costItems) {
    const owner = ids.get(i.ownerId);
    if (!owner) continue;
    ids.set(i.id, (await r.costItems.create(dstCtx, { ...strip(i), ownerId: owner, tripId: trip.id } as never)).id);
  }
  for (const s of src.selections) {
    const sc = ids.get(s.scenarioId);
    const ow = ids.get(s.ownerId);
    if (sc && ow) await parts.setSelection(dstCtx, sc, s.ownerType, ow, true);
  }
  for (const t of src.toggles) {
    const sc = ids.get(t.scenarioId);
    const it = ids.get(t.costItemId);
    if (sc && it) await parts.setToggle(dstCtx, sc, it, t.included);
  }
  for (const g of src.ratings) {
    const sc = ids.get(g.scenarioId);
    if (sc) await parts.setRating(dstCtx, sc, g.criterion, g.value);
  }
  for (const w of src.weights) await parts.setWeight(dstCtx, trip.id, w.criterion, w.weight);
  for (const o of src.overrides) {
    const key = o.entryKey.replace(/:([0-9a-f-]{36}):/, (m, id: string) => `:${ids.get(id) ?? id}:`);
    await parts.setOverride(dstCtx, trip.id, key, { position: o.position, note: o.note });
  }
  // Tipos de cambio que el destino no tenga (si no, los totales quedarían incompletos)
  if (srcCtx.workspaceId !== dstCtx.workspaceId) {
    const mine = await r.rates.list(dstCtx);
    for (const rt of src.rates) {
      if (!mine.some((m) => m.fromCurrency === rt.fromCurrency && m.toCurrency === rt.toCurrency && m.asOf === rt.asOf)) {
        await r.rates.create(dstCtx, {
          fromCurrency: rt.fromCurrency,
          toCurrency: rt.toCurrency,
          rate: rt.rate,
          asOf: rt.asOf,
          source: `Copiado de «${src.trip.name}»: ${rt.source}`,
        });
      }
    }
  }
  const patch: Partial<Trip> = {};
  if (src.trip.chosenScenarioId && ids.get(src.trip.chosenScenarioId)) patch.chosenScenarioId = ids.get(src.trip.chosenScenarioId)!;
  if (src.trip.referenceScenarioId && ids.get(src.trip.referenceScenarioId)) patch.referenceScenarioId = ids.get(src.trip.referenceScenarioId)!;
  return Object.keys(patch).length ? r.trips.update(dstCtx, trip.id, patch) : trip;
}

export async function duplicateTrip(db: Db, ctx: Ctx, tripId: string): Promise<Trip> {
  const src = await makeRepos(db).trips.require(ctx, tripId);
  return copyTrip(db, ctx, tripId, ctx, `${src.name} (copia)`);
}

export async function duplicateSharedTrip(db: Db, token: string, ctx: Ctx): Promise<Trip> {
  const [trip] = await db.select().from(trips).where(eq(trips.publicShareToken, token));
  if (!trip) throw new Error("Enlace inválido");
  const srcCtx: Ctx = { userId: ctx.userId, workspaceId: trip.workspaceId };
  return copyTrip(db, srcCtx, trip.id, ctx, trip.name.replace(/ \(demo\)$/, ""));
}

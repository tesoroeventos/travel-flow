import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import type { Trip } from "../repos/trips";
import type { TripCreate } from "../validation/trip";

export interface TripForm {
  trip: TripCreate;
  stops: string[];
  preferences: Record<string, unknown>;
  constraints: Record<string, unknown>;
}

const KIND_NAMES = { adult: "Adulto", child: "Niño", infant: "Bebé" } as const;
type Kind = keyof typeof KIND_NAMES;

function tripColumns(f: TripForm) {
  const { adults: _a, children: _c, infants: _i, ...t } = f.trip;
  void _a;
  void _c;
  void _i;
  return { ...t, preferences: f.preferences, constraints: f.constraints };
}

export async function createTrip(db: Db, ctx: Ctx, f: TripForm): Promise<Trip> {
  const r = makeRepos(db);
  const trip = await r.trips.create(ctx, tripColumns(f));
  await setTravelerCounts(db, ctx, trip.id, f.trip);
  await replaceStops(db, ctx, trip.id, f.stops);
  return trip;
}

export async function updateTrip(db: Db, ctx: Ctx, tripId: string, f: TripForm): Promise<Trip> {
  const r = makeRepos(db);
  const trip = await r.trips.update(ctx, tripId, tripColumns(f));
  await setTravelerCounts(db, ctx, tripId, f.trip);
  await replaceStops(db, ctx, tripId, f.stops);
  return trip;
}

/** Ajusta la cantidad de viajeros por tipo agregando o quitando los últimos de cada tipo. */
export async function setTravelerCounts(
  db: Db,
  ctx: Ctx,
  tripId: string,
  counts: { adults: number; children: number; infants: number },
): Promise<void> {
  const r = makeRepos(db);
  const current = await r.travelers.list(ctx, tripId);
  const wanted: Record<Kind, number> = { adult: counts.adults, child: counts.children, infant: counts.infants };
  let position = current.reduce((m, t) => Math.max(m, t.position), -1) + 1;
  for (const kind of Object.keys(wanted) as Kind[]) {
    const ofKind = current.filter((t) => t.kind === kind);
    for (let i = ofKind.length; i < wanted[kind]; i++) {
      await r.travelers.create(ctx, { tripId, kind, name: `${KIND_NAMES[kind]} ${i + 1}`, position: position++ });
    }
    for (const t of ofKind.slice(wanted[kind]).reverse()) await r.travelers.remove(ctx, t.id);
  }
  // Reordenar: adultos, niños, bebés, respetando el orden previo dentro de cada tipo
  const after = await r.travelers.list(ctx, tripId);
  const order: Kind[] = ["adult", "child", "infant"];
  const sorted = [...after].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.position - b.position);
  for (const [i, t] of sorted.entries()) if (t.position !== i) await r.travelers.update(ctx, t.id, { position: i });
}

async function replaceStops(db: Db, ctx: Ctx, tripId: string, labels: string[]): Promise<void> {
  const r = makeRepos(db);
  const clean = labels.map((s) => s.trim()).filter(Boolean);
  const existing = await r.stops.list(ctx, tripId);
  if (existing.map((s) => s.label).join("\n") === clean.join("\n")) return;
  for (const s of existing) await r.stops.remove(ctx, s.id);
  for (const [i, label] of clean.entries()) await r.stops.create(ctx, { tripId, label, position: i });
}

export async function deleteTrip(db: Db, ctx: Ctx, tripId: string): Promise<void> {
  await makeRepos(db).trips.remove(ctx, tripId);
}

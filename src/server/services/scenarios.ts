import { and, eq } from "drizzle-orm";
import type { Criterion } from "@/domain/decision/types";
import type { Db } from "../db/client";
import { costItems } from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";

export async function createScenario(db: Db, ctx: Ctx, tripId: string, name: string) {
  const r = makeRepos(db);
  const existing = await r.scenarios.list(ctx, tripId);
  const position = existing.reduce((m, s) => Math.max(m, s.position), -1) + 1;
  return r.scenarios.create(ctx, { tripId, name: name.trim() || `Escenario ${existing.length + 1}`, position });
}

/** Copia un escenario con sus selecciones, interruptores, calificaciones y partidas propias. */
export async function duplicateScenario(db: Db, ctx: Ctx, scenarioId: string, name: string) {
  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  const src = await r.scenarios.require(ctx, scenarioId);
  const copy = await createScenario(db, ctx, src.tripId, name);
  const [selections, toggles, ratings, items] = await Promise.all([
    parts.listSelections(ctx, src.tripId),
    parts.listToggles(ctx, src.tripId),
    parts.listRatings(ctx, src.tripId),
    r.costItems.list(ctx, src.tripId),
  ]);
  for (const s of selections.filter((x) => x.scenarioId === scenarioId)) {
    await parts.setSelection(ctx, copy.id, s.ownerType, s.ownerId, true);
  }
  for (const t of toggles.filter((x) => x.scenarioId === scenarioId)) {
    await parts.setToggle(ctx, copy.id, t.costItemId, t.included);
  }
  for (const g of ratings.filter((x) => x.scenarioId === scenarioId)) {
    await parts.setRating(ctx, copy.id, g.criterion, g.value);
  }
  for (const i of items.filter((x) => x.ownerType === "scenario" && x.ownerId === scenarioId)) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = i;
    void _id;
    void _c;
    void _u;
    await r.costItems.create(ctx, { ...rest, ownerId: copy.id });
  }
  return copy;
}

export async function deleteScenario(db: Db, ctx: Ctx, scenarioId: string): Promise<void> {
  const r = makeRepos(db);
  const sc = await r.scenarios.require(ctx, scenarioId);
  const trip = await r.trips.require(ctx, sc.tripId);
  const own = await db
    .select({ id: costItems.id })
    .from(costItems)
    .where(and(eq(costItems.tripId, sc.tripId), eq(costItems.ownerType, "scenario"), eq(costItems.ownerId, scenarioId)));
  for (const i of own) await r.costItems.remove(ctx, i.id);
  const patch: { chosenScenarioId?: null; referenceScenarioId?: null } = {};
  if (trip.chosenScenarioId === scenarioId) patch.chosenScenarioId = null;
  if (trip.referenceScenarioId === scenarioId) patch.referenceScenarioId = null;
  if (Object.keys(patch).length) await r.trips.update(ctx, trip.id, patch);
  await r.scenarios.remove(ctx, scenarioId);
}

export interface DecisionSettings {
  weights: Record<Criterion, number>;
  tieThresholdPct: string;
  contingencyPct: string;
  contingencyCategories: string[];
  referenceScenarioId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveDecisionSettings(db: Db, ctx: Ctx, tripId: string, s: DecisionSettings): Promise<void> {
  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  if (s.referenceScenarioId !== null) {
    const ref = UUID_RE.test(s.referenceScenarioId) ? await r.scenarios.get(ctx, s.referenceScenarioId) : null;
    if (!ref || ref.tripId !== tripId) throw new NotFoundError("el escenario", s.referenceScenarioId);
  }
  await r.trips.update(ctx, tripId, {
    tieThresholdPct: s.tieThresholdPct,
    contingencyPct: s.contingencyPct,
    contingencyCategories: s.contingencyCategories,
    referenceScenarioId: s.referenceScenarioId,
  });
  for (const [c, w] of Object.entries(s.weights)) await parts.setWeight(ctx, tripId, c as Criterion, w);
}

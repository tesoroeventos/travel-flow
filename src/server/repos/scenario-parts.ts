import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  costItems,
  decisionWeights,
  itineraryOverrides,
  scenarioItemToggles,
  scenarioRatings,
  scenarioSelections,
  scenarios,
  trips,
} from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import { assertOwnerInTrip, assertTrip, ownsTrip } from "./child";
import type { Criterion, RatingCriterion } from "@/domain/decision/types";

export type SelectionOwnerType = "transport_option" | "lodging_option" | "activity";

/** Selecciones, interruptores, calificaciones, pesos y ajustes de itinerario, con control de workspace. */
export function makeScenarioParts(db: Db) {
  async function assertScenario(ctx: Ctx, scenarioId: string): Promise<string> {
    const rows = await db
      .select({ tripId: scenarios.tripId })
      .from(scenarios)
      .innerJoin(trips, eq(trips.id, scenarios.tripId))
      .where(and(eq(scenarios.id, scenarioId), eq(trips.workspaceId, ctx.workspaceId)));
    if (!rows[0]) throw new NotFoundError("el escenario", scenarioId);
    return rows[0].tripId;
  }

  async function scenarioIds(ctx: Ctx, tripId: string): Promise<string[]> {
    if (!(await ownsTrip(db, ctx, tripId))) return [];
    const rows = await db.select({ id: scenarios.id }).from(scenarios).where(eq(scenarios.tripId, tripId));
    return rows.map((r) => r.id);
  }

  return {
    async setSelection(ctx: Ctx, scenarioId: string, ownerType: SelectionOwnerType, ownerId: string, selected: boolean) {
      const tripId = await assertScenario(ctx, scenarioId);
      if (selected) {
        await assertOwnerInTrip(db, ctx, tripId, ownerType, ownerId);
        await db.insert(scenarioSelections).values({ scenarioId, ownerType, ownerId }).onConflictDoNothing();
      } else {
        await db
          .delete(scenarioSelections)
          .where(
            and(
              eq(scenarioSelections.scenarioId, scenarioId),
              eq(scenarioSelections.ownerType, ownerType),
              eq(scenarioSelections.ownerId, ownerId),
            ),
          );
      }
    },

    async listSelections(ctx: Ctx, tripId: string) {
      const ids = await scenarioIds(ctx, tripId);
      if (ids.length === 0) return [];
      return db.select().from(scenarioSelections).where(inArray(scenarioSelections.scenarioId, ids));
    },

    async setToggle(ctx: Ctx, scenarioId: string, costItemId: string, included: boolean) {
      const tripId = await assertScenario(ctx, scenarioId);
      const item = await db
        .select({ id: costItems.id })
        .from(costItems)
        .where(and(eq(costItems.id, costItemId), eq(costItems.tripId, tripId)));
      if (item.length === 0) throw new NotFoundError("la partida", costItemId);
      await db
        .insert(scenarioItemToggles)
        .values({ scenarioId, costItemId, included })
        .onConflictDoUpdate({ target: [scenarioItemToggles.scenarioId, scenarioItemToggles.costItemId], set: { included } });
    },

    async listToggles(ctx: Ctx, tripId: string) {
      const ids = await scenarioIds(ctx, tripId);
      if (ids.length === 0) return [];
      return db.select().from(scenarioItemToggles).where(inArray(scenarioItemToggles.scenarioId, ids));
    },

    async setRating(ctx: Ctx, scenarioId: string, criterion: RatingCriterion, value: number | null) {
      await assertScenario(ctx, scenarioId);
      if (value === null) {
        await db
          .delete(scenarioRatings)
          .where(and(eq(scenarioRatings.scenarioId, scenarioId), eq(scenarioRatings.criterion, criterion)));
        return;
      }
      await db
        .insert(scenarioRatings)
        .values({ scenarioId, criterion, value })
        .onConflictDoUpdate({ target: [scenarioRatings.scenarioId, scenarioRatings.criterion], set: { value } });
    },

    async listRatings(ctx: Ctx, tripId: string) {
      const ids = await scenarioIds(ctx, tripId);
      if (ids.length === 0) return [];
      return db.select().from(scenarioRatings).where(inArray(scenarioRatings.scenarioId, ids));
    },

    async setWeight(ctx: Ctx, tripId: string, criterion: Criterion, weight: number) {
      await assertTrip(db, ctx, tripId);
      await db
        .insert(decisionWeights)
        .values({ tripId, criterion, weight })
        .onConflictDoUpdate({ target: [decisionWeights.tripId, decisionWeights.criterion], set: { weight } });
    },

    async listWeights(ctx: Ctx, tripId: string) {
      if (!(await ownsTrip(db, ctx, tripId))) return [];
      return db.select().from(decisionWeights).where(eq(decisionWeights.tripId, tripId));
    },

    async listOverrides(ctx: Ctx, tripId: string) {
      if (!(await ownsTrip(db, ctx, tripId))) return [];
      return db.select().from(itineraryOverrides).where(eq(itineraryOverrides.tripId, tripId));
    },

    async setOverride(ctx: Ctx, tripId: string, entryKey: string, patch: { position?: number | null; note?: string | null }) {
      await assertTrip(db, ctx, tripId);
      await db
        .insert(itineraryOverrides)
        .values({ tripId, entryKey, position: patch.position ?? null, note: patch.note ?? null })
        .onConflictDoUpdate({ target: [itineraryOverrides.tripId, itineraryOverrides.entryKey], set: patch });
    },

    /** Quita selecciones de una alternativa en todos los escenarios del viaje. */
    async removeOwnerEverywhere(ctx: Ctx, tripId: string, ownerType: SelectionOwnerType, ownerId: string) {
      const ids = await scenarioIds(ctx, tripId);
      if (ids.length === 0) return;
      await db
        .delete(scenarioSelections)
        .where(
          and(
            inArray(scenarioSelections.scenarioId, ids),
            eq(scenarioSelections.ownerType, ownerType),
            eq(scenarioSelections.ownerId, ownerId),
          ),
        );
    },
  };
}

export type ScenarioParts = ReturnType<typeof makeScenarioParts>;

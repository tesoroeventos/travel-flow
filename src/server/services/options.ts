import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { bookings, costItems, itineraryOverrides } from "../db/schema";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { makeScenarioParts, type SelectionOwnerType } from "../repos/scenario-parts";

const repoKey = { transport_option: "transport", lodging_option: "lodging", activity: "activities" } as const;

/**
 * Borra una alternativa y todo lo que depende de ella: partidas (y sus interruptores),
 * selecciones en escenarios, reservas y ajustes de itinerario. Todo en una transacción.
 */
export async function deleteOption(db: Db, ctx: Ctx, ownerType: SelectionOwnerType, ownerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    const r = makeRepos(t);
    const option = await r[repoKey[ownerType]].require(ctx, ownerId);
    const tripId = option.tripId;

    await makeScenarioParts(t).removeOwnerEverywhere(ctx, tripId, ownerType, ownerId);
    await t
      .delete(bookings)
      .where(and(eq(bookings.tripId, tripId), eq(bookings.ownerType, ownerType), eq(bookings.ownerId, ownerId)));
    const items = await t
      .select({ id: costItems.id })
      .from(costItems)
      .where(and(eq(costItems.tripId, tripId), eq(costItems.ownerType, ownerType), eq(costItems.ownerId, ownerId)));
    for (const i of items) await r.costItems.remove(ctx, i.id);
    const overrides = await t.select().from(itineraryOverrides).where(eq(itineraryOverrides.tripId, tripId));
    for (const o of overrides.filter((x) => x.entryKey.includes(`:${ownerId}:`))) {
      await t
        .delete(itineraryOverrides)
        .where(and(eq(itineraryOverrides.tripId, tripId), eq(itineraryOverrides.entryKey, o.entryKey)));
    }
    await r[repoKey[ownerType]].remove(ctx, ownerId);
  });
}

type CostItemPatch = Partial<Omit<typeof costItems.$inferInsert, "id" | "tripId" | "ownerType" | "ownerId">>;

/** Edita una partida. Una partida demo editada deja de ser demo. */
export async function updateCostItem(db: Db, ctx: Ctx, id: string, patch: CostItemPatch) {
  return makeRepos(db).costItems.update(ctx, id, { ...patch, isDemo: false });
}

/** Borra una partida (los interruptores se borran en cascada). */
export async function deleteCostItem(db: Db, ctx: Ctx, id: string) {
  return makeRepos(db).costItems.remove(ctx, id);
}

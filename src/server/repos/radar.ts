import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { radarChecks } from "../db/schema";
import type { Ctx } from "../context";
import { assertTrip, ownsTrip } from "./child";

/** Sitios del radar que se abrieron para cada viaje. Todo acceso verifica el workspace. */
export function makeRadarRepo(db: Db) {
  return {
    async listChecks(ctx: Ctx, tripId: string): Promise<{ siteId: string; openedAt: Date }[]> {
      if (!(await ownsTrip(db, ctx, tripId))) return [];
      return db
        .select({ siteId: radarChecks.siteId, openedAt: radarChecks.openedAt })
        .from(radarChecks)
        .where(eq(radarChecks.tripId, tripId))
        .orderBy(asc(radarChecks.openedAt));
    },

    async markOpened(ctx: Ctx, tripId: string, siteId: string, at: Date): Promise<void> {
      await assertTrip(db, ctx, tripId);
      await db
        .insert(radarChecks)
        .values({ tripId, siteId, openedAt: at })
        .onConflictDoUpdate({ target: [radarChecks.tripId, radarChecks.siteId], set: { openedAt: at } });
    },

    async reset(ctx: Ctx, tripId: string): Promise<void> {
      await assertTrip(db, ctx, tripId);
      await db.delete(radarChecks).where(eq(radarChecks.tripId, tripId));
    },
  };
}

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tripEvents, trips } from "../db/schema";
import type { Ctx } from "../context";

export type EventAction = "create" | "update" | "delete";

export interface EventInput {
  tripId: string;
  entity: string;
  entityId: string;
  action: EventAction;
  before?: unknown;
  after?: unknown;
}

const plain = (v: unknown) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export function makeEventsRepo(db: Db) {
  return {
    async log(ctx: Ctx, e: EventInput) {
      await db.insert(tripEvents).values({
        tripId: e.tripId,
        userId: ctx.userId,
        entity: e.entity,
        entityId: e.entityId,
        action: e.action,
        before: plain(e.before),
        after: plain(e.after),
      });
    },

    async list(ctx: Ctx, tripId: string) {
      const owned = await db
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, tripId), eq(trips.workspaceId, ctx.workspaceId)));
      if (owned.length === 0) return [];
      return db.select().from(tripEvents).where(eq(tripEvents.tripId, tripId)).orderBy(asc(tripEvents.at), asc(tripEvents.id));
    },
  };
}

export type EventsRepo = ReturnType<typeof makeEventsRepo>;

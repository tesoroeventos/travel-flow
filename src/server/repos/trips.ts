import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { trips } from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import type { EventsRepo } from "./events";

export type Trip = typeof trips.$inferSelect;
export type TripInsert = Omit<typeof trips.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">;
export type TripPatch = Partial<TripInsert>;

export function makeTripsRepo(db: Db, events: EventsRepo) {
  const repo = {
    async list(ctx: Ctx): Promise<Trip[]> {
      return db.select().from(trips).where(eq(trips.workspaceId, ctx.workspaceId)).orderBy(asc(trips.startAt));
    },

    async get(ctx: Ctx, id: string): Promise<Trip | null> {
      const [row] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, id), eq(trips.workspaceId, ctx.workspaceId)));
      return row ?? null;
    },

    async require(ctx: Ctx, id: string): Promise<Trip> {
      const t = await repo.get(ctx, id);
      if (!t) throw new NotFoundError("el viaje", id);
      return t;
    },

    /** Único acceso sin contexto: solo lectura por token público. */
    async getByShareToken(token: string): Promise<Trip | null> {
      if (!token) return null;
      const [row] = await db.select().from(trips).where(eq(trips.publicShareToken, token));
      return row ?? null;
    },

    async create(ctx: Ctx, input: TripInsert): Promise<Trip> {
      const [row] = await db
        .insert(trips)
        .values({ ...input, workspaceId: ctx.workspaceId })
        .returning();
      await events.log(ctx, { tripId: row!.id, entity: "trip", entityId: row!.id, action: "create", after: row });
      return row!;
    },

    async update(ctx: Ctx, id: string, patch: TripPatch): Promise<Trip> {
      const before = await repo.require(ctx, id);
      const [row] = await db
        .update(trips)
        .set(patch)
        .where(and(eq(trips.id, id), eq(trips.workspaceId, ctx.workspaceId)))
        .returning();
      await events.log(ctx, { tripId: id, entity: "trip", entityId: id, action: "update", before, after: row });
      return row!;
    },

    async remove(ctx: Ctx, id: string): Promise<void> {
      const before = await repo.require(ctx, id);
      await db.delete(trips).where(and(eq(trips.id, id), eq(trips.workspaceId, ctx.workspaceId)));
      await events.log(ctx, { tripId: id, entity: "trip", entityId: id, action: "delete", before });
    },
  };
  return repo;
}

export type TripsRepo = ReturnType<typeof makeTripsRepo>;

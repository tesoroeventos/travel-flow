/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq, getTableColumns, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../db/client";
import { activities, lodgingOptions, scenarios, transportOptions, trips } from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import type { EventsRepo } from "./events";

type ChildTable = PgTable & { id: AnyPgColumn; tripId: AnyPgColumn };

/** Verifica que el viaje pertenezca al workspace del contexto. */
export async function ownsTrip(db: Db, ctx: Ctx, tripId: string): Promise<boolean> {
  const rows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.workspaceId, ctx.workspaceId)));
  return rows.length > 0;
}

export async function assertTrip(db: Db, ctx: Ctx, tripId: string): Promise<void> {
  if (!(await ownsTrip(db, ctx, tripId))) throw new NotFoundError("el viaje", tripId);
}

const OWNER_TABLES = {
  transport_option: transportOptions,
  lodging_option: lodgingOptions,
  activity: activities,
  scenario: scenarios,
} as const;

export type OwnerType = keyof typeof OWNER_TABLES;

/** Verifica que la alternativa o escenario dueño pertenezca a ese viaje (y por lo tanto al workspace). */
export async function assertOwnerInTrip(db: Db, ctx: Ctx, tripId: string, ownerType: OwnerType, ownerId: string): Promise<void> {
  await assertTrip(db, ctx, tripId);
  const table = OWNER_TABLES[ownerType];
  if (!table) throw new NotFoundError("el elemento", ownerId);
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, ownerId), eq(table.tripId, tripId)));
  if (rows.length === 0) throw new NotFoundError("el elemento", ownerId);
}

/**
 * Repositorio genérico para tablas que cuelgan de un viaje (`trip_id`).
 * Todo acceso verifica que el viaje sea del workspace del contexto.
 */
export function makeChildRepo<T extends ChildTable>(db: Db, table: T, entity: string, events: EventsRepo) {
  type Row = InferSelectModel<T>;
  type Insert = InferInsertModel<T>;
  type Patch = Partial<InferInsertModel<T>>;
  const t = table as any;
  const columns = getTableColumns(table);
  const order = "position" in columns ? asc(t.position) : asc(t.createdAt ?? t.id);
  const hasOwner = "ownerType" in columns && "ownerId" in columns;

  const repo = {
    async list(ctx: Ctx, tripId: string): Promise<Row[]> {
      if (!(await ownsTrip(db, ctx, tripId))) return [];
      return (db as any).select().from(table).where(eq(t.tripId, tripId)).orderBy(order, asc(t.id));
    },

    async get(ctx: Ctx, id: string): Promise<Row | null> {
      const rows = await (db as any)
        .select({ row: table })
        .from(table)
        .innerJoin(trips, eq(trips.id, t.tripId))
        .where(and(eq(t.id, id), eq(trips.workspaceId, ctx.workspaceId)));
      return rows[0]?.row ?? null;
    },

    async require(ctx: Ctx, id: string): Promise<Row> {
      const row = await repo.get(ctx, id);
      if (!row) throw new NotFoundError(entity, id);
      return row;
    },

    async create(ctx: Ctx, values: Insert): Promise<Row> {
      await assertTrip(db, ctx, (values as any).tripId);
      if (hasOwner) await assertOwnerInTrip(db, ctx, (values as any).tripId, (values as any).ownerType, (values as any).ownerId);
      const [row] = await (db as any).insert(table).values(values).returning();
      await events.log(ctx, { tripId: row.tripId, entity, entityId: row.id, action: "create", after: row });
      return row;
    },

    async update(ctx: Ctx, id: string, patch: Patch): Promise<Row> {
      const before: any = await repo.require(ctx, id);
      const clean = { ...(patch as any) };
      delete clean.tripId;
      delete clean.id;
      // El dueño de una partida o reserva no se cambia al editar.
      delete clean.ownerType;
      delete clean.ownerId;
      if (Object.keys(clean).length === 0) return before;
      const [row] = await (db as any).update(table).set(clean).where(eq(t.id, id)).returning();
      await events.log(ctx, { tripId: before.tripId, entity, entityId: id, action: "update", before, after: row });
      return row;
    },

    async remove(ctx: Ctx, id: string): Promise<void> {
      const before: any = await repo.require(ctx, id);
      await (db as any).delete(table).where(eq(t.id, id));
      await events.log(ctx, { tripId: before.tripId, entity, entityId: id, action: "delete", before });
    },
  };
  return repo;
}

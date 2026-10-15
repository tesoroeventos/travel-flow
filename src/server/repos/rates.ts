import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { exchangeRates } from "../db/schema";
import { NotFoundError, type Ctx } from "../context";
import type { ExchangeRate } from "@/domain/money/rates";

export type RateRow = typeof exchangeRates.$inferSelect;
export type RateInsert = Omit<typeof exchangeRates.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">;

export const toDomainRate = (r: RateRow): ExchangeRate => ({
  from: r.fromCurrency,
  to: r.toCurrency,
  rate: r.rate,
  asOf: r.asOf,
  source: r.source,
});

export function makeRatesRepo(db: Db) {
  const scope = (ctx: Ctx, id: string) => and(eq(exchangeRates.id, id), eq(exchangeRates.workspaceId, ctx.workspaceId));
  return {
    async list(ctx: Ctx): Promise<RateRow[]> {
      return db
        .select()
        .from(exchangeRates)
        .where(eq(exchangeRates.workspaceId, ctx.workspaceId))
        .orderBy(desc(exchangeRates.asOf), exchangeRates.fromCurrency);
    },
    async create(ctx: Ctx, input: RateInsert): Promise<RateRow> {
      const [row] = await db.insert(exchangeRates).values({ ...input, workspaceId: ctx.workspaceId }).returning();
      return row!;
    },
    async update(ctx: Ctx, id: string, patch: Partial<RateInsert>): Promise<RateRow> {
      const [row] = await db.update(exchangeRates).set(patch).where(scope(ctx, id)).returning();
      if (!row) throw new NotFoundError("el tipo de cambio", id);
      return row;
    },
    async remove(ctx: Ctx, id: string): Promise<void> {
      const rows = await db.delete(exchangeRates).where(scope(ctx, id)).returning({ id: exchangeRates.id });
      if (rows.length === 0) throw new NotFoundError("el tipo de cambio", id);
    },
  };
}

export type RatesRepo = ReturnType<typeof makeRatesRepo>;

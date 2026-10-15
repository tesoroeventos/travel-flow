import { sql } from "drizzle-orm";
import { err, ok, type Result } from "@/domain/result";
import { AI_MESSAGES } from "@/integrations/ai/types";
import type { Db } from "../db/client";
import { aiUsage } from "../db/schema";

/** Suma una lectura con IA al día del usuario; falla si ya llegó al límite. Atómico. */
export async function consumeAiQuota(
  db: Db,
  userId: string,
  today: string,
  limit = Number(process.env.AI_DAILY_LIMIT ?? 60),
): Promise<Result<{ remaining: number }>> {
  if (limit <= 0) return err("limit", AI_MESSAGES.limit);
  const rows = await db
    .insert(aiUsage)
    .values({ userId, day: today, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
      setWhere: sql`${aiUsage.count} < ${limit}`,
    })
    .returning({ count: aiUsage.count });
  const count = rows[0]?.count;
  if (count === undefined) return err("limit", AI_MESSAGES.limit);
  return ok({ remaining: Math.max(0, limit - count) });
}

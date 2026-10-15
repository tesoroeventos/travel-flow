import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { createDb, PGLITE_PREFIX, type Db } from "./client";
import { memoizeWithRetry } from "./memo";

/** Si BOOTSTRAP_INVITE_CODE está definido, asegura ese código inicial (vence a los 14 días). */
async function bootstrapInvite(db: Db): Promise<void> {
  const code = process.env.BOOTSTRAP_INVITE_CODE;
  if (!code) return;
  const { ensureBootstrapInvite } = await import("../auth/register");
  await ensureBootstrapInvite(db, code);
}

const globalForDb = globalThis as unknown as { __travelflowGetDb?: () => Promise<Db> };

/** Con SEED_DEMO=true se siembra el viaje de demostración al iniciar (idempotente). */
async function maybeSeedDemo(db: Db): Promise<void> {
  if (process.env.SEED_DEMO !== "true") return;
  const { seedDemo } = await import("../services/demo");
  await seedDemo(db, { shareToken: process.env.DEMO_SHARE_TOKEN || undefined });
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable DATABASE_URL");
  if (url.startsWith(PGLITE_PREFIX)) {
    const dir = url.slice(PGLITE_PREFIX.length);
    if (dir) mkdirSync(dir, { recursive: true });
    const db = createDb(url);
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await bootstrapInvite(db);
    await maybeSeedDemo(db);
    return db;
  }
  const db = createDb(url);
  await bootstrapInvite(db);
  await maybeSeedDemo(db);
  return db;
}

/** Conexión única por proceso (reintenta si la inicialización falló). Con PGlite aplica las migraciones al iniciar. */
export function getDb(): Promise<Db> {
  globalForDb.__travelflowGetDb ??= memoizeWithRetry(init);
  return globalForDb.__travelflowGetDb();
}

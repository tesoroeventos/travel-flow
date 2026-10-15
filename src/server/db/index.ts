import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { createDb, PGLITE_PREFIX, type Db } from "./client";

const globalForDb = globalThis as unknown as { __travelflowDb?: Promise<Db> };

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
    return db;
  }
  return createDb(url);
}

/** Conexión única por proceso. Con PGlite aplica las migraciones al iniciar. */
export function getDb(): Promise<Db> {
  globalForDb.__travelflowDb ??= init();
  return globalForDb.__travelflowDb;
}

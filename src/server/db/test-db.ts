import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Db } from "./client";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

let template: Promise<File | Blob> | null = null;

async function migratedTemplate(): Promise<File | Blob> {
  const pg = new PGlite();
  await migrate(drizzle(pg), { migrationsFolder: MIGRATIONS_DIR });
  const dump = await pg.dumpDataDir("none");
  await pg.close();
  return dump;
}

/** Base PGlite en memoria con todas las migraciones aplicadas (copia de una plantilla migrada una vez). */
export async function createTestDb(): Promise<Db> {
  template ??= migratedTemplate();
  const pg = new PGlite({ loadDataDir: await template });
  return drizzle(pg, { schema }) as unknown as Db;
}

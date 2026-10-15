import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export const PGLITE_PREFIX = "pglite://";

/** `pglite://<dir>` usa PGlite embebido (desarrollo y pruebas); cualquier otra URL usa Postgres. */
export function createDb(url: string): Db {
  if (url.startsWith(PGLITE_PREFIX)) {
    const dir = url.slice(PGLITE_PREFIX.length);
    return drizzlePglite(dir ? new PGlite(dir) : new PGlite(), { schema }) as unknown as Db;
  }
  return drizzlePostgres(postgres(url, { max: 10 }), { schema }) as unknown as Db;
}

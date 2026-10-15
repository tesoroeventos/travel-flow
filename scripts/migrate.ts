import path from "node:path";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
const migrationsFolder = path.join(process.cwd(), "drizzle");

async function main(url: string) {
  if (url.startsWith("pglite://")) {
    const dir = url.slice("pglite://".length);
    if (dir) mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await migratePglite(drizzlePglite(client), { migrationsFolder });
    await client.close();
  } else {
    const sql = postgres(url, { max: 1 });
    await migratePostgres(drizzlePostgres(sql), { migrationsFolder });
    await sql.end();
  }
  console.log("Migraciones aplicadas");
}

main(url).catch((e) => {
  console.error(e);
  process.exit(1);
});

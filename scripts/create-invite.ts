import { parseArgs } from "node:util";
import { createDb } from "../src/server/db/client";
import { createInvite } from "../src/server/auth/register";

const { values } = parseArgs({
  options: { uses: { type: "string", default: "1" }, days: { type: "string", default: "30" } },
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const db = createDb(url);
  const code = await createInvite(db, { uses: Number(values.uses), days: Number(values.days) });
  console.log(code);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

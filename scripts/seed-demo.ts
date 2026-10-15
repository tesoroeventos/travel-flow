import { createDb } from "../src/server/db/client";
import { seedDemo } from "../src/server/services/demo";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const { tripId, shareToken } = await seedDemo(createDb(url), { shareToken: process.env.DEMO_SHARE_TOKEN || undefined });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  console.log(`Viaje demo: ${tripId}`);
  console.log(`Enlace público: ${base}/share/${shareToken}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

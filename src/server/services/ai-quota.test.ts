import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeCtx } from "./demo-data";
import { consumeAiQuota } from "./ai-quota";

describe("límite diario de IA", () => {
  it("con límite 2, la tercera del día falla y al día siguiente se renueva", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    expect(await consumeAiQuota(db, ctx.userId, "2026-10-15", 2)).toEqual({
      ok: true,
      data: { remaining: 1 },
    });
    expect(await consumeAiQuota(db, ctx.userId, "2026-10-15", 2)).toEqual({
      ok: true,
      data: { remaining: 0 },
    });
    expect(await consumeAiQuota(db, ctx.userId, "2026-10-15", 2)).toEqual({
      ok: false,
      error: {
        code: "limit",
        message: "Llegaste al límite de lecturas de hoy. Mañana se renueva; mientras tanto podés cargar a mano.",
      },
    });
    expect(await consumeAiQuota(db, ctx.userId, "2026-10-16", 2)).toMatchObject({ ok: true });
  });

  it("cada usuario tiene su propio límite", async () => {
    const db = await createTestDb();
    const a = await makeCtx(db);
    const b = await makeCtx(db, "otro@x.com");
    await consumeAiQuota(db, a.userId, "2026-10-15", 1);
    expect(await consumeAiQuota(db, b.userId, "2026-10-15", 1)).toMatchObject({
      ok: true,
    });
  });
});

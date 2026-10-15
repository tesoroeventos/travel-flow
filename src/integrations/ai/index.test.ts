import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAiConfigSafe, getAI } from "./index";

const saved = { key: process.env.ANTHROPIC_API_KEY, fake: process.env.AI_FAKE };
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = saved.key;
  process.env.AI_FAKE = saved.fake;
  if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
  if (saved.fake === undefined) delete process.env.AI_FAKE;
});

describe("getAI", () => {
  it("sin clave responde not_configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_FAKE;
    expect(await getAI().parseTrip("x", "2026-10-15")).toEqual({
      ok: false,
      error: {
        code: "not_configured",
        message: "La lectura automática no está configurada. Cargá la opción a mano.",
      },
    });
  });

  it("con AI_FAKE=1 usa la simulada", async () => {
    process.env.AI_FAKE = "1";
    const r = await getAI().readImage(Buffer.from("x"), "image/png;name=vuelo-ida.png", {
      origin: "Zárate",
      destination: "Bariloche",
      startDate: "2027-01-10",
      endDate: "2027-01-16",
      travelers: 2,
      today: "2026-10-15",
    });
    expect(r.ok && r.data[0]).toMatchObject({
      kind: "vuelo",
      direction: "ida",
    });
  });

  it("la simulada no encuentra ofertas en 'ilegible'", async () => {
    process.env.AI_FAKE = "1";
    const r = await getAI().readImage(Buffer.from("x"), "image/png;name=ilegible.png", {
      origin: null,
      destination: "B",
      startDate: "2027-01-10",
      endDate: "2027-01-16",
      travelers: 1,
      today: "2026-10-15",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "no_offers" } });
  });

  it("producción con AI_FAKE=1 no arranca", () => {
    expect(() => assertAiConfigSafe({ NODE_ENV: "production", AI_FAKE: "1" } as never)).toThrow();
    expect(() => assertAiConfigSafe({ NODE_ENV: "production" } as never)).not.toThrow();
  });

  it("en producción getAI se niega a usar la simulada aunque no haya pasado por la migración", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_FAKE", "1");
    try {
      expect(() => getAI()).toThrow(/AI_FAKE=1 no está permitido/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

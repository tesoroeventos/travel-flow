import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRadarConfigSafe, getReferencePrices } from "./index";
import { fakeReferencePrices } from "./fake";
import { RADAR_MESSAGES } from "./messages";

const q = {
  origin: "BUE",
  destination: "BRC",
  depart: "2027-01-10",
  return: "2027-01-16",
  windowDays: 3,
  currency: "ARS",
  today: "2026-11-14",
};

afterEach(() => vi.unstubAllEnvs());

describe("configuración del radar", () => {
  it("RADAR_FAKE en producción no arranca", () => {
    expect(() =>
      assertRadarConfigSafe({ NODE_ENV: "production", RADAR_FAKE: "1" } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
    expect(() =>
      assertRadarConfigSafe({ NODE_ENV: "development", RADAR_FAKE: "1" } as unknown as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("sin token responde not_configured", async () => {
    vi.stubEnv("RADAR_FAKE", "");
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "");
    const r = await getReferencePrices().calendar(q);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toEqual({ code: "not_configured", message: "Precios de referencia no configurados" });
  });

  it("con RADAR_FAKE usa el simulado", async () => {
    vi.stubEnv("RADAR_FAKE", "1");
    const r = await getReferencePrices().calendar(q);
    expect(r.ok && r.data.data).toHaveLength(5);
  });
});

describe("radar simulado", () => {
  it("BUE→BRC: 5 de 7 días y el más bajo el día siguiente a la ida", async () => {
    const r = await fakeReferencePrices.calendar(q);
    if (!r.ok) throw new Error("debería andar");
    const fares = r.data.data;
    expect(fares).toHaveLength(5);
    const min = fares.reduce((a, b) => (b.amountCents < a.amountCents ? b : a));
    expect(min.date).toBe("2027-01-11");
    expect(min.amountCents).toBe(8_700_000);
  });

  it("otra ruta no tiene datos", async () => {
    const r = await fakeReferencePrices.calendar({ ...q, destination: "MDZ" });
    expect(r.ok && r.data.data).toEqual([]);
  });

  it("sugiere BUE para Zárate y BRC para Bariloche", async () => {
    const a = await fakeReferencePrices.places("Zárate");
    const b = await fakeReferencePrices.places("Bariloche");
    expect(a.ok && a.data.data[0]!.code).toBe("BUE");
    expect(b.ok && b.data.data[0]!.code).toBe("BRC");
  });
});

describe("mensajes", () => {
  it("son los del spec", () => {
    expect(RADAR_MESSAGES.unavailable).toBe(
      "No pude traer los precios de referencia ahora. Los enlaces funcionan igual.",
    );
    expect(RADAR_MESSAGES.no_data).toBe("Nadie buscó esta ruta en los últimos días. Usá los enlaces.");
    expect(RADAR_MESSAGES.bad_token).toBe("El token de Travelpayouts no es válido. Revisá TRAVELPAYOUTS_TOKEN.");
    expect(RADAR_MESSAGES.no_airports).toBe("Elegí los aeropuertos para buscar vuelos.");
    expect(RADAR_MESSAGES.no_prefill).toBe("Abre la página principal: cargá los datos a mano.");
  });
});

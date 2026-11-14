import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSearchConfigSafe, getTravelSearch } from "./index";
import { fakeTravelSearch } from "./fake";
import { SEARCH_MESSAGES } from "./messages";
import type { FlightQuery } from "./types";

const q: FlightQuery = {
  departureId: "EZE,AEP",
  arrivalId: "BRC",
  outboundDate: "2027-01-10",
  returnDate: "2027-01-16",
  adults: 2,
  children: 0,
  infants: 0,
  currency: "ARS",
};

afterEach(() => vi.unstubAllEnvs());

describe("configuración de la búsqueda", () => {
  it("SEARCH_FAKE en producción no arranca", () => {
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(() => assertSearchConfigSafe(env({ NODE_ENV: "production", SEARCH_FAKE: "1" }))).toThrow();
    expect(() => assertSearchConfigSafe(env({ NODE_ENV: "development", SEARCH_FAKE: "1" }))).not.toThrow();
  });

  it("sin clave responde not_configured", async () => {
    vi.stubEnv("SEARCH_FAKE", "");
    vi.stubEnv("SERPAPI_KEY", "");
    const r = await getTravelSearch().flights(q);
    expect(!r.ok && r.error).toEqual({ code: "not_configured", message: SEARCH_MESSAGES.not_configured });
  });

  it("con SEARCH_FAKE usa el simulado", async () => {
    vi.stubEnv("SEARCH_FAKE", "1");
    const r = await getTravelSearch().flights(q);
    expect(r.ok && r.data.options).toHaveLength(7);
  });
});

describe("búsqueda simulada", () => {
  it("devuelve los fixtures reales para Bariloche", async () => {
    const f = await fakeTravelSearch.flights(q);
    const h = await fakeTravelSearch.hotels({
      q: "San Carlos de Bariloche",
      checkIn: "2027-01-10",
      checkOut: "2027-01-16",
      adults: 2,
      children: 0,
      currency: "ARS",
    });
    expect(f.ok && f.data.options).toHaveLength(7);
    expect(h.ok && h.data.properties).toHaveLength(6);
  });

  it("otra ruta no tiene resultados", async () => {
    const f = await fakeTravelSearch.flights({ ...q, arrivalId: "MDZ" });
    const h = await fakeTravelSearch.hotels({
      q: "Mendoza",
      checkIn: "2027-01-10",
      checkOut: "2027-01-16",
      adults: 2,
      children: 0,
      currency: "ARS",
    });
    expect(f.ok && f.data.options).toEqual([]);
    expect(h.ok && h.data.properties).toEqual([]);
  });

  it("la vuelta simulada sale de BRC el día de regreso", async () => {
    const r = await fakeTravelSearch.returnFlights(q, "tok-AR1682");
    expect(r.ok && r.data.options[0]!.legs[0]).toMatchObject({ from: "BRC", to: "EZE", depart: "2027-01-16 18:20" });
  });
});

describe("mensajes", () => {
  it("son los del spec", () => {
    expect(SEARCH_MESSAGES.not_configured).toBe("Búsqueda automática no configurada. Cargá SERPAPI_KEY en Railway.");
    expect(SEARCH_MESSAGES.bad_key).toBe("La clave de SerpApi no es válida. Revisá SERPAPI_KEY.");
    expect(SEARCH_MESSAGES.no_credits).toBe(
      "Se terminaron las búsquedas de SerpApi de este mes. Podés seguir con el radar y la carga rápida.",
    );
    expect(SEARCH_MESSAGES.unavailable).toBe("No pude buscar ahora. Probá de nuevo en un rato.");
    expect(SEARCH_MESSAGES.no_flights).toBe("Google no mostró vuelos con precio para estas fechas.");
    expect(SEARCH_MESSAGES.return_failed).toBe("Vuelta: confirmala en Google Flights.");
    expect(SEARCH_MESSAGES.noLodging(4)).toBe("No encontré alojamiento para 4 personas en esas fechas.");
  });
});

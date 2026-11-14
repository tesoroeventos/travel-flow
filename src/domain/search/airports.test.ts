import { describe, expect, it } from "vitest";
import { AIRPORTS, findAirport, searchAirports } from "./airports";

describe("aeropuertos", () => {
  it("Zárate y Campana sugieren BUE", () => {
    expect(searchAirports("Zárate")[0]!.code).toBe("BUE");
    expect(searchAirports("campana")[0]!.code).toBe("BUE");
  });

  it("Bariloche sugiere BRC sin tildes ni mayúsculas", () => {
    expect(searchAirports("BARILOCHE")[0]!.code).toBe("BRC");
    expect(searchAirports("san carlos de bariloche")[0]!.code).toBe("BRC");
  });

  it("un código exacto va primero", () => {
    expect(searchAirports("MDZ")[0]!.code).toBe("MDZ");
    expect(searchAirports("brc")[0]!.code).toBe("BRC");
  });

  it("BUE se busca en Ezeiza y Aeroparque", () => {
    expect(findAirport("BUE")!.flightIds).toBe("EZE,AEP");
    expect(findAirport("BRC")!.flightIds).toBe("BRC");
    expect(findAirport("brc")!.code).toBe("BRC");
    expect(findAirport("XXX")).toBeUndefined();
  });

  it("nunca sugiere aeropuertos fuera de la lista (Surat, Ciudad Victoria)", () => {
    expect(searchAirports("Surat")).toEqual([]);
    expect(searchAirports("Ciudad Victoria")).toEqual([]);
  });

  it("respeta el límite y prioriza Argentina", () => {
    const r = searchAirports("san", 3);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.country).toBe("Argentina");
  });

  it("términos muy cortos no sugieren nada", () => {
    expect(searchAirports("a")).toEqual([]);
    expect(searchAirports("  ")).toEqual([]);
  });

  it("los códigos de la lista son únicos y de 3 letras", () => {
    const codes = AIRPORTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true);
  });

  it("las ciudades que usa la pantalla del radar coinciden", () => {
    expect(findAirport("BUE")!.city).toBe("Buenos Aires");
    expect(findAirport("BRC")!.city).toBe("San Carlos de Bariloche");
    expect(findAirport("MDZ")!.city).toBe("Mendoza");
  });
});

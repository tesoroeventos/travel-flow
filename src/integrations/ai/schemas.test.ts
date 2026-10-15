import { describe, expect, it } from "vitest";
import { parseCarEstimate, parseOffers, parseTripDraft, toNumber } from "./schemas";

describe("lectura de la respuesta de la IA", () => {
  it("normaliza precio en texto, recorta y descarta lo inválido", () => {
    const [o] = parseOffers({
      opciones: [
        {
          tipo: "vuelo",
          sentido: "ida",
          nombre: "AR 1672",
          precio: "$ 1.234.567",
          moneda: "ARS",
          base: "total",
          salida: "2027-13-40T99:99",
          confort: 9,
          dudosos: ["precio"],
        },
      ],
    });
    expect(o).toMatchObject({
      kind: "vuelo",
      direction: "ida",
      price: 1234567,
      depart: null,
      comfort: 5,
    });
    expect(o!.doubtful).toEqual(expect.arrayContaining(["price", "depart"]));
  });

  it("tipo desconocido pasa a 'otro'; transporte sin sentido pasa a 'ida' y queda dudoso", () => {
    const [a, b] = parseOffers({
      opciones: [
        { tipo: "crucero", nombre: "X" },
        { tipo: "micro", nombre: "Cama" },
      ],
    });
    expect(a).toMatchObject({ kind: "otro", direction: null });
    expect(b).toMatchObject({ kind: "micro", direction: "ida" });
    expect(b!.doubtful).toContain("direction");
  });

  it("más de 6 ofertas se recortan a 6", () => {
    expect(
      parseOffers({
        opciones: Array.from({ length: 9 }, () => ({
          tipo: "vuelo",
          sentido: "ida",
          precio: 1,
        })),
      }),
    ).toHaveLength(6);
  });

  it("basura o sin lista devuelve vacío", () => {
    expect(parseOffers("hola")).toEqual([]);
    expect(parseOffers({ opciones: [null, 3] })).toEqual([]);
  });

  it("acepta fechas válidas y convierte dólares con decimales", () => {
    const [o] = parseOffers({
      opciones: [
        {
          tipo: "alojamiento",
          nombre: "Hotel",
          salida: "2027-01-10T14:00",
          llegada: "2027-01-16",
          precio: "US$ 1,234.50",
          moneda: "USD",
          base: "por_noche",
          puntaje: "8,6/10",
        },
      ],
    });
    expect(o).toMatchObject({
      depart: "2027-01-10T14:00",
      arrive: "2027-01-16",
      price: 1234.5,
      currency: "USD",
      basis: "por_noche",
      score: "8,6/10",
    });
  });

  it("toNumber entiende millones y miles", () => {
    expect(toNumber("1,5 millones")).toBe(1_500_000);
    expect(toNumber("800 mil")).toBe(800_000);
    expect(toNumber("1.500")).toBe(1500);
    expect(toNumber("abc")).toBeNull();
  });

  it("borrador del viaje marca como dudoso lo que falta", () => {
    const t = parseTripDraft({
      destino: "Bariloche",
      salida: "2027-01-10",
      regreso: "2027-01-16",
      personas: "2",
      presupuesto: "1,5 millones",
    });
    expect(t).toMatchObject({
      destination: "Bariloche",
      origin: null,
      startDate: "2027-01-10",
      endDate: "2027-01-16",
      travelers: 2,
      budget: 1_500_000,
      currency: "ARS",
    });
    expect(t.doubtful).toContain("origin");
  });

  it("estimación de auto exige km, horas, consumo y precio", () => {
    expect(
      parseCarEstimate(
        {
          distancia_km: 1650,
          horas_manejo: 19,
          peajes: 15000,
          consumo_l_100km: 7,
          precio_litro: 1300,
          ruta: "RN 5",
        },
        null,
      ),
    ).toMatchObject({
      km: 1650,
      hours: 19,
      tolls: 15000,
      consumptionLPer100: 7,
      fuelPrice: 1300,
    });
    expect(parseCarEstimate({ distancia_km: 1650 }, null)).toBeNull();
    expect(parseCarEstimate({ distancia_km: 100, horas_manejo: 1, precio_litro: 1000 }, 6.5)).toMatchObject({
      consumptionLPer100: 6.5,
    });
  });
});

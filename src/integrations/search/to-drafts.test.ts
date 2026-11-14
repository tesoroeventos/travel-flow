import { beforeAll, describe, expect, it } from "vitest";
import { fakeTravelSearch } from "./fake";
import { chooseReturn, flightToDraft, lodgingExtras, lodgingToDraft, pickFlights, pickLodging } from "./to-drafts";
import type { FlightsResult, HotelsResult } from "./types";

let flights: FlightsResult;
let hotels: HotelsResult;

beforeAll(async () => {
  const q = {
    departureId: "EZE,AEP",
    arrivalId: "BRC",
    outboundDate: "2027-01-10",
    returnDate: "2027-01-16",
    adults: 2,
    children: 0,
    infants: 0,
    currency: "ARS" as const,
  };
  const f = await fakeTravelSearch.flights(q);
  const h = await fakeTravelSearch.hotels({
    q: "Bariloche",
    checkIn: "2027-01-10",
    checkOut: "2027-01-16",
    adults: 2,
    children: 0,
    currency: "ARS",
  });
  if (!f.ok || !h.ok) throw new Error("fixtures");
  flights = f.data;
  hotels = h.data;
});

describe("vuelos", () => {
  it("elige 5 vuelos con precio, primero los mejores, e informa Flybondi", () => {
    const { picked, missingAirlines } = pickFlights(flights);
    expect(picked.map((o) => o.price)).toEqual([733920, 821437, 867320, 901940, 1036051]);
    expect(missingAirlines).toEqual(["Flybondi"]);
  });

  it("respeta el máximo y no repite un vuelo", () => {
    const dup: FlightsResult = {
      options: [flights.options[0]!, { ...flights.options[0]!, best: false }, flights.options[1]!],
    };
    expect(pickFlights(dup).picked).toHaveLength(2);
    expect(pickFlights(flights, 2).picked).toHaveLength(2);
  });

  it("una aerolínea que aparece con y sin precio no se informa como faltante", () => {
    const withAr = {
      options: [
        ...flights.options,
        {
          ...flights.options[0]!,
          price: null,
          best: false,
          legs: [{ ...flights.options[0]!.legs[0]!, flightNumber: "AR 9999" }],
        },
      ],
    };
    expect(pickFlights(withAr).missingAirlines).toEqual(["Flybondi"]);
  });

  it("convierte un vuelo en oferta de ida y vuelta", () => {
    expect(flightToDraft(flights.options[0]!, "ARS")).toMatchObject({
      kind: "vuelo",
      direction: "ida_y_vuelta",
      basis: "total",
      price: 733920,
      currency: "ARS",
      company: "Aerolíneas Argentinas",
      name: "AR 1682",
      from: "EZE",
      to: "BRC",
      depart: "2027-01-10T18:20",
      arrive: "2027-01-10T20:45",
      durationMin: 145,
      stops: 0,
      nights: null,
      score: null,
      comfort: 3,
      doubtful: [],
      detail: "Precio ida y vuelta para todos los pasajeros. Vuelta: se confirma al elegir esta opción.",
    });
  });

  it("un vuelo con escala une los números y toma el último destino", () => {
    const o = flights.options[0]!;
    const two = {
      ...o,
      legs: [o.legs[0]!, { ...o.legs[0]!, from: "BRC", to: "NQN", flightNumber: "AR 2", arrive: "2027-01-10 23:00" }],
    };
    expect(flightToDraft(two, "USD")).toMatchObject({
      name: "AR 1682 + AR 2",
      to: "NQN",
      arrive: "2027-01-10T23:00",
      stops: 1,
      currency: "USD",
    });
  });

  it("chooseReturn prefiere la vuelta con el mismo precio total que la ida", () => {
    const [a, b, c] = flights.options;
    const r = { options: [{ ...a!, price: 999 }, { ...b!, price: 733920 }, { ...c!, price: 733920, best: false }] };
    expect(chooseReturn(r, 733920)!.legs[0]!.flightNumber).toBe(b!.legs[0]!.flightNumber);
  });

  it("sin precio igual, chooseReturn toma la más barata", () => {
    const [a, b] = flights.options;
    const r = { options: [{ ...a!, price: 800000 }, { ...b!, price: 750000, best: false }] };
    expect(chooseReturn(r, 733920)!.price).toBe(750000);
  });

  it("chooseReturn prefiere la primera mejor con precio", () => {
    expect(chooseReturn(flights)!.price).toBe(733920);
    expect(chooseReturn({ options: flights.options.filter((o) => !o.best) })!.price).toBe(901940);
    expect(chooseReturn({ options: [] })).toBeNull();
  });
});

describe("alojamiento", () => {
  it("descarta alojamientos chicos para el grupo y mantiene los sin dato", () => {
    const names = pickLodging(hotels, 4).map((p) => p.name);
    expect(names).not.toContain("Lagos del Sur");
    expect(names).toContain("Nahuel Departamentos");
    expect(names).toContain("Tangoinn Hostel Downtown Bariloche");
  });

  it("mitad más baratos y mitad mejor calificados, sin repetir", () => {
    expect(pickLodging(hotels, 2, 4).map((x) => x.total)).toEqual([420000, 540000, 777390, 600000]);
    expect(pickLodging(hotels, 2)).toHaveLength(6);
  });

  it("sin precio total no se elige", () => {
    const noPrice = { properties: [{ ...hotels.properties[0]!, total: null }] };
    expect(pickLodging(noPrice, 2)).toEqual([]);
  });

  it("convierte un alojamiento con total de la estadía y calificación", () => {
    const nahuel = hotels.properties.find((p) => p.name === "Nahuel Departamentos")!;
    expect(lodgingToDraft(nahuel, { checkIn: "2027-01-10", checkOut: "2027-01-16", currency: "ARS" })).toMatchObject({
      kind: "alojamiento",
      direction: null,
      name: "Nahuel Departamentos",
      price: 600000,
      currency: "ARS",
      basis: "total",
      nights: 6,
      score: "4.91/5",
      company: "AlquilerArgentina",
      depart: "2027-01-10",
      arrive: "2027-01-16",
      comfort: 3,
      detail:
        "Todo el apartamento · Capacidad para 6 · 2 dormitorios · 1 baño · Adecuado para niños · Cuna · Calefacción · Aparcamiento gratuito",
    });
    expect(lodgingExtras(nahuel)).toEqual({
      lat: -41.15037155151367,
      lng: -71.30011749267578,
      capacity: 6,
      reviewCount: 32,
      amenities: ["Adecuado para niños", "Cuna", "Calefacción", "Aparcamiento gratuito"],
      flexibleCancellation: false,
      kind: "apartment",
    });
  });

  it("un hotel sin fuente ni calificación usa valores por defecto", () => {
    const tango = hotels.properties.find((p) => p.kind === "hotel")!;
    const d = lodgingToDraft(
      { ...tango, rating5: null },
      { checkIn: "2027-01-10", checkOut: "2027-01-16", currency: "ARS" },
    );
    expect(d).toMatchObject({ company: "Google Hotels", score: null, comfort: 2 });
    expect(lodgingExtras(tango).kind).toBe("hotel");
  });
});

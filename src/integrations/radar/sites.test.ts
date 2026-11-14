import { describe, expect, it } from "vitest";
import type { RadarQuery } from "@/domain/radar/query";
import { RADAR_GROUPS, RADAR_SITES, findSite } from "./sites";

const q: RadarQuery = {
  originIata: "BUE",
  destinationIata: "BRC",
  originLabel: "Zárate",
  destinationLabel: "Bariloche",
  depart: "2027-01-10",
  return: "2027-01-16",
  adults: 2,
  children: 0,
  infants: 0,
  rooms: 1,
};

const EXPECTED: [string, string][] = [
  [
    "google-flights",
    "https://www.google.com/travel/flights?q=Flights%20from%20BUE%20to%20BRC%20on%202027-01-10%20through%202027-01-16%20for%202%20adults&hl=es-419",
  ],
  ["skyscanner", "https://www.skyscanner.com.ar/transporte/vuelos/bue/brc/270110/270116/?adultsv2=2&rtn=1"],
  ["kayak", "https://www.kayak.com.ar/flights/BUE-BRC/2027-01-10/2027-01-16/2adults"],
  ["despegar-vuelos", "https://www.despegar.com.ar/shop/flights/results/roundtrip/BUE/BRC/2027-01-10/2027-01-16/2/0/0"],
  ["almundo", "https://almundo.com.ar/"],
  ["aerolineas", "https://www.aerolineas.com.ar/"],
  ["flybondi", "https://flybondi.com/ar"],
  ["jetsmart", "https://jetsmart.com/ar/es/"],
  ["latam", "https://www.latamairlines.com/ar/es"],
  ["gol", "https://www.voegol.com.br/es"],
  ["plataforma10", "https://www.plataforma10.com.ar/"],
  ["centraldepasajes", "https://www.centraldepasajes.com.ar/"],
  [
    "booking",
    "https://www.booking.com/searchresults.es.html?ss=Bariloche&checkin=2027-01-10&checkout=2027-01-16&group_adults=2&no_rooms=1",
  ],
  [
    "airbnb",
    "https://www.airbnb.com.ar/s/Bariloche/homes?checkin=2027-01-10&checkout=2027-01-16&adults=2&children=0&infants=0",
  ],
  ["vrbo", "https://www.vrbo.com/search?destination=Bariloche&startDate=2027-01-10&endDate=2027-01-16&adults=2"],
  ["google-hotels", "https://www.google.com/travel/search?q=hoteles%20en%20Bariloche&hl=es-419"],
  ["despegar-alojamiento", "https://www.despegar.com.ar/hoteles/"],
];

describe("sitios del radar", () => {
  it.each(EXPECTED)("%s arma la dirección esperada", (id, url) => {
    expect(findSite(id)!.buildUrl(q)).toBe(url);
  });

  it("son 17 sitios con id único, en el orden del boceto", () => {
    expect(RADAR_SITES.map((s) => s.id)).toEqual(EXPECTED.map(([id]) => id));
    expect(new Set(RADAR_SITES.map((s) => s.id)).size).toBe(17);
  });

  it("los grupos llevan sus etiquetas", () => {
    expect(RADAR_GROUPS.map((g) => g.label)).toEqual(["Vuelos", "Aerolíneas", "Micros", "Alojamiento"]);
  });

  it("vuelos y aerolíneas devuelven null sin IATA", () => {
    for (const sin of [
      { ...q, destinationIata: null },
      { ...q, originIata: null },
    ]) {
      for (const s of RADAR_SITES.filter((s) => s.group === "vuelos" || s.group === "aerolineas")) {
        expect(s.buildUrl(sin)).toBeNull();
      }
    }
  });

  it("micros y alojamiento funcionan sin IATA", () => {
    const sin = { ...q, originIata: null, destinationIata: null };
    for (const s of RADAR_SITES.filter((s) => s.group === "micros" || s.group === "alojamiento")) {
      expect(s.buildUrl(sin)).not.toBeNull();
    }
  });

  it("codifica tildes y espacios", () => {
    const url = findSite("booking")!.buildUrl({ ...q, destinationLabel: "San Carlos de Bariloche" })!;
    expect(new URL(url).searchParams.get("ss")).toBe("San Carlos de Bariloche");
    expect(findSite("airbnb")!.buildUrl({ ...q, destinationLabel: "Zárate" })).toContain("/s/Z%C3%A1rate/homes");
  });

  it("lleva chicos y bebés donde se puede", () => {
    const kids = { ...q, children: 1, infants: 1 };
    expect(findSite("despegar-vuelos")!.buildUrl(kids)).toMatch(/\/2\/1\/1$/);
    expect(findSite("airbnb")!.buildUrl(kids)).toContain("children=1&infants=1");
    expect(findSite("despegar-vuelos")!.supportsChildren).toBe(true);
    expect(findSite("kayak")!.supportsChildren).toBe(false);
  });

  it("findSite devuelve undefined para un id desconocido", () => {
    expect(findSite("nada")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import type { RadarQuery } from "@/domain/radar/query";
import type { ReferenceFare } from "@/integrations/types";
import { agoText, cheapestDay, displayFare, fareDetail, siteButtons } from "./view";

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

const fare = (date: string, amountCents: number, currency = "ARS"): ReferenceFare => ({
  date,
  amountCents,
  currency,
  airline: null,
  transfers: null,
  foundAt: null,
  oneWay: false,
});

describe("botones del radar", () => {
  it("arma 4 grupos con 17 sitios y marca los revisados", () => {
    const g = siteButtons(q, [{ siteId: "booking", openedAt: "2026-11-14T10:00:00Z" }]);
    expect(g.map((x) => x.label)).toEqual(["Vuelos", "Aerolíneas", "Micros", "Alojamiento"]);
    expect(g.flatMap((x) => x.sites)).toHaveLength(17);
    expect(g[3]!.sites.find((s) => s.id === "booking")!.checked).toBe(true);
    expect(g[3]!.sites.find((s) => s.id === "airbnb")!.checked).toBe(false);
  });

  it("avisa que hay que sumar chicos a mano", () => {
    const s = siteButtons({ ...q, children: 1 }, []).flatMap((x) => x.sites);
    expect(s.find((x) => x.id === "kayak")!.note).toBe("Sumá los chicos a mano");
    expect(s.find((x) => x.id === "booking")!.note).toBe("Sumá los chicos a mano");
    expect(s.find((x) => x.id === "airbnb")!.note).toBeNull();
    expect(s.find((x) => x.id === "despegar-vuelos")!.note).toBeNull();
  });

  it("sin chicos no hay aviso en los sitios con búsqueda armada", () => {
    const s = siteButtons(q, []).flatMap((x) => x.sites);
    expect(s.find((x) => x.id === "kayak")!.note).toBeNull();
  });

  it("sitios sin búsqueda armada llevan su nota", () => {
    const s = siteButtons({ ...q, infants: 1 }, []).flatMap((x) => x.sites);
    expect(s.find((x) => x.id === "flybondi")!.note).toBe("Abre la página principal: cargá los datos a mano.");
  });

  it("sin IATA los vuelos quedan sin dirección y el resto sigue", () => {
    const g = siteButtons({ ...q, originIata: null }, []);
    expect(g[0]!.sites.every((s) => s.url === null)).toBe(true);
    expect(g[1]!.sites.every((s) => s.url === null)).toBe(true);
    expect(g[3]!.sites.every((s) => s.url !== null)).toBe(true);
  });
});

describe("calendario", () => {
  it("cheapestDay devuelve el día de menor precio", () => {
    expect(cheapestDay([fare("2027-01-09", 300), fare("2027-01-11", 100), fare("2027-01-12", 200)])).toBe("2027-01-11");
    expect(cheapestDay([])).toBeNull();
  });

  it("convierte USD con el tipo de cambio del viaje y si no lo deja en USD", () => {
    const f = fare("2027-01-10", 10000, "USD");
    expect(displayFare(f, "ARS", 1200)).toEqual({ amountCents: 12000000, currency: "ARS" });
    expect(displayFare(f, "ARS", null)).toEqual({ amountCents: 10000, currency: "USD" });
    expect(displayFare(fare("2027-01-10", 500), "ARS", 1200)).toEqual({ amountCents: 500, currency: "ARS" });
  });
});

describe("textos", () => {
  it("agoText dice hace cuánto se consultó", () => {
    const now = new Date("2026-11-14T15:00:00Z");
    expect(agoText("2026-11-14T14:59:40Z", now)).toBe("consultado hace instantes");
    expect(agoText("2026-11-14T14:35:00Z", now)).toBe("consultado hace 25 min");
    expect(agoText("2026-11-14T12:00:00Z", now)).toBe("consultado hace 3 h");
  });

  it("fareDetail arma aerolínea, escalas y solo ida", () => {
    expect(fareDetail({ ...fare("2027-01-11", 1), airline: "Flybondi", transfers: 1 })).toBe("Flybondi, 1 escala");
    expect(fareDetail({ ...fare("2027-01-11", 1), airline: "FO", transfers: 0, oneWay: true })).toBe(
      "FO, directo, solo ida",
    );
    expect(fareDetail({ ...fare("2027-01-11", 1), transfers: 2 })).toBe("2 escalas");
    expect(fareDetail(fare("2027-01-11", 1))).toBe("");
  });
});

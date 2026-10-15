import { describe, expect, it } from "vitest";
import { haversineKm, orderByProximity } from "./order";
import { activity } from "../__fixtures__/itinerary";

const hotel = { lat: -41.1335, lng: -71.3103 };
const catedral = { lat: -41.1703, lng: -71.4393 };
const civico = { lat: -41.1334, lng: -71.3097 };
const llao = { lat: -41.0511, lng: -71.5317 };

describe("haversineKm", () => {
  it("Bariloche centro a Cerro Catedral ≈ 11,6 km", () => {
    expect(haversineKm(hotel, catedral)).toBeCloseTo(11.6, 0);
    expect(Math.abs(haversineKm(hotel, catedral) - 11.6)).toBeLessThan(0.2);
  });
});

describe("orderByProximity", () => {
  it("ordena flexibles por vecino más cercano desde el inicio", () => {
    const r = orderByProximity(
      [activity({ id: "lejos", ...catedral }), activity({ id: "cerca", ...civico })],
      hotel,
    );
    expect(r.ok && r.data.map((a) => a.id)).toEqual(["cerca", "lejos"]);
  });

  it("las actividades con hora fija mantienen su posición", () => {
    const r = orderByProximity(
      [
        activity({ id: "lejos", ...llao }),
        activity({ id: "fija", startTime: "12:00", fixedTime: true, ...catedral }),
        activity({ id: "cerca", ...civico }),
      ],
      hotel,
    );
    expect(r.ok && r.data.map((a) => a.id)).toEqual(["cerca", "fija", "lejos"]);
  });

  it("ordena cada día por separado", () => {
    const r = orderByProximity(
      [
        activity({ id: "d2-lejos", date: "2027-01-13", ...catedral }),
        activity({ id: "d1-lejos", ...catedral }),
        activity({ id: "d2-cerca", date: "2027-01-13", ...civico }),
        activity({ id: "d1-cerca", ...civico }),
      ],
      hotel,
    );
    expect(r.ok && r.data.map((a) => a.id)).toEqual(["d1-cerca", "d1-lejos", "d2-cerca", "d2-lejos"]);
  });

  it("sin coordenadas devuelve error", () => {
    expect(orderByProximity([activity({ id: "a" }), activity({ id: "b" })], hotel)).toEqual({
      ok: false,
      error: { code: "missing_coordinates", message: "Cargá coordenadas en las actividades para ordenarlas por cercanía" },
    });
  });

  it("las flexibles sin coordenadas van al final de su día", () => {
    const r = orderByProximity([activity({ id: "sin" }), activity({ id: "con", ...civico })], hotel);
    expect(r.ok && r.data.map((a) => a.id)).toEqual(["con", "sin"]);
  });
});

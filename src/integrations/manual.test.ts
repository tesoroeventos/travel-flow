import { describe, expect, it } from "vitest";
import { manualProviders } from "./manual";

describe("proveedores manuales", () => {
  it("todas las integraciones avisan que no están configuradas", async () => {
    const p = manualProviders;
    const expected = {
      ok: false,
      error: {
        code: "not_configured",
        message: "Integración no configurada: cargá los datos a mano",
      },
    };
    expect(
      await p.flights.search({
        from: "AEP",
        to: "BRC",
        date: "2027-01-10",
        passengers: 2,
      }),
    ).toEqual(expected);
    expect(
      await p.lodging.search({
        destination: "Bariloche",
        checkIn: "2027-01-10",
        checkOut: "2027-01-16",
        guests: 2,
      }),
    ).toEqual(expected);
    expect(await p.rates.latest("USD", "ARS")).toEqual(expected);
    expect(
      await p.routing.route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, "driving"),
    ).toEqual(expected);
  });
});

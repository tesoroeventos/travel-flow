import { describe, expect, it } from "vitest";
import { carCostItems, type CarParams } from "./car";

const base: CarParams = {
  km: "3200",
  consumptionLPer100: "8",
  fuelPriceCents: 120000,
  currency: "ARS",
  tollsCents: 2500000,
  parkingCents: 0,
  rentalCents: 0,
  insuranceCents: 0,
  depositCents: 0,
  extraKm: "0",
  extraKmPriceCents: 0,
  dropOffCents: 0,
  wearPerKmCents: 1500,
  leg: "outbound",
};

describe("carCostItems", () => {
  const items = carCostItems(base);
  const byKey = (k: string) => items.find((i) => i.assumptions.concept === k);

  it("combustible = km × consumo/100 × precio", () => {
    expect(byKey("fuel")).toMatchObject({ amountCents: 30720000, unit: "total", category: "transport_outbound", currency: "ARS" });
    expect(byKey("fuel")?.assumptions).toMatchObject({ km: "3200", consumptionLPer100: "8", liters: "256" });
    expect(byKey("fuel")?.label).toBe("Combustible: 3.200 km × 8 l/100 km × $ 1.200,00/l");
  });

  it("peajes van a estacionamiento y peajes", () => {
    expect(byKey("tolls")).toMatchObject({ amountCents: 2500000, category: "parking_tolls" });
  });

  it("desgaste es opcional", () => {
    expect(byKey("wear")).toMatchObject({ amountCents: 4800000, costType: "optional" });
  });

  it("omite conceptos en cero", () => {
    expect(byKey("deposit")).toBeUndefined();
    expect(byKey("rental")).toBeUndefined();
  });

  it("depósito es reembolsable", () => {
    const withDeposit = carCostItems({ ...base, depositCents: 10000000 });
    expect(withDeposit.find((i) => i.assumptions.concept === "deposit")).toMatchObject({ amountCents: 10000000, refundable: true });
  });

  it("km adicional multiplica km por precio", () => {
    const r = carCostItems({ ...base, extraKm: "100", extraKmPriceCents: 25000 });
    expect(r.find((i) => i.assumptions.concept === "extra_km")?.amountCents).toBe(2500000);
  });
});

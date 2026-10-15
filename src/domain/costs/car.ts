import Decimal from "decimal.js";
import { formatMoney, money, roundHalfEven, type Currency } from "../money/money";
import type { CostCategory, CostItemInput } from "./types";

export interface CarParams {
  km: string;
  consumptionLPer100: string;
  fuelPriceCents: number;
  currency: Currency;
  tollsCents: number;
  parkingCents: number;
  rentalCents: number;
  insuranceCents: number;
  depositCents: number;
  extraKm: string;
  extraKmPriceCents: number;
  dropOffCents: number;
  wearPerKmCents: number | null;
  leg: "outbound" | "return" | "internal";
}

export type CarConcept = "fuel" | "tolls" | "parking" | "rental" | "insurance" | "deposit" | "extra_km" | "drop_off" | "wear";

export type CarCostItem = Omit<CostItemInput, "id"> & { assumptions: Record<string, string> & { concept: CarConcept } };

const num = (v: Decimal.Value) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(new Decimal(v).toNumber());
const fmt = (cents: number, currency: Currency) => formatMoney(money(cents, currency)).replace(/ /g, " ");

/** Genera las partidas de costo de un auto propio o alquilado, con los supuestos visibles. */
export function carCostItems(p: CarParams): CarCostItem[] {
  const transport: CostCategory = `transport_${p.leg}`;
  const out: CarCostItem[] = [];
  const add = (
    concept: CarConcept,
    label: string,
    amountCents: number,
    category: CostCategory,
    extra: Partial<CarCostItem> = {},
    assumptions: Record<string, string> = {},
  ) => {
    if (amountCents <= 0) return;
    out.push({
      label,
      amountCents,
      currency: p.currency,
      unit: "total",
      quantity: "1",
      category,
      costType: "fixed",
      refundable: false,
      certainty: "estimated",
      includesTaxes: true,
      consultedAt: null,
      nights: null,
      paymentStatus: "payment_pending",
      ...extra,
      assumptions: { concept, ...assumptions },
    });
  };

  const liters = new Decimal(p.km).times(p.consumptionLPer100).dividedBy(100);
  add(
    "fuel",
    `Combustible: ${num(p.km)} km × ${num(p.consumptionLPer100)} l/100 km × ${fmt(p.fuelPriceCents, p.currency)}/l`,
    roundHalfEven(liters.times(p.fuelPriceCents)),
    transport,
    { costType: "variable" },
    { km: p.km, consumptionLPer100: p.consumptionLPer100, liters: liters.toString(), fuelPriceCents: String(p.fuelPriceCents) },
  );
  add("tolls", "Peajes", p.tollsCents, "parking_tolls");
  add("parking", "Estacionamiento", p.parkingCents, "parking_tolls");
  add("rental", "Alquiler del auto", p.rentalCents, transport);
  add("insurance", "Seguro del auto", p.insuranceCents, transport);
  add("deposit", "Depósito / franquicia", p.depositCents, transport, { refundable: true });
  add(
    "extra_km",
    `Kilometraje adicional: ${num(p.extraKm)} km × ${fmt(p.extraKmPriceCents, p.currency)}`,
    roundHalfEven(new Decimal(p.extraKm).times(p.extraKmPriceCents)),
    transport,
    {},
    { extraKm: p.extraKm, extraKmPriceCents: String(p.extraKmPriceCents) },
  );
  add("drop_off", "Devolución en otra ubicación", p.dropOffCents, transport);
  if (p.wearPerKmCents !== null) {
    add(
      "wear",
      `Desgaste: ${num(p.km)} km × ${fmt(p.wearPerKmCents, p.currency)}/km`,
      roundHalfEven(new Decimal(p.km).times(p.wearPerKmCents)),
      transport,
      { costType: "optional" },
      { km: p.km, wearPerKmCents: String(p.wearPerKmCents) },
    );
  }
  return out;
}

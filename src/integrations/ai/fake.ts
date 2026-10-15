import { err, ok } from "@/domain/result";
import {
  AI_MESSAGES,
  type OfferDraft,
  type TravelAI,
  type TripContext,
} from "./types";

/** IA simulada para pruebas y E2E (AI_FAKE=1). Responde según el nombre del archivo o el link. */
const base = (o: Partial<OfferDraft>): OfferDraft => ({
  kind: "otro",
  direction: null,
  name: "",
  company: "",
  from: "",
  to: "",
  depart: null,
  arrive: null,
  durationMin: null,
  stops: null,
  price: null,
  currency: "ARS",
  basis: "total",
  nights: null,
  score: null,
  comfort: 3,
  detail: "",
  doubtful: [],
  ...o,
});

function offersFor(name: string, ctx: TripContext): OfferDraft[] | null {
  const n = name.toLowerCase();
  const s = ctx.startDate;
  const e = ctx.endDate;
  if (n.includes("ilegible")) return null;
  if (n.includes("vuelo-ida"))
    return [
      base({
        kind: "vuelo",
        direction: "ida",
        name: "AR 1672 · directo",
        company: "Aerolíneas Argentinas",
        from: "Aeroparque",
        to: ctx.destination,
        depart: `${s}T10:00`,
        arrive: `${s}T12:20`,
        durationMin: 140,
        stops: 0,
        price: 240000,
        comfort: 4,
        detail: "Equipaje de mano y valija de 15 kg",
      }),
    ];
  if (n.includes("vuelo-vuelta"))
    return [
      base({
        kind: "vuelo",
        direction: "vuelta",
        name: "AR 1673 · directo",
        company: "Aerolíneas Argentinas",
        from: ctx.destination,
        to: "Aeroparque",
        depart: `${e}T17:00`,
        arrive: `${e}T19:10`,
        durationMin: 130,
        stops: 0,
        price: 220000,
        comfort: 4,
      }),
    ];
  if (n.includes("micro-ida"))
    return [
      base({
        kind: "micro",
        direction: "ida",
        name: "Coche cama",
        company: "Vía Bariloche",
        from: "Retiro",
        to: ctx.destination,
        depart: `${s}T06:00`,
        durationMin: 22 * 60,
        price: 60000,
        basis: "por_persona",
        comfort: 2,
        detail: "Cama 160°",
      }),
    ];
  if (n.includes("micro-vuelta"))
    return [
      base({
        kind: "micro",
        direction: "vuelta",
        name: "Coche cama",
        company: "Vía Bariloche",
        from: ctx.destination,
        to: "Retiro",
        depart: `${e}T12:00`,
        durationMin: 22 * 60,
        price: 60000,
        basis: "por_persona",
        comfort: 2,
      }),
    ];
  if (n.includes("hostel"))
    return [
      base({
        kind: "alojamiento",
        name: "Hostel del Lago",
        company: "Booking",
        price: 30000,
        basis: "por_noche",
        score: "8,1/10",
        comfort: 2,
      }),
    ];
  if (n.includes("hotel"))
    return [
      base({
        kind: "alojamiento",
        name: "Hotel Centro Cívico",
        company: "Booking",
        price: 80000,
        basis: "por_noche",
        score: "8,6/10",
        comfort: 4,
        detail: "Desayuno incluido",
        doubtful: ["price"],
      }),
    ];
  if (n.includes("usd"))
    return [
      base({
        kind: "alojamiento",
        name: "Cabaña del Bosque",
        company: "Airbnb",
        price: 70,
        currency: "USD",
        basis: "por_noche",
        score: "4,9/5",
        comfort: 4,
      }),
    ];
  if (n.includes("actividad"))
    return [
      base({
        kind: "actividad",
        name: "Excursión Cerro Catedral",
        price: 40000,
        basis: "por_persona",
      }),
    ];
  return null;
}

export const fakeAI: TravelAI = {
  async parseTrip(text) {
    const origin = /z[aá]rate/i.test(text) ? "Zárate" : null;
    const dest = /bariloche/i.test(text)
      ? "Bariloche"
      : (text.split(/[ ,]/)[0] ?? "").trim() || null;
    return ok({
      destination: dest,
      origin,
      startDate: "2027-01-10",
      endDate: "2027-01-16",
      travelers: 2,
      budget: /mill/i.test(text) ? 1_500_000 : null,
      currency: "ARS",
      doubtful: origin ? [] : ["origin"],
    });
  },
  async readImage(_image, mime, ctx) {
    const name = /;name=(.+)$/.exec(mime)?.[1] ?? "";
    const offers = offersFor(name, ctx);
    return offers ? ok(offers) : err("no_offers", AI_MESSAGES.no_offers);
  },
  async readPage(text, url, ctx) {
    const offers = offersFor(`${url} ${text}`, ctx);
    return offers ? ok(offers) : err("no_offers", AI_MESSAGES.no_offers);
  },
  async estimateCar(a) {
    return ok({
      km: 1650,
      hours: 19,
      tolls: 15000,
      consumptionLPer100: a.consumptionLPer100 ?? 7,
      fuelPrice: 1300,
      route: "RN 5 y RN 237",
      doubtful: ["fuelPrice", "tolls"],
    });
  },
};

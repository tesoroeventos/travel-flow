import type { OfferDraft } from "../ai/types";
import type { FlightOption, FlightsResult, HotelsResult, Property, SearchCurrency } from "./types";

const FLIGHT_DETAIL = "Precio ida y vuelta para todos los pasajeros. Vuelta: se confirma al elegir esta opción.";

/** "YYYY-MM-DD HH:MM" → "YYYY-MM-DDTHH:MM" */
const toLocal = (s: string) => s.replace(" ", "T");

/**
 * Vuelos con precio: primero los que Google marca como mejores, después los más baratos, sin repetir.
 * También devuelve las aerolíneas que solo aparecieron sin precio (por ejemplo, Flybondi).
 */
export function pickFlights(r: FlightsResult, max = 5): { picked: FlightOption[]; missingAirlines: string[] } {
  const priced = r.options.filter((o) => o.price !== null);
  const ordered = [
    ...priced.filter((o) => o.best),
    ...priced.filter((o) => !o.best).sort((a, b) => a.price! - b.price!),
  ];
  const seen = new Set<string>();
  const picked: FlightOption[] = [];
  for (const o of ordered) {
    const key = `${o.legs[0]!.flightNumber}|${o.legs[0]!.depart}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(o);
    if (picked.length === max) break;
  }
  const withPrice = new Set(priced.map((o) => o.legs[0]!.airline));
  const missing: string[] = [];
  for (const o of r.options) {
    const a = o.legs[0]!.airline;
    if (o.price === null && !withPrice.has(a) && !missing.includes(a)) missing.push(a);
  }
  return { picked, missingAirlines: missing };
}

export function flightToDraft(o: FlightOption, currency: SearchCurrency): OfferDraft {
  const first = o.legs[0]!;
  const last = o.legs[o.legs.length - 1]!;
  return {
    kind: "vuelo",
    direction: "ida_y_vuelta",
    name: o.legs.map((l) => l.flightNumber).join(" + "),
    company: first.airline,
    from: first.from,
    to: last.to,
    depart: toLocal(first.depart),
    arrive: toLocal(last.arrive),
    durationMin: o.totalMin,
    stops: o.legs.length - 1,
    price: o.price,
    currency,
    basis: "total",
    nights: null,
    score: null,
    comfort: 3,
    detail: FLIGHT_DETAIL,
    doubtful: [],
  };
}

/**
 * La vuelta a usar. Con el precio de la tarjeta: la que da ese mismo total (la primera de las mejores si hay
 * varias); si ninguna lo da, la más barata. Sin precio: la primera de las mejores con precio.
 */
export function chooseReturn(r: FlightsResult, outboundPrice?: number | null): FlightOption | null {
  const priced = r.options.filter((o) => o.price !== null);
  if (outboundPrice != null) {
    const same = priced.filter((o) => o.price === outboundPrice);
    if (same.length) return same.find((o) => o.best) ?? same[0]!;
    return [...priced].sort((a, b) => a.price! - b.price!)[0] ?? null;
  }
  return priced.find((o) => o.best) ?? priced[0] ?? null;
}

/**
 * Alojamientos con precio total donde entra el grupo (sin dato de capacidad se mantienen).
 * La mitad más barata y el resto los mejor calificados, sin repetir.
 */
export function pickLodging(r: HotelsResult, groupSize: number, max = 6): Property[] {
  const ok = r.properties.filter((p) => p.total !== null && (p.capacity === null || p.capacity >= groupSize));
  const cheap = [...ok].sort((a, b) => a.total! - b.total!).slice(0, Math.ceil(max / 2));
  const rest = ok
    .filter((p) => !cheap.includes(p))
    .sort((a, b) => (b.rating5 ?? -1) - (a.rating5 ?? -1))
    .slice(0, max - cheap.length);
  return [...cheap, ...rest];
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

export function lodgingToDraft(
  p: Property,
  stay: { checkIn: string; checkOut: string; currency: SearchCurrency },
): OfferDraft {
  return {
    kind: "alojamiento",
    direction: null,
    name: p.name,
    company: p.source ?? "Google Hotels",
    from: "",
    to: "",
    depart: stay.checkIn,
    arrive: stay.checkOut,
    durationMin: null,
    stops: null,
    price: p.total,
    currency: stay.currency,
    basis: "total",
    nights: nightsBetween(stay.checkIn, stay.checkOut),
    score: p.rating5 !== null ? `${p.rating5}/5` : null,
    comfort: p.hotelClass !== null ? Math.min(5, Math.max(1, Math.round(p.hotelClass))) : 3,
    detail: [...p.info, ...p.amenities.slice(0, 4)].join(" · "),
    doubtful: [],
  };
}

export function lodgingExtras(p: Property): {
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  reviewCount: number | null;
  amenities: string[];
  flexibleCancellation: boolean;
  kind: "hotel" | "apartment";
} {
  return {
    lat: p.lat,
    lng: p.lng,
    capacity: p.capacity,
    reviewCount: p.reviews,
    amenities: p.amenities,
    flexibleCancellation: p.freeCancellation,
    kind: p.kind === "vacation_rental" ? "apartment" : "hotel",
  };
}

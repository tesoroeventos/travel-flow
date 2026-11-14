import { ok } from "@/domain/result";
import flightsFixture from "./__fixtures__/google_flights_BUE_BRC_2027-01.json";
import hotelsFixture from "./__fixtures__/google_hotels_Bariloche_2027-01.json";
import { normalizeFlights, normalizeHotels } from "./serpapi";
import type { FlightsResult, TravelSearch } from "./types";

/** Respuestas reales de SerpApi guardadas (SEARCH_FAKE=1). Nunca en producción. */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const empty: FlightsResult = { options: [] };

export const fakeTravelSearch: TravelSearch = {
  async flights(q) {
    return ok(q.arrivalId.includes("BRC") ? normalizeFlights(flightsFixture) : empty);
  },

  async returnFlights(q) {
    if (!q.arrivalId.includes("BRC")) return ok(empty);
    const base = normalizeFlights(flightsFixture);
    // Los mismos vuelos dados vuelta, el día de regreso.
    const options = base.options.map((o) => ({
      ...o,
      departureToken: null,
      legs: [...o.legs].reverse().map((l) => ({
        ...l,
        from: l.to,
        to: l.from,
        depart: `${q.returnDate} ${l.depart.slice(11)}`,
        arrive: `${q.returnDate} ${l.arrive.slice(11)}`,
      })),
    }));
    return ok({ options });
  },

  async hotels(q) {
    return ok(norm(q.q).includes("bariloche") ? normalizeHotels(hotelsFixture) : { properties: [] });
  },
};

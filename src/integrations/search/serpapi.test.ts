import { describe, expect, it } from "vitest";
import flightsFixture from "./__fixtures__/google_flights_BUE_BRC_2027-01.json";
import hotelsFixture from "./__fixtures__/google_hotels_Bariloche_2027-01.json";
import { serpApiSearch } from "./serpapi";
import type { FlightQuery, HotelQuery } from "./types";

type Reply = { status?: number; body?: unknown } | Error;

function fakeFetch(replies: Reply[]) {
  const urls: string[] = [];
  let i = 0;
  const fn = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { fn, urls };
}

const q: FlightQuery = {
  departureId: "EZE,AEP",
  arrivalId: "BRC",
  outboundDate: "2027-01-10",
  returnDate: "2027-01-16",
  adults: 2,
  children: 0,
  infants: 0,
  currency: "ARS",
};
const hq: HotelQuery = {
  q: "Bariloche",
  checkIn: "2027-01-10",
  checkOut: "2027-01-16",
  adults: 2,
  children: 0,
  currency: "ARS",
};
const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("SerpApi: vuelos", () => {
  it("normaliza vuelos reales: 7 opciones, 4 mejores, Flybondi sin precio", async () => {
    const r = await serpApiSearch("k", fakeFetch([{ body: flightsFixture }]).fn).flights(q);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.options).toHaveLength(7);
    expect(r.data.options.filter((o) => o.best)).toHaveLength(4);
    expect(r.data.options[0]).toEqual({
      price: 733920,
      totalMin: 145,
      departureToken: "tok-AR1682",
      best: true,
      legs: [
        {
          from: "EZE",
          to: "BRC",
          depart: "2027-01-10 18:20",
          arrive: "2027-01-10 20:45",
          durationMin: 145,
          airline: "Aerolíneas Argentinas",
          flightNumber: "AR 1682",
        },
      ],
    });
    expect(r.data.options[3]!.price).toBeNull();
    expect(r.data.options[3]!.legs[0]!.airline).toBe("Flybondi");
    expect(r.data.options[4]!.best).toBe(false);
  });

  it("descarta una opción sin tramos válidos y sigue con el resto", async () => {
    const body = { best_flights: [{ flights: [{ airline: "X" }], price: 5 }, flightsFixture.best_flights[0]] };
    const r = await serpApiSearch("k", fakeFetch([{ body }]).fn).flights(q);
    expect(r.ok && r.data.options).toHaveLength(1);
  });

  it("parámetros de vuelos con chicos", async () => {
    const f = fakeFetch([{ body: flightsFixture }]);
    await serpApiSearch("clave", f.fn).flights({ ...q, children: 1, infants: 1 });
    expect(new URL(f.urls[0]!).origin + new URL(f.urls[0]!).pathname).toBe("https://serpapi.com/search.json");
    expect(params(f.urls[0]!)).toMatchObject({
      engine: "google_flights",
      departure_id: "EZE,AEP",
      arrival_id: "BRC",
      outbound_date: "2027-01-10",
      return_date: "2027-01-16",
      type: "1",
      adults: "2",
      children: "1",
      infants_on_lap: "1",
      currency: "ARS",
      hl: "es",
      gl: "ar",
      api_key: "clave",
    });
  });

  it("returnFlights manda departure_token", async () => {
    const f = fakeFetch([{ body: flightsFixture }]);
    await serpApiSearch("k", f.fn).returnFlights(q, "tok-AR1682");
    expect(params(f.urls[0]!).departure_token).toBe("tok-AR1682");
  });
});

describe("SerpApi: hoteles", () => {
  it("normaliza hoteles reales", async () => {
    const r = await serpApiSearch("k", fakeFetch([{ body: hotelsFixture }]).fn).hotels(hq);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.properties).toHaveLength(6);
    expect(r.data.properties[2]).toMatchObject({
      kind: "vacation_rental",
      name: "Nahuel Departamentos",
      total: 600000,
      capacity: 6,
      rating5: 4.91,
      reviews: 32,
      source: "AlquilerArgentina",
      lat: -41.15037155151367,
    });
    expect(r.data.properties[1]!.freeCancellation).toBe(true);
    expect(r.data.properties[0]!.freeCancellation).toBe(false);
    expect(r.data.properties[5]).toMatchObject({
      kind: "hotel",
      hotelClass: 2,
      capacity: null,
      source: null,
      link: "http://www.tangoinn.com/",
    });
  });

  it("hoteles con chicos mandan children_ages", async () => {
    const f = fakeFetch([{ body: hotelsFixture }, { body: hotelsFixture }]);
    const s = serpApiSearch("k", f.fn);
    await s.hotels({ ...hq, children: 2 });
    await s.hotels(hq);
    expect(params(f.urls[0]!)).toMatchObject({
      engine: "google_hotels",
      q: "Bariloche",
      check_in_date: "2027-01-10",
      check_out_date: "2027-01-16",
      adults: "2",
      children: "2",
      children_ages: "8,8",
      currency: "ARS",
      hl: "es",
      gl: "ar",
    });
    expect(params(f.urls[1]!).children_ages).toBeUndefined();
  });
});

describe("SerpApi: errores", () => {
  it("401 es bad_key", async () => {
    const r = await serpApiSearch("k", fakeFetch([{ status: 401, body: { error: "Invalid API key." } }]).fn).flights(q);
    expect(!r.ok && r.error.code).toBe("bad_key");
  });

  it("cuerpo con 'Your account has run out of searches.' es no_credits", async () => {
    const r = await serpApiSearch(
      "k",
      fakeFetch([{ body: { error: "Your account has run out of searches." } }]).fn,
    ).hotels(hq);
    expect(!r.ok && r.error.code).toBe("no_credits");
  });

  it("429 es no_credits", async () => {
    const r = await serpApiSearch("k", fakeFetch([{ status: 429 }]).fn).flights(q);
    expect(!r.ok && r.error.code).toBe("no_credits");
  });

  it("otro error en el cuerpo es unavailable", async () => {
    const r = await serpApiSearch(
      "k",
      fakeFetch([{ body: { error: "Google hasn't returned any results." } }]).fn,
    ).flights(q);
    expect(!r.ok && r.error.code).toBe("unavailable");
  });

  it("500 se reintenta una vez y después es unavailable", async () => {
    const f = fakeFetch([{ status: 500 }, { status: 500 }]);
    const r = await serpApiSearch("k", f.fn).flights(q);
    expect(!r.ok && r.error.code).toBe("unavailable");
    expect(f.urls).toHaveLength(2);
  });

  it("un error de red se reintenta y puede salir bien", async () => {
    const f = fakeFetch([new Error("ECONNRESET"), { body: flightsFixture }]);
    const r = await serpApiSearch("k", f.fn).flights(q);
    expect(r.ok && r.data.options).toHaveLength(7);
  });
});

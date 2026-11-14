import { describe, expect, it } from "vitest";
import { travelpayoutsProvider } from "./travelpayouts";

type Reply = { status?: number; body?: unknown } | Error;

/** fetch simulado: devuelve las respuestas en orden y guarda las URLs pedidas. */
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

const day = {
  origin: "BUE",
  destination: "BRC",
  depart: "2027-01-10",
  return: "2027-01-16",
  windowDays: 0,
  currency: "ARS",
  today: "2026-11-14",
};
const ok = (data: unknown[]) => ({ body: { success: true, currency: "ars", data } });

describe("Travelpayouts", () => {
  it("convierte el precio a centavos y marca ida y vuelta", async () => {
    const f = fakeFetch([
      ok([{ price: 105000, airline: "FO", transfers: 1, departure_at: "2027-01-10T06:00:00-03:00" }]),
    ]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.data).toEqual([
      {
        date: "2027-01-10",
        amountCents: 10500000,
        currency: "ARS",
        airline: "FO",
        transfers: 1,
        foundAt: null,
        oneWay: false,
      },
    ]);
    expect(r.data.source).toBe("Travelpayouts");
  });

  it("cae a solo ida cuando no hay ida y vuelta", async () => {
    const f = fakeFetch([ok([]), ok([{ price: 50000, airline: "WJ", transfers: 0 }])]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(r.ok && r.data.data[0]).toMatchObject({ date: "2027-01-10", oneWay: true, amountCents: 5000000 });
    expect(f.urls[1]).toContain("one_way=true");
    expect(f.urls[1]).not.toContain("return_at");
  });

  it("descarta precios 0, negativos o sin número", async () => {
    for (const bad of [{ price: 0 }, { price: -5 }, {}, { price: "mucho" }]) {
      const f = fakeFetch([ok([bad]), ok([bad])]);
      const r = await travelpayoutsProvider("t", f.fn).calendar(day);
      expect(r.ok && r.data.data).toEqual([]);
    }
  });

  it("un día sin datos no aparece", async () => {
    const f = fakeFetch([ok([]), ok([])]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(r.ok && r.data.data).toEqual([]);
  });

  it("401 es bad_token", async () => {
    const f = fakeFetch([{ status: 401 }]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(!r.ok && r.error.code).toBe("bad_token");
  });

  it("500 se reintenta una vez y después es unavailable", async () => {
    const f = fakeFetch([{ status: 500 }, { status: 500 }]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(!r.ok && r.error.code).toBe("unavailable");
    expect(f.urls).toHaveLength(2);
  });

  it("un error de red se reintenta y puede salir bien", async () => {
    const f = fakeFetch([new Error("ECONNRESET"), ok([{ price: 100 }])]);
    const r = await travelpayoutsProvider("t", f.fn).calendar(day);
    expect(r.ok && r.data.data).toHaveLength(1);
  });

  it("los parámetros llevan market=ar, la moneda en minúscula y el token", async () => {
    const f = fakeFetch([ok([{ price: 1 }])]);
    await travelpayoutsProvider("tok", f.fn).calendar(day);
    const u = new URL(f.urls[0]!);
    expect(u.pathname).toBe("/aviasales/v3/prices_for_dates");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      origin: "BUE",
      destination: "BRC",
      departure_at: "2027-01-10",
      return_at: "2027-01-16",
      currency: "ars",
      market: "ar",
      one_way: "false",
      limit: "1",
      token: "tok",
    });
  });

  it("consulta un día por cada día de la ventana", async () => {
    const f = fakeFetch([ok([{ price: 1 }])]);
    await travelpayoutsProvider("t", f.fn).calendar({ ...day, windowDays: 3 });
    expect(f.urls).toHaveLength(7);
  });

  it("places mapea código, nombre y tipo", async () => {
    const f = fakeFetch([
      {
        body: [
          { code: "BUE", name: "Buenos Aires", type: "city" },
          { code: "EZE", name: "Ezeiza", type: "airport" },
          { name: "sin código" },
        ],
      },
    ]);
    const r = await travelpayoutsProvider("t", f.fn).places("Buenos");
    expect(r.ok && r.data.data).toEqual([
      { code: "BUE", name: "Buenos Aires", kind: "city" },
      { code: "EZE", name: "Ezeiza", kind: "airport" },
    ]);
    expect(f.urls[0]).toContain("autocomplete.travelpayouts.com/places2");
  });
});

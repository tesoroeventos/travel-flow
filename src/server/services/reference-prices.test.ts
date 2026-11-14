import { beforeEach, describe, expect, it } from "vitest";
import { err, ok } from "@/domain/result";
import type { ReferenceFare, ReferencePriceProvider } from "@/integrations/types";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { getCalendar } from "./reference-prices";

const fare: ReferenceFare = {
  date: "2027-01-10",
  amountCents: 10_500_000,
  currency: "ARS",
  airline: "FO",
  transfers: 1,
  foundAt: null,
  oneWay: false,
};

/** Proveedor que cuenta llamadas y devuelve lo que se le diga. */
function counting(result: () => Awaited<ReturnType<ReferencePriceProvider["calendar"]>>) {
  const p = {
    calls: 0,
    windows: [] as number[],
    async calendar(q: Parameters<ReferencePriceProvider["calendar"]>[0]) {
      p.calls++;
      p.windows.push(q.windowDays);
      return result();
    },
    async places() {
      return ok({ data: [], source: "x", fetchedAt: "" });
    },
  };
  return p;
}

const q = {
  origin: "BUE",
  destination: "BRC",
  depart: "2027-01-10",
  return: "2027-01-16",
  currency: "ARS",
  today: "2026-11-14",
};
const withFares = () => ok({ data: [fare], source: "Travelpayouts", fetchedAt: "2026-11-14T12:00:00.000Z" });

describe("caché de precios de referencia", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("pide una ventana de 3 días y devuelve tarifas, fuente y fecha", async () => {
    const p = counting(withFares);
    const r = await getCalendar(db, p, q, new Date("2026-11-14T12:00:00Z"));
    expect(p.windows).toEqual([3]);
    expect(r.ok && r.data).toEqual({ fares: [fare], source: "Travelpayouts", fetchedAt: "2026-11-14T12:00:00.000Z" });
  });

  it("la segunda consulta dentro de 6 h no llama al proveedor", async () => {
    const p = counting(withFares);
    await getCalendar(db, p, q, new Date("2026-11-14T12:00:00Z"));
    const r = await getCalendar(db, p, q, new Date("2026-11-14T17:59:00Z"));
    expect(p.calls).toBe(1);
    expect(r.ok && r.data.fetchedAt).toBe("2026-11-14T12:00:00.000Z");
    expect(r.ok && r.data.fares).toEqual([fare]);
  });

  it("después de 6 h vuelve a consultar", async () => {
    const p = counting(withFares);
    await getCalendar(db, p, q, new Date("2026-11-14T12:00:00Z"));
    const r = await getCalendar(db, p, q, new Date("2026-11-14T18:01:00Z"));
    expect(p.calls).toBe(2);
    expect(r.ok && r.data.fetchedAt).toBe("2026-11-14T18:01:00.000Z");
  });

  it("otra moneda u otras fechas son otra clave", async () => {
    const p = counting(withFares);
    const now = new Date("2026-11-14T12:00:00Z");
    await getCalendar(db, p, q, now);
    await getCalendar(db, p, { ...q, currency: "USD" }, now);
    await getCalendar(db, p, { ...q, depart: "2027-01-11", return: "2027-01-17" }, now);
    expect(p.calls).toBe(3);
  });

  it("guarda también una ruta sin datos", async () => {
    const p = counting(() => ok({ data: [], source: "Travelpayouts", fetchedAt: "" }));
    await getCalendar(db, p, q, new Date("2026-11-14T12:00:00Z"));
    const r = await getCalendar(db, p, q, new Date("2026-11-14T13:00:00Z"));
    expect(p.calls).toBe(1);
    expect(r.ok && r.data.fares).toEqual([]);
  });

  it("no guarda errores", async () => {
    const p = counting(() => err("unavailable", "x"));
    const r = await getCalendar(db, p, q, new Date("2026-11-14T12:00:00Z"));
    expect(!r.ok && r.error.code).toBe("unavailable");
    await getCalendar(db, p, q, new Date("2026-11-14T12:01:00Z"));
    expect(p.calls).toBe(2);
  });
});

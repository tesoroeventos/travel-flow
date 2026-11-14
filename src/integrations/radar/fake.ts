import { ok } from "@/domain/result";
import { windowDates } from "@/domain/radar/query";
import type { ReferenceFare, ReferencePlace, ReferencePriceProvider } from "../types";

/** Precios fijos para pruebas y E2E (RADAR_FAKE=1). Nunca en producción. */
const BRC_PRICES = [98_000, 112_000, null, 105_000, 87_000, 90_000, null];

const PLACES: Record<string, ReferencePlace> = {
  buenos: { code: "BUE", name: "Buenos Aires", kind: "city" },
  bariloche: { code: "BRC", name: "San Carlos de Bariloche", kind: "city" },
  mendoza: { code: "MDZ", name: "Mendoza", kind: "city" },
};

const now = () => new Date().toISOString();
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const fakeReferencePrices: ReferencePriceProvider = {
  async calendar(q) {
    if (q.origin !== "BUE" || q.destination !== "BRC") return ok({ data: [], source: "Simulado", fetchedAt: now() });
    // Índice fijo respecto de la ida: -3..+3, así el más bajo es siempre el día siguiente a la ida.
    const all = windowDates(q.depart, q.return, q.windowDays, "0000-01-01");
    const fares: ReferenceFare[] = [];
    all.forEach((d, i) => {
      const price = BRC_PRICES[i + (3 - q.windowDays)];
      if (price == null || d.depart < q.today) return;
      fares.push({
        date: d.depart,
        amountCents: price * 100,
        currency: q.currency.toUpperCase(),
        airline: "Flybondi",
        transfers: 1,
        foundAt: null,
        oneWay: false,
      });
    });
    return ok({ data: fares, source: "Simulado", fetchedAt: now() });
  },

  async places(term) {
    const t = normalize(term);
    const hit = Object.entries(PLACES).find(([k]) => t.includes(k));
    return ok({ data: hit ? [hit[1]] : [], source: "Simulado", fetchedAt: now() });
  },
};

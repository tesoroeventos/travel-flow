import { describe, expect, it } from "vitest";
import { sortTransport, type SortableTransport } from "./sort";

const opt = (id: string, totalCents: number | null, durationMin: number | null, transfers: number | null, comfort: number | null): SortableTransport => ({
  id,
  totalCents,
  durationMin,
  transfers,
  comfort,
});

describe("sortTransport", () => {
  const list = [opt("a", 30000, 120, 1, 3), opt("b", 20000, 600, 0, 5), opt("c", null, 60, 2, null), opt("d", 25000, null, null, 4)];

  it("menor precio, sin precio al final", () => {
    expect(sortTransport(list, "price").map((o) => o.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("menor duración, sin duración al final", () => {
    expect(sortTransport(list, "duration").map((o) => o.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("mejor relación precio-tiempo = precio total por hora", () => {
    // a: 30000/2h = 15000; b: 20000/10h = 2000; c y d sin dato
    expect(sortTransport(list, "price_per_hour").map((o) => o.id)).toEqual(["b", "a", "c", "d"]);
  });
  it("menos transbordos", () => {
    expect(sortTransport(list, "transfers").map((o) => o.id)).toEqual(["b", "a", "c", "d"]);
  });
  it("mayor comodidad", () => {
    expect(sortTransport(list, "comfort").map((o) => o.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("no modifica la lista original", () => {
    const copy = [...list];
    sortTransport(list, "price");
    expect(list).toEqual(copy);
  });
});

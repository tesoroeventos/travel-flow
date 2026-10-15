import { describe, expect, it } from "vitest";
import {
  buildCombos,
  buildPlans,
  legMinutes,
  missingForProposals,
  pickProposals,
  type Combo,
  type PropLeg,
} from "./proposals";

const vuelo = (
  id: string,
  leg: "outbound" | "return",
  h0: string,
  h1: string,
  extra: Partial<PropLeg> = {},
): PropLeg => ({
  id,
  leg,
  pairId: null,
  mode: "flight",
  departUtc: `2027-01-10T${h0}:00:00Z`,
  arriveUtc: `2027-01-10T${h1}:00:00Z`,
  comfort: 4,
  ...extra,
});
const combo = (
  key: string,
  costCents: number | null,
  minutes: number | null,
  comfort: number,
): Combo => ({ key, legIds: [], lodgingId: "h", costCents, minutes, comfort });

describe("propuestas", () => {
  it("un par ida y vuelta es un plan cerrado y no se mezcla", () => {
    const plans = buildPlans([
      vuelo("a", "outbound", "10", "12", { pairId: "p" }),
      vuelo("b", "return", "17", "19", { pairId: "p" }),
      vuelo("c", "outbound", "08", "10"),
      vuelo("d", "return", "20", "22"),
    ]);
    expect(plans.map((p) => p.map((l) => l.id).join("+")).sort()).toEqual([
      "a+b",
      "c+d",
    ]);
  });

  it("margen de terminal: vuelo de 2 h cuenta 270 min", () =>
    expect(legMinutes(vuelo("a", "outbound", "10", "12"))).toBe(270));

  it("auto propio no suma margen", () =>
    expect(
      legMinutes(vuelo("a", "outbound", "10", "12", { mode: "own_car" })),
    ).toBe(120));

  it("sin horarios el tiempo es desconocido", () =>
    expect(
      legMinutes({ ...vuelo("a", "outbound", "10", "12"), departUtc: null }),
    ).toBeNull());

  it("arma combinaciones con costo, minutos y confort", () => {
    const plans = buildPlans([
      vuelo("a", "outbound", "10", "12"),
      vuelo("b", "return", "17", "19", { comfort: 2 }),
    ]);
    const combos = buildCombos(
      plans,
      [{ id: "h", comfort: null }],
      (legIds, lodgingId) =>
        legIds.length === 2 && lodgingId === "h" ? 1000 : null,
    );
    expect(combos).toEqual([
      {
        key: "a+b|h",
        legIds: ["a", "b"],
        lodgingId: "h",
        costCents: 1000,
        minutes: 540,
        comfort: 3,
      },
    ]);
  });

  it("elige barata, rápida y cómoda; empata por costo", () => {
    const combos = [
      combo("1", 500, 2760, 2),
      combo("2", 720, 570, 3),
      combo("3", 1020, 570, 4),
    ];
    expect(pickProposals(combos).map((c) => [c.combo.key, c.tags])).toEqual([
      ["1", ["barata"]],
      ["2", ["rapida"]],
      ["3", ["comoda"]],
    ]);
  });

  it("una combinación que gana dos veces es una sola tarjeta con dos etiquetas", () => {
    const combos = [combo("1", 100, 100, 2), combo("2", 200, 300, 5)];
    expect(pickProposals(combos).map((c) => c.tags)).toEqual([
      ["barata", "rapida"],
      ["comoda"],
    ]);
  });

  it("las combinaciones sin costo no compiten", () => {
    expect(pickProposals([combo("1", null, 1, 5)])).toEqual([]);
  });

  it("tiempo desconocido pierde en la más rápida", () => {
    const cards = pickProposals([
      combo("1", 100, null, 3),
      combo("2", 200, 900, 3),
    ]);
    expect(cards.find((c) => c.tags.includes("rapida"))!.combo.key).toBe("2");
  });

  it("dice qué falta", () => {
    expect(
      missingForProposals([vuelo("a", "outbound", "10", "12")], 0),
    ).toEqual(["cómo volvés", "dónde te alojás"]);
    expect(missingForProposals([], 1)).toEqual(["cómo vas y cómo volvés"]);
    expect(
      missingForProposals(
        [
          vuelo("a", "outbound", "10", "12", { pairId: "p" }),
          vuelo("b", "return", "10", "12", { pairId: "p" }),
        ],
        1,
      ),
    ).toEqual([]);
  });
});

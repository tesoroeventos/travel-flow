import { describe, expect, it } from "vitest";
import { parseSwaps, swapHref } from "./swaps";

describe("ajustes de propuestas en la URL", () => {
  it("lee ?barata=1,0 e ignora lo inválido", () => {
    expect(
      parseSwaps({ barata: "1,0", rapida: "x", comoda: ["2,3"], otra: "1,1" }),
    ).toEqual({
      barata: { plan: 1, lodging: 0 },
      comoda: { plan: 2, lodging: 3 },
    });
    expect(parseSwaps({ barata: "-1,0" })).toEqual({});
  });

  it("arma el link conservando los otros ajustes y lo quita con null", () => {
    const cur = new URLSearchParams("rapida=0,1");
    expect(
      swapHref("/viajes/a/propuestas", cur, "barata", { plan: 2, lodging: 1 }),
    ).toBe("/viajes/a/propuestas?rapida=0%2C1&barata=2%2C1");
    expect(swapHref("/viajes/a/propuestas", cur, "rapida", null)).toBe(
      "/viajes/a/propuestas",
    );
  });
});

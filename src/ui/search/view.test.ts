import { describe, expect, it } from "vitest";
import { missingText, summaryText } from "./view";

describe("textos de la búsqueda automática", () => {
  const now = new Date("2026-11-14T20:00:00Z");

  it("summaryText dice cuántos y cuándo", () => {
    expect(summaryText({ flights: 5, lodging: 6, searchedAt: "2026-11-14T19:05:00Z" }, now)).toBe(
      "✓ 5 vuelos y 6 alojamientos · consultado hoy 16:05",
    );
    expect(summaryText({ flights: 1, lodging: 0, searchedAt: "2026-11-13T19:05:00Z" }, now)).toBe(
      "✓ 1 vuelo y 0 alojamientos · consultado ayer 16:05",
    );
    expect(summaryText({ flights: 2, lodging: 1, searchedAt: "2026-11-10T19:05:00Z" }, now)).toBe(
      "✓ 2 vuelos y 1 alojamiento · consultado el 10/11 16:05",
    );
  });

  it("'hoy' se calcula en hora de Buenos Aires", () => {
    // 23:30 del 14 en Buenos Aires es 02:30Z del 15
    expect(
      summaryText({ flights: 5, lodging: 6, searchedAt: "2026-11-15T02:30:00Z" }, new Date("2026-11-15T02:45:00Z")),
    ).toBe("✓ 5 vuelos y 6 alojamientos · consultado hoy 23:30");
  });

  it("missingText", () => {
    expect(missingText(["Flybondi"])).toBe("Flybondi también vuela esta ruta, pero Google no muestra su precio");
    expect(missingText(["Flybondi", "JetSMART"])).toBe(
      "Flybondi y JetSMART también vuelan esta ruta, pero Google no muestra su precio",
    );
    expect(missingText([])).toBeNull();
  });
});

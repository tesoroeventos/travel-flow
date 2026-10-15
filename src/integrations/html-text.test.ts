import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-text";

describe("htmlToText", () => {
  it("incluye JSON-LD y og:title, y descarta scripts y estilos", () => {
    const t =
      htmlToText(`<html><head><title>Hotel Lago</title><meta property="og:title" content="Hotel Lago Bariloche">
      <meta name="description" content="Desde $ 80.000 la noche"><script type="application/ld+json">{"@type":"Hotel","name":"Hotel Lago","priceRange":"$$"}</script>
      <script>var x = "no";</script><style>.a{color:red}</style></head><body><h1>Hotel &amp; Spa</h1><p>Check-in   14:00</p></body></html>`);
    expect(t).toContain("Hotel Lago Bariloche");
    expect(t).toContain("Desde $ 80.000 la noche");
    expect(t).toContain('"priceRange":"$$"');
    expect(t).toContain("Hotel & Spa");
    expect(t).toContain("Check-in 14:00");
    expect(t).not.toContain("var x");
    expect(t).not.toContain("color:red");
  });

  it("corta a 30.000 caracteres", () => {
    expect(
      htmlToText(`<p>${"a ".repeat(40_000)}</p>`).length,
    ).toBeLessThanOrEqual(30_000);
  });
});

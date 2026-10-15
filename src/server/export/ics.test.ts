import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/domain/itinerary/generate";
import { activity, input } from "@/domain/__fixtures__/itinerary";
import { itineraryIcs } from "./ics";

describe("itineraryIcs", () => {
  const it0 = generateItinerary(input({ activities: [activity({ id: "a1", name: "Excursión, con coma; y punto y coma " + "x".repeat(80) })] }));
  const ics = itineraryIcs(it0, "Bariloche 2027", "2027-01-01T00:00:00Z");

  it("es un calendario válido con CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
  });

  it("el vuelo de ida está en UTC", () => {
    expect(ics).toContain("DTSTART:20270110T130000Z");
    expect(ics).toContain("UID:departure:out:0@travelflow");
  });

  it("ninguna línea supera 75 octetos", () => {
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  });

  it("escapa comas y punto y coma en el texto", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Excursión\\, con coma\\; y punto y coma");
  });
});

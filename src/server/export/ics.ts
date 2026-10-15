import type { Itinerary } from "@/domain/itinerary/types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Pliega una línea a 75 octetos (RFC 5545 §3.1) sin cortar caracteres UTF-8. */
export function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (bytes + b > limit) {
      parts.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += b;
  }
  parts.push(current);
  return parts.join("\r\n");
}

/** Itinerario en formato iCalendar: un evento por entrada, horas en UTC. */
export function itineraryIcs(it: Itinerary, tripName: string, nowIso = new Date().toISOString()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TravelFlow//Itinerario//ES", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(tripName)}`];
  for (const day of it.days) {
    for (const e of day.entries) {
      const end = e.endUtc && e.endUtc > e.startUtc ? e.endUtc : new Date(new Date(e.startUtc).getTime() + 15 * 60_000).toISOString();
      const desc = [e.details.address, e.note, e.alerts.length ? `Alertas: ${e.alerts.join(", ")}` : ""].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.key}@travelflow`,
        `DTSTAMP:${stamp(nowIso)}`,
        `DTSTART:${stamp(e.startUtc)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(e.title)}`,
        ...(e.details.address ? [`LOCATION:${esc(e.details.address)}`] : []),
        ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

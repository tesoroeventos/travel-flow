import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type Block = "morning" | "midday" | "afternoon" | "night";

const MS_PER_DAY = 86_400_000;

/** Fecha local YYYY-MM-DD de un instante UTC en la zona dada. */
export function localDate(utcIso: string, tz: string): string {
  return formatInTimeZone(new Date(utcIso), tz, "yyyy-MM-dd");
}

/** Hora local HH:mm de un instante UTC en la zona dada. */
export function localTime(utcIso: string, tz: string): string {
  return formatInTimeZone(new Date(utcIso), tz, "HH:mm");
}

/** Instante UTC (ISO) para una fecha y hora locales en la zona dada. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  return fromZonedTime(`${date}T${time}:00`, tz).toISOString();
}

function dayNumber(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / MS_PER_DAY;
}

/** Diferencia en días de calendario entre dos fechas YYYY-MM-DD. */
export function daysDiff(fromDate: string, toDate: string): number {
  return Math.round(dayNumber(toDate) - dayNumber(fromDate));
}

/** Días de calendario del viaje, inclusive. */
export function tripDays(startUtc: string, startTz: string, endUtc: string, endTz: string): number {
  if (new Date(endUtc) < new Date(startUtc)) {
    throw new RangeError("La fecha de regreso debe ser posterior a la salida");
  }
  return daysDiff(localDate(startUtc, startTz), localDate(endUtc, endTz)) + 1;
}

/** Noches entre check-in y check-out, contadas en fecha local. */
export function nights(checkInUtc: string, checkOutUtc: string, tz: string): number {
  const n = daysDiff(localDate(checkInUtc, tz), localDate(checkOutUtc, tz));
  if (n <= 0) throw new RangeError("El check-out debe ser posterior al check-in");
  return n;
}

export function minutesBetween(aUtc: string, bUtc: string): number {
  return Math.round((new Date(bUtc).getTime() - new Date(aUtc).getTime()) / 60_000);
}

export function blockOf(localHHmm: string): Block {
  if (localHHmm >= "06:00" && localHHmm < "12:00") return "morning";
  if (localHHmm >= "12:00" && localHHmm < "15:00") return "midday";
  if (localHHmm >= "15:00" && localHHmm < "20:00") return "afternoon";
  return "night";
}

export function addDays(date: string, n: number): string {
  return new Date((dayNumber(date) + n) * MS_PER_DAY).toISOString().slice(0, 10);
}

export function datesBetween(start: string, endInclusive: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= endInclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

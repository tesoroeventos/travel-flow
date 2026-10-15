import { formatMoney, money } from "@/domain/money/money";

const NBSP = / /g;

export function fmtMoney(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return "—";
  return formatMoney(money(cents, currency)).replace(NBSP, " ");
}

/** Importe sin símbolo, formato 1.234,56 (para inputs y CSV). */
export function fmtAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const units = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${units},${(abs % 100).toString().padStart(2, "0")}`;
}

const dayFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const asUtcDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export const fmtDay = (ymd: string) => dayFmt.format(asUtcDate(ymd)).replace(".", "");
export const fmtDayLong = (ymd: string) => {
  const s = longFmt.format(asUtcDate(ymd));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtDate = (ymd: string) => `${fmtDay(ymd)} ${ymd.slice(0, 4)}`;

export function fmtRange(start: string, end: string): string {
  return start.slice(0, 4) === end.slice(0, 4) ? `${fmtDay(start)} – ${fmtDate(end)}` : `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

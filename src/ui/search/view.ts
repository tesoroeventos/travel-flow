import { formatInTimeZone } from "date-fns-tz";

const TZ = "America/Argentina/Buenos_Aires";
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "✓ 5 vuelos y 6 alojamientos · consultado hoy 16:05" (fecha en hora de Buenos Aires). */
export function summaryText(
  s: { flights: number; lodging: number; searchedAt: string },
  now: Date = new Date(),
): string {
  const at = new Date(s.searchedAt);
  const day = formatInTimeZone(at, TZ, "yyyy-MM-dd");
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const yesterday = formatInTimeZone(new Date(now.getTime() - 86_400_000), TZ, "yyyy-MM-dd");
  const when = day === today ? "hoy" : day === yesterday ? "ayer" : `el ${formatInTimeZone(at, TZ, "dd/MM")}`;
  return `✓ ${n(s.flights, "vuelo", "vuelos")} y ${n(s.lodging, "alojamiento", "alojamientos")} · consultado ${when} ${formatInTimeZone(at, TZ, "HH:mm")}`;
}

export function missingText(airlines: string[]): string | null {
  if (airlines.length === 0) return null;
  const names = airlines.length === 1 ? airlines[0] : `${airlines.slice(0, -1).join(", ")} y ${airlines.at(-1)}`;
  return `${names} también ${airlines.length === 1 ? "vuela" : "vuelan"} esta ruta, pero Google no muestra su precio`;
}

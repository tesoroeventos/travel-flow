import { formatInTimeZone } from "date-fns-tz";

/** Lo que necesita un sitio para armar la búsqueda. Fechas en YYYY-MM-DD, en la zona del viaje. */
export interface RadarQuery {
  originIata: string | null;
  destinationIata: string | null;
  originLabel: string;
  destinationLabel: string;
  depart: string;
  return: string;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
}

export interface RadarTrip {
  originIata: string | null;
  destinationIata: string | null;
  originLabel: string;
  destinationLabel: string;
  startAt: Date;
  startTz: string;
  endAt: Date;
  endTz: string;
  rooms: number;
}

export type RadarTraveler = { kind: "adult" | "child" | "infant" };

const DAY_MS = 86_400_000;

/** Suma días a una fecha YYYY-MM-DD sin depender de la zona horaria del servidor. */
function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function buildRadarQuery(trip: RadarTrip, travelers: RadarTraveler[]): RadarQuery {
  const count = (k: RadarTraveler["kind"]) => travelers.filter((t) => t.kind === k).length;
  return {
    originIata: trip.originIata,
    destinationIata: trip.destinationIata,
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    depart: formatInTimeZone(trip.startAt, trip.startTz, "yyyy-MM-dd"),
    return: formatInTimeZone(trip.endAt, trip.endTz, "yyyy-MM-dd"),
    adults: count("adult"),
    children: count("child"),
    infants: count("infant"),
    rooms: trip.rooms,
  };
}

/** Cambia la ida y corre la vuelta la misma cantidad de días. */
export function shiftDeparture(q: RadarQuery, newDepart: string): RadarQuery {
  const shift = daysBetween(q.depart, newDepart);
  return { ...q, depart: newDepart, return: addDays(q.return, shift) };
}

/** Días de salida alrededor de la ida, con la misma duración, sin días anteriores a hoy. */
export function windowDates(
  depart: string,
  ret: string,
  windowDays: number,
  today: string,
): { depart: string; return: string }[] {
  const out: { depart: string; return: string }[] = [];
  for (let d = -windowDays; d <= windowDays; d++) {
    const day = addDays(depart, d);
    if (day < today) continue;
    out.push({ depart: day, return: addDays(ret, d) });
  }
  return out;
}

export function hasKids(q: RadarQuery): boolean {
  return q.children + q.infants > 0;
}

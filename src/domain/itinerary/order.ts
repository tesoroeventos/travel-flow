import { err, ok, type Result } from "../result";
import type { ActivityInput } from "./types";

export interface Point {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

const hasCoords = (a: ActivityInput): a is ActivityInput & Point => a.lat !== null && a.lng !== null;

/**
 * Reordena las actividades flexibles de cada día por vecino más cercano (línea recta),
 * partiendo de `start`. Las de hora fija quedan en su posición.
 */
export function orderByProximity(activities: ActivityInput[], start: Point): Result<ActivityInput[]> {
  if (!activities.some((a) => !a.fixedTime && hasCoords(a))) {
    return err("missing_coordinates", "Cargá coordenadas en las actividades para ordenarlas por cercanía");
  }

  const byDate = new Map<string, ActivityInput[]>();
  for (const a of activities) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  const out: ActivityInput[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!;
    const slots = day.map((a) => (a.fixedTime ? a : null));
    const withCoords = day.filter((a) => !a.fixedTime && hasCoords(a)) as (ActivityInput & Point)[];
    const withoutCoords = day.filter((a) => !a.fixedTime && !hasCoords(a));

    const ordered: ActivityInput[] = [];
    let here: Point = start;
    const pending = [...withCoords];
    while (pending.length > 0) {
      let best = 0;
      for (let i = 1; i < pending.length; i++) {
        if (haversineKm(here, pending[i]!) < haversineKm(here, pending[best]!)) best = i;
      }
      const next = pending.splice(best, 1)[0]!;
      ordered.push(next);
      here = next;
    }
    ordered.push(...withoutCoords);

    let k = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] === null) slots[i] = ordered[k++]!;
    }
    out.push(...(slots as ActivityInput[]));
  }
  return ok(out);
}

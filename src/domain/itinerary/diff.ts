import type { Itinerary, ItineraryEntry } from "./types";

export interface ItineraryDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

const flat = (it: Itinerary) => new Map<string, ItineraryEntry>(it.days.flatMap((d) => d.entries).map((e) => [e.key, e]));

export function diffItineraries(prev: Itinerary, next: Itinerary): ItineraryDiff {
  const a = flat(prev);
  const b = flat(next);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [k, e] of b) {
    const old = a.get(k);
    if (!old) added.push(k);
    else if (old.startUtc !== e.startUtc || old.endUtc !== e.endUtc || old.title !== e.title) changed.push(k);
  }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
  return { added, removed, changed };
}

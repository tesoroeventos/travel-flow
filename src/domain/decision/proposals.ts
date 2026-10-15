import type { TransportMode } from "../itinerary/types";

/** Las tres propuestas que la app arma sola. */
export type ProposalTag = "barata" | "rapida" | "comoda";

export interface PropLeg {
  id: string;
  leg: "outbound" | "return";
  pairId: string | null;
  mode: TransportMode;
  departUtc: string | null;
  arriveUtc: string | null;
  comfort: number | null;
}

export interface PropLodging {
  id: string;
  comfort: number | null;
}

export interface Combo {
  key: string;
  legIds: string[];
  lodgingId: string;
  costCents: number | null;
  minutes: number | null;
  comfort: number;
}

export interface ProposalCard {
  tags: ProposalTag[];
  combo: Combo;
}

/** Minutos de terminal o aeropuerto que se suman a cada tramo (anticipación + traslado). */
export const TERMINAL_MARGIN_MIN: Record<TransportMode, number> = {
  flight: 150,
  bus: 60,
  train: 60,
  own_car: 0,
  rental_car: 0,
  taxi_app: 60,
  public_transport: 60,
  ferry: 60,
  private_transfer: 60,
  mixed: 60,
};

const DEFAULT_COMFORT = 3;
const comfortOf = (v: number | null) => v ?? DEFAULT_COMFORT;

/** Duración puerta a terminal de un tramo: horario + margen. null si faltan horarios. */
export function legMinutes(l: PropLeg): number | null {
  if (!l.departUtc || !l.arriveUtc) return null;
  const ms = Date.parse(l.arriveUtc) - Date.parse(l.departUtc);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000) + TERMINAL_MARGIN_MIN[l.mode];
}

/** Planes de transporte: cada par ida y vuelta es cerrado; las idas sueltas se combinan con las vueltas sueltas. */
export function buildPlans(legs: PropLeg[]): PropLeg[][] {
  const plans: PropLeg[][] = [];
  const pairs = new Map<string, PropLeg[]>();
  for (const l of legs) if (l.pairId) pairs.set(l.pairId, [...(pairs.get(l.pairId) ?? []), l]);
  for (const group of pairs.values()) {
    const out = group.find((l) => l.leg === "outbound");
    const ret = group.find((l) => l.leg === "return");
    if (out && ret) plans.push([out, ret]);
  }
  const outs = legs.filter((l) => !l.pairId && l.leg === "outbound");
  const rets = legs.filter((l) => !l.pairId && l.leg === "return");
  for (const a of outs) for (const b of rets) plans.push([a, b]);
  return plans;
}

export function buildCombos(
  plans: PropLeg[][],
  lodgings: PropLodging[],
  costOf: (legIds: string[], lodgingId: string) => number | null,
): Combo[] {
  const combos: Combo[] = [];
  for (const legs of plans) {
    const legIds = legs.map((l) => l.id);
    let minutes: number | null = 0;
    for (const l of legs) {
      const m = legMinutes(l);
      minutes = m === null || minutes === null ? null : minutes + m;
    }
    const legComfort = legs.reduce((s, l) => s + comfortOf(l.comfort), 0) / legs.length;
    for (const lod of lodgings) {
      combos.push({
        key: `${legIds.join("+")}|${lod.id}`,
        legIds,
        lodgingId: lod.id,
        costCents: costOf(legIds, lod.id),
        minutes,
        comfort: (legComfort + comfortOf(lod.comfort)) / 2,
      });
    }
  }
  return combos;
}

const BIG = Number.MAX_SAFE_INTEGER;
const mins = (c: Combo) => c.minutes ?? BIG;

/** La más barata, la más rápida y la más cómoda. Si una combinación gana más de una vez, es una sola tarjeta. */
export function pickProposals(combos: Combo[]): ProposalCard[] {
  const ok = combos.filter((c) => c.costCents !== null);
  if (!ok.length) return [];
  const cost = (c: Combo) => c.costCents as number;
  const first = (f: (a: Combo, b: Combo) => number) => ok.slice().sort(f)[0]!;
  const winners: [ProposalTag, Combo][] = [
    ["barata", first((a, b) => cost(a) - cost(b) || mins(a) - mins(b))],
    ["rapida", first((a, b) => mins(a) - mins(b) || cost(a) - cost(b))],
    ["comoda", first((a, b) => b.comfort - a.comfort || cost(a) - cost(b))],
  ];
  const cards: ProposalCard[] = [];
  for (const [tag, c] of winners) {
    const existing = cards.find((x) => x.combo.key === c.key);
    if (existing) existing.tags.push(tag);
    else cards.push({ tags: [tag], combo: c });
  }
  return cards;
}

/** Qué falta cargar para poder comparar. */
export function missingForProposals(legs: PropLeg[], lodgingCount: number): string[] {
  const missing: string[] = [];
  const plans = buildPlans(legs);
  if (!plans.length) {
    const hasOut = legs.some((l) => l.leg === "outbound" && !l.pairId);
    const hasRet = legs.some((l) => l.leg === "return" && !l.pairId);
    if (!hasOut && !hasRet) missing.push("cómo vas y cómo volvés");
    else missing.push(hasOut ? "cómo volvés" : "cómo vas");
  }
  if (lodgingCount === 0) missing.push("dónde te alojás");
  return missing;
}

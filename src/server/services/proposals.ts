import { and, eq, inArray } from "drizzle-orm";
import { computeCoverage } from "@/domain/costs/coverage";
import { computeScenarioCosts } from "@/domain/costs/engine";
import type { CostItemInput } from "@/domain/costs/types";
import {
  buildCombos,
  buildPlans,
  missingForProposals,
  pickProposals,
  type Combo,
  type PropLeg,
  type ProposalCard,
  type ProposalTag,
} from "@/domain/decision/proposals";
import { formatMoney, money } from "@/domain/money/money";
import { localDate, tripDays } from "@/domain/time/calendar";
import type { Db } from "../db/client";
import { bookings } from "../db/schema";
import type { Ctx } from "../context";
import { NotFoundError } from "../context";
import { makeRepos } from "../repos";
import { toDomainRate } from "../repos/rates";
import { makeScenarioParts } from "../repos/scenario-parts";
import { chooseScenario } from "./confirm";
import { loadTrip, type LoadedTrip } from "./load-trip";
import { toCostInput } from "./trip-analysis";
import { itemsTotalCents, ownerItems } from "./costing";

/** Descripción con la que se marcan los escenarios creados desde "Tus 3 opciones". */
export const PROPOSAL_MARK = "propuesta";

export type PieceOwner = "transport_option" | "lodging_option" | "activity";

export interface ProposalView extends ProposalCard {
  costCents: number;
  perPersonCents: number;
  budgetDiffCents: number | null;
  why: string;
  pieces: {
    ownerType: PieceOwner;
    id: string;
    label: string;
    detail: string;
    costCents: number | null;
  }[];
  adjusted: boolean;
}

export interface ProposalsResult {
  /** Lo que impide comparar (falta ida, vuelta o alojamiento). */
  missing: string[];
  /** Lo que no impide comparar pero queda afuera hasta completarlo (precios, dólar). */
  pending: string[];
  needsUsdRate: boolean;
  comboCount: number;
  cards: ProposalView[];
  all: Combo[];
  plans: PropLeg[][];
  lodgings: { id: string; name: string }[];
}

export type Swaps = Partial<Record<ProposalTag, { plan: number; lodging: number }>>;

const iso = (d: Date) => d.toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const fmt = (cents: number, currency: string) => formatMoney(money(cents, currency as never)).replace(/\s/g, " ");

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r} min`;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

const TAG_NAME: Record<ProposalTag, string> = {
  barata: "la más barata",
  rapida: "la más rápida",
  comoda: "la más cómoda",
};

function propLegs(data: LoadedTrip): PropLeg[] {
  return data.transport
    .filter((t): t is typeof t & { leg: "outbound" | "return" } => t.leg === "outbound" || t.leg === "return")
    .map((t) => ({
      id: t.id,
      leg: t.leg,
      pairId: t.pairId,
      mode: t.mode,
      departUtc: t.segments[0]?.departUtc ?? null,
      arriveUtc: t.segments[t.segments.length - 1]?.arriveUtc ?? null,
      comfort: t.comfortRating,
    }));
}

/** Opciones "En destino" que se suman a todas las combinaciones. */
function extras(data: LoadedTrip) {
  return {
    transport: data.transport.filter((t) => t.leg === "internal" && t.inProposals),
    activities: data.activities.filter((a) => a.inProposals),
  };
}

function legLabel(t: LoadedTrip["transport"][number]): string {
  const dir = t.leg === "outbound" ? "ida" : t.leg === "return" ? "vuelta" : "en destino";
  const mode: Record<string, string> = {
    flight: "Vuelo",
    bus: "Micro",
    train: "Tren",
    own_car: "Tu auto",
    rental_car: "Auto de alquiler",
  };
  return `${mode[t.mode] ?? "Transporte"} ${dir}`;
}

function comfortWords(data: LoadedTrip, combo: Combo): string {
  const words = combo.legIds.map((id) => {
    const t = data.transport.find((x) => x.id === id)!;
    if (t.mode === "flight") return t.segments.length <= 1 ? "vuelo directo" : "vuelo con escalas";
    if (t.mode === "bus") return /cama/i.test(`${t.serviceNumber ?? ""} ${t.notes ?? ""}`) ? "micro cama" : "micro";
    if (t.mode === "own_car") return "tu auto";
    if (t.mode === "train") return "tren";
    return "transporte";
  });
  const uniq = [...new Set(words)];
  const lod = data.lodging.find((l) => l.id === combo.lodgingId)!;
  const score = lod.rating ? ` (${String(Number(lod.rating)).replace(".", ",")}/10)` : "";
  return `Combina ${uniq.join(" y ")} con ${lod.name}${score}.`;
}

export function proposalsFromLoaded(data: LoadedTrip, opts: { today?: string; swaps?: Swaps } = {}): ProposalsResult {
  const { trip } = data;
  const today = opts.today ?? todayIso();
  const days = tripDays(iso(trip.startAt), trip.startTz, iso(trip.endAt), trip.endTz);
  const travelers = Math.max(1, data.travelers.length);
  const rateDate = trip.status === "planning" ? today : localDate(iso(trip.startAt), trip.startTz);
  const rates = data.rates.map(toDomainRate);
  const ex = extras(data);
  const legs = propLegs(data);
  const plans = buildPlans(legs);
  const lodgings = data.lodging.map((l) => ({
    id: l.id,
    comfort: l.qualityRating,
  }));
  const missing = missingForProposals(legs, lodgings.length);
  const ex0 = extras(data);
  const pairIds = (t: LoadedTrip["transport"][number]) =>
    t.pairId ? data.transport.filter((x) => x.pairId === t.pairId).map((x) => x.id) : [t.id];
  const pricedTransport = (t: LoadedTrip["transport"][number]) =>
    ownerItems(data, "transport_option", pairIds(t)).length > 0;
  const pricedOther = (type: PieceOwner, id: string) => ownerItems(data, type, [id]).length > 0;
  const unpriced = [
    ...data.transport
      .filter((t) => (t.leg !== "internal" || t.inProposals) && !pricedTransport(t))
      .map((t) => t.serviceNumber || t.provider),
    ...data.lodging.filter((l) => !pricedOther("lodging_option", l.id)).map((l) => l.name),
    ...ex0.activities.filter((a) => !pricedOther("activity", a.id)).map((a) => a.name),
  ];
  const pending = [...new Set(unpriced)].map((n) => `el precio de “${n}”`);

  const itemsOf = (type: PieceOwner, id: string): CostItemInput[] =>
    data.costItems.filter((i) => i.ownerType === type && i.ownerId === id).map((i) => toCostInput(data, i));
  const extraItems = [
    ...ex.transport.flatMap((t) => itemsOf("transport_option", t.id)),
    ...ex.activities.flatMap((a) => itemsOf("activity", a.id)),
  ];

  const summaries = new Map<string, ReturnType<typeof computeScenarioCosts>>();
  const costOf = (legIds: string[], lodgingId: string): number | null => {
    const lod = data.lodging.find((l) => l.id === lodgingId)!;
    const legRows = legIds.map((id) => data.transport.find((t) => t.id === id)!);
    if (!legRows.every(pricedTransport) || !pricedOther("lodging_option", lodgingId)) return null;
    const summary = computeScenarioCosts({
      travelers,
      tripDays: days,
      baseCurrency: trip.baseCurrency,
      budgetCents: trip.budgetCents,
      contingencyPct: trip.contingencyPct,
      contingencyCategories: trip.contingencyCategories as CostItemInput["category"][],
      rateDate,
      today,
      staleDays: trip.staleDays,
      rates,
      items: [
        ...legIds.flatMap((id) => itemsOf("transport_option", id)),
        ...itemsOf("lodging_option", lodgingId),
        ...extraItems,
      ],
      coverage: computeCoverage({
        tripStartUtc: iso(trip.startAt),
        tripStartTz: trip.startTz,
        tripEndUtc: iso(trip.endAt),
        tripEndTz: trip.endTz,
        lodgings: [
          {
            checkInUtc: iso(lod.checkInAt),
            checkOutUtc: iso(lod.checkOutAt),
            tz: lod.tz,
          },
        ],
        legs: [...legRows.map((t) => t.leg), ...ex.transport.map((t) => t.leg)],
      }),
    });
    summaries.set(`${legIds.join("+")}|${lodgingId}`, summary);
    return summary.incomplete ? null : summary.totalWithContingencyCents;
  };

  const all = buildCombos(plans, lodgings, costOf);
  const needsUsdRate = [...summaries.values()].some((s) =>
    s.warnings.some((w) => w.code === "missing_exchange_rate" && (w.detail ?? "").includes("USD")),
  );
  if (needsUsdRate) pending.push("a cuánto tomás el dólar");
  const picked = missing.length ? [] : pickProposals(all);
  const byTag = (tag: ProposalTag) => picked.find((p) => p.tags.includes(tag))?.combo;

  const cards: ProposalView[] = picked.map((card) => {
    const tag = card.tags[0]!;
    const sw = opts.swaps?.[tag];
    const swapped = sw
      ? all.find(
          (c) =>
            c.legIds.join("+") === plans[sw.plan]?.map((l) => l.id).join("+") &&
            c.lodgingId === lodgings[sw.lodging]?.id,
        )
      : undefined;
    const combo = swapped && swapped.costCents !== null ? swapped : card.combo;
    const adjusted = combo.key !== card.combo.key;
    const cost = combo.costCents as number;

    let why: string;
    if (adjusted) why = "Combinación ajustada por vos.";
    else if (tag === "barata") {
      const ref = picked.find((p) => p.combo.key !== combo.key);
      why = ref
        ? `Ahorrás ${fmt((ref.combo.costCents as number) - cost, trip.baseCurrency)} frente a ${TAG_NAME[ref.tags[0]!]}.`
        : "Es la de menor costo de todas las combinaciones.";
    } else if (tag === "rapida") {
      why =
        combo.minutes === null
          ? "Tiene el menor tiempo de viaje entre las opciones con horarios."
          : `${fmtMinutes(combo.minutes)} de viaje sumando ida y vuelta, con tiempos de terminal y aeropuerto.`;
      const cheap = byTag("barata");
      if (
        cheap &&
        cheap.key !== combo.key &&
        cheap.minutes !== null &&
        combo.minutes !== null &&
        cheap.minutes > combo.minutes
      ) {
        why += ` Son ${fmtMinutes(cheap.minutes - combo.minutes)} menos que la más barata.`;
      }
    } else why = comfortWords(data, combo);

    const pieceCost = (type: PieceOwner, id: string) => itemsTotalCents(data, ownerItems(data, type, [id]), today);
    const lod = data.lodging.find((l) => l.id === combo.lodgingId)!;
    const pieces: ProposalView["pieces"] = [
      ...combo.legIds.map((id) => {
        const t = data.transport.find((x) => x.id === id)!;
        return {
          ownerType: "transport_option" as const,
          id,
          label:
            t.mode === "own_car"
              ? `${legLabel(t)}${t.serviceNumber ? ` · ${t.serviceNumber}` : ""}`
              : `${legLabel(t)} · ${t.serviceNumber || t.provider}`,
          detail:
            t.pairId && t.leg === "return"
              ? "Incluido en el precio de la ida"
              : t.mode === "own_car"
                ? "Nafta y peajes"
                : t.provider,
          costCents: pieceCost("transport_option", id),
        };
      }),
      {
        ownerType: "lodging_option",
        id: lod.id,
        label: lod.name,
        detail: lod.rating ? `${String(Number(lod.rating)).replace(".", ",")}/10` : "",
        costCents: pieceCost("lodging_option", lod.id),
      },
      ...ex.transport.map((t) => ({
        ownerType: "transport_option" as const,
        id: t.id,
        label: t.serviceNumber || t.provider || "Auto de alquiler",
        detail: "En destino",
        costCents: pieceCost("transport_option", t.id),
      })),
      ...ex.activities.map((a) => ({
        ownerType: "activity" as const,
        id: a.id,
        label: a.name,
        detail: "En destino",
        costCents: pieceCost("activity", a.id),
      })),
    ];

    return {
      tags: card.tags,
      combo,
      costCents: cost,
      perPersonCents: Math.round(cost / travelers),
      budgetDiffCents: trip.budgetCents > 0 ? trip.budgetCents - cost : null,
      why,
      pieces,
      adjusted,
    };
  });

  return {
    missing,
    pending,
    needsUsdRate,
    comboCount: all.filter((c) => c.costCents !== null).length,
    cards,
    all,
    plans,
    lodgings: data.lodging.map((l) => ({ id: l.id, name: l.name })),
  };
}

/** Guarda la propuesta elegida como escenario (reemplazando la anterior) y la marca como elegida. */
export async function chooseProposal(
  db: Db,
  ctx: Ctx,
  tripId: string,
  p: { legIds: string[]; lodgingId: string; name: string },
): Promise<string> {
  const data = await loadTrip(db, ctx, tripId);
  const legIds = new Set(p.legIds);
  for (const id of p.legIds) {
    const t = data.transport.find((x) => x.id === id);
    if (!t) throw new NotFoundError("el transporte", id);
    if (t.pairId) for (const sib of data.transport.filter((x) => x.pairId === t.pairId)) legIds.add(sib.id);
  }
  if (!data.lodging.some((l) => l.id === p.lodgingId)) throw new NotFoundError("el alojamiento", p.lodgingId);
  const ex = extras(data);
  const selection: { ownerType: PieceOwner; ownerId: string }[] = [
    ...[...legIds].map((ownerId) => ({
      ownerType: "transport_option" as const,
      ownerId,
    })),
    { ownerType: "lodging_option", ownerId: p.lodgingId },
    ...ex.transport.map((t) => ({
      ownerType: "transport_option" as const,
      ownerId: t.id,
    })),
    ...ex.activities.map((a) => ({
      ownerType: "activity" as const,
      ownerId: a.id,
    })),
  ];

  const r = makeRepos(db);
  const parts = makeScenarioParts(db);
  for (const old of data.scenarios.filter((s) => s.description === PROPOSAL_MARK))
    await r.scenarios.remove(ctx, old.id);
  const keep = new Set(selection.map((s) => `${s.ownerType}:${s.ownerId}`));
  const stale = data.bookings
    .filter(
      (b) =>
        b.bookingStatus === "selected" &&
        b.paymentStatus === "payment_pending" &&
        !keep.has(`${b.ownerType}:${b.ownerId}`),
    )
    .map((b) => b.id);
  if (stale.length) await db.delete(bookings).where(and(eq(bookings.tripId, tripId), inArray(bookings.id, stale)));

  const sc = await r.scenarios.create(ctx, {
    tripId,
    name: p.name,
    description: PROPOSAL_MARK,
  });
  for (const s of selection) await parts.setSelection(ctx, sc.id, s.ownerType, s.ownerId, true);
  await chooseScenario(db, ctx, tripId, sc.id);
  return sc.id;
}

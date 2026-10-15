import { and, eq } from "drizzle-orm";
import { carCostItems } from "@/domain/costs/car";
import { formatMoney, money } from "@/domain/money/money";
import { addDays, localDate, localTime, zonedToUtc } from "@/domain/time/calendar";
import type { CarEstimate, OfferBasis, OfferDraft, OfferKind } from "@/integrations/ai/types";
import type { Db } from "../db/client";
import { costItems } from "../db/schema";
import type { Ctx } from "../context";
import { NotFoundError } from "../context";
import { makeRepos } from "../repos";
import { itemsTotalCents, ownerItems } from "./costing";
import { loadTrip, type LoadedTrip } from "./load-trip";
import { deleteOption } from "./options";

export type OfferSource = { kind: "captura" } | { kind: "link"; url: string } | { kind: "manual" } | { kind: "auto" };
export type OfferOwner = "transport_option" | "lodging_option" | "activity";
export interface SavedOffer {
  ownerType: OfferOwner;
  id: string;
  pairId: string | null;
}
export interface CarEdit {
  km: number;
  hours: number;
  consumptionLPer100: number;
  fuelPrice: number;
  tolls: number;
}
export interface OfferEdit extends Partial<OfferDraft> {
  car?: CarEdit;
}
export type CardKind = OfferKind | "auto_propio";
export interface OfferCard {
  ownerType: OfferOwner;
  id: string;
  group: "ida" | "vuelta" | "ida_y_vuelta" | "alojamiento" | "destino";
  kind: CardKind;
  name: string;
  company: string;
  route: string;
  when: string;
  detail: string;
  score: string | null;
  totalCents: number | null;
  priceNote: string;
  currency: string;
  doubtful: string[];
  inProposals: boolean | null;
  source: string | null;
  edit: OfferEdit;
}

type TripRow = LoadedTrip["trip"];
type TransportRow = LoadedTrip["transport"][number];
type Mode = TransportRow["mode"];

const MODE_OF: Partial<Record<OfferKind, Mode>> = {
  vuelo: "flight",
  micro: "bus",
  tren: "train",
  auto_alquiler: "rental_car",
};
const KIND_OF: Partial<Record<Mode, CardKind>> = {
  flight: "vuelo",
  bus: "micro",
  train: "tren",
  own_car: "auto_propio",
  rental_car: "auto_alquiler",
};
const UNIT_OF: Record<OfferBasis, "total" | "per_person" | "per_night" | "per_person_night" | "per_day"> = {
  total: "total",
  por_persona: "per_person",
  por_noche: "per_night",
  por_persona_por_noche: "per_person_night",
  por_dia: "per_day",
};
const BASIS_OF = Object.fromEntries(Object.entries(UNIT_OF).map(([k, v]) => [v, k])) as Record<string, OfferBasis>;
const BASIS_LABEL: Record<OfferBasis, string> = {
  total: "total",
  por_persona: "por persona",
  por_noche: "por noche",
  por_persona_por_noche: "por persona y noche",
  por_dia: "por día",
};

const tableOf = (k: OfferKind): OfferOwner =>
  k === "alojamiento" ? "lodging_option" : k === "actividad" || k === "otro" ? "activity" : "transport_option";
const iso = (d: Date) => d.toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/* ───────── marca de datos dudosos en notes ───────── */

const MARK = /\s*\[revisar:([^\]]*)\]\s*$/;
export function splitNotes(notes: string | null): {
  text: string;
  doubtful: string[];
} {
  const s = notes ?? "";
  const m = MARK.exec(s);
  return {
    text: s.replace(MARK, "").trim(),
    doubtful: m
      ? m[1]!
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [],
  };
}
const withMark = (text: string, doubtful: string[]) =>
  (doubtful.length ? `${text} [revisar:${doubtful.join(",")}]`.trim() : text) || null;

/* ───────── horarios ───────── */

function toUtc(local: string | null, tz: string, defaultTime: string): string | null {
  if (!local) return null;
  const date = local.slice(0, 10);
  const time = local.length > 10 ? local.slice(11, 16) : defaultTime;
  return zonedToUtc(date, time, tz);
}
const toLocal = (utc: string | null | undefined, tz: string) =>
  utc ? `${localDate(utc, tz)}T${localTime(utc, tz)}` : null;
const addMin = (utc: string, min: number) => new Date(Date.parse(utc) + min * 60_000).toISOString();

function legTz(trip: TripRow, leg: "outbound" | "return" | "internal") {
  if (leg === "outbound") return { dep: trip.startTz, arr: trip.endTz };
  if (leg === "return") return { dep: trip.endTz, arr: trip.startTz };
  return { dep: trip.endTz, arr: trip.endTz };
}

function segmentsFor(
  trip: TripRow,
  leg: "outbound" | "return" | "internal",
  d: Pick<OfferDraft, "depart" | "arrive" | "durationMin" | "from" | "to">,
) {
  const tz = legTz(trip, leg);
  const dep = d.depart && d.depart.length > 10 ? toUtc(d.depart, tz.dep, "00:00") : null;
  if (!dep) return [];
  let arr = d.arrive && d.arrive.length > 10 ? toUtc(d.arrive, tz.arr, "00:00") : null;
  if ((!arr || arr <= dep) && d.durationMin) arr = addMin(dep, d.durationMin);
  if (!arr || arr <= dep) return [];
  return [
    {
      from: d.from || "Origen",
      to: d.to || "Destino",
      departUtc: dep,
      departTz: tz.dep,
      arriveUtc: arr,
      arriveTz: tz.arr,
    },
  ];
}

/* ───────── puntajes ───────── */

export function ratingFromScore(score: string | null): string | null {
  if (!score) return null;
  const s = score.toLowerCase().replace(",", ".");
  const n = Number.parseFloat(s.match(/\d+(\.\d+)?/)?.[0] ?? "");
  if (!Number.isFinite(n)) return null;
  let v: number;
  if (/estrella|★/.test(s)) v = n * 2;
  else if (/\/\s*5\b/.test(s)) v = n * 2;
  else if (/\/\s*100\b/.test(s)) v = n / 10;
  else v = n <= 5 && !/\/\s*10\b/.test(s) ? n * 2 : n;
  return v >= 0 && v <= 10 ? v.toFixed(1) : null;
}

function firstFullDay(trip: TripRow): string {
  const start = localDate(iso(trip.startAt), trip.startTz);
  const end = localDate(iso(trip.endAt), trip.endTz);
  const next = addDays(start, 1);
  return next < end ? next : start;
}

function sourceLabel(src: OfferSource): string {
  if (src.kind === "captura") return "Captura";
  if (src.kind === "manual") return "Cargado a mano";
  if (src.kind === "auto") return "Estimado por IA";
  try {
    return new URL(src.url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

/* ───────── guardar ───────── */

async function addPriceItem(
  db: Db,
  ctx: Ctx,
  tripId: string,
  ownerType: OfferOwner,
  ownerId: string,
  d: OfferDraft,
  category: typeof costItems.$inferInsert.category,
  source: string,
) {
  if (d.price === null) return;
  await makeRepos(db).costItems.create(ctx, {
    tripId,
    ownerType,
    ownerId,
    label: d.name || "Precio",
    amountCents: Math.round(d.price * 100),
    currency: d.currency,
    unit: UNIT_OF[d.basis],
    category,
    source,
    consultedAt: today(),
    certainty: "estimated",
  });
}

async function saveOne(db: Db, ctx: Ctx, trip: TripRow, d: OfferDraft, src: OfferSource): Promise<SavedOffer[]> {
  const r = makeRepos(db);
  const tripId = trip.id;
  const label = sourceLabel(src);
  const url = src.kind === "link" ? src.url : null;
  const notes = withMark(d.detail, d.doubtful);
  const table = tableOf(d.kind);

  if (table === "lodging_option") {
    const l = await r.lodging.create(ctx, {
      tripId,
      name: d.name || "Alojamiento",
      kind: /airbnb|depto|departamento|caba[ñn]a/i.test(`${d.company} ${d.name}`) ? "apartment" : "hotel",
      checkInAt: new Date(toUtc(d.depart ?? localDate(iso(trip.startAt), trip.startTz), trip.endTz, "14:00")!),
      checkOutAt: new Date(toUtc(d.arrive ?? localDate(iso(trip.endAt), trip.endTz), trip.endTz, "10:00")!),
      tz: trip.endTz,
      rating: ratingFromScore(d.score),
      qualityRating: d.comfort,
      notes,
      url,
      source: src.kind,
    });
    await addPriceItem(db, ctx, tripId, "lodging_option", l.id, d, "lodging", label);
    return [{ ownerType: "lodging_option", id: l.id, pairId: null }];
  }

  if (table === "activity") {
    const a = await r.activities.create(ctx, {
      tripId,
      name: d.name || "Actividad",
      date: d.depart?.slice(0, 10) ?? firstFullDay(trip),
      startTime: d.depart && d.depart.length > 10 ? d.depart.slice(11, 16) : null,
      durationMin: d.durationMin ?? 60,
      notes,
      url,
      source: src.kind,
    });
    await addPriceItem(db, ctx, tripId, "activity", a.id, d, d.kind === "actividad" ? "activities" : "other", label);
    return [{ ownerType: "activity", id: a.id, pairId: null }];
  }

  const mode = MODE_OF[d.kind] ?? "mixed";
  const legs: ("outbound" | "return" | "internal")[] =
    d.kind === "auto_alquiler"
      ? ["internal"]
      : d.direction === "ida_y_vuelta"
        ? ["outbound", "return"]
        : [d.direction === "vuelta" ? "return" : "outbound"];
  const pairId = legs.length === 2 ? crypto.randomUUID() : null;
  const out: SavedOffer[] = [];
  for (const [idx, leg] of legs.entries()) {
    const isSecond = idx === 1;
    const from = isSecond
      ? d.to || trip.destinationLabel
      : d.from || (leg === "return" ? trip.destinationLabel : trip.originLabel);
    const to = isSecond
      ? d.from || trip.originLabel
      : d.to || (leg === "return" ? trip.originLabel : trip.destinationLabel);
    const t = await r.transport.create(ctx, {
      tripId,
      leg,
      mode,
      provider: d.company || d.name,
      serviceNumber: d.name || null,
      fromLabel: from,
      toLabel: to,
      segments: isSecond ? [] : segmentsFor(trip, leg, { ...d, from, to }),
      comfortRating: d.comfort,
      notes,
      url,
      pairId,
      source: src.kind,
    });
    if (!isSecond) {
      const cat =
        leg === "outbound" ? "transport_outbound" : leg === "return" ? "transport_return" : "transport_internal";
      await addPriceItem(db, ctx, tripId, "transport_option", t.id, d, cat, label);
    }
    out.push({ ownerType: "transport_option", id: t.id, pairId });
  }
  return out;
}

export async function saveOffers(
  db: Db,
  ctx: Ctx,
  tripId: string,
  drafts: OfferDraft[],
  source: OfferSource,
): Promise<SavedOffer[]> {
  const trip = await makeRepos(db).trips.require(ctx, tripId);
  const saved: SavedOffer[] = [];
  for (const d of drafts) saved.push(...(await saveOne(db, ctx, trip, d, source)));
  return saved;
}

/* ───────── auto propio ───────── */

async function writeCarItems(db: Db, ctx: Ctx, trip: TripRow, rowId: string, leg: "outbound" | "return", c: CarEdit) {
  const items = carCostItems({
    km: String(c.km),
    consumptionLPer100: String(c.consumptionLPer100),
    fuelPriceCents: Math.round(c.fuelPrice * 100),
    currency: trip.baseCurrency as never,
    tollsCents: Math.round(c.tolls * 100),
    parkingCents: 0,
    rentalCents: 0,
    insuranceCents: 0,
    depositCents: 0,
    extraKm: "0",
    extraKmPriceCents: 0,
    dropOffCents: 0,
    wearPerKmCents: null,
    leg,
  });
  const r = makeRepos(db);
  for (const i of items) {
    await r.costItems.create(ctx, {
      tripId: trip.id,
      ownerType: "transport_option",
      ownerId: rowId,
      label: i.label,
      amountCents: i.amountCents,
      currency: i.currency,
      unit: i.unit,
      quantity: i.quantity,
      category: i.category,
      costType: i.costType,
      refundable: i.refundable,
      certainty: "estimated",
      includesTaxes: i.includesTaxes,
      assumptions: {
        ...i.assumptions,
        hours: String(c.hours),
        tolls: String(c.tolls),
        fuelPrice: String(c.fuelPrice),
      },
      source: "Estimado por IA",
      consultedAt: today(),
    });
  }
}

function carSegments(trip: TripRow, leg: "outbound" | "return", hours: number, from: string, to: string) {
  const date = leg === "outbound" ? localDate(iso(trip.startAt), trip.startTz) : localDate(iso(trip.endAt), trip.endTz);
  const tz = legTz(trip, leg);
  const dep = zonedToUtc(date, "08:00", tz.dep);
  return [
    {
      from,
      to,
      departUtc: dep,
      departTz: tz.dep,
      arriveUtc: addMin(dep, Math.round(hours * 60)),
      arriveTz: tz.arr,
    },
  ];
}

export async function saveCarOffer(
  db: Db,
  ctx: Ctx,
  tripId: string,
  est: CarEstimate,
  model: string | null,
): Promise<SavedOffer[]> {
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  const pairId = crypto.randomUUID();
  const c: CarEdit = {
    km: est.km,
    hours: est.hours,
    consumptionLPer100: est.consumptionLPer100,
    fuelPrice: est.fuelPrice,
    tolls: est.tolls,
  };
  const out: SavedOffer[] = [];
  for (const leg of ["outbound", "return"] as const) {
    const from = leg === "outbound" ? trip.originLabel : trip.destinationLabel;
    const to = leg === "outbound" ? trip.destinationLabel : trip.originLabel;
    const t = await r.transport.create(ctx, {
      tripId,
      leg,
      mode: "own_car",
      provider: "Tu auto",
      serviceNumber: model,
      fromLabel: from,
      toLabel: to,
      segments: carSegments(trip, leg, est.hours, from, to),
      distanceKm: est.km,
      comfortRating: 3,
      notes: withMark(est.route ? `Ruta: ${est.route}` : "", est.doubtful),
      pairId,
      source: "auto",
    });
    await writeCarItems(db, ctx, trip, t.id, leg, c);
    out.push({ ownerType: "transport_option", id: t.id, pairId });
  }
  return out;
}

/* ───────── vista ───────── */

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
const fmtMoney = (cents: number, currency: string) => formatMoney(money(cents, currency as never)).replace(/\s/g, " ");

function carOf(data: LoadedTrip, rowId: string): CarEdit | undefined {
  const items = ownerItems(data, "transport_option", [rowId]);
  const fuel = items.find((i) => i.assumptions?.concept === "fuel");
  if (!fuel?.assumptions) return undefined;
  const a = fuel.assumptions;
  return {
    km: Number(a.km),
    hours: Number(a.hours),
    consumptionLPer100: Number(a.consumptionLPer100),
    fuelPrice: Number(a.fuelPrice),
    tolls: Number(a.tolls ?? 0),
  };
}

function priceOf(items: LoadedTrip["costItems"]) {
  const i = items[0];
  return i
    ? {
        price: i.amountCents / 100,
        currency: (i.currency === "USD" ? "USD" : "ARS") as "ARS" | "USD",
        basis: BASIS_OF[i.unit] ?? "total",
      }
    : { price: null, currency: "ARS" as const, basis: "total" as OfferBasis };
}

function priceNote(
  data: LoadedTrip,
  items: LoadedTrip["costItems"],
  total: number | null,
  perNights: number | null,
): string {
  const i = items[0];
  if (!i) return "";
  const basis = BASIS_OF[i.unit] ?? "total";
  const n = Math.max(1, data.travelers.length);
  const orig =
    i.currency !== data.trip.baseCurrency || basis !== "total"
      ? `${i.currency === "USD" ? `US$ ${(i.amountCents / 100).toLocaleString("es-AR")}` : fmtMoney(i.amountCents, i.currency)} ${BASIS_LABEL[basis]}`
      : "";
  if (total === null) return [orig, "falta el dólar"].filter(Boolean).join(" · ");
  const tot =
    perNights !== null ? `total ${perNights} noche${perNights === 1 ? "" : "s"}` : n > 1 ? `total para ${n}` : "total";
  return [orig, tot].filter(Boolean).join(" · ");
}

export function offerCardsFromLoaded(data: LoadedTrip, opts: { today?: string } = {}): OfferCard[] {
  const day = opts.today ?? today();
  const trip = data.trip;
  const cards: OfferCard[] = [];

  for (const t of data.transport) {
    const sibling = t.pairId ? data.transport.find((x) => x.pairId === t.pairId && x.id !== t.id) : undefined;
    if (sibling && t.leg === "return") continue;
    const ids = sibling ? [t.id, sibling.id] : [t.id];
    const items = ownerItems(data, "transport_option", ids);
    const total = itemsTotalCents(data, items, day);
    const { text, doubtful } = splitNotes(t.notes);
    const seg = t.segments[0];
    const tz = legTz(trip, t.leg);
    const car = t.mode === "own_car" ? carOf(data, t.id) : undefined;
    const minutes = seg ? Math.round((Date.parse(seg.arriveUtc) - Date.parse(seg.departUtc)) / 60_000) : null;
    let when = "";
    if (car) when = `${fmtDuration(Math.round(car.hours * 60))} de manejo por tramo`;
    else if (seg) {
      const dl = localDate(seg.departUtc, tz.dep);
      const al = localDate(seg.arriveUtc, tz.arr);
      when = `${fmtDay(dl)} ${localTime(seg.departUtc, tz.dep)} → ${al === dl ? "" : `${fmtDay(al)} `}${localTime(seg.arriveUtc, tz.arr)} · ${fmtDuration(minutes!)}`;
    }
    const p = priceOf(items);
    cards.push({
      ownerType: "transport_option",
      id: t.id,
      group: sibling ? "ida_y_vuelta" : t.leg === "outbound" ? "ida" : t.leg === "return" ? "vuelta" : "destino",
      kind: KIND_OF[t.mode] ?? "otro",
      name:
        t.mode === "own_car"
          ? `Tu auto${t.serviceNumber ? ` · ${t.serviceNumber}` : ""}`
          : t.serviceNumber || t.provider,
      company: t.mode === "own_car" ? "" : t.provider,
      route: `${t.fromLabel} → ${t.toLabel}`,
      when,
      detail: car
        ? `${Math.round(car.km).toLocaleString("es-AR")} km por tramo${text ? ` · ${text.replace(/^Ruta: /, "")}` : ""}`
        : text,
      score: null,
      totalCents: total,
      priceNote: car ? "nafta + peajes, ida y vuelta" : priceNote(data, items, total, null),
      currency: trip.baseCurrency,
      doubtful,
      inProposals: t.leg === "internal" ? t.inProposals : null,
      source: t.source,
      edit: {
        kind: (KIND_OF[t.mode] === "auto_propio" ? "otro" : KIND_OF[t.mode]) as OfferKind,
        direction: sibling ? "ida_y_vuelta" : t.leg === "return" ? "vuelta" : t.leg === "outbound" ? "ida" : null,
        name: t.serviceNumber ?? "",
        company: t.provider,
        from: t.fromLabel,
        to: t.toLabel,
        depart: toLocal(seg?.departUtc, tz.dep),
        arrive: toLocal(seg?.arriveUtc, tz.arr),
        durationMin: minutes,
        comfort: t.comfortRating ?? 3,
        detail: text,
        ...(car ? { car } : p),
      },
    });
  }

  for (const l of data.lodging) {
    const items = ownerItems(data, "lodging_option", [l.id]);
    const total = itemsTotalCents(data, items, day);
    const { text, doubtful } = splitNotes(l.notes);
    const ci = localDate(iso(l.checkInAt), l.tz);
    const co = localDate(iso(l.checkOutAt), l.tz);
    const nights = Math.max(
      0,
      Math.round((Date.parse(`${co}T00:00:00Z`) - Date.parse(`${ci}T00:00:00Z`)) / 86_400_000),
    );
    const score = l.rating ? `${String(Number(l.rating)).replace(".", ",")}/10` : null;
    cards.push({
      ownerType: "lodging_option",
      id: l.id,
      group: "alojamiento",
      kind: "alojamiento",
      name: l.name,
      company: l.url ? sourceLabel({ kind: "link", url: l.url }) : "",
      route: "",
      when: `${fmtDay(ci)} ${localTime(iso(l.checkInAt), l.tz)} → ${fmtDay(co)} ${localTime(iso(l.checkOutAt), l.tz)} · ${nights} noche${nights === 1 ? "" : "s"}`,
      detail: text,
      score,
      totalCents: total,
      priceNote: priceNote(data, items, total, nights),
      currency: trip.baseCurrency,
      doubtful,
      inProposals: null,
      source: l.source,
      edit: {
        kind: "alojamiento",
        direction: null,
        name: l.name,
        depart: toLocal(iso(l.checkInAt), l.tz),
        arrive: toLocal(iso(l.checkOutAt), l.tz),
        score,
        comfort: l.qualityRating ?? 3,
        detail: text,
        ...priceOf(items),
      },
    });
  }

  for (const a of data.activities) {
    const items = ownerItems(data, "activity", [a.id]);
    const total = itemsTotalCents(data, items, day);
    const { text, doubtful } = splitNotes(a.notes);
    const isOther = items[0]?.category === "other";
    cards.push({
      ownerType: "activity",
      id: a.id,
      group: "destino",
      kind: isOther ? "otro" : "actividad",
      name: a.name,
      company: "",
      route: "",
      when: `${fmtDay(a.date)}${a.startTime ? ` ${a.startTime}` : ""}`,
      detail: text,
      score: null,
      totalCents: total,
      priceNote: priceNote(data, items, total, null),
      currency: trip.baseCurrency,
      doubtful,
      inProposals: a.inProposals,
      source: a.source,
      edit: {
        kind: isOther ? "otro" : "actividad",
        direction: null,
        name: a.name,
        depart: a.startTime ? `${a.date}T${a.startTime}` : a.date,
        durationMin: a.durationMin,
        comfort: 3,
        detail: text,
        ...priceOf(items),
      },
    });
  }
  return cards;
}

/* ───────── editar ───────── */

async function replacePrice(
  db: Db,
  ctx: Ctx,
  trip: TripRow,
  ownerType: OfferOwner,
  ownerId: string,
  d: OfferDraft,
  category: typeof costItems.$inferInsert.category,
  source: string,
) {
  const r = makeRepos(db);
  const existing = await db
    .select()
    .from(costItems)
    .where(and(eq(costItems.tripId, trip.id), eq(costItems.ownerType, ownerType), eq(costItems.ownerId, ownerId)));
  if (d.price === null) {
    for (const i of existing) await r.costItems.remove(ctx, i.id);
    return;
  }
  const values = {
    amountCents: Math.round(d.price * 100),
    currency: d.currency,
    unit: UNIT_OF[d.basis],
    label: d.name || "Precio",
    isDemo: false,
  };
  if (existing[0]) await r.costItems.update(ctx, existing[0].id, values);
  else await addPriceItem(db, ctx, trip.id, ownerType, ownerId, d, category, source);
}

export async function updateOffer(
  db: Db,
  ctx: Ctx,
  ref: { ownerType: OfferOwner; id: string },
  edit: OfferEdit,
): Promise<void> {
  const r = makeRepos(db);
  const repo =
    ref.ownerType === "transport_option" ? r.transport : ref.ownerType === "lodging_option" ? r.lodging : r.activities;
  const row = await repo.require(ctx, ref.id);
  const data = await loadTrip(db, ctx, row.tripId);
  const self = data.transport.find((t) => t.id === ref.id);
  const outboundOfPair = self?.pairId
    ? data.transport.find((t) => t.pairId === self.pairId && t.leg === "outbound")?.id
    : undefined;
  const card = offerCardsFromLoaded(data).find((c) => c.id === (outboundOfPair ?? ref.id));
  if (!card) throw new NotFoundError("la opción", ref.id);
  const trip = data.trip;
  const { car, ...rest } = edit;

  // Auto propio: se recalculan las partidas de los dos tramos.
  if (card.kind === "auto_propio") {
    const rows = data.transport.filter(
      (t) => t.id === card.id || (t.pairId && t.pairId === data.transport.find((x) => x.id === card.id)?.pairId),
    );
    const c = car ?? card.edit.car!;
    for (const t of rows) {
      for (const i of ownerItems(data, "transport_option", [t.id])) await r.costItems.remove(ctx, i.id);
      await writeCarItems(db, ctx, trip, t.id, t.leg as "outbound" | "return", c);
      const seg = t.segments[0];
      await r.transport.update(ctx, t.id, {
        distanceKm: c.km,
        serviceNumber: rest.name ?? t.serviceNumber,
        comfortRating: rest.comfort ?? t.comfortRating,
        segments: seg
          ? [
              {
                ...seg,
                arriveUtc: addMin(seg.departUtc, Math.round(c.hours * 60)),
              },
            ]
          : [],
        notes: splitNotes(t.notes).text || null,
      });
    }
    return;
  }

  const merged: OfferDraft = {
    kind: (card.edit.kind ?? "otro") as OfferKind,
    direction: card.edit.direction ?? null,
    name: card.edit.name ?? "",
    company: card.edit.company ?? "",
    from: card.edit.from ?? "",
    to: card.edit.to ?? "",
    depart: card.edit.depart ?? null,
    arrive: card.edit.arrive ?? null,
    durationMin: card.edit.durationMin ?? null,
    stops: null,
    price: card.edit.price ?? null,
    currency: card.edit.currency ?? "ARS",
    basis: card.edit.basis ?? "total",
    nights: null,
    score: card.edit.score ?? null,
    comfort: card.edit.comfort ?? 3,
    detail: card.edit.detail ?? "",
    ...rest,
    doubtful: [],
  };
  const wasPair = card.group === "ida_y_vuelta";
  const willPair =
    merged.direction === "ida_y_vuelta" &&
    tableOf(merged.kind) === "transport_option" &&
    merged.kind !== "auto_alquiler";
  const src = (row.source as OfferSource["kind"] | null) ?? "manual";
  const source: OfferSource =
    src === "link" && row.url
      ? { kind: "link", url: row.url }
      : ({ kind: src === "link" ? "manual" : src } as OfferSource);

  if (
    tableOf(merged.kind) !== ref.ownerType ||
    wasPair !== willPair ||
    (merged.kind === "auto_alquiler") !== (card.kind === "auto_alquiler")
  ) {
    await deleteOption(db, ctx, ref.ownerType, card.id);
    await saveOffers(db, ctx, trip.id, [merged], source);
    return;
  }
  const label = sourceLabel(source);

  if (ref.ownerType === "transport_option") {
    const t = data.transport.find((x) => x.id === card.id)!;
    const leg = t.leg === "internal" ? "internal" : merged.direction === "vuelta" ? "return" : "outbound";
    await r.transport.update(ctx, t.id, {
      leg: wasPair ? t.leg : leg,
      mode: MODE_OF[merged.kind] ?? t.mode,
      provider: merged.company || merged.name,
      serviceNumber: merged.name || null,
      fromLabel: merged.from || t.fromLabel,
      toLabel: merged.to || t.toLabel,
      segments: segmentsFor(trip, wasPair ? t.leg : leg, merged),
      comfortRating: merged.comfort,
      notes: merged.detail || null,
    });
    const cat =
      leg === "internal"
        ? "transport_internal"
        : leg === "return" && !wasPair
          ? "transport_return"
          : "transport_outbound";
    await replacePrice(db, ctx, trip, "transport_option", t.id, merged, cat, label);
  } else if (ref.ownerType === "lodging_option") {
    await r.lodging.update(ctx, card.id, {
      name: merged.name || "Alojamiento",
      checkInAt: new Date(toUtc(merged.depart ?? localDate(iso(trip.startAt), trip.startTz), trip.endTz, "14:00")!),
      checkOutAt: new Date(toUtc(merged.arrive ?? localDate(iso(trip.endAt), trip.endTz), trip.endTz, "10:00")!),
      rating: ratingFromScore(merged.score),
      qualityRating: merged.comfort,
      notes: merged.detail || null,
    });
    await replacePrice(db, ctx, trip, "lodging_option", card.id, merged, "lodging", label);
  } else {
    await r.activities.update(ctx, card.id, {
      name: merged.name || "Actividad",
      date: merged.depart?.slice(0, 10) ?? firstFullDay(trip),
      startTime: merged.depart && merged.depart.length > 10 ? merged.depart.slice(11, 16) : null,
      notes: merged.detail || null,
    });
    await replacePrice(
      db,
      ctx,
      trip,
      "activity",
      card.id,
      merged,
      merged.kind === "actividad" ? "activities" : "other",
      label,
    );
  }
}

export async function setInProposals(
  db: Db,
  ctx: Ctx,
  ref: { ownerType: "transport_option" | "activity"; id: string },
  value: boolean,
): Promise<void> {
  const r = makeRepos(db);
  if (ref.ownerType === "activity") await r.activities.update(ctx, ref.id, { inProposals: value });
  else await r.transport.update(ctx, ref.id, { inProposals: value });
}

/** Guarda "¿a cuánto tomás el dólar?" como tipo de cambio USD → moneda del viaje. */
export async function setUsdRate(db: Db, ctx: Ctx, tripId: string, perUsd: number, day: string): Promise<void> {
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  // Siempre USD→pesos: si el viaje está en dólares, el motor usa la inversa para pasar los pesos a dólares.
  await r.rates.create(ctx, {
    fromCurrency: "USD",
    toCurrency: trip.baseCurrency === "USD" ? "ARS" : trip.baseCurrency,
    rate: String(perUsd),
    asOf: day,
    source: "Ingresado por vos",
  });
}

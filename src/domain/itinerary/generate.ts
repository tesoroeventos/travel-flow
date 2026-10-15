import { blockOf, localDate, localTime, minutesBetween, zonedToUtc } from "../time/calendar";
import { detectAlerts } from "./alerts";
import type {
  ActivityInput,
  EntryKind,
  Itinerary,
  ItineraryEntry,
  ItineraryInput,
  TransportLeg,
  TransportMode,
} from "./types";

const DAY_START = "09:00";

export function defaultAdvanceMin(mode: TransportMode, international: boolean): number {
  if (mode === "flight") return international ? 180 : 120;
  if (mode === "bus" || mode === "train") return 30;
  return 0;
}

export const addMinutes = (utc: string, min: number) => new Date(new Date(utc).getTime() + min * 60_000).toISOString();

function entry(
  kind: EntryKind,
  sourceId: string,
  index: number,
  startUtc: string,
  endUtc: string | null,
  tz: string,
  title: string,
  details: Record<string, string> = {},
  suggested = false,
): ItineraryEntry {
  const time = localTime(startUtc, tz);
  return {
    key: `${kind}:${sourceId}:${index}`,
    kind,
    startUtc,
    endUtc,
    tz,
    localDate: localDate(startUtc, tz),
    localTime: time,
    block: blockOf(time),
    title,
    details,
    sourceId,
    suggested,
    note: null,
    alerts: [],
  };
}

function legEntries(leg: TransportLeg, isFirstOutbound: boolean, isLastReturn: boolean): ItineraryEntry[] {
  const out: ItineraryEntry[] = [];
  const segs = [...leg.segments].sort((a, b) => a.departUtc.localeCompare(b.departUtc));
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (!first || !last) return out;

  const service = [leg.provider, leg.serviceNumber].filter(Boolean).join(" ");
  const advance = leg.advanceMin ?? defaultAdvanceMin(leg.mode, leg.international);
  const transferTo = leg.transferToMin ?? 0;

  if (leg.leg !== "internal") {
    const leaveAt = addMinutes(first.departUtc, -(advance + transferTo));
    if (isFirstOutbound) {
      const leave = entry("leave_home", leg.id, 0, leaveAt, null, first.departTz, "Salir de casa", {
        advanceMin: String(advance),
        transferMin: leg.transferToMin === null ? "" : String(leg.transferToMin),
      }, leg.advanceMin === null);
      if (leg.transferToMin === null) leave.alerts.push("missing_transfer_time");
      out.push(leave);
    }
    if (leg.transferToMin !== null) {
      out.push(
        entry("transfer", leg.id, 0, leaveAt, addMinutes(leaveAt, leg.transferToMin), first.departTz, `Traslado a ${first.from}`, {
          durationMin: String(leg.transferToMin),
        }),
      );
    }
  }

  segs.forEach((s, i) => {
    out.push(
      entry("departure", leg.id, i, s.departUtc, s.arriveUtc, s.departTz, `${service} · ${s.from} → ${s.to}`.trim(), {
        from: s.from,
        to: s.to,
        service,
        durationMin: String(minutesBetween(s.departUtc, s.arriveUtc)),
        advanceMin: String(advance),
      }),
    );
    out.push(entry("arrival", leg.id, i, s.arriveUtc, null, s.arriveTz, `Llegada a ${s.to}`, { to: s.to }));
    const next = segs[i + 1];
    if (next) {
      out.push(
        entry("connection", leg.id, i, s.arriveUtc, next.departUtc, s.arriveTz, `Conexión en ${s.to}`, {
          minutes: String(minutesBetween(s.arriveUtc, next.departUtc)),
          mode: leg.mode,
        }),
      );
    }
  });

  if (leg.leg === "return" && isLastReturn) {
    const homeAt = addMinutes(last.arriveUtc, leg.transferFromMin ?? 0);
    if (leg.transferFromMin !== null) {
      out.push(
        entry("transfer", leg.id, 1, last.arriveUtc, homeAt, last.arriveTz, "Traslado a casa", {
          durationMin: String(leg.transferFromMin),
        }),
      );
    }
    const home = entry("return_home", leg.id, 0, homeAt, null, last.arriveTz, "Llegada a casa");
    if (leg.transferFromMin === null) home.alerts.push("missing_transfer_time");
    out.push(home);
  } else if (leg.transferFromMin !== null) {
    out.push(
      entry(
        "transfer",
        leg.id,
        1,
        last.arriveUtc,
        addMinutes(last.arriveUtc, leg.transferFromMin),
        last.arriveTz,
        leg.leg === "outbound" ? "Traslado al alojamiento" : `Traslado desde ${last.to}`,
        { durationMin: String(leg.transferFromMin) },
      ),
    );
  }
  return out;
}

function activityEntries(activities: ActivityInput[], positions: Map<string, number>): ItineraryEntry[] {
  const out: ItineraryEntry[] = [];
  const byDate = new Map<string, { a: ActivityInput; idx: number }[]>();
  activities.forEach((a, idx) => {
    const list = byDate.get(a.date) ?? [];
    list.push({ a, idx });
    byDate.set(a.date, list);
  });

  for (const list of byDate.values()) {
    list.sort(
      (x, y) =>
        (positions.get(`activity:${x.a.id}:0`) ?? 10_000 + x.idx) - (positions.get(`activity:${y.a.id}:0`) ?? 10_000 + y.idx),
    );
    let cursor: string | null = null;
    for (const { a } of list) {
      const start: string = a.startTime
        ? zonedToUtc(a.date, a.startTime, a.tz)
        : cursor === null
          ? zonedToUtc(a.date, DAY_START, a.tz)
          : addMinutes(cursor, a.travelMinFromPrev ?? 0);
      const end = addMinutes(start, a.durationMin);
      cursor = end;
      out.push(
        entry("activity", a.id, 0, start, end, a.tz, a.name, {
          address: a.address,
          durationMin: String(a.durationMin),
          travelMinFromPrev: a.travelMinFromPrev === null ? "" : String(a.travelMinFromPrev),
          costCents: a.costCents === null ? "" : String(a.costCents),
          requiresBooking: a.requiresBooking ? "true" : "false",
          url: a.url ?? "",
          fixedTime: a.fixedTime ? "true" : "false",
        }),
      );
      if (a.notes) out[out.length - 1]!.details.notes = a.notes;
    }
  }
  return out;
}

export function generateItinerary(input: ItineraryInput): Itinerary {
  const positions = new Map<string, number>();
  const notes = new Map<string, string>();
  for (const o of input.overrides) {
    if (o.position !== null) positions.set(o.entryKey, o.position);
    if (o.note) notes.set(o.entryKey, o.note);
  }

  const firstDepart = (l: TransportLeg) => [...l.segments].map((s) => s.departUtc).sort()[0] ?? "";
  const outbound = input.legs.filter((l) => l.leg === "outbound").sort((a, b) => firstDepart(a).localeCompare(firstDepart(b)));
  const returns = input.legs.filter((l) => l.leg === "return").sort((a, b) => firstDepart(a).localeCompare(firstDepart(b)));

  const entries: ItineraryEntry[] = [];
  for (const leg of input.legs) {
    entries.push(...legEntries(leg, leg === outbound[0], leg === returns[returns.length - 1]));
  }
  for (const l of input.lodgings) {
    entries.push(entry("check_in", l.id, 0, l.checkInUtc, null, l.tz, `Check-in · ${l.name}`, { address: l.address }));
    entries.push(entry("check_out", l.id, 0, l.checkOutUtc, null, l.tz, `Check-out · ${l.name}`, { address: l.address }));
  }
  entries.push(...activityEntries(input.activities, positions));

  for (const e of entries) e.note = notes.get(e.key) ?? null;

  const alerts = detectAlerts(entries, input.lodgings, input.legs);
  for (const a of alerts) {
    for (const k of a.entryKeys) {
      const e = entries.find((x) => x.key === k);
      if (e && !e.alerts.includes(a.code)) e.alerts.push(a.code);
    }
  }

  const days = new Map<string, ItineraryEntry[]>();
  for (const e of [...entries].sort((a, b) => a.startUtc.localeCompare(b.startUtc))) {
    const list = days.get(e.localDate) ?? [];
    list.push(e);
    days.set(e.localDate, list);
  }
  return {
    days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, entries: list })),
    alerts,
  };
}

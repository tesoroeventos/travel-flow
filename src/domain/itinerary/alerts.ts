import { localDate, minutesBetween } from "../time/calendar";
import type { ItineraryAlert, ItineraryEntry, LodgingStay, TransportLeg } from "./types";

const CONNECTION_MIN: Partial<Record<TransportLeg["mode"], number>> = { flight: 60, bus: 15, train: 15 };

export function detectAlerts(entries: ItineraryEntry[], lodgings: LodgingStay[], legs: TransportLeg[]): ItineraryAlert[] {
  const alerts: ItineraryAlert[] = [];

  for (const e of entries) {
    if (e.alerts.includes("missing_transfer_time")) alerts.push({ code: "missing_transfer_time", entryKeys: [e.key] });
  }

  const activities = entries
    .filter((e) => e.kind === "activity" && e.endUtc)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i]!;
      const b = activities[j]!;
      if (b.startUtc < a.endUtc!) alerts.push({ code: "overlap", entryKeys: [a.key, b.key] });
    }
  }

  for (let i = 0; i + 1 < activities.length; i++) {
    const a = activities[i]!;
    const b = activities[i + 1]!;
    if (a.localDate !== b.localDate) continue;
    const gap = minutesBetween(a.endUtc!, b.startUtc);
    const needed = b.details.travelMinFromPrev ? Number(b.details.travelMinFromPrev) : 0;
    if (gap >= 0 && gap < needed) alerts.push({ code: "insufficient_travel_time", entryKeys: [a.key, b.key] });
  }

  for (const leg of legs) {
    const limit = CONNECTION_MIN[leg.mode];
    if (limit === undefined) continue;
    const segs = [...leg.segments].sort((a, b) => a.departUtc.localeCompare(b.departUtc));
    for (let i = 0; i + 1 < segs.length; i++) {
      if (minutesBetween(segs[i]!.arriveUtc, segs[i + 1]!.departUtc) < limit) {
        alerts.push({ code: "tight_connection", entryKeys: [`connection:${leg.id}:${i}`] });
      }
    }
  }

  if (lodgings.length > 0) {
    const first = lodgings.map((l) => localDate(l.checkInUtc, l.tz)).sort()[0]!;
    const last = lodgings.map((l) => localDate(l.checkOutUtc, l.tz)).sort().reverse()[0]!;
    for (const a of activities) {
      if (a.localDate < first || a.localDate > last) alerts.push({ code: "outside_lodging_dates", entryKeys: [a.key] });
    }
  }

  for (const leg of legs.filter((l) => l.leg === "outbound")) {
    const segs = [...leg.segments].sort((a, b) => a.departUtc.localeCompare(b.departUtc));
    const lastIdx = segs.length - 1;
    const arrival = segs[lastIdx];
    if (!arrival) continue;
    const arrivalDate = localDate(arrival.arriveUtc, arrival.arriveTz);
    const lodging = lodgings.find((l) => localDate(l.checkInUtc, l.tz) === arrivalDate);
    if (lodging && arrival.arriveUtc < lodging.checkInUtc) {
      alerts.push({ code: "arrival_before_checkin", entryKeys: [`arrival:${leg.id}:${lastIdx}`] });
    }
  }

  return alerts;
}

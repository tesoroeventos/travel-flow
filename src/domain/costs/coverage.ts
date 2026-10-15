import { addDays, localDate } from "../time/calendar";
import type { Coverage } from "./types";

export interface CoverageArgs {
  tripStartUtc: string;
  tripStartTz: string;
  tripEndUtc: string;
  tripEndTz: string;
  lodgings: { checkInUtc: string; checkOutUtc: string; tz: string }[];
  legs: ("outbound" | "return" | "internal")[];
}

/** Determina si hay ida, vuelta y cuántas noches del viaje no tienen alojamiento. */
export function computeCoverage(args: CoverageArgs): Coverage {
  const start = localDate(args.tripStartUtc, args.tripStartTz);
  const end = localDate(args.tripEndUtc, args.tripEndTz);

  const covered = new Set<string>();
  for (const l of args.lodgings) {
    const inDate = localDate(l.checkInUtc, l.tz);
    const outDate = localDate(l.checkOutUtc, l.tz);
    for (let d = inDate; d < outDate; d = addDays(d, 1)) covered.add(d);
  }

  let uncovered = 0;
  for (let night = start; night < end; night = addDays(night, 1)) {
    if (!covered.has(night)) uncovered++;
  }

  return {
    hasOutbound: args.legs.includes("outbound"),
    hasReturn: args.legs.includes("return"),
    uncoveredNights: uncovered,
  };
}

import { hasKids, type RadarQuery } from "@/domain/radar/query";
import { RADAR_MESSAGES } from "@/integrations/radar/messages";
import { RADAR_GROUPS, RADAR_SITES } from "@/integrations/radar/sites";
import type { ReferenceFare } from "@/integrations/types";

export const KIDS_NOTE = "Sumá los chicos a mano";

export interface SiteButton {
  id: string;
  name: string;
  url: string | null;
  checked: boolean;
  note: string | null;
}

export function siteButtons(
  q: RadarQuery,
  checks: { siteId: string; openedAt: string }[],
): { group: string; label: string; sites: SiteButton[] }[] {
  const opened = new Set(checks.map((c) => c.siteId));
  const kids = hasKids(q);
  return RADAR_GROUPS.map((g) => ({
    group: g.id,
    label: g.label,
    sites: RADAR_SITES.filter((s) => s.group === g.id).map((s) => ({
      id: s.id,
      name: s.name,
      url: s.buildUrl(q),
      checked: opened.has(s.id),
      note: !s.prefills ? RADAR_MESSAGES.no_prefill : kids && !s.supportsChildren ? KIDS_NOTE : null,
    })),
  }));
}

/**
 * Día más barato entre los visibles. Si hay precios de ida y vuelta, compite solo entre ellos:
 * un precio de solo ida no se compara con uno de ida y vuelta.
 */
export function cheapestDay(fares: ReferenceFare[], visibleDays?: string[]): string | null {
  const shown = visibleDays ? fares.filter((f) => visibleDays.includes(f.date)) : fares;
  const round = shown.filter((f) => !f.oneWay);
  const pool = round.length > 0 ? round : shown;
  let best: ReferenceFare | null = null;
  for (const f of pool) if (!best || f.amountCents < best.amountCents) best = f;
  return best?.date ?? null;
}

/** Tarifas en USD se pasan a la moneda del viaje si hay tipo de cambio; si no, quedan en USD. */
export function displayFare(
  fare: ReferenceFare,
  baseCurrency: string,
  usdRate: number | null,
): { amountCents: number; currency: string } {
  if (fare.currency === "USD" && baseCurrency !== "USD" && usdRate) {
    return { amountCents: Math.round(fare.amountCents * usdRate), currency: baseCurrency };
  }
  return { amountCents: fare.amountCents, currency: fare.currency };
}

export function agoText(fetchedAt: string, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - Date.parse(fetchedAt)) / 60_000);
  if (min < 1) return "consultado hace instantes";
  if (min < 60) return `consultado hace ${min} min`;
  return `consultado hace ${Math.floor(min / 60)} h`;
}

/** "Flybondi, 1 escala, solo ida" con lo que se sepa. */
export function fareDetail(f: ReferenceFare): string {
  const parts: string[] = [];
  if (f.airline) parts.push(f.airline);
  if (f.transfers === 0) parts.push("directo");
  else if (f.transfers != null) parts.push(`${f.transfers} ${f.transfers === 1 ? "escala" : "escalas"}`);
  if (f.oneWay) parts.push("solo ida");
  return parts.join(", ");
}

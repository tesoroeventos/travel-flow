import { err } from "@/domain/result";
import type { ReferencePriceProvider } from "../types";
import { fakeReferencePrices } from "./fake";
import { assertRadarConfigSafe } from "./guard";
import { RADAR_MESSAGES } from "./messages";
import { travelpayoutsProvider } from "./travelpayouts";

export { assertRadarConfigSafe } from "./guard";
export { RADAR_MESSAGES, type RadarErrorCode } from "./messages";
export { RADAR_GROUPS, RADAR_SITES, findSite, type RadarSite } from "./sites";

const notConfigured = async () => err("not_configured", RADAR_MESSAGES.not_configured);
const unconfigured: ReferencePriceProvider = { calendar: notConfigured, places: notConfigured };

/** Precios de referencia según el entorno: simulados (RADAR_FAKE=1), Travelpayouts (token) o no configurados. */
export function getReferencePrices(): ReferencePriceProvider {
  assertRadarConfigSafe(process.env);
  if (process.env.RADAR_FAKE === "1") return fakeReferencePrices;
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return unconfigured;
  return travelpayoutsProvider(token);
}

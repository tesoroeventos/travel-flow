import { err } from "@/domain/result";
import { fakeTravelSearch } from "./fake";
import { assertSearchConfigSafe } from "./guard";
import { SEARCH_MESSAGES } from "./messages";
import { serpApiSearch } from "./serpapi";
import type { TravelSearch } from "./types";

export { assertSearchConfigSafe } from "./guard";
export { SEARCH_MESSAGES } from "./messages";
export type * from "./types";

const notConfigured = async () => err("not_configured", SEARCH_MESSAGES.not_configured);
const unconfigured: TravelSearch = { flights: notConfigured, returnFlights: notConfigured, hotels: notConfigured };

/** true si hay con qué buscar (clave real o simulado). */
export function searchConfigured(): boolean {
  return process.env.SEARCH_FAKE === "1" || Boolean(process.env.SERPAPI_KEY);
}

/** Búsqueda según el entorno: simulada (SEARCH_FAKE=1), SerpApi (clave) o no configurada. */
export function getTravelSearch(): TravelSearch {
  assertSearchConfigSafe(process.env);
  if (process.env.SEARCH_FAKE === "1") return fakeTravelSearch;
  const key = process.env.SERPAPI_KEY;
  if (!key) return unconfigured;
  return serpApiSearch(key);
}

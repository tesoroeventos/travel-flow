import { err } from "@/domain/result";
import type { Providers } from "./types";

const notConfigured = async () =>
  err("not_configured", "Integración no configurada: cargá los datos a mano");

/** Implementación por defecto del MVP: sin APIs externas, todo se carga a mano. */
export const manualProviders: Providers = {
  flights: { search: notConfigured },
  lodging: { search: notConfigured },
  rates: { latest: notConfigured },
  routing: { route: notConfigured },
};

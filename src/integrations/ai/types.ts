import type { Result } from "@/domain/result";

export interface TripContext {
  origin: string | null;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  today: string;
}

export type OfferKind =
  | "vuelo"
  | "micro"
  | "tren"
  | "auto_alquiler"
  | "alojamiento"
  | "actividad"
  | "otro";
export type OfferDirection = "ida" | "vuelta" | "ida_y_vuelta";
export type OfferBasis =
  "total" | "por_persona" | "por_noche" | "por_persona_por_noche" | "por_dia";

export interface OfferDraft {
  kind: OfferKind;
  direction: OfferDirection | null;
  name: string;
  company: string;
  from: string;
  to: string;
  /** YYYY-MM-DDTHH:MM o YYYY-MM-DD, hora local */
  depart: string | null;
  arrive: string | null;
  durationMin: number | null;
  stops: number | null;
  price: number | null;
  currency: "ARS" | "USD";
  basis: OfferBasis;
  nights: number | null;
  score: string | null;
  comfort: number;
  detail: string;
  doubtful: string[];
}

export interface TripDraft {
  destination: string | null;
  origin: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number | null;
  budget: number | null;
  currency: "ARS" | "USD";
  doubtful: string[];
}

export interface CarAsk {
  origin: string;
  destination: string;
  model: string | null;
  consumptionLPer100: number | null;
  today: string;
}

export interface CarEstimate {
  km: number;
  hours: number;
  tolls: number;
  consumptionLPer100: number;
  fuelPrice: number;
  route: string;
  doubtful: string[];
}

export type AiErrorCode =
  | "not_configured"
  | "no_offers"
  | "bad_response"
  | "upstream"
  | "limit"
  | "blocked"
  | "bad_input";

export const AI_MESSAGES = {
  not_configured:
    "La lectura automática no está configurada. Cargá la opción a mano.",
  no_offers: "No encontré una opción de viaje en esta captura.",
  bad_response: "No pude entender esta captura. Reintentá o cargala a mano.",
  upstream: "No se pudo leer ahora. Probá de nuevo en un rato.",
  limit:
    "Llegaste al límite de lecturas de hoy. Mañana se renueva; mientras tanto podés cargar a mano.",
  blocked: "Este sitio no deja leer el link. Subí una captura de la página.",
} as const;

export interface TravelAI {
  parseTrip(text: string, today: string): Promise<Result<TripDraft>>;
  readImage(
    image: Buffer,
    mime: string,
    ctx: TripContext,
  ): Promise<Result<OfferDraft[]>>;
  readPage(
    text: string,
    url: string,
    ctx: TripContext,
  ): Promise<Result<OfferDraft[]>>;
  estimateCar(input: CarAsk): Promise<Result<CarEstimate>>;
}

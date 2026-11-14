import type { Result } from "@/domain/result";
import type { Currency } from "@/domain/money/money";
import type { ExchangeRate } from "@/domain/money/rates";
import type { Segment } from "@/domain/itinerary/types";

/**
 * Contratos para integraciones externas (sub-proyecto 5).
 * Toda respuesta trae su fuente y la fecha de consulta; un precio nunca se presenta como confirmado.
 */
export interface ProviderResult<T> {
  data: T;
  source: string;
  fetchedAt: string;
}

export interface PriceQuote {
  amountCents: number;
  currency: Currency;
  includesTaxes: boolean | null;
  conditions: string | null;
  url: string | null;
}

export interface FlightOffer extends PriceQuote {
  provider: string;
  serviceNumber: string | null;
  segments: Segment[];
  baggage: string | null;
}

export interface LodgingOffer extends PriceQuote {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewCount: number | null;
  pricePer: "night" | "stay";
}

export interface FlightSearchProvider {
  search(q: {
    from: string;
    to: string;
    date: string;
    passengers: number;
  }): Promise<Result<ProviderResult<FlightOffer[]>>>;
}

export interface LodgingSearchProvider {
  search(q: {
    destination: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }): Promise<Result<ProviderResult<LodgingOffer[]>>>;
}

export interface ExchangeRateProvider {
  latest(from: Currency, to: Currency): Promise<Result<ProviderResult<ExchangeRate>>>;
}

export interface RoutingProvider {
  route(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    mode: "driving" | "walking" | "transit",
  ): Promise<Result<ProviderResult<{ distanceKm: number; durationMin: number }>>>;
}

export interface Providers {
  flights: FlightSearchProvider;
  lodging: LodgingSearchProvider;
  rates: ExchangeRateProvider;
  routing: RoutingProvider;
}

/** Precio de referencia: visto por otros usuarios en los últimos días, nunca precio final. */
export interface ReferenceFare {
  /** Día de salida, YYYY-MM-DD. */
  date: string;
  amountCents: number;
  currency: Currency;
  airline: string | null;
  transfers: number | null;
  /** Cuándo lo vio el usuario que buscó, si la fuente lo dice. */
  foundAt: string | null;
  /** true si solo hay precio de ida. */
  oneWay: boolean;
}

export interface ReferencePlace {
  code: string;
  name: string;
  kind: "city" | "airport";
}

export interface ReferencePriceProvider {
  /** Un ReferenceFare por día con datos; los días sin datos no aparecen. */
  calendar(q: {
    origin: string;
    destination: string;
    depart: string;
    return: string;
    windowDays: number;
    currency: string;
    today: string;
  }): Promise<Result<ProviderResult<ReferenceFare[]>>>;
  places(term: string): Promise<Result<ProviderResult<ReferencePlace[]>>>;
}

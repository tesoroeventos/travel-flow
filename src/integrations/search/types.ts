import type { Result } from "@/domain/result";

export type SearchCurrency = "ARS" | "USD";

export interface FlightQuery {
  /** Lo que se manda a Google Flights: "EZE,AEP" o "BRC". */
  departureId: string;
  arrivalId: string;
  outboundDate: string;
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
  currency: SearchCurrency;
}

export interface HotelQuery {
  q: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: SearchCurrency;
}

export interface FlightLeg {
  from: string;
  to: string;
  /** "YYYY-MM-DD HH:MM", hora local del aeropuerto. */
  depart: string;
  arrive: string;
  durationMin: number;
  airline: string;
  flightNumber: string;
}

export interface FlightOption {
  legs: FlightLeg[];
  totalMin: number;
  /** Total de ida y vuelta para todos los pasajeros; null si Google no lo muestra. */
  price: number | null;
  departureToken: string | null;
  best: boolean;
}

export interface FlightsResult {
  options: FlightOption[];
}

export interface Property {
  kind: "hotel" | "vacation_rental";
  name: string;
  link: string | null;
  lat: number | null;
  lng: number | null;
  /** Total de la estadía. */
  total: number | null;
  source: string | null;
  rating5: number | null;
  reviews: number | null;
  capacity: number | null;
  hotelClass: number | null;
  amenities: string[];
  info: string[];
  freeCancellation: boolean;
}

export interface HotelsResult {
  properties: Property[];
}

export type SearchErrorCode = "not_configured" | "bad_key" | "no_credits" | "unavailable";

export interface TravelSearch {
  flights(q: FlightQuery): Promise<Result<FlightsResult>>;
  returnFlights(q: FlightQuery, departureToken: string): Promise<Result<FlightsResult>>;
  hotels(q: HotelQuery): Promise<Result<HotelsResult>>;
}

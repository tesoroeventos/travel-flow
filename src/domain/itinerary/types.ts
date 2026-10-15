import type { Block } from "../time/calendar";

export type TransportMode =
  | "flight"
  | "bus"
  | "train"
  | "own_car"
  | "rental_car"
  | "taxi_app"
  | "public_transport"
  | "ferry"
  | "private_transfer"
  | "mixed";

export interface Segment {
  from: string;
  to: string;
  departUtc: string;
  departTz: string;
  arriveUtc: string;
  arriveTz: string;
}

export interface TransportLeg {
  id: string;
  leg: "outbound" | "return" | "internal";
  mode: TransportMode;
  international: boolean;
  provider: string;
  serviceNumber: string | null;
  segments: Segment[];
  /** Minutos de casa/alojamiento hasta la terminal */
  transferToMin: number | null;
  /** Minutos de la terminal de llegada hasta el destino (alojamiento o casa) */
  transferFromMin: number | null;
  /** Anticipación elegida por el usuario; null = sugerida */
  advanceMin: number | null;
}

export interface LodgingStay {
  id: string;
  name: string;
  address: string;
  checkInUtc: string;
  checkOutUtc: string;
  tz: string;
}

export interface ActivityInput {
  id: string;
  name: string;
  address: string;
  /** YYYY-MM-DD local */
  date: string;
  /** HH:mm local, o null */
  startTime: string | null;
  durationMin: number;
  fixedTime: boolean;
  tz: string;
  lat: number | null;
  lng: number | null;
  travelMinFromPrev: number | null;
  costCents: number | null;
  requiresBooking: boolean;
  url: string | null;
  notes: string | null;
}

export interface ItineraryOverride {
  entryKey: string;
  position: number | null;
  note: string | null;
}

export type EntryKind =
  | "leave_home"
  | "transfer"
  | "departure"
  | "arrival"
  | "connection"
  | "check_in"
  | "check_out"
  | "activity"
  | "return_home";

export type AlertCode =
  | "overlap"
  | "insufficient_travel_time"
  | "tight_connection"
  | "outside_lodging_dates"
  | "arrival_before_checkin"
  | "missing_transfer_time";

export const ALERT_LABELS: Record<AlertCode, string> = {
  overlap: "Se superponen",
  insufficient_travel_time: "No alcanza el tiempo de traslado",
  tight_connection: "Conexión ajustada",
  outside_lodging_dates: "Fuera de las fechas de alojamiento",
  arrival_before_checkin: "Llegás antes del check-in",
  missing_transfer_time: "Falta el tiempo de traslado",
};

export interface ItineraryEntry {
  key: string;
  kind: EntryKind;
  startUtc: string;
  endUtc: string | null;
  tz: string;
  localDate: string;
  localTime: string;
  block: Block;
  title: string;
  details: Record<string, string>;
  sourceId: string;
  suggested: boolean;
  note: string | null;
  alerts: AlertCode[];
}

export interface ItineraryAlert {
  code: AlertCode;
  entryKeys: string[];
}

export interface Itinerary {
  days: { date: string; entries: ItineraryEntry[] }[];
  alerts: ItineraryAlert[];
}

export interface ItineraryInput {
  tripTz: string;
  legs: TransportLeg[];
  lodgings: LodgingStay[];
  activities: ActivityInput[];
  overrides: ItineraryOverride[];
}

import { zonedToUtc } from "../time/calendar";
import type { ActivityInput, ItineraryInput, LodgingStay, TransportLeg } from "../itinerary/types";

export const BA = "America/Argentina/Buenos_Aires";
export const at = (d: string, t: string, tz = BA) => zonedToUtc(d, t, tz);

export const outbound = (over: Partial<TransportLeg> = {}): TransportLeg => ({
  id: "out",
  leg: "outbound",
  mode: "flight",
  international: false,
  provider: "Aerolíneas",
  serviceNumber: "AR 1672",
  segments: [{ from: "AEP", to: "BRC", departUtc: at("2027-01-10", "10:00"), departTz: BA, arriveUtc: at("2027-01-10", "12:20"), arriveTz: BA }],
  transferToMin: 45,
  transferFromMin: 30,
  advanceMin: null,
  ...over,
});

export const back = (over: Partial<TransportLeg> = {}): TransportLeg => ({
  id: "back",
  leg: "return",
  mode: "flight",
  international: false,
  provider: "Aerolíneas",
  serviceNumber: "AR 1673",
  segments: [{ from: "BRC", to: "AEP", departUtc: at("2027-01-16", "17:00"), departTz: BA, arriveUtc: at("2027-01-16", "19:10"), arriveTz: BA }],
  transferToMin: 30,
  transferFromMin: 40,
  advanceMin: null,
  ...over,
});

export const hotel = (over: Partial<LodgingStay> = {}): LodgingStay => ({
  id: "hotel",
  name: "Hotel Centro",
  address: "Mitre 100",
  checkInUtc: at("2027-01-10", "15:00"),
  checkOutUtc: at("2027-01-16", "10:00"),
  tz: BA,
  ...over,
});

export const activity = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  id: "act",
  name: "Actividad",
  address: "",
  date: "2027-01-12",
  startTime: null,
  durationMin: 60,
  fixedTime: false,
  tz: BA,
  lat: null,
  lng: null,
  travelMinFromPrev: null,
  costCents: null,
  requiresBooking: false,
  url: null,
  notes: null,
  ...over,
});

export const input = (over: Partial<ItineraryInput> = {}): ItineraryInput => ({
  tripTz: BA,
  legs: [outbound(), back()],
  lodgings: [hotel()],
  activities: [],
  overrides: [],
  ...over,
});


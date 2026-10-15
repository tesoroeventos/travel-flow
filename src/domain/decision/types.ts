export const CRITERIA = [
  "price",
  "travel_time",
  "transfers",
  "location",
  "flexibility",
  "comfort",
  "lodging_quality",
  "experience",
] as const;

export type Criterion = (typeof CRITERIA)[number];

export const HIGHER_IS_BETTER: ReadonlySet<Criterion> = new Set<Criterion>([
  "flexibility",
  "comfort",
  "lodging_quality",
  "experience",
]);

export const CRITERION_LABELS: Record<Criterion, string> = {
  price: "Precio total",
  travel_time: "Tiempo de viaje",
  transfers: "Transbordos",
  location: "Ubicación",
  flexibility: "Flexibilidad",
  comfort: "Comodidad",
  lodging_quality: "Calidad del alojamiento",
  experience: "Experiencia general",
};

export type RatingCriterion = "comfort" | "lodging_quality" | "experience";

export interface ScenarioMetrics {
  scenarioId: string;
  name: string;
  /**
   * price: centavos · travel_time: minutos · transfers: cantidad · location: km
   * flexibility: % (0–100) · comfort/lodging_quality/experience: 1–5
   */
  values: Partial<Record<Criterion, number>>;
}

export interface ScoreResult {
  scores: { scenarioId: string; score: number; perCriterion: Partial<Record<Criterion, number>> }[];
  ties: Criterion[];
  excluded: Criterion[];
  warnings: { code: "criterion_missing_data"; criterion: Criterion }[];
  recommendedId: string | null;
}

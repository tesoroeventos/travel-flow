import { CRITERIA, HIGHER_IS_BETTER, type Criterion, type ScenarioMetrics, type ScoreResult } from "./types";

/** ¿La diferencia entre el mejor y el peor valor es menor al umbral (o nula)? */
export function isTie(best: number, worst: number, thresholdPct: number): boolean {
  if (best === worst) return true;
  if (best === 0) return false;
  return (Math.abs(worst - best) / Math.abs(best)) * 100 < thresholdPct;
}

export function scoreScenarios(
  metrics: ScenarioMetrics[],
  weights: Record<Criterion, number>,
  tieThresholdPct: number,
): ScoreResult {
  const ties: Criterion[] = [];
  const excluded: Criterion[] = [];
  const warnings: ScoreResult["warnings"] = [];
  const per = metrics.map(() => ({}) as Partial<Record<Criterion, number>>);
  let weightSum = 0;

  for (const c of CRITERIA) {
    const weight = weights[c] ?? 0;
    if (weight <= 0 || metrics.length === 0) continue;
    const values = metrics.map((m) => m.values[c]);
    if (values.some((v) => v === undefined || Number.isNaN(v))) {
      excluded.push(c);
      warnings.push({ code: "criterion_missing_data", criterion: c });
      continue;
    }
    const nums = values as number[];
    const higher = HIGHER_IS_BETTER.has(c);
    const best = higher ? Math.max(...nums) : Math.min(...nums);
    const worst = higher ? Math.min(...nums) : Math.max(...nums);
    weightSum += weight;

    if (isTie(best, worst, tieThresholdPct)) {
      ties.push(c);
      per.forEach((p) => (p[c] = 1));
      continue;
    }
    nums.forEach((v, i) => {
      per[i]![c] = Math.abs(v - worst) / Math.abs(best - worst);
    });
  }

  const scores = metrics.map((m, i) => {
    const perCriterion = per[i]!;
    const weighted = Object.entries(perCriterion).reduce((sum, [c, v]) => sum + v * (weights[c as Criterion] ?? 0), 0);
    return { scenarioId: m.scenarioId, score: weightSum > 0 ? weighted / weightSum : 0, perCriterion };
  });

  let recommendedId: string | null = null;
  if (weightSum > 0 && scores.length > 0) {
    const top = Math.max(...scores.map((s) => s.score));
    const leaders = scores.filter((s) => Math.abs(s.score - top) < 1e-9);
    if (leaders.length === 1) recommendedId = leaders[0]!.scenarioId;
  }

  return { scores, ties, excluded, warnings, recommendedId };
}

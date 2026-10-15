import { CRITERION_LABELS, type ScenarioMetrics, type ScoreResult } from "./types";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Explicación determinística, basada solo en diferencias reales entre escenarios. */
export function explainScores(metrics: ScenarioMetrics[], result: ScoreResult, referenceId: string): string[] {
  const lines: string[] = [];
  const byId = new Map(metrics.map((m) => [m.scenarioId, m]));
  const ref = byId.get(referenceId);

  if (result.recommendedId) {
    lines.push(`Con tus prioridades, conviene ${byId.get(result.recommendedId)?.name ?? result.recommendedId}.`);
  }

  const priceUsed = !result.excluded.includes("price") && !result.ties.includes("price");
  const timeUsed = !result.excluded.includes("travel_time") && !result.ties.includes("travel_time");

  if (ref) {
    for (const m of metrics) {
      if (m.scenarioId === referenceId) continue;
      const parts: { price?: { pct: number; cheaper: boolean }; time?: { hours: number; slower: boolean } } = {};

      const rp = ref.values.price;
      const mp = m.values.price;
      if (priceUsed && rp !== undefined && mp !== undefined && rp > 0 && mp !== rp) {
        parts.price = { pct: Math.round((Math.abs(rp - mp) / rp) * 100), cheaper: mp < rp };
      }
      const rt = ref.values.travel_time;
      const mt = m.values.travel_time;
      if (timeUsed && rt !== undefined && mt !== undefined && Math.abs(mt - rt) >= 30) {
        parts.time = { hours: Math.round(Math.abs(mt - rt) / 60), slower: mt > rt };
      }

      if (parts.price) {
        let s = `${m.name} cuesta ${parts.price.pct} % ${parts.price.cheaper ? "menos" : "más"} que ${ref.name}`;
        if (parts.time) {
          const tradeOff = parts.price.cheaper === parts.time.slower;
          s += `, ${tradeOff ? "pero" : "y"} ${parts.time.slower ? "suma" : "ahorra"} unas ${parts.time.hours} h de viaje`;
        }
        lines.push(`${s}.`);
      } else if (parts.time) {
        lines.push(
          `${m.name} ${parts.time.slower ? "suma" : "ahorra"} unas ${parts.time.hours} h de viaje respecto de ${ref.name}.`,
        );
      }
    }
  }

  const names = joinNames(metrics.map((m) => m.name));
  for (const c of result.ties) {
    if (metrics.length > 1) lines.push(`En ${lower(CRITERION_LABELS[c])}, ${names} empatan.`);
  }
  for (const c of result.excluded) {
    lines.push(`No se consideró ${lower(CRITERION_LABELS[c])} porque falta el dato en algún escenario.`);
  }
  return lines;
}

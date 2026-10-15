import type { Db } from "../db/client";
import type { Ctx } from "../context";
import { budgetCsv } from "../export/csv";
import { itineraryIcs } from "../export/ics";
import { loadTrip } from "./load-trip";
import { analyzeLoaded, itineraryFromLoaded, toCostInput } from "./trip-analysis";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "viaje";

/** CSV del escenario pedido, o del elegido, o del más económico. */
export async function exportBudgetCsv(db: Db, ctx: Ctx, tripId: string, scenarioId?: string | null) {
  const data = await loadTrip(db, ctx, tripId);
  const a = analyzeLoaded(data);
  const pick =
    a.scenarios.find((s) => s.id === scenarioId) ??
    a.scenarios.find((s) => s.id === data.trip.chosenScenarioId) ??
    [...a.scenarios].sort((x, y) => x.summary.totalWithContingencyCents - y.summary.totalWithContingencyCents)[0];
  if (!pick) return null;
  const items = data.costItems
    .filter((i) => pick.itemIds.includes(i.id))
    .map((i) => ({ ...toCostInput(data, i), source: i.isDemo ? "Dato de demostración" : i.source }));
  return {
    filename: `presupuesto-${slug(data.trip.name)}-${slug(pick.name)}.csv`,
    body: budgetCsv({ name: pick.name, summary: pick.summary, baseCurrency: data.trip.baseCurrency }, items),
  };
}

export async function exportItineraryIcs(db: Db, ctx: Ctx, tripId: string) {
  const data = await loadTrip(db, ctx, tripId);
  const it = itineraryFromLoaded(data);
  if (!it) return null;
  return { filename: `itinerario-${slug(data.trip.name)}.ics`, body: itineraryIcs(it, data.trip.name) };
}

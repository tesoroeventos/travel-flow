"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COST_CATEGORIES } from "@/domain/costs/types";
import { CRITERIA, type Criterion, type RatingCriterion } from "@/domain/decision/types";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { makeRepos } from "../repos";
import { makeScenarioParts, type SelectionOwnerType } from "../repos/scenario-parts";
import { createScenario, deleteScenario, duplicateScenario, saveDecisionSettings } from "../services/scenarios";
import { positiveDecimal } from "../validation/common";
import { formObject, invalid, type FormState } from "./form";

const refresh = (tripId: string) => revalidatePath(`/viajes/${tripId}`, "layout");

export async function createScenarioAction(tripId: string, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await createScenario(await getDb(), ctx, tripId, String(fd.get("name") ?? ""));
  refresh(tripId);
  return { ok: true };
}

export async function renameScenarioAction(tripId: string, scenarioId: string, fd: FormData): Promise<void> {
  const ctx = await requireCtx();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  await makeRepos(await getDb()).scenarios.update(ctx, scenarioId, { name });
  refresh(tripId);
}

export async function duplicateScenarioAction(tripId: string, scenarioId: string, name: string): Promise<void> {
  const ctx = await requireCtx();
  await duplicateScenario(await getDb(), ctx, scenarioId, `${name} (copia)`);
  refresh(tripId);
}

export async function deleteScenarioAction(tripId: string, scenarioId: string): Promise<void> {
  const ctx = await requireCtx();
  await deleteScenario(await getDb(), ctx, scenarioId);
  refresh(tripId);
}

export async function setSelectionAction(tripId: string, scenarioId: string, ownerType: SelectionOwnerType, ownerId: string, selected: boolean): Promise<void> {
  const ctx = await requireCtx();
  await makeScenarioParts(await getDb()).setSelection(ctx, scenarioId, ownerType, ownerId, selected);
  refresh(tripId);
}

export async function setToggleAction(tripId: string, scenarioId: string, costItemId: string, included: boolean): Promise<void> {
  const ctx = await requireCtx();
  await makeScenarioParts(await getDb()).setToggle(ctx, scenarioId, costItemId, included);
  refresh(tripId);
}

export async function setRatingAction(tripId: string, scenarioId: string, criterion: RatingCriterion, value: number | null): Promise<void> {
  const ctx = await requireCtx();
  const v = value === null || (value >= 1 && value <= 5) ? value : null;
  await makeScenarioParts(await getDb()).setRating(ctx, scenarioId, criterion, v);
  refresh(tripId);
}

const weight = z.coerce.number().int("Usá números enteros").min(0, "De 0 a 10").max(10, "De 0 a 10");
const settingsSchema = z.object({
  ...(Object.fromEntries(CRITERIA.map((c) => [`w_${c}`, weight])) as Record<`w_${Criterion}`, typeof weight>),
  tieThresholdPct: positiveDecimal("Ingresá un porcentaje mayor a 0"),
  contingencyPct: z
    .string()
    .trim()
    .transform((v, c) => {
      const n = Number(v.replace(",", "."));
      if (Number.isNaN(n) || n < 0 || n > 100) {
        c.addIssue({ code: "custom", message: "Entre 0 y 100" });
        return z.NEVER;
      }
      return String(n);
    }),
  contingencyCategories: z.array(z.enum(COST_CATEGORIES)).default([]),
  referenceScenarioId: z
    .union([z.literal(""), z.uuid("Escenario inválido")])
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function saveSettingsAction(tripId: string, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = settingsSchema.safeParse(formObject(fd, ["contingencyCategories"]));
  if (!parsed.success) return invalid(parsed.error, fd);
  const d = parsed.data;
  const weights = Object.fromEntries(CRITERIA.map((c) => [c, d[`w_${c}`]])) as Record<Criterion, number>;
  await saveDecisionSettings(await getDb(), ctx, tripId, {
    weights,
    tieThresholdPct: d.tieThresholdPct,
    contingencyPct: d.contingencyPct,
    contingencyCategories: d.contingencyCategories,
    referenceScenarioId: d.referenceScenarioId,
  });
  refresh(tripId);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { makeRepos } from "../repos";
import { expenseSchema } from "../validation/expense";
import { exchangeRateSchema } from "../validation/rate";
import { formObject, invalid, type FormState } from "./form";

export async function saveExpenseAction(tripId: string, expenseId: string | null, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = expenseSchema.safeParse(formObject(fd, ["participantIds"]));
  if (!parsed.success) return invalid(parsed.error, fd);
  const r = makeRepos(await getDb());
  if (expenseId) await r.expenses.update(ctx, expenseId, parsed.data);
  else await r.expenses.create(ctx, { ...parsed.data, tripId });
  revalidatePath(`/viajes/${tripId}`, "layout");
  return { ok: true };
}

export async function deleteExpenseAction(tripId: string, expenseId: string): Promise<void> {
  const ctx = await requireCtx();
  await makeRepos(await getDb()).expenses.remove(ctx, expenseId);
  revalidatePath(`/viajes/${tripId}`, "layout");
}

export async function saveRateAction(_p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = exchangeRateSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  await makeRepos(await getDb()).rates.create(ctx, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRateAction(rateId: string): Promise<void> {
  const ctx = await requireCtx();
  await makeRepos(await getDb()).rates.remove(ctx, rateId);
  revalidatePath("/", "layout");
}

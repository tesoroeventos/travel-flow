"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CostCategory } from "@/domain/costs/types";
import { carCostItems } from "@/domain/costs/car";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import { makeRepos } from "../repos";
import { deleteCostItem, deleteOption, updateCostItem } from "../services/options";
import { activitySchema, costItemSchema, lodgingOptionSchema, transportOptionSchema } from "../validation/options";
import { amountField, currencyField, positiveDecimal } from "../validation/common";
import { formObject, formValues, invalid, zodErrors, type FormState } from "./form";
import { segmentsFromForm } from "./segments";

type OwnerType = "transport_option" | "lodging_option" | "activity";

const refresh = (tripId: string) => revalidatePath(`/viajes/${tripId}`, "layout");

const quickPriceSchema = z.object({
  price: z.string().optional(),
  priceCurrency: currencyField.optional(),
  priceUnit: z.enum(["total", "per_person", "per_night", "per_person_night", "per_day"]).default("total"),
  priceTaxes: z.enum(["yes", "no", "unknown"]).default("yes"),
});

/** Si el formulario trae un precio rápido, crea la partida principal de la alternativa. */
async function createQuickPrice(
  fd: FormData,
  ctx: Awaited<ReturnType<typeof requireCtx>>,
  tripId: string,
  ownerType: OwnerType,
  ownerId: string,
  label: string,
  category: CostCategory,
  baseCurrency: string,
): Promise<string | null> {
  const raw = quickPriceSchema.safeParse(formObject(fd));
  if (!raw.success || !raw.data.price?.trim()) return null;
  const amount = amountField.safeParse(raw.data.price);
  if (!amount.success) return amount.error.issues[0]?.message ?? "Importe inválido";
  await makeRepos(await getDb()).costItems.create(ctx, {
    tripId,
    ownerType,
    ownerId,
    label,
    amountCents: amount.data,
    currency: raw.data.priceCurrency ?? baseCurrency,
    unit: raw.data.priceUnit,
    includesTaxes: raw.data.priceTaxes === "yes" ? true : raw.data.priceTaxes === "no" ? false : null,
    category,
    source: "Carga manual",
    consultedAt: new Date().toISOString().slice(0, 10),
  });
  return null;
}

function priceError(fd: FormData): FormState | null {
  const price = String(fd.get("price") ?? "").trim();
  if (!price) return null;
  const r = amountField.safeParse(price);
  return r.success ? null : { ok: false, message: "Revisá los campos marcados", fieldErrors: { price: r.error.issues[0]!.message }, values: formValues(fd) };
}

/* ───────── Transporte ───────── */

function transportInput(tripId: string, fd: FormData) {
  const obj = formObject(fd);
  return transportOptionSchema.safeParse({ ...obj, tripId, segments: segmentsFromForm(obj) });
}

export async function saveTransportAction(tripId: string, optionId: string | null, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = transportInput(tripId, fd);
  if (!parsed.success) {
    const errs = zodErrors(parsed.error);
    // Errores de tramos → mostrarlos en el primer campo de horario
    for (const k of Object.keys(errs)) if (k.startsWith("segments.")) errs.seg_arriveDate_0 ??= errs[k]!;
    return { ok: false, message: "Revisá los campos marcados", fieldErrors: errs, values: formValues(fd) };
  }
  const pe = priceError(fd);
  if (pe) return pe;
  const db = await getDb();
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  if (optionId) {
    await r.transport.update(ctx, optionId, parsed.data);
  } else {
    const opt = await r.transport.create(ctx, parsed.data);
    const category = `transport_${parsed.data.leg}` as CostCategory;
    await createQuickPrice(fd, ctx, tripId, "transport_option", opt.id, "Pasaje", category, trip.baseCurrency);
  }
  refresh(tripId);
  return { ok: true };
}

/* ───────── Alojamiento ───────── */

export async function saveLodgingAction(tripId: string, optionId: string | null, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = lodgingOptionSchema.safeParse({ ...formObject(fd, ["amenities"]), tripId });
  if (!parsed.success) return invalid(parsed.error, fd);
  const pe = priceError(fd);
  if (pe) return pe;
  const db = await getDb();
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  if (optionId) {
    await r.lodging.update(ctx, optionId, parsed.data);
  } else {
    const opt = await r.lodging.create(ctx, parsed.data);
    await createQuickPrice(fd, ctx, tripId, "lodging_option", opt.id, "Estadía", "lodging", trip.baseCurrency);
  }
  refresh(tripId);
  return { ok: true };
}

/* ───────── Actividades ───────── */

export async function saveActivityAction(tripId: string, optionId: string | null, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = activitySchema.safeParse({ ...formObject(fd), tripId });
  if (!parsed.success) return invalid(parsed.error, fd);
  const pe = priceError(fd);
  if (pe) return pe;
  const db = await getDb();
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  if (optionId) {
    await r.activities.update(ctx, optionId, parsed.data);
  } else {
    const opt = await r.activities.create(ctx, parsed.data);
    await createQuickPrice(fd, ctx, tripId, "activity", opt.id, "Entrada", "activities", trip.baseCurrency);
  }
  refresh(tripId);
  return { ok: true };
}

export async function deleteOptionAction(tripId: string, ownerType: OwnerType, id: string): Promise<void> {
  const ctx = await requireCtx();
  await deleteOption(await getDb(), ctx, ownerType, id);
  refresh(tripId);
}

/* ───────── Partidas ───────── */

export async function saveCostItemAction(
  tripId: string,
  owner: { ownerType: OwnerType | "scenario"; ownerId: string } | null,
  itemId: string | null,
  _p: FormState,
  fd: FormData,
): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = costItemSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  const db = await getDb();
  if (itemId) {
    await updateCostItem(db, ctx, itemId, parsed.data);
  } else if (owner) {
    await makeRepos(db).costItems.create(ctx, { ...parsed.data, tripId, ...owner });
  }
  refresh(tripId);
  return { ok: true };
}

export async function deleteCostItemAction(tripId: string, itemId: string): Promise<void> {
  const ctx = await requireCtx();
  await deleteCostItem(await getDb(), ctx, itemId);
  refresh(tripId);
}

/* ───────── Calculadora de auto ───────── */

const optionalAmount = z
  .string()
  .optional()
  .transform((v, c) => {
    if (!v || !v.trim()) return 0;
    const r = amountField.safeParse(v);
    if (!r.success) {
      c.addIssue({ code: "custom", message: r.error.issues[0]!.message });
      return z.NEVER;
    }
    return r.data;
  });

const carSchema = z.object({
  km: positiveDecimal("Ingresá los kilómetros totales"),
  consumptionLPer100: positiveDecimal("Ingresá el consumo"),
  fuelPrice: amountField,
  tolls: optionalAmount,
  parking: optionalAmount,
  rental: optionalAmount,
  insurance: optionalAmount,
  deposit: optionalAmount,
  extraKm: z.string().optional(),
  extraKmPrice: optionalAmount,
  dropOff: optionalAmount,
  wearPerKm: optionalAmount,
});

export async function carCalculatorAction(tripId: string, optionId: string, _p: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const parsed = carSchema.safeParse(formObject(fd));
  if (!parsed.success) return invalid(parsed.error, fd);
  const db = await getDb();
  const r = makeRepos(db);
  const [trip, opt] = await Promise.all([r.trips.require(ctx, tripId), r.transport.require(ctx, optionId)]);
  if (opt.tripId !== trip.id) return { ok: false, message: "La alternativa no pertenece a este viaje" };
  const d = parsed.data;
  const extraKm = d.extraKm?.trim() ? d.extraKm.replace(/\./g, "").replace(",", ".") : "0";
  const items = carCostItems({
    km: d.km,
    consumptionLPer100: d.consumptionLPer100,
    fuelPriceCents: d.fuelPrice,
    currency: trip.baseCurrency,
    tollsCents: d.tolls,
    parkingCents: d.parking,
    rentalCents: d.rental,
    insuranceCents: d.insurance,
    depositCents: d.deposit,
    extraKm,
    extraKmPriceCents: d.extraKmPrice,
    dropOffCents: d.dropOff,
    wearPerKmCents: d.wearPerKm > 0 ? d.wearPerKm : null,
    leg: opt.leg,
  });
  for (const { nights: _n, paymentStatus: _p2, ...item } of items) {
    void _n;
    void _p2;
    await r.costItems.create(ctx, {
      ...item,
      tripId,
      ownerType: "transport_option",
      ownerId: optionId,
      source: "Calculadora de auto",
      consultedAt: new Date().toISOString().slice(0, 10),
    });
  }
  refresh(tripId);
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import {
  getAI,
  AI_MESSAGES,
  type OfferDraft,
  type TripDraft,
} from "@/integrations/ai";
import { toNumber } from "@/integrations/ai/schemas";
import { fetchPage } from "@/integrations/fetch-page";
import { htmlToText } from "@/integrations/html-text";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { consumeAiQuota } from "../services/ai-quota";
import { loadTrip } from "../services/load-trip";
import { deleteOption } from "../services/options";
import {
  saveCarOffer,
  saveOffers,
  setInProposals,
  setUsdRate,
  updateOffer,
  type OfferEdit,
  type OfferOwner,
  type SavedOffer,
} from "../services/offers";
import { chooseProposal } from "../services/proposals";
import {
  createQuickTrip,
  quickTripSchema,
  tripContext,
  updateQuickTrip,
} from "../services/quick-trip";
import { formValues, zodErrors, type FormState } from "./form";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_PAGE_TEXT = 200;
const today = () => new Date().toISOString().slice(0, 10);
const refresh = (tripId: string) =>
  revalidatePath(`/viajes/${tripId}`, "layout");

const refSchema = z.object({
  ownerType: z.enum(["transport_option", "lodging_option", "activity"]),
  id: z.uuid(),
});
const uuid = z.uuid();

async function ownTrip(ctx: Ctx, tripId: string) {
  if (!uuid.safeParse(tripId).success) throw new Error("Viaje inválido");
  const db = await getDb();
  await makeRepos(db).trips.require(ctx, tripId);
  return db;
}

async function ownRef(ctx: Ctx, tripId: string, rawRef: unknown) {
  const db = await ownTrip(ctx, tripId);
  const ref = refSchema.parse(rawRef);
  const r = makeRepos(db);
  const repo =
    ref.ownerType === "transport_option"
      ? r.transport
      : ref.ownerType === "lodging_option"
        ? r.lodging
        : r.activities;
  const row = await repo.require(ctx, ref.id);
  if (row.tripId !== tripId) throw new Error("La opción no es de este viaje");
  return { db, ref };
}

async function quota(ctx: Ctx): Promise<Result<unknown>> {
  return consumeAiQuota(await getDb(), ctx.userId, today());
}

/* ───────── viaje ───────── */

export async function parseTripAction(
  text: string,
): Promise<Result<TripDraft>> {
  const ctx = await requireCtx();
  const clean = String(text ?? "")
    .trim()
    .slice(0, 1500);
  if (!clean)
    return err(
      "bad_input",
      "Escribí a dónde vas y cuándo, o usá el formulario.",
    );
  const q = await quota(ctx);
  if (!q.ok) return q;
  return getAI().parseTrip(clean, today());
}

export async function saveQuickTripAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const ctx = await requireCtx();
  const values = formValues(fd);
  const parsed = quickTripSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisá los campos marcados",
      fieldErrors: zodErrors(parsed.error),
      values,
    };
  const db = await getDb();
  const tripId = values.tripId;
  let id: string;
  if (tripId) {
    await ownTrip(ctx, tripId);
    id = (await updateQuickTrip(db, ctx, tripId, parsed.data)).id;
    refresh(id);
  } else id = (await createQuickTrip(db, ctx, parsed.data)).id;
  redirect(`/viajes/${id}/opciones`);
}

/* ───────── cargar opciones ───────── */

export async function readImageAction(
  tripId: string,
  fd: FormData,
): Promise<Result<SavedOffer[]>> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const file = fd.get("image");
  if (!(file instanceof File))
    return err("bad_input", "No llegó la imagen. Probá de nuevo.");
  if (!IMAGE_TYPES.includes(file.type))
    return err("bad_input", "Subí una imagen JPG, PNG, WebP o GIF.");
  if (file.size > MAX_IMAGE_BYTES)
    return err(
      "bad_input",
      "La imagen pesa más de 8 MB. Probá con una captura más chica.",
    );
  const q = await quota(ctx);
  if (!q.ok) return q;
  const data = await loadTrip(db, ctx, tripId);
  const name = (fd.get("name") ?? file.name ?? "")
    .toString()
    .replace(/[;\n]/g, " ")
    .slice(0, 80);
  const r = await getAI().readImage(
    Buffer.from(await file.arrayBuffer()),
    `${file.type};name=${name}`,
    tripContext(data, today()),
  );
  if (!r.ok) return r;
  const saved = await saveOffers(db, ctx, tripId, r.data, { kind: "captura" });
  refresh(tripId);
  return ok(saved);
}

export async function readLinkAction(
  tripId: string,
  url: string,
): Promise<Result<SavedOffer[]>> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const page = await fetchPage(String(url ?? "").slice(0, 2000));
  if (!page.ok) return page;
  const text = htmlToText(page.data.html);
  if (text.replace(/\s/g, "").length < MIN_PAGE_TEXT)
    return err("blocked", AI_MESSAGES.blocked);
  const q = await quota(ctx);
  if (!q.ok) return q;
  const data = await loadTrip(db, ctx, tripId);
  const r = await getAI().readPage(
    text,
    page.data.finalUrl,
    tripContext(data, today()),
  );
  if (!r.ok) return r;
  const saved = await saveOffers(db, ctx, tripId, r.data, {
    kind: "link",
    url: page.data.finalUrl,
  });
  refresh(tripId);
  return ok(saved);
}

export async function carAction(
  tripId: string,
  model: string | null,
  consumption: string | null,
): Promise<Result<SavedOffer[]>> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const data = await loadTrip(db, ctx, tripId);
  const c = tripContext(data, today());
  if (!c.origin)
    return err(
      "bad_input",
      "Falta desde dónde salís. Completalo en los datos del viaje.",
    );
  const m = (model ?? "").trim().slice(0, 60) || null;
  const cons = toNumber(consumption ?? null);
  if (!m && !cons)
    return err("bad_input", "Poné el modelo del auto o cuánto consume.");
  const q = await quota(ctx);
  if (!q.ok) return q;
  const r = await getAI().estimateCar({
    origin: c.origin,
    destination: c.destination,
    model: m,
    consumptionLPer100: cons && cons > 0 && cons < 40 ? cons : null,
    today: c.today,
  });
  if (!r.ok) return r;
  const saved = await saveCarOffer(db, ctx, tripId, r.data, m);
  refresh(tripId);
  return ok(saved);
}

const MANUAL_KINDS = [
  "vuelo",
  "micro",
  "tren",
  "auto_alquiler",
  "alojamiento",
  "actividad",
  "otro",
] as const;

export async function manualOfferAction(
  tripId: string,
  kind: string,
): Promise<SavedOffer> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const k = z.enum(MANUAL_KINDS).catch("vuelo").parse(kind);
  const isT = k === "vuelo" || k === "micro" || k === "tren";
  const draft: OfferDraft = {
    kind: k,
    direction: isT ? "ida" : null,
    name: "",
    company: "",
    from: "",
    to: "",
    depart: null,
    arrive: null,
    durationMin: null,
    stops: null,
    price: null,
    currency: "ARS",
    basis: k === "alojamiento" ? "por_noche" : "total",
    nights: null,
    score: null,
    comfort: 3,
    detail: "",
    doubtful: [],
  };
  const [saved] = await saveOffers(db, ctx, tripId, [draft], {
    kind: "manual",
  });
  refresh(tripId);
  return saved!;
}

const localDT = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
  .nullable();
const editSchema = z
  .object({
    kind: z.enum(MANUAL_KINDS),
    direction: z.enum(["ida", "vuelta", "ida_y_vuelta"]).nullable(),
    name: z.string().trim().max(90),
    company: z.string().trim().max(60),
    from: z.string().trim().max(60),
    to: z.string().trim().max(60),
    depart: localDT,
    arrive: localDT,
    durationMin: z.number().int().min(1).max(10_080).nullable(),
    price: z.number().min(0).max(1e12).nullable(),
    currency: z.enum(["ARS", "USD"]),
    basis: z.enum([
      "total",
      "por_persona",
      "por_noche",
      "por_persona_por_noche",
      "por_dia",
    ]),
    score: z.string().trim().max(30).nullable(),
    comfort: z.number().int().min(1).max(5),
    detail: z.string().trim().max(160),
    car: z.object({
      km: z.number().positive().max(20_000),
      hours: z.number().positive().max(200),
      consumptionLPer100: z.number().positive().max(40),
      fuelPrice: z.number().positive().max(1e7),
      tolls: z.number().min(0).max(1e8),
    }),
  })
  .partial();

export async function updateOfferAction(
  tripId: string,
  ref: { ownerType: OfferOwner; id: string },
  edit: OfferEdit,
): Promise<Result<void>> {
  const ctx = await requireCtx();
  const own = await ownRef(ctx, tripId, ref);
  const parsed = editSchema.safeParse(edit);
  if (!parsed.success)
    return err("bad_input", "Revisá los datos: hay un valor fuera de rango.");
  await updateOffer(own.db, ctx, own.ref, parsed.data as OfferEdit);
  refresh(tripId);
  return ok(undefined);
}

export async function deleteOfferAction(
  tripId: string,
  ref: { ownerType: OfferOwner; id: string },
): Promise<void> {
  const ctx = await requireCtx();
  const own = await ownRef(ctx, tripId, ref);
  await deleteOption(own.db, ctx, own.ref.ownerType, own.ref.id);
  refresh(tripId);
}

export async function inProposalsAction(
  tripId: string,
  ref: { ownerType: "transport_option" | "activity"; id: string },
  value: boolean,
): Promise<void> {
  const ctx = await requireCtx();
  const own = await ownRef(ctx, tripId, ref);
  if (own.ref.ownerType === "lodging_option") return;
  await setInProposals(
    own.db,
    ctx,
    { ownerType: own.ref.ownerType, id: own.ref.id },
    Boolean(value),
  );
  refresh(tripId);
}

export async function usdRateAction(
  tripId: string,
  value: string,
): Promise<Result<void>> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const n = toNumber(value);
  if (n === null || n <= 0 || n > 1e7)
    return err(
      "bad_input",
      "Poné cuántos pesos vale un dólar, por ejemplo 1.200.",
    );
  await setUsdRate(db, ctx, tripId, n, today());
  refresh(tripId);
  return ok(undefined);
}

export async function chooseProposalAction(
  tripId: string,
  p: { legIds: string[]; lodgingId: string; name: string },
): Promise<void> {
  const ctx = await requireCtx();
  const db = await ownTrip(ctx, tripId);
  const parsed = z
    .object({
      legIds: z.array(z.uuid()).min(1).max(4),
      lodgingId: z.uuid(),
      name: z.string().trim().min(1).max(40),
    })
    .parse(p);
  await chooseProposal(db, ctx, tripId, parsed);
  refresh(tripId);
  redirect(`/viajes/${tripId}/confirmar`);
}

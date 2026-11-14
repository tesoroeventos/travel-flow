"use server";

import { revalidatePath } from "next/cache";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import { buildRadarQuery, shiftDeparture } from "@/domain/radar/query";
import { RADAR_MESSAGES, findSite, getReferencePrices } from "@/integrations/radar";
import type { ReferencePlace } from "@/integrations/types";
import { getDb } from "../db";
import { requireCtx } from "../auth/session";
import type { Ctx } from "../context";
import { makeRepos } from "../repos";
import { getCalendar, type CalendarResult } from "../services/reference-prices";

const uuid = z.uuid();
const iata = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);
const day = z.iso.date();

async function ownTrip(ctx: Ctx, tripId: string) {
  if (!uuid.safeParse(tripId).success) throw new Error("Viaje inválido");
  const db = await getDb();
  const r = makeRepos(db);
  const trip = await r.trips.require(ctx, tripId);
  return { db, r, trip };
}

export async function markSiteOpened(tripId: string, siteId: string): Promise<Result<{ openedAt: string }>> {
  const ctx = await requireCtx();
  if (!findSite(String(siteId))) return err("bad_input", "Sitio desconocido");
  const { r } = await ownTrip(ctx, tripId);
  const at = new Date();
  await r.radar.markOpened(ctx, tripId, siteId, at);
  return ok({ openedAt: at.toISOString() });
}

export async function resetRadarChecks(tripId: string): Promise<Result<null>> {
  const ctx = await requireCtx();
  const { r } = await ownTrip(ctx, tripId);
  await r.radar.reset(ctx, tripId);
  return ok(null);
}

export async function saveAirports(tripId: string, originIata: string, destinationIata: string): Promise<Result<null>> {
  const ctx = await requireCtx();
  const o = iata.safeParse(originIata);
  const d = iata.safeParse(destinationIata);
  if (!o.success || !d.success) return err("bad_input", "Usá códigos de 3 letras, por ejemplo BUE o BRC.");
  const { r } = await ownTrip(ctx, tripId);
  await r.trips.update(ctx, tripId, { originIata: o.data, destinationIata: d.data });
  revalidatePath(`/viajes/${tripId}`, "layout");
  return ok(null);
}

export async function suggestPlaces(term: string): Promise<Result<ReferencePlace[]>> {
  await requireCtx();
  const t = String(term ?? "").trim();
  if (t.length < 2 || t.length > 60) return ok([]);
  const res = await getReferencePrices().places(t);
  return res.ok ? ok(res.data.data) : res;
}

export async function loadCalendar(tripId: string, depart?: string): Promise<Result<CalendarResult>> {
  const ctx = await requireCtx();
  const { db, r, trip } = await ownTrip(ctx, tripId);
  if (!trip.originIata || !trip.destinationIata) return err("no_airports", RADAR_MESSAGES.no_airports);
  let q = buildRadarQuery(trip, await r.travelers.list(ctx, tripId));
  if (depart !== undefined) {
    if (!day.safeParse(depart).success) return err("bad_input", "Fecha inválida");
    q = shiftDeparture(q, depart);
  }
  return getCalendar(db, getReferencePrices(), {
    origin: trip.originIata,
    destination: trip.destinationIata,
    depart: q.depart,
    return: q.return,
    currency: trip.baseCurrency,
    today: formatInTimeZone(new Date(), trip.startTz, "yyyy-MM-dd"),
  });
}

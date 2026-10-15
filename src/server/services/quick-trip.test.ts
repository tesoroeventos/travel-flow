import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeCtx } from "./demo-data";
import { loadTrip } from "./load-trip";
import {
  createQuickTrip,
  quickTripSchema,
  toTripForm,
  tripContext,
  updateQuickTrip,
} from "./quick-trip";

const base = {
  destination: "Bariloche",
  origin: "Zárate",
  startDate: "2027-01-10",
  endDate: "2027-01-16",
  travelers: "2",
  budget: "1.500.000",
  currency: "ARS",
};

describe("viaje rápido", () => {
  it("rechaza la vuelta antes de la ida", () => {
    const r = quickTripSchema.safeParse({ ...base, endDate: "2027-01-09" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toContain(
      "La vuelta tiene que ser después de la ida",
    );
  });

  it("acepta un viaje de un día y presupuesto vacío", () => {
    expect(
      quickTripSchema.parse({ ...base, endDate: "2027-01-10", budget: "" }),
    ).toMatchObject({
      startDate: "2027-01-10",
      endDate: "2027-01-10",
      budget: null,
    });
  });

  it("pide destino, fecha de ida y entre 1 y 20 personas", () => {
    const r = quickTripSchema.safeParse({
      ...base,
      destination: " ",
      startDate: "",
      travelers: "0",
    });
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        "Falta el destino",
        "Falta la fecha de ida",
        "Entre 1 y 20 personas",
      ]),
    );
  });

  it("toTripForm arma 00:00 y 23:59 de Buenos Aires y el presupuesto en centavos", () => {
    const f = toTripForm(quickTripSchema.parse(base));
    expect(f.trip.startAt.toISOString()).toBe("2027-01-10T03:00:00.000Z");
    expect(f.trip.endAt.toISOString()).toBe("2027-01-17T02:59:00.000Z");
    expect(f.trip).toMatchObject({
      name: "Bariloche",
      originLabel: "Zárate",
      destinationLabel: "Bariloche",
      adults: 2,
      budgetCents: 150_000_000,
      baseCurrency: "ARS",
      startTz: "America/Argentina/Buenos_Aires",
    });
    expect(
      toTripForm(quickTripSchema.parse({ ...base, budget: "", origin: "" }))
        .trip,
    ).toMatchObject({ budgetCents: 0, originLabel: "" });
  });

  it("crea y actualiza el viaje; el contexto para la IA cuenta los viajeros", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const trip = await createQuickTrip(db, ctx, quickTripSchema.parse(base));
    let data = await loadTrip(db, ctx, trip.id);
    expect(data.travelers).toHaveLength(2);
    expect(tripContext(data, "2026-10-15")).toEqual({
      origin: "Zárate",
      destination: "Bariloche",
      startDate: "2027-01-10",
      endDate: "2027-01-16",
      travelers: 2,
      today: "2026-10-15",
    });
    await updateQuickTrip(
      db,
      ctx,
      trip.id,
      quickTripSchema.parse({ ...base, origin: "", travelers: "3" }),
    );
    data = await loadTrip(db, ctx, trip.id);
    expect(data.travelers).toHaveLength(3);
    expect(tripContext(data, "2026-10-15").origin).toBeNull();
  });
});

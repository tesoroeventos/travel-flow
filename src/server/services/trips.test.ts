import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeCtx } from "./__fixtures__/seed-bariloche";
import { createTrip, updateTrip, setTravelerCounts } from "./trips";
import { tripCreateSchema, tripPreferencesSchema, tripConstraintsSchema } from "../validation/trip";

const form = tripCreateSchema.parse({
  name: "Bariloche 2027",
  originLabel: "Zárate",
  destinationLabel: "Bariloche",
  alternativeDestinations: "Mendoza, Salta",
  startDate: "2027-01-10",
  startTime: "08:00",
  endDate: "2027-01-16",
  endTime: "20:00",
  adults: "2",
  children: "1",
  infants: "1",
  budget: "1.500.000",
  baseCurrency: "ARS",
});

describe("createTrip", () => {
  it("crea viaje, viajeros por tipo, paradas y preferencias", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const trip = await createTrip(db, ctx, {
      trip: form,
      stops: ["Neuquén", "Villa La Angostura"],
      preferences: tripPreferencesSchema.parse({ pace: "relajado", interests: ["naturaleza"] }),
      constraints: tripConstraintsSchema.parse({ maxStops: "1" }),
    });
    const r = makeRepos(db);
    const travelers = await r.travelers.list(ctx, trip.id);
    expect(travelers.map((t) => `${t.kind}:${t.name}`)).toEqual(["adult:Adulto 1", "adult:Adulto 2", "child:Niño 1", "infant:Bebé 1"]);
    expect((await r.stops.list(ctx, trip.id)).map((s) => s.label)).toEqual(["Neuquén", "Villa La Angostura"]);
    expect(trip).toMatchObject({ budgetCents: 150000000, alternativeDestinations: ["Mendoza", "Salta"], status: "planning" });
    expect(trip.preferences).toMatchObject({ pace: "relajado", interests: ["naturaleza"] });
    expect(trip.constraints).toMatchObject({ maxStops: 1 });
  });
});

describe("setTravelerCounts", () => {
  it("agrega o quita viajeros del final sin tocar los nombres existentes", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const trip = await createTrip(db, ctx, { trip: { ...form, children: 0, infants: 0 }, stops: [], preferences: {}, constraints: {} });
    const r = makeRepos(db);
    const [first] = await r.travelers.list(ctx, trip.id);
    await r.travelers.update(ctx, first!.id, { name: "Matías" });

    await setTravelerCounts(db, ctx, trip.id, { adults: 3, children: 1, infants: 0 });
    let names = (await r.travelers.list(ctx, trip.id)).map((t) => t.name);
    expect(names).toEqual(["Matías", "Adulto 2", "Adulto 3", "Niño 1"]);

    await setTravelerCounts(db, ctx, trip.id, { adults: 1, children: 0, infants: 0 });
    names = (await r.travelers.list(ctx, trip.id)).map((t) => t.name);
    expect(names).toEqual(["Matías"]);
  });
});

describe("updateTrip", () => {
  it("actualiza datos y reemplaza paradas", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const trip = await createTrip(db, ctx, { trip: form, stops: ["A"], preferences: {}, constraints: {} });
    const updated = await updateTrip(db, ctx, trip.id, {
      trip: { ...form, name: "Bariloche en familia", budgetCents: 200000000, adults: 2, children: 1, infants: 1 },
      stops: ["B", "C"],
      preferences: {},
      constraints: {},
    });
    expect(updated).toMatchObject({ name: "Bariloche en familia", budgetCents: 200000000 });
    expect((await makeRepos(db).stops.list(ctx, trip.id)).map((s) => s.label)).toEqual(["B", "C"]);
  });
});

import { describe, expect, it } from "vitest";
import { zonedToUtc } from "@/domain/time/calendar";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { acknowledgeItinerary, moveActivities, orderDayByProximity, reorderActivities, viewItinerary } from "./itinerary-snapshot";

const BA = "America/Argentina/Buenos_Aires";

describe("itinerario guardado y cambios", () => {
  it("la primera vista guarda la referencia; un cambio de vuelo se informa hasta confirmarlo", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);

    const first = await viewItinerary(db, ctx, seed.tripId);
    expect(first?.diff).toBeNull();

    await makeRepos(db).transport.update(ctx, seed.flightOut.id, {
      segments: [{ from: "AEP", to: "BRC", departUtc: zonedToUtc("2027-01-10", "12:00", BA), departTz: BA, arriveUtc: zonedToUtc("2027-01-10", "14:20", BA), arriveTz: BA }],
    });
    const second = await viewItinerary(db, ctx, seed.tripId);
    expect(second?.diff?.changed).toContain(`departure:${seed.flightOut.id}:0`);
    expect(second?.diff?.changed).toContain(`leave_home:${seed.flightOut.id}:0`);

    await acknowledgeItinerary(db, ctx, seed.tripId);
    expect((await viewItinerary(db, ctx, seed.tripId))?.diff).toBeNull();
  });

  it("mover actividades guarda el orden del día", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    const museo = await r.activities.create(ctx, { tripId: seed.tripId, name: "Museo", date: "2027-01-13", durationMin: 60 });
    const feria = await r.activities.create(ctx, { tripId: seed.tripId, name: "Feria", date: "2027-01-13", durationMin: 60 });
    const { makeScenarioParts } = await import("../repos/scenario-parts");
    for (const a of [museo, feria]) await makeScenarioParts(db).setSelection(ctx, seed.scenarioId, "activity", a.id, true);

    let v = await viewItinerary(db, ctx, seed.tripId);
    const day = (it: typeof v) => it!.itinerary.days.find((d) => d.date === "2027-01-13")!.entries.filter((e) => e.kind === "activity").map((e) => e.title);
    expect(day(v)).toEqual(["Museo", "Feria"]);

    await moveActivities(db, ctx, seed.tripId, [feria.id, museo.id]);
    v = await viewItinerary(db, ctx, seed.tripId);
    expect(day(v)).toEqual(["Feria", "Museo"]);
  });

  it("ordenar por cercanía sin coordenadas devuelve el error", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.activities.update(ctx, seed.excursion.id, { lat: null, lng: null });
    const res = await orderDayByProximity(db, ctx, seed.tripId, "2027-01-12");
    expect(res).toEqual({ ok: false, error: { code: "missing_coordinates", message: "Cargá coordenadas en las actividades para ordenarlas por cercanía" } });
  });
});

describe("cambios hechos por el usuario", () => {
  it("reordenar a mano no genera el aviso de cambios, pero no oculta un cambio externo pendiente", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    const { makeScenarioParts } = await import("../repos/scenario-parts");
    const museo = await r.activities.create(ctx, { tripId: seed.tripId, name: "Museo", date: "2027-01-13", durationMin: 60 });
    const feria = await r.activities.create(ctx, { tripId: seed.tripId, name: "Feria", date: "2027-01-13", durationMin: 60 });
    for (const a of [museo, feria]) await makeScenarioParts(db).setSelection(ctx, seed.scenarioId, "activity", a.id, true);
    await viewItinerary(db, ctx, seed.tripId);

    await reorderActivities(db, ctx, seed.tripId, [feria.id, museo.id]);
    expect((await viewItinerary(db, ctx, seed.tripId))?.diff).toBeNull();

    await r.transport.update(ctx, seed.flightOut.id, {
      segments: [{ from: "AEP", to: "BRC", departUtc: zonedToUtc("2027-01-10", "12:00", BA), departTz: BA, arriveUtc: zonedToUtc("2027-01-10", "14:20", BA), arriveTz: BA }],
    });
    await reorderActivities(db, ctx, seed.tripId, [museo.id, feria.id]);
    expect((await viewItinerary(db, ctx, seed.tripId))?.diff?.changed).toContain(`departure:${seed.flightOut.id}:0`);
  });
});

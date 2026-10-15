import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import type { Db } from "../db/client";
import { NotFoundError, type Ctx } from "../context";
import { makeRepos } from "./index";
import { makeScenarioParts } from "./scenario-parts";
import { makeCtx, seedBarilocheA } from "../services/demo-data";
import { chooseScenario } from "../services/confirm";

/** Dos viajes del MISMO workspace: nada de uno puede colgarse del otro. */
describe("no se mezclan datos entre viajes del mismo workspace", () => {
  let db: Db;
  let ctx: Ctx;
  let a: Awaited<ReturnType<typeof seedBarilocheA>>;
  let bTripId: string;
  let bScenarioId: string;

  beforeEach(async () => {
    db = await createTestDb();
    ctx = await makeCtx(db);
    a = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    const b = await r.trips.create(ctx, {
      name: "Otro",
      originLabel: "X",
      destinationLabel: "Y",
      startAt: new Date("2027-02-01T12:00:00Z"),
      startTz: "UTC",
      endAt: new Date("2027-02-03T12:00:00Z"),
      endTz: "UTC",
      baseCurrency: "ARS",
      budgetCents: 1,
    });
    bTripId = b.id;
    bScenarioId = (await r.scenarios.create(ctx, { tripId: b.id, name: "B" })).id;
  });

  it("no se puede seleccionar en un escenario una alternativa de otro viaje", async () => {
    await expect(makeScenarioParts(db).setSelection(ctx, bScenarioId, "lodging_option", a.hotel.id, true)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("no se puede alternar en un escenario una partida de otro viaje", async () => {
    await expect(makeScenarioParts(db).setToggle(ctx, bScenarioId, a.items.excursion.id, false)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("no se puede crear una partida cuyo dueño es de otro viaje", async () => {
    await expect(
      makeRepos(db).costItems.create(ctx, {
        tripId: bTripId,
        ownerType: "lodging_option",
        ownerId: a.hotel.id,
        label: "Intruso",
        amountCents: 1,
        currency: "ARS",
        category: "lodging",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("no se puede crear una reserva de una alternativa de otro viaje", async () => {
    await expect(makeRepos(db).bookings.create(ctx, { tripId: bTripId, ownerType: "lodging_option", ownerId: a.hotel.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("editar una partida no puede cambiarle el dueño", async () => {
    const updated = await makeRepos(db).costItems.update(ctx, a.items.food.id, { ownerId: a.hotel.id, ownerType: "lodging_option" } as never);
    expect(updated).toMatchObject({ ownerType: "scenario", ownerId: a.scenarioId });
  });

  it("elegir un escenario de otro viaje falla", async () => {
    await expect(chooseScenario(db, ctx, bTripId, a.scenarioId)).rejects.toThrow();
  });
});

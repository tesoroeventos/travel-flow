import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-db";
import { makeRepos } from "../repos";
import { makeScenarioParts } from "../repos/scenario-parts";
import { makeCtx, seedBarilocheA } from "./__fixtures__/seed-bariloche";
import { analyzeTrip } from "./trip-analysis";
import { chooseScenario, setBookingStatus } from "./confirm";
import { createScenario } from "./scenarios";

describe("confirmar viaje", () => {
  it("elegir un escenario crea reservas 'seleccionada' y no pisa las existentes", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const r = makeRepos(db);
    await r.trips.update(ctx, seed.tripId, { chosenScenarioId: null });

    await chooseScenario(db, ctx, seed.tripId, seed.scenarioId);
    const trip = await r.trips.get(ctx, seed.tripId);
    expect(trip).toMatchObject({ chosenScenarioId: seed.scenarioId, status: "confirmed" });

    const bookings = await r.bookings.list(ctx, seed.tripId);
    expect(bookings).toHaveLength(4);
    const flight = bookings.find((b) => b.ownerId === seed.flightOut.id)!;
    expect(flight).toMatchObject({ bookingStatus: "booking_confirmed", paymentStatus: "paid" });
    const hotel = bookings.find((b) => b.ownerId === seed.hotel.id)!;
    expect(hotel).toMatchObject({ bookingStatus: "selected", paymentStatus: "payment_pending" });
  });

  it("cambiar de escenario y volver no pisa estados cambiados", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await chooseScenario(db, ctx, seed.tripId, seed.scenarioId);
    const hotel = (await makeRepos(db).bookings.list(ctx, seed.tripId)).find((b) => b.ownerId === seed.hotel.id)!;
    await setBookingStatus(db, ctx, hotel.id, { bookingStatus: "booking_confirmed", confirmationCode: "HX-123" });

    const other = await createScenario(db, ctx, seed.tripId, "B");
    await makeScenarioParts(db).setSelection(ctx, other.id, "lodging_option", seed.hotel.id, true);
    await chooseScenario(db, ctx, seed.tripId, other.id);
    await chooseScenario(db, ctx, seed.tripId, seed.scenarioId);
    const again = (await makeRepos(db).bookings.list(ctx, seed.tripId)).find((b) => b.ownerId === seed.hotel.id)!;
    expect(again).toMatchObject({ bookingStatus: "booking_confirmed", confirmationCode: "HX-123" });
  });

  it("marcar pagado suma en pagado del análisis", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    await chooseScenario(db, ctx, seed.tripId, seed.scenarioId);
    const hotel = (await makeRepos(db).bookings.list(ctx, seed.tripId)).find((b) => b.ownerId === seed.hotel.id)!;
    await setBookingStatus(db, ctx, hotel.id, { paymentStatus: "paid" });
    const a = await analyzeTrip(db, ctx, seed.tripId, { today: "2027-01-05" });
    expect(a.scenarios[0]!.summary.paidCents).toBe(24000000 + 48000000);
  });

  it("no permite elegir un escenario de otro viaje", async () => {
    const db = await createTestDb();
    const ctx = await makeCtx(db);
    const seed = await seedBarilocheA(db, ctx);
    const other = await makeCtx(db, "otro@x.com");
    await expect(chooseScenario(db, other, seed.tripId, seed.scenarioId)).rejects.toThrow();
  });
});

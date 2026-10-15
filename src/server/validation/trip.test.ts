import { describe, expect, it } from "vitest";
import { tripCreateSchema, tripPreferencesSchema, tripConstraintsSchema } from "./trip";
import { lodgingOptionSchema, transportOptionSchema, activitySchema, costItemSchema } from "./options";
import { expenseSchema } from "./expense";
import { exchangeRateSchema } from "./rate";
import { registerSchema } from "./auth";

const firstError = (r: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  r.error?.issues[0];

const validTrip = {
  name: "Bariloche 2027",
  originLabel: "Zárate",
  destinationLabel: "Bariloche",
  startDate: "2027-01-10",
  startTime: "08:00",
  endDate: "2027-01-16",
  endTime: "20:00",
  tz: "America/Argentina/Buenos_Aires",
  adults: "2",
  children: "0",
  infants: "0",
  rooms: "1",
  tripType: "vacaciones",
  budget: "1.500.000",
  baseCurrency: "ARS",
};

describe("tripCreateSchema", () => {
  it("convierte el formulario en datos del viaje", () => {
    const r = tripCreateSchema.safeParse(validTrip);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      budgetCents: 150000000,
      adults: 2,
      startAt: new Date("2027-01-10T11:00:00.000Z"),
      endAt: new Date("2027-01-16T23:00:00.000Z"),
      alternativeDestinations: [],
      flexibilityDays: 0,
    });
  });

  it("rechaza regreso antes de la salida", () => {
    const r = tripCreateSchema.safeParse({ ...validTrip, endDate: "2027-01-09" });
    expect(firstError(r)).toMatchObject({ message: "La fecha de regreso debe ser posterior a la salida", path: ["endDate"] });
  });

  it("exige al menos un adulto", () => {
    expect(firstError(tripCreateSchema.safeParse({ ...validTrip, adults: "0" }))?.message).toBe(
      "Tiene que viajar al menos un adulto",
    );
  });

  it("muestra el error del importe", () => {
    expect(firstError(tripCreateSchema.safeParse({ ...validTrip, budget: "12,345" }))).toMatchObject({
      message: "Usá como máximo 2 decimales",
      path: ["budget"],
    });
  });

  it("rechaza monedas no soportadas", () => {
    expect(tripCreateSchema.safeParse({ ...validTrip, baseCurrency: "XXX" }).success).toBe(false);
  });

  it("exige nombre", () => {
    expect(firstError(tripCreateSchema.safeParse({ ...validTrip, name: " " }))?.message).toBe("Ingresá un nombre para el viaje");
  });
});

describe("preferencias y restricciones", () => {
  it("aceptan valores vacíos con defaults", () => {
    expect(tripPreferencesSchema.parse({})).toMatchObject({ budgetLevel: "intermedio", priority: "equilibrio", pace: "equilibrado", interests: [] });
    expect(tripConstraintsSchema.parse({})).toMatchObject({ maxStops: null, needsParking: false });
  });
});

describe("lodgingOptionSchema", () => {
  const valid = {
    tripId: "00000000-0000-4000-8000-000000000000",
    name: "Hotel",
    kind: "hotel",
    checkInDate: "2027-01-10",
    checkInTime: "15:00",
    checkOutDate: "2027-01-16",
    checkOutTime: "10:00",
    tz: "America/Argentina/Buenos_Aires",
  };
  it("acepta una estadía válida", () => {
    expect(lodgingOptionSchema.parse(valid)).toMatchObject({ checkInAt: new Date("2027-01-10T18:00:00.000Z") });
  });
  it("rechaza check-out igual o anterior al check-in", () => {
    const r = lodgingOptionSchema.safeParse({ ...valid, checkOutDate: "2027-01-10", checkOutTime: "20:00" });
    expect(firstError(r)).toMatchObject({ message: "El check-out debe ser posterior al check-in", path: ["checkOutDate"] });
  });
});

describe("transportOptionSchema", () => {
  const seg = { from: "AEP", to: "BRC", departDate: "2027-01-10", departTime: "10:00", arriveDate: "2027-01-10", arriveTime: "12:20", departTz: "America/Argentina/Buenos_Aires", arriveTz: "America/Argentina/Buenos_Aires" };
  const valid = { tripId: "00000000-0000-4000-8000-000000000000", leg: "outbound", mode: "flight", provider: "AR", fromLabel: "AEP", toLabel: "BRC", segments: [seg] };
  it("convierte tramos a UTC", () => {
    expect(transportOptionSchema.parse(valid).segments[0]).toMatchObject({ departUtc: "2027-01-10T13:00:00.000Z", arriveUtc: "2027-01-10T15:20:00.000Z" });
  });
  it("rechaza llegada antes de la salida", () => {
    const r = transportOptionSchema.safeParse({ ...valid, segments: [{ ...seg, arriveTime: "09:00" }] });
    expect(firstError(r)?.message).toBe("La llegada debe ser posterior a la salida");
  });
  it("permite alternativas sin horarios", () => {
    expect(transportOptionSchema.parse({ ...valid, segments: [] }).segments).toEqual([]);
  });
});

describe("activitySchema", () => {
  it("acepta hora opcional", () => {
    expect(activitySchema.parse({ tripId: "00000000-0000-4000-8000-000000000000", name: "Catedral", date: "2027-01-12", startTime: "", durationMin: "240" })).toMatchObject({ startTime: null, durationMin: 240 });
  });
  it("rechaza hora inválida", () => {
    expect(activitySchema.safeParse({ tripId: "00000000-0000-4000-8000-000000000000", name: "x", date: "2027-01-12", startTime: "25:00", durationMin: "60" }).success).toBe(false);
  });
});

describe("costItemSchema", () => {
  it("parsea importe y cantidad", () => {
    expect(costItemSchema.parse({ label: "Hotel", amount: "80.000", currency: "ARS", unit: "per_night", quantity: "1", category: "lodging" })).toMatchObject({ amountCents: 8000000, quantity: "1", costType: "fixed", includesTaxes: null, certainty: "estimated" });
  });
  it("cantidad acepta coma decimal", () => {
    expect(costItemSchema.parse({ label: "x", amount: "1", currency: "ARS", unit: "total", quantity: "0,5", category: "other" }).quantity).toBe("0.5");
  });
  it("impuestos sí/no/no sé", () => {
    expect(costItemSchema.parse({ label: "x", amount: "1", currency: "ARS", unit: "total", category: "other", includesTaxes: "yes" }).includesTaxes).toBe(true);
    expect(costItemSchema.parse({ label: "x", amount: "1", currency: "ARS", unit: "total", category: "other", includesTaxes: "no" }).includesTaxes).toBe(false);
  });
});

describe("expenseSchema y exchangeRateSchema", () => {
  it("gasto válido", () => {
    expect(expenseSchema.parse({ date: "2027-01-12", category: "food", description: "Cena", amount: "30.000", currency: "ARS" })).toMatchObject({ amountCents: 3000000, participantIds: [] });
  });
  it("tasa positiva con coma", () => {
    expect(exchangeRateSchema.parse({ fromCurrency: "USD", toCurrency: "ARS", rate: "1.000,50", asOf: "2027-01-01", source: "BNA" }).rate).toBe("1000.5");
    expect(exchangeRateSchema.safeParse({ fromCurrency: "USD", toCurrency: "USD", rate: "1", asOf: "2027-01-01", source: "x" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("exige contraseña de al menos 8 caracteres", () => {
    expect(firstError(registerSchema.safeParse({ name: "Ana", email: "a@x.com", password: "123", inviteCode: "ABC" }))?.message).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });
  it("normaliza el email", () => {
    expect(registerSchema.parse({ name: "Ana", email: " A@X.com ", password: "12345678", inviteCode: " abc " })).toMatchObject({ email: "a@x.com", inviteCode: "ABC" });
  });
});

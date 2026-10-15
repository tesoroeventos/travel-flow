import { expect, test } from "@playwright/test";
import { addLodging, addScenario, addTransport, createBarilocheTrip, registerUser } from "./helpers";

test("exportar presupuesto CSV, itinerario ICS y vista de impresión", async ({ page }) => {
  test.setTimeout(180_000);
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();
  await addTransport(page, trip, { leg: "outbound", mode: "flight", provider: "Vuelo ida", from: "AEP", to: "BRC", date: "2027-01-10", departs: "10:00", arrives: "12:20", price: "120.000", transferTo: "45" });
  await addTransport(page, trip, { leg: "return", mode: "flight", provider: "Vuelo vuelta", from: "BRC", to: "AEP", date: "2027-01-16", departs: "17:00", arrives: "19:10", price: "110.000", transferFrom: "40" });
  await addLodging(page, trip, "Hotel Centro", "80.000");
  await addScenario(page, trip, "A", ["Vuelo ida", "Vuelo vuelta", "Hotel Centro"]);
  await page.goto(`${trip}/confirmar`);
  await page.getByRole("radio", { name: /^A/ }).check();
  await page.getByRole("button", { name: "Elegir este escenario" }).click();
  await expect(page.getByRole("region", { name: "Resumen final" })).toBeVisible();

  const csv = await page.request.get(`${trip}/exportar/presupuesto.csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvText = await csv.text();
  expect(csvText).toContain("Total con imprevistos");
  expect(csvText).toContain("940.000,00");

  const ics = await page.request.get(`${trip}/exportar/itinerario.ics`);
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("DTSTART:20270110T130000Z");

  await page.goto(`${trip}/itinerario`);
  await expect(page.getByRole("link", { name: "Descargar presupuesto (CSV)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agregar al calendario (.ics)" })).toBeVisible();
  await page.getByRole("link", { name: "Imprimir o guardar PDF" }).click();
  await expect(page.getByRole("heading", { name: "Presupuesto" })).toBeVisible();
  await expect(page.getByText("$ 940.000,00").first()).toBeVisible();
  await expect(page.getByText("Salir de casa").first()).toBeVisible();

  // Otro usuario no puede descargar
  await page.context().clearCookies();
  const denied = await page.request.get(`${trip}/exportar/presupuesto.csv`, { maxRedirects: 0 });
  expect([302, 303, 307, 404]).toContain(denied.status());
});

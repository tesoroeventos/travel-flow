import { expect, test } from "@playwright/test";
import { addActivity, addLodging, addScenario, addTransport, createBarilocheTrip, expectNoHorizontalScroll, registerUser } from "./helpers";

test("flujo completo en el celular: de la idea al itinerario y los gastos", async ({ page }) => {
  test.setTimeout(300_000);
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();
  await expectNoHorizontalScroll(page);

  await addTransport(page, trip, { leg: "outbound", mode: "flight", provider: "Vuelo ida", from: "AEP", to: "BRC", date: "2027-01-10", departs: "10:00", arrives: "12:20", price: "120.000", transferTo: "45", transferFrom: "30" });
  await addTransport(page, trip, { leg: "return", mode: "flight", provider: "Vuelo vuelta", from: "BRC", to: "AEP", date: "2027-01-16", departs: "17:00", arrives: "19:10", price: "110.000", transferTo: "30", transferFrom: "40" });
  await addTransport(page, trip, { leg: "outbound", mode: "bus", provider: "Micro ida", from: "Retiro", to: "Bariloche", date: "2027-01-09", departs: "20:00", arriveDate: "2027-01-10", arrives: "18:00", price: "60.000" });
  await addTransport(page, trip, { leg: "return", mode: "bus", provider: "Micro vuelta", from: "Bariloche", to: "Retiro", date: "2027-01-16", departs: "12:00", arriveDate: "2027-01-17", arrives: "10:00", price: "60.000" });
  await expectNoHorizontalScroll(page);
  await addLodging(page, trip, "Hotel Centro", "80.000");
  await addLodging(page, trip, "Hostel Lago", "30.000");
  await expectNoHorizontalScroll(page);
  await addActivity(page, trip, { name: "Cerro Catedral", date: "2027-01-12", time: "10:00", duration: "240", price: "40.000" });
  await addActivity(page, trip, { name: "Circuito Chico", date: "2027-01-13", duration: "180" });
  await expectNoHorizontalScroll(page);

  await addScenario(page, trip, "A", ["Vuelo ida", "Vuelo vuelta", "Hotel Centro", "Cerro Catedral", "Circuito Chico"]);
  await addScenario(page, trip, "B", ["Micro ida", "Micro vuelta", "Hostel Lago", "Cerro Catedral", "Circuito Chico"]);
  await addScenario(page, trip, "C", ["Vuelo ida", "Micro vuelta", "Hostel Lago", "Circuito Chico"]);
  await expect(page.getByRole("table", { name: "Comparación de escenarios" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto(`${trip}/confirmar`);
  await page.getByRole("radio", { name: /^A/ }).check();
  await page.getByRole("button", { name: "Elegir este escenario" }).click();
  await expect(page.getByRole("region", { name: "Resumen final" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Generar itinerario" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Salir de casa" })).toContainText("07:15");
  await expect(page.getByRole("listitem").filter({ hasText: "Llegada a casa" })).toContainText("19:50");
  await expectNoHorizontalScroll(page);

  await page.goto(`${trip}/gastos`);
  await page.getByRole("button", { name: "Agregar gasto" }).click();
  const form = page.getByRole("form", { name: "Nuevo gasto" });
  await form.getByLabel("Fecha").fill("2027-01-11");
  await form.getByLabel("Descripción").fill("Cena");
  await form.getByLabel("Importe").fill("35.000");
  await form.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByRole("region", { name: "Resumen de gastos" }).getByText("Gastado").locator("..")).toContainText("$ 35.000,00");
  await expectNoHorizontalScroll(page);

  const csv = await page.request.get(`${trip}/exportar/presupuesto.csv`);
  expect(csv.status()).toBe(200);
  const ics = await page.request.get(`${trip}/exportar/itinerario.ics`);
  expect(ics.status()).toBe(200);

  await page.goto(`${trip}/imprimir`);
  await expect(page.getByRole("heading", { name: "Presupuesto" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Bariloche 2027/ })).toContainText("Estimado (escenario elegido)");
  await expectNoHorizontalScroll(page);
});

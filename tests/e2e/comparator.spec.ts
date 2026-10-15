import { expect, test } from "@playwright/test";
import { addLodging, addScenario, addTransport, createBarilocheTrip, expectNoHorizontalScroll, registerUser } from "./helpers";

test("comparar tres escenarios con recomendación y avisos", async ({ page }) => {
  test.setTimeout(240_000);
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();

  await addTransport(page, trip, { leg: "outbound", mode: "flight", provider: "Vuelo ida", from: "AEP", to: "BRC", date: "2027-01-10", departs: "10:00", arrives: "12:20", price: "120.000" });
  await addTransport(page, trip, { leg: "return", mode: "flight", provider: "Vuelo vuelta", from: "BRC", to: "AEP", date: "2027-01-16", departs: "17:00", arrives: "19:10", price: "110.000" });
  await addTransport(page, trip, { leg: "outbound", mode: "bus", provider: "Micro ida", from: "Retiro", to: "Bariloche", date: "2027-01-09", departs: "20:00", arriveDate: "2027-01-10", arrives: "18:00", price: "60.000" });
  await addTransport(page, trip, { leg: "return", mode: "bus", provider: "Micro vuelta", from: "Bariloche", to: "Retiro", date: "2027-01-16", departs: "12:00", arriveDate: "2027-01-17", arrives: "10:00", price: "60.000" });
  await addLodging(page, trip, "Hotel Centro", "80.000");
  await addLodging(page, trip, "Hostel Lago", "30.000");

  await addScenario(page, trip, "A", ["Vuelo ida", "Vuelo vuelta", "Hotel Centro"]);
  await addScenario(page, trip, "B", ["Micro ida", "Micro vuelta", "Hostel Lago"]);
  await addScenario(page, trip, "C", ["Vuelo ida", "Micro vuelta", "Hostel Lago"]);

  const table = page.getByRole("table", { name: "Comparación de escenarios" });
  for (const n of ["A", "B", "C"]) await expect(table.getByRole("columnheader", { name: n, exact: true })).toBeVisible();
  // A = 240.000 + 220.000 + 480.000
  await expect(table.getByText("$ 940.000,00").first()).toBeVisible();

  // Cambiar el precio del vuelo de ida recalcula
  await page.goto(`${trip}/transporte`);
  const flight = page.getByRole("article").filter({ hasText: "Vuelo ida" });
  await flight.getByRole("button", { name: /Editar partida/ }).click();
  await flight.getByLabel("Importe").fill("130.000");
  await flight.getByRole("button", { name: "Guardar partida" }).click();
  await expect(flight.getByText("$ 260.000,00").first()).toBeVisible();
  await page.goto(`${trip}/comparador`);
  await expect(table.getByText("$ 960.000,00").first()).toBeVisible();

  // Partida opcional propia del escenario A, y apagarla
  const a = page.getByRole("region", { name: "Escenario A" });
  await a.getByRole("button", { name: "Armar escenario" }).click();
  await a.getByRole("button", { name: "Agregar partida" }).click();
  const itemForm = a.getByRole("form", { name: "Nueva partida" });
  await itemForm.getByLabel("Descripción").fill("Cena especial");
  await itemForm.getByLabel("Importe").fill("50.000");
  await itemForm.getByLabel("Tipo de gasto").selectOption("optional");
  await itemForm.getByLabel("Categoría").selectOption("food");
  await itemForm.getByRole("button", { name: "Guardar partida" }).click();
  await expect(table.getByText("$ 1.010.000,00").first()).toBeVisible();
  await a.getByRole("checkbox", { name: "Incluir Cena especial" }).uncheck();
  await expect(table.getByText("$ 960.000,00").first()).toBeVisible();

  // Prioridad al precio → recomendación con explicación
  await page.getByRole("button", { name: "Prioridades" }).click();
  for (const label of ["Tiempo de viaje", "Transbordos", "Ubicación", "Flexibilidad", "Comodidad", "Calidad del alojamiento", "Experiencia general"]) {
    await page.getByLabel(label, { exact: true }).fill("0");
  }
  await page.getByLabel("Precio total", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Guardar prioridades" }).click();
  const rec = page.getByRole("region", { name: "Recomendación" });
  await expect(rec.getByText("Con tus prioridades, conviene B.")).toBeVisible();
  await expect(rec.getByText(/% menos que/).first()).toBeVisible();

  // Partida en USD sin tipo de cambio → total incompleto
  const c = page.getByRole("region", { name: "Escenario C" });
  await c.getByRole("button", { name: "Armar escenario" }).click();
  await c.getByRole("button", { name: "Agregar partida" }).click();
  const usd = c.getByRole("form", { name: "Nueva partida" });
  await usd.getByLabel("Descripción").fill("Seguro");
  await usd.getByLabel("Importe").fill("30");
  await usd.getByLabel("Moneda").selectOption("USD");
  await usd.getByLabel("Categoría").selectOption("insurance");
  await usd.getByRole("button", { name: "Guardar partida" }).click();
  await expect(page.getByText("Incompleto: falta tipo de cambio USD→ARS").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

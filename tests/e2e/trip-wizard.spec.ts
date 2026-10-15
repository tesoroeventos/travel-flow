import { expect, test } from "@playwright/test";
import { createBarilocheTrip, expectNoHorizontalScroll, registerUser } from "./helpers";


test("crear un viaje en tres pasos y recuperarlo", async ({ page }) => {
  await registerUser(page);
  await createBarilocheTrip(page);
  await expect(page.getByText("7 días")).toBeVisible();
  await expect(page.getByText("2 viajeros")).toBeVisible();
  await expect(page.getByText("$ 1.500.000,00").first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  const url = page.url();
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mis viajes" }).click();
  await expect(page.getByRole("link", { name: /Bariloche 2027/ })).toBeVisible();

  await page.goto(url);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bariloche 2027" })).toBeVisible();
  await expect(page.getByText("$ 1.500.000,00").first()).toBeVisible();
});

test("regreso antes de la salida se avisa en el primer paso", async ({ page }) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page.getByLabel("Nombre del viaje").fill("Error");
  await page.getByLabel("Origen").fill("A");
  await page.getByLabel("Destino principal").fill("B");
  await page.getByLabel("Fecha de salida").fill("2027-01-16");
  await page.getByLabel("Hora de salida").fill("08:00");
  await page.getByLabel("Fecha de regreso").fill("2027-01-10");
  await page.getByLabel("Hora de regreso").fill("20:00");
  await page.getByLabel("Presupuesto total").fill("100");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("La fecha de regreso debe ser posterior a la salida")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Datos generales" })).toBeVisible();
});

test("editar el viaje cambia el presupuesto", async ({ page }) => {
  await registerUser(page);
  await createBarilocheTrip(page);
  await page.getByRole("link", { name: "Editar datos" }).click();
  await page.getByLabel("Presupuesto total").fill("2.000.000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("$ 2.000.000,00").first()).toBeVisible();
});

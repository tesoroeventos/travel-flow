import { expect, test } from "@playwright/test";
import { createBarilocheTrip, registerUser } from "./helpers";

test("tipo de cambio y gastos reales con disponible", async ({ page }) => {
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();

  await page.goto("/configuracion");
  const rateForm = page.getByRole("form", { name: "Nuevo tipo de cambio" });
  await rateForm.getByLabel("Moneda de origen").selectOption("USD");
  await rateForm.getByLabel("Moneda de destino").selectOption("ARS");
  await rateForm.getByLabel("Tasa").fill("1.000,50");
  await rateForm.getByLabel("Vigente desde").fill("2027-01-01");
  await rateForm.getByLabel("Fuente").fill("Banco Nación");
  await rateForm.getByRole("button", { name: "Guardar tipo de cambio" }).click();
  await expect(page.getByRole("table", { name: "Tipos de cambio" })).toContainText("1 USD = 1.000,50 ARS");

  await page.goto(`${trip}/gastos`);
  await page.getByRole("button", { name: "Agregar gasto" }).click();
  const form = page.getByRole("form", { name: "Nuevo gasto" });
  await form.getByLabel("Fecha").fill("2027-01-11");
  await form.getByLabel("Categoría").selectOption("food");
  await form.getByLabel("Descripción").fill("Cena en el centro");
  await form.getByLabel("Importe").fill("20");
  await form.getByLabel("Moneda").selectOption("USD");
  await form.getByRole("button", { name: "Guardar gasto" }).click();

  const panel = page.getByRole("region", { name: "Resumen de gastos" });
  await expect(panel.getByText("Gastado").locator("..")).toContainText("$ 20.010,00");
  await expect(panel.getByText("Disponible").locator("..")).toContainText("$ 1.479.990,00");
  await expect(page.getByRole("listitem").filter({ hasText: "Cena en el centro" })).toContainText("US$ 20,00");
});

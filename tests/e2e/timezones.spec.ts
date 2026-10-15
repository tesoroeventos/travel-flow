import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("viaje internacional: zona horaria de destino, salida del regreso y alojamiento", async ({ page }) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page.getByLabel("Nombre del viaje").fill("Madrid 2027");
  await page.getByLabel("Origen").fill("Buenos Aires");
  await page.getByLabel("Destino principal").fill("Madrid");
  await page.getByLabel("Fecha de salida").fill("2027-01-10");
  await page.getByLabel("Hora de salida").fill("13:00");
  await page.getByLabel("Fecha de regreso").fill("2027-01-20");
  await page.getByLabel("Hora de regreso").fill("18:30");
  await page.getByLabel("Zona horaria de salida").selectOption("America/Argentina/Buenos_Aires");
  await page.getByLabel("Zona horaria del destino").selectOption("Europe/Madrid");
  await page.getByLabel("Presupuesto total").fill("5.000.000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Crear viaje" }).click();
  await expect(page.getByRole("heading", { name: "Madrid 2027" })).toBeVisible();
  // 10 al 20 de enero (fechas locales de cada extremo) = 11 días
  await expect(page.getByText("11 días")).toBeVisible();
  const trip = page.url();

  // Vuelo de regreso: sale de Madrid a las 10:00 (hora de Madrid) y llega a Buenos Aires 18:30
  await page.goto(`${trip}/transporte`);
  await page.getByRole("button", { name: "Agregar transporte" }).click();
  const form = page.getByRole("form", { name: "Nueva alternativa de transporte" });
  await form.getByLabel("Tramo").selectOption("return");
  await expect(form.getByLabel("Zona horaria de salida")).toHaveValue("Europe/Madrid");
  await form.getByLabel("Empresa o proveedor").fill("Iberia");
  await form.getByLabel("Desde").fill("MAD");
  await form.getByLabel("Hasta").fill("EZE");
  await form.getByLabel("Sale el día").fill("2027-01-20");
  await form.getByLabel("Sale a las").fill("10:00");
  await form.getByLabel("Llega el día").fill("2027-01-20");
  await form.getByLabel("Llega a las").fill("18:30");
  await form.getByLabel("Zona horaria de llegada").selectOption("America/Argentina/Buenos_Aires");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  const iberia = page.getByRole("article").filter({ hasText: "Iberia" });
  await expect(iberia.getByText("12 h 30 min")).toBeVisible();

  // El alojamiento en Madrid usa la zona del destino por defecto
  await page.goto(`${trip}/alojamiento`);
  await page.getByRole("button", { name: "Agregar alojamiento" }).click();
  const lf = page.getByRole("form", { name: "Nueva alternativa de alojamiento" });
  await expect(lf.getByLabel("Zona horaria")).toHaveValue("Europe/Madrid");
});

import { expect, test } from "@playwright/test";
import { registerUser, uploadShots } from "./helpers";

test("viaje internacional: zona horaria del destino para la vuelta y el alojamiento", async ({ page }) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page.getByRole("button", { name: "Prefiero completar un formulario" }).click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await form.getByLabel("Destino", { exact: true }).fill("Madrid");
  await form.getByLabel("Salís desde").fill("Buenos Aires");
  await form.getByLabel("Ida", { exact: true }).fill("2027-01-10");
  await form.getByLabel("Vuelta", { exact: true }).fill("2027-01-16");
  await form.getByLabel("Personas").fill("1");
  await form.getByText("Zonas horarias").click();
  await form.getByLabel("Zona horaria del lugar que visitás").selectOption("Europe/Madrid");
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/opciones$/);
  await expect(page.getByText("10 ene – 16 ene 2027 · 6 noches")).toBeVisible();

  // La vuelta sale de Madrid a las 17:00 hora de Madrid; el hotel hace check-in 14:00 hora de Madrid.
  await uploadShots(page, ["vuelo-vuelta", "hotel"]);
  await expect(page.getByRole("article", { name: "AR 1673 · directo" })).toContainText("sáb 16 ene 17:00");
  await expect(page.getByRole("article", { name: "Hotel Centro Cívico" })).toContainText("dom 10 ene 14:00");
  await page.goto(page.url().replace("/opciones", "/editar"));
  await expect(
    page.getByRole("form", { name: "Datos del viaje" }).getByLabel("Zona horaria del lugar que visitás"),
  ).toHaveValue("Europe/Madrid");
});

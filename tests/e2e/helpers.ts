import { expect, type Page } from "@playwright/test";

export const E2E_INVITE = "PRUEBAE2E2";

let counter = 0;

/** Registra un usuario nuevo y deja la sesión abierta en el Dashboard. */
export async function registerUser(page: Page, name = "Ana"): Promise<string> {
  const email = `e2e-${Date.now()}-${counter++}@travelflow.test`;
  await page.goto("/registro");
  await page.getByLabel("Código de invitación").fill(E2E_INVITE);
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("secreta123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Tus viajes" })).toBeVisible();
  return email;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function createBarilocheTrip(page: Page) {
  await page.goto("/viajes/nuevo");
  await page.getByLabel("Nombre del viaje").fill("Bariloche 2027");
  await page.getByLabel("Origen").fill("Zárate");
  await page.getByLabel("Destino principal").fill("Bariloche");
  await page.getByLabel("Fecha de salida").fill("2027-01-10");
  await page.getByLabel("Hora de salida").fill("08:00");
  await page.getByLabel("Fecha de regreso").fill("2027-01-16");
  await page.getByLabel("Hora de regreso").fill("20:00");
  await page.getByLabel("Adultos").fill("2");
  await page.getByLabel("Presupuesto total").fill("1.500.000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("heading", { name: "Preferencias" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("heading", { name: "Restricciones" })).toBeVisible();
  await page.getByRole("button", { name: "Crear viaje" }).click();
  await expect(page.getByRole("heading", { name: "Bariloche 2027" })).toBeVisible();
}

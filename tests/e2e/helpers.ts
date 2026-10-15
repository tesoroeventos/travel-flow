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

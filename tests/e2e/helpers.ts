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

/** Crea un viaje con el formulario corto (Bariloche, 10 al 16 de enero de 2027) y deja abierta la pantalla Opciones. */
export async function createQuickTrip(
  page: Page,
  opts: { origin?: string; travelers?: string; destination?: string } = {},
) {
  await page.goto("/viajes/nuevo");
  await page.getByRole("button", { name: "Prefiero completar un formulario" }).click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await form.getByLabel("Destino", { exact: true }).fill(opts.destination ?? "Bariloche");
  if (opts.origin !== "") await form.getByLabel("Salís desde").fill(opts.origin ?? "Zárate");
  await form.getByLabel("Ida", { exact: true }).fill("2027-01-10");
  await form.getByLabel("Vuelta", { exact: true }).fill("2027-01-16");
  await form.getByLabel("Personas").fill(opts.travelers ?? "2");
  await form.getByLabel("Presupuesto (opcional)").fill("1.500.000");
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/opciones$/);
  return page.url().replace(/\/opciones$/, "");
}

/** Sube capturas de tests/e2e/fixtures y espera que terminen de leerse. */
export async function uploadShots(page: Page, names: string[]) {
  await page.getByLabel("Elegir capturas").setInputFiles(names.map((n) => `tests/e2e/fixtures/${n}.png`));
  await expect(page.getByText("Leyendo…")).toHaveCount(0, { timeout: 30_000 });
}

/** Sube ida, vuelta y hotel y elige la única propuesta. Deja abierta la pantalla Confirmar. */
export async function chooseSimpleTrip(page: Page, trip: string, shots = ["vuelo-ida", "vuelo-vuelta", "hotel"]) {
  await uploadShots(page, shots);
  await page.goto(`${trip}/propuestas`);
  await page.getByRole("button", { name: "Elegir esta" }).first().click();
  await expect(page).toHaveURL(`${trip}/confirmar`);
  await expect(page.getByRole("region", { name: "Resumen final" })).toBeVisible();
}

import { expect, test } from "@playwright/test";
import { E2E_INVITE, expectNoHorizontalScroll } from "./helpers";

test("la demo pública se ve sin cuenta y se puede duplicar al registrarse", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Ver un viaje de ejemplo" }).click();
  await expect(page).toHaveURL(/\/share\/demo-e2e/);
  await expect(page.getByText("Precios ficticios")).toBeVisible();
  const table = page.getByRole("table", { name: "Comparación de escenarios" });
  for (const n of ["A · Avión + hotel céntrico", "B · Auto propio + departamento", "C · Micro + hostel"]) {
    await expect(table.getByRole("columnheader", { name: n })).toBeVisible();
  }
  await expect(page.getByText("Salir de casa").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Duplicar como mío" }).click();
  await expect(page).toHaveURL(/\/registro/);
  await page.getByLabel("Código de invitación").fill(E2E_INVITE);
  await page.getByLabel("Nombre").fill("Ana");
  await page.getByLabel("Email").fill(`demo-${Date.now()}@travelflow.test`);
  await page.getByLabel("Contraseña").fill("secreta123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/share\/demo-e2e/);
  await page.getByRole("button", { name: "Duplicar como mío" }).click();
  await expect(page.getByRole("heading", { name: "Buenos Aires → Bariloche" })).toBeVisible();
  await expect(page.getByText("Precios ficticios")).toBeVisible();
  await page.getByRole("link", { name: "Comparador" }).click();
  await expect(page.getByRole("table", { name: "Comparación de escenarios" }).getByRole("columnheader", { name: "C · Micro + hostel" })).toBeVisible();
});

test("un enlace inexistente responde 404", async ({ page }) => {
  const res = await page.goto("/share/no-existe");
  expect(res?.status()).toBe(404);
});

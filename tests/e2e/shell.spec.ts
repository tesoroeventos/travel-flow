import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, registerUser } from "./helpers";

test("sin sesión redirige al ingreso", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
});

test("registro con invitación lleva al dashboard", async ({ page }) => {
  await registerUser(page);
  await expect(page.getByRole("heading", { name: "Viajes activos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próximos viajes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear viaje" }).first()).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const item of ["Inicio", "Mis viajes", "Crear viaje", "Configuración"]) {
    await expect(nav.getByRole("link", { name: item })).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
});

test("código inválido muestra el error", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Código de invitación").fill("NOEXISTE22");
  await page.getByLabel("Nombre").fill("Ana");
  await page.getByLabel("Email").fill(`x-${Date.now()}@travelflow.test`);
  await page.getByLabel("Contraseña").fill("secreta123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Código de invitación inválido").first()).toBeVisible();
});

test("el tema se puede alternar", async ({ page }) => {
  await registerUser(page);
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /Modo (claro|oscuro)/ }).click();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "");
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "");
});

test("cerrar sesión vuelve al ingreso", async ({ page }) => {
  const email = await registerUser(page);
  await page.goto("/configuracion");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("secreta123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Tus viajes" })).toBeVisible();
});

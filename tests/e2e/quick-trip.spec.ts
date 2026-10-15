import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, registerUser } from "./helpers";

test("viaje nuevo con una frase", async ({ page }) => {
  await registerUser(page);
  await page.getByRole("link", { name: "Viaje nuevo" }).first().click();
  await page
    .getByLabel("Tu viaje en una frase")
    .fill("Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate");
  await page.getByRole("button", { name: "Armar mi viaje" }).click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await expect(form.getByLabel("Destino")).toHaveValue("Bariloche");
  await expect(form.getByLabel("Salís desde")).toHaveValue("Zárate");
  await expect(form.getByLabel("Ida")).toHaveValue("2027-01-10");
  await expect(form.getByLabel("Vuelta")).toHaveValue("2027-01-16");
  await expect(form.getByLabel("Personas")).toHaveValue("2");
  await expectNoHorizontalScroll(page);
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/viajes\/[0-9a-f-]+\/opciones$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bariloche" }),
  ).toBeVisible();
});

test("lo que la IA supuso queda marcado para revisar", async ({ page }) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page.getByLabel("Tu viaje en una frase").fill("Mendoza en enero");
  await page.getByRole("button", { name: "Armar mi viaje" }).click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await expect(form.getByText("Revisá este dato")).toBeVisible();
});

test("formulario: la vuelta antes de la ida muestra el error", async ({
  page,
}) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page
    .getByRole("button", { name: "Prefiero completar un formulario" })
    .click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await form.getByLabel("Destino").fill("Mendoza");
  await form.getByLabel("Ida").fill("2027-02-10");
  await form.getByLabel("Vuelta").fill("2027-02-05");
  await form.getByLabel("Personas").fill("3");
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(
    form.getByText("La vuelta tiene que ser después de la ida"),
  ).toBeVisible();
});

test("editar los datos del viaje", async ({ page }) => {
  await registerUser(page);
  await page.goto("/viajes/nuevo");
  await page
    .getByRole("button", { name: "Prefiero completar un formulario" })
    .click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await form.getByLabel("Destino").fill("Salta");
  await form.getByLabel("Ida").fill("2027-03-01");
  await form.getByLabel("Vuelta").fill("2027-03-05");
  await form.getByLabel("Personas").fill("1");
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/opciones$/);
  await page.goto(page.url().replace("/opciones", "/editar"));
  const edit = page.getByRole("form", { name: "Datos del viaje" });
  await expect(edit.getByLabel("Destino")).toHaveValue("Salta");
  await edit.getByLabel("Salís desde").fill("Campana");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("desde Campana")).toBeVisible();
});

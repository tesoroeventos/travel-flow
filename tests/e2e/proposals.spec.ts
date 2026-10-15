import { expect, test } from "@playwright/test";
import {
  createQuickTrip,
  expectNoHorizontalScroll,
  registerUser,
  uploadShots,
} from "./helpers";

test("tus 3 opciones: ver, ajustar y elegir", async ({ page }) => {
  await registerUser(page);
  const trip = await createQuickTrip(page);
  await uploadShots(page, [
    "vuelo-ida",
    "vuelo-vuelta",
    "micro-ida",
    "micro-vuelta",
    "hotel",
    "hostel",
  ]);
  await page.getByRole("link", { name: "Ver mis 3 opciones" }).click();
  await expect(page).toHaveURL(`${trip}/propuestas`);
  await expect(
    page.getByRole("heading", { name: "Tus 3 opciones para Bariloche" }),
  ).toBeVisible();
  const cheap = page.getByRole("article", { name: "La más barata" });
  await expect(cheap).toContainText("Hostel del Lago");
  await expect(cheap).toContainText("Ahorrás");
  await expect(
    page.getByRole("article", { name: "La más rápida" }),
  ).toContainText("de viaje sumando ida y vuelta");
  await expect(
    page.getByRole("article", { name: "La más cómoda" }),
  ).toContainText("Combina vuelo directo con Hotel Centro Cívico (8,6/10).");
  await expectNoHorizontalScroll(page);

  await cheap.getByRole("button", { name: "Cambiar algo" }).click();
  await cheap
    .getByLabel("Alojamiento")
    .selectOption({ label: "Hotel Centro Cívico" });
  await expect(cheap).toContainText("Ajustada");
  await expect(cheap).toContainText("Combinación ajustada por vos.");
  await cheap.getByRole("link", { name: "Volver a la propuesta" }).click();
  await expect(cheap).not.toContainText("Ajustada");

  await page.getByText("Ver las 8 combinaciones").click();
  await expect(
    page
      .getByRole("table", { name: "Todas las combinaciones" })
      .getByRole("row"),
  ).toHaveCount(9);

  await page
    .getByRole("article", { name: "La más rápida" })
    .getByRole("button", { name: "Elegir esta" })
    .click();
  await expect(page).toHaveURL(`${trip}/confirmar`);
  await expect(
    page.getByRole("heading", { name: "Escenario elegido" }),
  ).toBeVisible();
  await expect(page.getByText("La más rápida").first()).toBeVisible();
});

test("sin todo lo necesario muestra qué falta", async ({ page }) => {
  await registerUser(page);
  const trip = await createQuickTrip(page);
  await page.goto(`${trip}/propuestas`);
  await expect(
    page.getByText(
      "Para comparar falta cómo vas y cómo volvés, dónde te alojás.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir a Opciones" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { createQuickTrip, expectNoHorizontalScroll, registerUser, uploadShots } from "./helpers";

test.describe("pantalla Opciones", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
    await createQuickTrip(page);
  });

  test("tres capturas arman la primera combinación", async ({ page }) => {
    await expect(page.getByText("Para comparar falta")).toBeVisible();
    await uploadShots(page, ["vuelo-ida", "vuelo-vuelta", "hotel"]);
    await expect(page.getByRole("article", { name: "AR 1672 · directo" })).toBeVisible();
    await expect(page.getByRole("article", { name: "AR 1673 · directo" })).toBeVisible();
    const hotel = page.getByRole("article", { name: "Hotel Centro Cívico" });
    await expect(hotel).toContainText("$ 480.000,00");
    await expect(hotel).toContainText("Revisá: precio");
    await expect(page.getByText("Listo. 1 combinación posible.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver mis 3 opciones" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("una captura ilegible se puede cargar a mano", async ({ page }) => {
    await page.getByLabel("Elegir capturas").setInputFiles("tests/e2e/fixtures/ilegible.png");
    await expect(page.getByText("No encontré una opción de viaje en esta captura.")).toBeVisible();
    await page.getByRole("button", { name: "Cargar a mano" }).click();
    await expect(page.getByRole("form", { name: "Editar opción" })).toBeVisible();
  });

  test("precios en dólares piden el valor del dólar", async ({ page }) => {
    await uploadShots(page, ["vuelo-ida", "vuelo-vuelta", "usd"]);
    await expect(page.getByText("¿A cuánto tomás el dólar?")).toBeVisible();
    await expect(page.getByText("Para comparar falta a cuánto tomás el dólar.")).toBeVisible();
    await page.getByLabel("Pesos por dólar").fill("1.200");
    await page.getByRole("button", { name: "Guardar dólar" }).click();
    await expect(page.getByText("Listo. 1 combinación posible.")).toBeVisible();
    await expect(page.getByRole("article", { name: "Cabaña del Bosque" })).toContainText("$ 504.000,00");
  });

  test("un link que apunta a la red local se bloquea", async ({ page }) => {
    await page.getByLabel("Link de una opción").fill("http://127.0.0.1/hotel");
    await page.getByRole("button", { name: "Leer link" }).click();
    await expect(page.getByText("Este sitio no deja leer el link. Subí una captura de la página.")).toBeVisible();
  });

  test("uso mi auto crea una opción de ida y vuelta", async ({ page }) => {
    await page.getByRole("button", { name: "Uso mi auto" }).click();
    await page.getByLabel("Modelo").fill("Gol Trend");
    await page.getByRole("button", { name: "Calcular" }).click();
    const car = page.getByRole("article", { name: "Tu auto · Gol Trend" });
    await expect(car).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ida y vuelta" })).toBeVisible();
    await expect(car).toContainText("Revisá: precio de la nafta, peajes");
  });

  test("editar el precio actualiza el total", async ({ page }) => {
    await uploadShots(page, ["hotel"]);
    const hotel = page.getByRole("article", { name: "Hotel Centro Cívico" });
    await hotel.getByRole("button", { name: "Editar" }).click();
    const form = page.getByRole("form", { name: "Editar opción" });
    await form.getByLabel("Precio").fill("90.000");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(hotel).toContainText("$ 540.000,00");
    await expect(hotel).not.toContainText("Revisá");
  });

  test("cargar a mano y borrar", async ({ page }) => {
    await page.getByLabel("Qué querés cargar").selectOption("actividad");
    await page.getByRole("button", { name: "A mano" }).click();
    const form = page.getByRole("form", { name: "Editar opción" });
    await form.getByLabel("Nombre").fill("Kayak en el lago");
    await form.getByLabel("Precio").fill("25.000");
    await form.getByRole("button", { name: "Guardar" }).click();
    const card = page.getByRole("article", { name: "Kayak en el lago" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Quitar" }).click();
    await expect(card).toHaveCount(0);
  });
});

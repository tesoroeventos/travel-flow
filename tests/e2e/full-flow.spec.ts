import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, registerUser, uploadShots } from "./helpers";

test("flujo completo en el celular: de la frase al itinerario y los gastos", async ({ page }) => {
  test.setTimeout(300_000);
  await registerUser(page);

  // 1. Frase → formulario
  await page.goto("/viajes/nuevo");
  await page
    .getByLabel("Tu viaje en una frase")
    .fill("Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate, presupuesto 1,5 millones");
  await page.getByRole("button", { name: "Armar mi viaje" }).click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await expect(form.getByLabel("Destino", { exact: true })).toHaveValue("Bariloche");
  await expectNoHorizontalScroll(page);
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/opciones$/);
  const trip = page.url().replace(/\/opciones$/, "");

  // 2. Capturas, dólar y auto
  await uploadShots(page, ["vuelo-ida", "vuelo-vuelta", "micro-ida", "micro-vuelta", "hotel", "usd"]);
  await page.getByLabel("Pesos por dólar").fill("1.200");
  await page.getByRole("button", { name: "Guardar dólar" }).click();
  await page.getByRole("button", { name: "Uso mi auto" }).click();
  await page.getByLabel("Modelo").fill("Gol Trend");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByRole("article", { name: "Tu auto · Gol Trend" })).toBeVisible();
  await expect(page.getByText(/Listo\. \d+ combinaciones posibles\./)).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 3. Las 3 opciones, cambiar algo y elegir
  await page.getByRole("link", { name: "Ver mis 3 opciones" }).click();
  for (const n of ["La más barata", "La más rápida", "La más cómoda"])
    await expect(page.getByRole("article", { name: n }).first()).toBeVisible();
  const fast = page.getByRole("article", { name: "La más rápida" });
  await fast.getByRole("button", { name: "Cambiar algo" }).click();
  await fast.getByLabel("Alojamiento").selectOption({ label: "Cabaña del Bosque" });
  await expect(fast).toContainText("Ajustada");
  await expectNoHorizontalScroll(page);
  await fast.getByRole("button", { name: "Elegir esta" }).click();

  // 4. Confirmar
  await expect(page).toHaveURL(`${trip}/confirmar`);
  await expect(page.getByRole("region", { name: "Resumen final" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 5. Itinerario
  await page.getByRole("link", { name: "Generar itinerario" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Salir de casa" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 6. Gasto real
  await page.goto(`${trip}/gastos`);
  await page.getByRole("button", { name: "Agregar gasto" }).click();
  const g = page.getByRole("form", { name: "Nuevo gasto" });
  await g.getByLabel("Fecha").fill("2027-01-11");
  await g.getByLabel("Descripción").fill("Cena");
  await g.getByLabel("Importe").fill("35.000");
  await g.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(
    page.getByRole("region", { name: "Resumen de gastos" }).getByText("Gastado").locator(".."),
  ).toContainText("$ 35.000,00");
  await expectNoHorizontalScroll(page);

  // 7. Exportar
  expect((await page.request.get(`${trip}/exportar/presupuesto.csv`)).status()).toBe(200);
  expect((await page.request.get(`${trip}/exportar/itinerario.ics`)).status()).toBe(200);

  // 8. Imprimir
  await page.goto(`${trip}/imprimir`);
  await expect(page.getByRole("heading", { name: "Presupuesto" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // 9. Inicio con el viaje
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Bariloche/ })).toContainText("Estimado (escenario elegido)");
  await expectNoHorizontalScroll(page);
});

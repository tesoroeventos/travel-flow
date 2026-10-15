import { expect, test } from "@playwright/test";
import { chooseSimpleTrip, createQuickTrip, registerUser } from "./helpers";

test("exportar presupuesto CSV, itinerario ICS y vista de impresión", async ({ page }) => {
  await registerUser(page);
  const trip = await createQuickTrip(page);
  await chooseSimpleTrip(page, trip);

  const csv = await page.request.get(`${trip}/exportar/presupuesto.csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvText = await csv.text();
  expect(csvText).toContain("Total con imprevistos");
  expect(csvText).toContain("940.000,00");

  const ics = await page.request.get(`${trip}/exportar/itinerario.ics`);
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("DTSTART:20270110T130000Z");

  await page.goto(`${trip}/itinerario`);
  await page.locator("summary", { hasText: "Más" }).click();
  await expect(page.getByRole("link", { name: "Presupuesto (CSV)", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Itinerario al calendario (.ics)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Imprimir o guardar PDF" }).first().click();
  await expect(page.getByRole("heading", { name: "Presupuesto" })).toBeVisible();
  await expect(page.getByText("$ 940.000,00").first()).toBeVisible();
  await expect(page.getByText("Salir de casa").first()).toBeVisible();

  // Otro usuario no puede descargar
  await page.context().clearCookies();
  const denied = await page.request.get(`${trip}/exportar/presupuesto.csv`, {
    maxRedirects: 0,
  });
  expect([302, 303, 307, 404]).toContain(denied.status());
});

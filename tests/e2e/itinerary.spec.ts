import { expect, test } from "@playwright/test";
import { chooseSimpleTrip, createQuickTrip, registerUser } from "./helpers";

async function addActivity(page: import("@playwright/test").Page, name: string, date: string) {
  await page.getByLabel("Qué querés cargar").selectOption("actividad");
  await page.getByRole("button", { name: "A mano" }).click();
  const form = page.getByRole("form", { name: "Editar opción" });
  await form.getByLabel("Nombre").fill(name);
  await form.getByLabel("Fecha").fill(date);
  await form.getByLabel("Precio").fill("0");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("article", { name })).toBeVisible();
}

test("itinerario con salida calculada, orden manual y aviso de cambios", async ({ page }) => {
  test.setTimeout(180_000);
  await registerUser(page);
  const trip = await createQuickTrip(page);
  await addActivity(page, "Museo", "2027-01-13");
  await addActivity(page, "Feria", "2027-01-13");
  await chooseSimpleTrip(page, trip);
  await page.getByRole("link", { name: "Generar itinerario" }).click();

  const leave = page.getByRole("listitem").filter({ hasText: "Salir de casa" });
  await expect(leave).toContainText("08:00");
  await expect(leave).toContainText("Sugerido");

  // Orden manual: Feria antes que Museo
  await expect(page.getByRole("listitem").filter({ hasText: "Museo" })).toContainText("09:00");
  await page.getByRole("button", { name: "Bajar Museo" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Feria" })).toContainText("09:00");
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Feria" })).toContainText("09:00");
  await expect(page.getByRole("listitem").filter({ hasText: "Museo" })).toContainText("10:00");

  await page.getByRole("link", { name: "Por día" }).click();
  await expect(page.getByRole("heading", { name: "Mañana" }).first()).toBeVisible();

  // Cambio de horario del vuelo desde Opciones → aviso en el itinerario
  await page.goto(`${trip}/opciones`);
  const flight = page.getByRole("article", { name: "AR 1672 · directo" });
  await flight.getByRole("button", { name: "Editar" }).click();
  const form = page.getByRole("form", { name: "Editar opción" });
  await form.getByLabel("Salida").fill("2027-01-10T12:00");
  await form.getByLabel("Llegada").fill("2027-01-10T14:20");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(flight).toContainText("12:00 → 14:20");
  await page.goto(`${trip}/itinerario`);
  const banner = page.getByRole("region", { name: "Cambió tu itinerario" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Salir de casa");
  await banner.getByRole("button", { name: "Entendido" }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "Salir de casa" })).toContainText("10:00");
});

import { expect, test } from "@playwright/test";
import { addActivity, addLodging, addScenario, addTransport, createBarilocheTrip, registerUser } from "./helpers";

test("itinerario con salida calculada, alertas, orden manual y aviso de cambios", async ({ page }) => {
  test.setTimeout(240_000);
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();
  await addTransport(page, trip, { leg: "outbound", mode: "flight", provider: "Vuelo ida", from: "AEP", to: "BRC", date: "2027-01-10", departs: "10:00", arrives: "12:20", price: "120.000", transferTo: "45", transferFrom: "30" });
  await addTransport(page, trip, { leg: "return", mode: "flight", provider: "Vuelo vuelta", from: "BRC", to: "AEP", date: "2027-01-16", departs: "17:00", arrives: "19:10", price: "110.000", transferTo: "30", transferFrom: "40" });
  await addLodging(page, trip, "Hotel Centro", "80.000");
  await addActivity(page, trip, { name: "Cerro Catedral", date: "2027-01-12", time: "10:00", duration: "120" });
  await addActivity(page, trip, { name: "Almuerzo Llao Llao", date: "2027-01-12", time: "11:00", duration: "60" });
  await addActivity(page, trip, { name: "Museo", date: "2027-01-13", duration: "60" });
  await addActivity(page, trip, { name: "Feria", date: "2027-01-13", duration: "60" });
  await addScenario(page, trip, "A", ["Vuelo ida", "Vuelo vuelta", "Hotel Centro", "Cerro Catedral", "Almuerzo Llao Llao", "Museo", "Feria"]);
  await page.goto(`${trip}/confirmar`);
  await page.getByRole("radio", { name: /^A/ }).check();
  await page.getByRole("button", { name: "Elegir este escenario" }).click();
  await page.getByRole("link", { name: "Generar itinerario" }).click();

  const leave = page.getByRole("listitem").filter({ hasText: "Salir de casa" });
  await expect(leave).toContainText("07:15");
  await expect(leave).toContainText("Sugerido");
  await expect(page.getByRole("listitem").filter({ hasText: "Almuerzo Llao Llao" })).toContainText("Se superponen");

  // Orden manual: Feria antes que Museo
  const museo = page.getByRole("listitem").filter({ hasText: "Museo" });
  await expect(museo).toContainText("09:00");
  await page.getByRole("button", { name: "Bajar Museo" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Feria" })).toContainText("09:00");
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Feria" })).toContainText("09:00");
  await expect(page.getByRole("listitem").filter({ hasText: "Museo" })).toContainText("10:00");

  // Vista por día
  await page.getByRole("link", { name: "Por día" }).click();
  await expect(page.getByRole("heading", { name: "Mañana" }).first()).toBeVisible();

  // Cambio de horario del vuelo → aviso
  await page.goto(`${trip}/transporte`);
  const flight = page.getByRole("article").filter({ hasText: "Vuelo ida" });
  await flight.getByRole("button", { name: "Editar alternativa" }).click();
  const form = flight.getByRole("form", { name: /Editar/ });
  await form.getByLabel("Sale a las").fill("12:00");
  await form.getByLabel("Llega a las").fill("14:20");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  await expect(flight.getByText(/12:00 →/)).toBeVisible();
  await page.goto(`${trip}/itinerario`);
  const banner = page.getByRole("region", { name: "Cambió tu itinerario" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Salir de casa");
  await banner.getByRole("button", { name: "Entendido" }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "Salir de casa" })).toContainText("09:15");
});

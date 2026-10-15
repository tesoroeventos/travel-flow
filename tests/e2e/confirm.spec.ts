import { expect, test } from "@playwright/test";
import { addLodging, addScenario, addTransport, createBarilocheTrip, registerUser } from "./helpers";

test("confirmar el viaje y cambiar estados de reserva y pago", async ({ page }) => {
  test.setTimeout(180_000);
  await registerUser(page);
  await createBarilocheTrip(page);
  const trip = page.url();
  await addTransport(page, trip, { leg: "outbound", mode: "flight", provider: "Vuelo ida", from: "AEP", to: "BRC", date: "2027-01-10", departs: "10:00", arrives: "12:20", price: "120.000" });
  await addTransport(page, trip, { leg: "return", mode: "flight", provider: "Vuelo vuelta", from: "BRC", to: "AEP", date: "2027-01-16", departs: "17:00", arrives: "19:10", price: "110.000" });
  await addLodging(page, trip, "Hotel Centro", "80.000");
  await addScenario(page, trip, "A", ["Vuelo ida", "Vuelo vuelta", "Hotel Centro"]);

  await page.goto(`${trip}/confirmar`);
  await page.getByRole("radio", { name: /^A/ }).check();
  await page.getByRole("button", { name: "Elegir este escenario" }).click();

  const summary = page.getByRole("region", { name: "Resumen final" });
  await expect(summary.getByText("Presupuesto definitivo")).toBeVisible();
  await expect(summary.getByText("$ 940.000,00").first()).toBeVisible();
  const hotel = summary.getByRole("listitem").filter({ hasText: "Hotel Centro" });
  await expect(hotel.getByLabel("Estado de reserva")).toHaveValue("selected");
  await hotel.getByLabel("Estado de reserva").selectOption("booking_confirmed");
  await hotel.getByLabel("Estado de pago").selectOption("paid");
  await hotel.getByLabel("Código de confirmación").fill("HX-123");
  await hotel.getByRole("button", { name: "Guardar estado" }).click();
  await expect(summary.getByText("Pagado").locator("..")).toContainText("$ 480.000,00");

  await page.reload();
  const hotel2 = page.getByRole("region", { name: "Resumen final" }).getByRole("listitem").filter({ hasText: "Hotel Centro" });
  await expect(hotel2.getByLabel("Estado de reserva")).toHaveValue("booking_confirmed");
  await expect(hotel2.getByLabel("Estado de pago")).toHaveValue("paid");
  await expect(hotel2.getByLabel("Código de confirmación")).toHaveValue("HX-123");
  await expect(page.getByRole("link", { name: "Generar itinerario" })).toBeVisible();
});

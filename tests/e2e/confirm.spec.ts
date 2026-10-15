import { expect, test } from "@playwright/test";
import { chooseSimpleTrip, createQuickTrip, registerUser } from "./helpers";

test("confirmar el viaje y cambiar estados de reserva y pago", async ({ page }) => {
  await registerUser(page);
  const trip = await createQuickTrip(page);
  await chooseSimpleTrip(page, trip);

  const summary = page.getByRole("region", { name: "Resumen final" });
  await expect(summary.getByText("Presupuesto definitivo")).toBeVisible();
  await expect(summary.getByText("$ 940.000,00").first()).toBeVisible();
  const hotel = summary.getByRole("listitem").filter({ hasText: "Hotel Centro Cívico" });
  await expect(hotel.getByLabel("Estado de reserva")).toHaveValue("selected");
  await hotel.getByLabel("Estado de reserva").selectOption("booking_confirmed");
  await hotel.getByLabel("Estado de pago").selectOption("paid");
  await hotel.getByLabel("Código de confirmación").fill("HX-123");
  await hotel.getByRole("button", { name: "Guardar estado" }).click();
  await expect(summary.getByText("Pagado").locator("..")).toContainText("$ 480.000,00");

  await page.reload();
  const hotel2 = page
    .getByRole("region", { name: "Resumen final" })
    .getByRole("listitem")
    .filter({ hasText: "Hotel Centro Cívico" });
  await expect(hotel2.getByLabel("Estado de reserva")).toHaveValue("booking_confirmed");
  await expect(hotel2.getByLabel("Estado de pago")).toHaveValue("paid");
  await expect(hotel2.getByLabel("Código de confirmación")).toHaveValue("HX-123");
  await expect(page.getByRole("link", { name: "Generar itinerario" })).toBeVisible();
});

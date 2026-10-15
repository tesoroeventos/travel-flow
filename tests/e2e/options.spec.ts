import { expect, test } from "@playwright/test";
import { createBarilocheTrip, expectNoHorizontalScroll, registerUser } from "./helpers";

test("cargar transporte, calculadora de auto, alojamiento y editar un precio", async ({ page }) => {
  await registerUser(page);
  await createBarilocheTrip(page);
  const tripUrl = page.url();

  // Vuelo de ida
  await page.goto(`${tripUrl}/transporte`);
  let form = page.getByRole("form", { name: "Nueva alternativa de transporte" });
  await page.getByRole("button", { name: "Agregar transporte" }).click();
  await form.getByLabel("Tramo").selectOption("outbound");
  await form.getByLabel("Medio").selectOption("flight");
  await form.getByLabel("Empresa o proveedor").fill("Aerolíneas Argentinas");
  await form.getByLabel("Desde").fill("Aeroparque");
  await form.getByLabel("Hasta").fill("Bariloche");
  await form.getByLabel("Sale el día").fill("2027-01-10");
  await form.getByLabel("Sale a las").fill("10:00");
  await form.getByLabel("Llega el día").fill("2027-01-10");
  await form.getByLabel("Llega a las").fill("12:20");
  await form.getByLabel("Precio").fill("120.000");
  await form.getByLabel("Se cobra").selectOption("per_person");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();

  const flight = page.getByRole("article").filter({ hasText: "Aerolíneas Argentinas" });
  await expect(flight.getByText("Total del grupo")).toBeVisible();
  await expect(flight.getByText("$ 240.000,00").first()).toBeVisible();
  await expect(flight.getByText("2 h 20 min")).toBeVisible();

  // Auto propio con calculadora
  await page.getByRole("button", { name: "Agregar transporte" }).click();
  form = page.getByRole("form", { name: "Nueva alternativa de transporte" });
  await form.getByLabel("Tramo").selectOption("outbound");
  await form.getByLabel("Medio").selectOption("own_car");
  await form.getByLabel("Empresa o proveedor").fill("Auto propio");
  await form.getByLabel("Desde").fill("Zárate");
  await form.getByLabel("Hasta").fill("Bariloche");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  const car = page.getByRole("article").filter({ hasText: "Auto propio" });
  await car.getByRole("button", { name: "Calcular costo del auto" }).click();
  await car.getByLabel("Kilómetros totales").fill("3200");
  await car.getByLabel("Consumo (l/100 km)").fill("8");
  await car.getByLabel("Precio del combustible por litro").fill("1.200");
  await car.getByRole("button", { name: "Agregar costos del auto" }).click();
  await expect(car.getByText(/Combustible: 3\.200 km/)).toBeVisible();
  await expect(car.getByText("$ 307.200,00").first()).toBeVisible();

  // Alojamiento
  await page.goto(`${tripUrl}/alojamiento`);
  await page.getByRole("button", { name: "Agregar alojamiento" }).click();
  form = page.getByRole("form", { name: "Nueva alternativa de alojamiento" });
  await form.getByLabel("Nombre").fill("Hotel Centro");
  await form.getByLabel("Precio").fill("80.000");
  await form.getByLabel("Se cobra").selectOption("per_night");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  const hotel = page.getByRole("article").filter({ hasText: "Hotel Centro" });
  await expect(hotel.getByText("Total estadía")).toBeVisible();
  await expect(hotel.getByText("$ 480.000,00").first()).toBeVisible();
  await expect(hotel.getByText("$ 240.000,00").first()).toBeVisible();
  await expect(hotel.getByText("6 noches")).toBeVisible();

  // Editar el precio actualiza el total
  await hotel.getByRole("button", { name: /Editar partida/ }).first().click();
  await hotel.getByLabel("Importe").fill("90.000");
  await hotel.getByRole("button", { name: "Guardar partida" }).click();
  await expect(hotel.getByText("$ 540.000,00").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("actividades con hora opcional", async ({ page }) => {
  await registerUser(page);
  await createBarilocheTrip(page);
  await page.goto(`${page.url()}/actividades`);
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  const form = page.getByRole("form", { name: "Nueva actividad" });
  await form.getByLabel("Nombre").fill("Cerro Catedral");
  await form.getByLabel("Fecha").fill("2027-01-12");
  await form.getByLabel("Duración (min)").fill("240");
  await form.getByLabel("Precio").fill("40.000");
  await form.getByLabel("Se cobra").selectOption("per_person");
  await form.getByRole("button", { name: "Guardar actividad" }).click();
  const act = page.getByRole("article").filter({ hasText: "Cerro Catedral" });
  await expect(act.getByText("$ 80.000,00").first()).toBeVisible();
  await expect(act.getByText("4 h")).toBeVisible();
});

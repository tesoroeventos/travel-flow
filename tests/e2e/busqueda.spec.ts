import { expect, test, type Page } from "@playwright/test";
import { createQuickTrip, expectNoHorizontalScroll, registerUser } from "./helpers";

async function chooseAirports(page: Page) {
  const radar = page.locator("details", { hasText: "Buscar en otros sitios" });
  await radar.getByLabel("Buscar ciudad o aeropuerto de salida").fill("Buenos Aires");
  await radar.getByRole("button", { name: "BUE · Buenos Aires" }).click();
  await radar.getByRole("button", { name: "BRC · San Carlos de Bariloche" }).click();
  await radar.getByRole("button", { name: "Guardar aeropuertos" }).click();
}

const flightLinks = (page: Page) => page.getByRole("link", { name: /^Google Flights · / });
const hotelLinks = (page: Page) => page.getByRole("link", { name: /^Google Hotels · / });

test.describe("búsqueda automática", () => {
  test.beforeEach(async ({ page, context }) => {
    // Ningún sitio externo se abre de verdad en la prueba.
    await context.route(/^https:\/\/(?!localhost)/, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<p>externo</p>" }),
    );
    await registerUser(page);
  });

  test("viaje nuevo: aeropuertos y las 3 opciones sin cargar nada", async ({ page }) => {
    await createQuickTrip(page);
    const auto = page.getByRole("region", { name: "Búsqueda automática" });
    await chooseAirports(page);

    await expect(auto.getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible();
    await expect(flightLinks(page)).toHaveCount(5);
    await expect(hotelLinks(page)).toHaveCount(6);
    await expect(page.getByRole("article", { name: "AR 1682" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Nahuel Departamentos" })).toBeVisible();
    await expect(auto.getByText("Flybondi también vuela esta ruta, pero Google no muestra su precio")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.reload();
    await expect(auto.getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible();
    await expect(auto.getByText("Buscando vuelos y alojamiento…")).toHaveCount(0);
    await expect(flightLinks(page)).toHaveCount(5);
    await expect(hotelLinks(page)).toHaveCount(6);

    await page.getByRole("link", { name: /Ver mis 3 opciones/ }).click();
    await expect(page).toHaveURL(/\/propuestas$/);
    await expect(page.getByText("Aerolíneas Argentinas").first()).toBeVisible();
  });

  test("al elegir una opción se completa el vuelo de vuelta", async ({ page }) => {
    const trip = await createQuickTrip(page);
    await chooseAirports(page);
    await expect(page.getByRole("region", { name: "Búsqueda automática" }).getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible();
    await page.goto(`${trip}/propuestas`);
    await page.getByRole("article", { name: "La más barata" }).getByRole("button", { name: "Elegir esta" }).click();
    await expect(page).toHaveURL(`${trip}/confirmar`);
    await page.goto(`${trip}/itinerario`);
    // La vuelta simulada es el AR 1682 dado vuelta: sale de Bariloche el 16/01 a las 18:20.
    await expect(page.getByText("Aerolíneas Argentinas AR 1682 · BRC → EZE")).toBeVisible();
  });

  test("Volver a buscar reemplaza las importadas", async ({ page }) => {
    await createQuickTrip(page);
    await chooseAirports(page);
    const auto = page.getByRole("region", { name: "Búsqueda automática" });
    await expect(auto.getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible();
    await auto.getByRole("button", { name: "Volver a buscar" }).click();
    await expect(auto.getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible();
    await expect(flightLinks(page)).toHaveCount(5);
    await expect(hotelLinks(page)).toHaveCount(6);
  });

  test("recargar en medio de la búsqueda no busca de nuevo ni duplica", async ({ page }) => {
    await createQuickTrip(page);
    await chooseAirports(page);
    const auto = page.getByRole("region", { name: "Búsqueda automática" });
    await expect(auto.getByText("Buscando vuelos y alojamiento…")).toBeVisible();
    // Se recarga con la búsqueda en curso; la recargada no lanza otra (si termina antes, igual no duplica).
    await page.reload();
    await expect(auto.getByText("✓ 5 vuelos y 6 alojamientos")).toBeVisible({ timeout: 15_000 });
    await expect(flightLinks(page)).toHaveCount(5);
    await expect(hotelLinks(page)).toHaveCount(6);
  });

  test("sin aeropuertos no busca", async ({ page }) => {
    await createQuickTrip(page);
    await expect(page.getByRole("region", { name: "Búsqueda automática" })).toHaveCount(0);
    await expect(flightLinks(page)).toHaveCount(0);
  });
});

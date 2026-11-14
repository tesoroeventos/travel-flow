import { expect, test, type Page } from "@playwright/test";
import { createQuickTrip, expectNoHorizontalScroll, registerUser, uploadShots } from "./helpers";

/** Abre la sección del radar si está plegada. */
async function openRadar(page: Page) {
  const radar = page.locator("details", { hasText: "Buscar en otros sitios" });
  if ((await radar.getAttribute("open")) === null) await radar.locator("summary").click();
  await expect(radar).toHaveAttribute("open", "");
}

test.describe("radar de fuentes", () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test("aeropuertos, calendario, enlaces y vuelta a la carga rápida", async ({ page, context }) => {
    // Ningún sitio externo se abre de verdad en la prueba: responde una página vacía.
    await context.route(/^https:\/\/(?!localhost)/, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<p>sitio externo</p>" }),
    );
    await createQuickTrip(page);

    const radar = page.locator("details", { hasText: "Buscar en otros sitios" });
    await expect(radar).toHaveAttribute("open", "");
    await expect(radar.getByText("Elegí los aeropuertos para buscar vuelos.")).toBeVisible();
    await expect(radar.getByRole("region", { name: "Vuelos" })).toHaveCount(0);
    await expect(radar.getByRole("region", { name: "Alojamiento" })).toBeVisible();

    // Zárate no tiene aeropuerto: se busca la ciudad por nombre.
    await radar.getByLabel("Buscar ciudad o aeropuerto de salida").fill("Buenos Aires");
    await radar.getByRole("button", { name: "BUE · Buenos Aires" }).click();
    await radar.getByRole("button", { name: "BRC · San Carlos de Bariloche" }).click();
    await radar.getByRole("button", { name: "Guardar aeropuertos" }).click();

    const cal = radar.getByRole("region", { name: "Precios de referencia" });
    await expect(cal.getByText(/no son precio final/)).toBeVisible();
    await expect(cal.getByRole("listitem")).toHaveCount(7);
    await expect(cal.getByText("sin datos")).toHaveCount(2);
    await expect(cal.getByText("más bajo")).toHaveCount(1);
    await expect(cal.getByText(/Flybondi, 1 escala · consultado hace/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await cal.getByRole("button", { name: /^11 ene/ }).click();
    await expect(radar.getByText("Enlaces con salida el 11 ene")).toBeVisible();
    const gf = radar.locator('a[data-site="google-flights"]');
    await expect(gf).toHaveAttribute("href", /2027-01-11%20through%202027-01-17/);
    await radar.getByRole("button", { name: "Volver a las fechas del viaje" }).click();
    await expect(gf).toHaveAttribute("href", /2027-01-10%20through%202027-01-16/);

    const [popup] = await Promise.all([context.waitForEvent("page"), radar.locator('a[data-site="booking"]').click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/^https:\/\/www\.booking\.com\/searchresults/);
    await popup.close();
    await expect(radar.getByText("Revisaste 1 de 17")).toBeVisible();
    await expect(radar.locator('a[data-site="booking"]')).toContainText("(revisado)");

    // Con aeropuertos, la búsqueda automática ya trajo opciones: al recargar la sección arranca plegada.
    await page.reload();
    await openRadar(page);
    await expect(page.getByText("Revisaste 1 de 17")).toBeVisible();
    await page.getByRole("button", { name: "Empezar de nuevo" }).click();
    await expect(page.getByText("Revisaste 0 de 17")).toBeVisible();
    await page.reload();
    await openRadar(page);
    await expect(page.getByText("Revisaste 0 de 17")).toBeVisible();

    // Lo que se encuentra vuelve por la carga rápida de siempre.
    await uploadShots(page, ["vuelo-ida"]);
    await expect(page.getByRole("article", { name: "AR 1672 · directo" })).toBeVisible();
    await page.reload();
    await expect(page.locator("details", { hasText: "Buscar en otros sitios" })).not.toHaveAttribute("open", "");
  });

  test("ruta sin datos muestra el aviso y los enlaces", async ({ page }) => {
    await createQuickTrip(page, { destination: "Mendoza" });
    const radar = page.locator("details", { hasText: "Buscar en otros sitios" });
    await radar.getByLabel("Buscar ciudad o aeropuerto de salida").fill("Buenos Aires");
    await radar.getByRole("button", { name: "BUE · Buenos Aires" }).click();
    await radar.getByRole("button", { name: "MDZ · Mendoza" }).click();
    await radar.getByRole("button", { name: "Guardar aeropuertos" }).click();
    await expect(radar.getByText("Nadie buscó esta ruta en los últimos días. Usá los enlaces.")).toBeVisible();
    await expect(radar.locator('a[data-site="kayak"]')).toHaveAttribute("href", /BUE-MDZ/);
  });

  test("al cambiar los aeropuertos el calendario se vuelve a pedir", async ({ page }) => {
    await createQuickTrip(page);
    const radar = page.locator("details", { hasText: "Buscar en otros sitios" });
    await radar.getByLabel("Buscar ciudad o aeropuerto de salida").fill("Buenos Aires");
    await radar.getByRole("button", { name: "BUE · Buenos Aires" }).click();
    await radar.getByRole("button", { name: "BRC · San Carlos de Bariloche" }).click();
    await radar.getByRole("button", { name: "Guardar aeropuertos" }).click();
    await expect(radar.getByText("más bajo")).toBeVisible();

    await radar.getByRole("button", { name: "Cambiar" }).click();
    await radar.getByRole("textbox", { name: /^Aeropuerto de destino/ }).fill("MDZ");
    await radar.getByRole("button", { name: "Guardar aeropuertos" }).click();
    await expect(radar.getByText("Nadie buscó esta ruta en los últimos días. Usá los enlaces.")).toBeVisible();
    await expect(radar.getByText("más bajo")).toHaveCount(0);
  });
});

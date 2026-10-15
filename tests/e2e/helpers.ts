import { expect, type Page } from "@playwright/test";

export const E2E_INVITE = "PRUEBAE2E2";

let counter = 0;

/** Registra un usuario nuevo y deja la sesión abierta en el Dashboard. */
export async function registerUser(page: Page, name = "Ana"): Promise<string> {
  const email = `e2e-${Date.now()}-${counter++}@travelflow.test`;
  await page.goto("/registro");
  await page.getByLabel("Código de invitación").fill(E2E_INVITE);
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("secreta123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Tus viajes" })).toBeVisible();
  return email;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function createBarilocheTrip(page: Page) {
  await page.goto("/viajes/nuevo");
  await page.getByLabel("Nombre del viaje").fill("Bariloche 2027");
  await page.getByLabel("Origen").fill("Zárate");
  await page.getByLabel("Destino principal").fill("Bariloche");
  await page.getByLabel("Fecha de salida").fill("2027-01-10");
  await page.getByLabel("Hora de salida").fill("08:00");
  await page.getByLabel("Fecha de regreso").fill("2027-01-16");
  await page.getByLabel("Hora de regreso").fill("20:00");
  await page.getByLabel("Adultos").fill("2");
  await page.getByLabel("Presupuesto total").fill("1.500.000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(
    page.getByRole("heading", { name: "Preferencias" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(
    page.getByRole("heading", { name: "Restricciones" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear viaje" }).click();
  await expect(
    page.getByRole("heading", { name: "Bariloche 2027" }),
  ).toBeVisible();
}

export interface TransportInput {
  leg: "outbound" | "return" | "internal";
  mode: string;
  provider: string;
  from: string;
  to: string;
  date: string;
  departs: string;
  arriveDate?: string;
  arrives: string;
  price: string;
  unit?: string;
  transferTo?: string;
  transferFrom?: string;
}

export async function addTransport(
  page: Page,
  tripUrl: string,
  t: TransportInput,
) {
  await page.goto(`${tripUrl}/transporte`);
  await page.getByRole("button", { name: "Agregar transporte" }).click();
  const form = page.getByRole("form", {
    name: "Nueva alternativa de transporte",
  });
  await form.getByLabel("Tramo").selectOption(t.leg);
  await form.getByLabel("Medio").selectOption(t.mode);
  await form.getByLabel("Empresa o proveedor").fill(t.provider);
  await form.getByLabel("Desde").fill(t.from);
  await form.getByLabel("Hasta").fill(t.to);
  await form.getByLabel("Sale el día").fill(t.date);
  await form.getByLabel("Sale a las").fill(t.departs);
  await form.getByLabel("Llega el día").fill(t.arriveDate ?? t.date);
  await form.getByLabel("Llega a las").fill(t.arrives);
  if (t.transferTo)
    await form
      .getByLabel("Minutos de traslado a la terminal")
      .fill(t.transferTo);
  if (t.transferFrom)
    await form.getByLabel("Minutos de traslado al llegar").fill(t.transferFrom);
  await form.getByLabel("Precio").fill(t.price);
  await form.getByLabel("Se cobra").selectOption(t.unit ?? "per_person");
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: t.provider }).first(),
  ).toBeVisible();
}

export async function addLodging(
  page: Page,
  tripUrl: string,
  name: string,
  price: string,
  unit = "per_night",
) {
  await page.goto(`${tripUrl}/alojamiento`);
  await page.getByRole("button", { name: "Agregar alojamiento" }).click();
  const form = page.getByRole("form", {
    name: "Nueva alternativa de alojamiento",
  });
  await form.getByLabel("Nombre").fill(name);
  await form.getByLabel("Precio").fill(price);
  await form.getByLabel("Se cobra").selectOption(unit);
  await form.getByRole("button", { name: "Guardar alternativa" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: name }),
  ).toBeVisible();
}

export async function addActivity(
  page: Page,
  tripUrl: string,
  a: {
    name: string;
    date: string;
    time?: string;
    duration: string;
    price?: string;
  },
) {
  await page.goto(`${tripUrl}/actividades`);
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  const form = page.getByRole("form", { name: "Nueva actividad" });
  await form.getByLabel("Nombre").fill(a.name);
  await form.getByLabel("Fecha").fill(a.date);
  if (a.time) await form.getByLabel("Hora", { exact: true }).fill(a.time);
  await form.getByLabel("Duración (min)").fill(a.duration);
  if (a.price) await form.getByLabel("Precio").fill(a.price);
  await form.getByRole("button", { name: "Guardar actividad" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: a.name }),
  ).toBeVisible();
}

export async function addScenario(
  page: Page,
  tripUrl: string,
  name: string,
  picks: string[],
) {
  await page.goto(`${tripUrl}/comparador`);
  await page.getByRole("button", { name: "Nuevo escenario" }).click();
  await page.getByLabel("Nombre del escenario").fill(name);
  await page.getByRole("button", { name: "Crear escenario" }).click();
  const region = page.getByRole("region", { name: `Escenario ${name}` });
  await expect(region).toBeVisible();
  await region.getByRole("button", { name: "Armar escenario" }).click();
  for (const p of picks) {
    const box = region.getByRole("checkbox", { name: p });
    await box.check();
    await expect(box).toBeChecked();
  }
  await expect(
    region.getByText(
      `${picks.length} ${picks.length === 1 ? "alternativa elegida" : "alternativas elegidas"}.`,
    ),
  ).toBeVisible();
  await region.getByRole("button", { name: "Listo" }).click();
}

/** Crea un viaje con el formulario corto (Bariloche, 10 al 16 de enero de 2027) y deja abierta la pantalla Opciones. */
export async function createQuickTrip(
  page: Page,
  opts: { origin?: string; travelers?: string; destination?: string } = {},
) {
  await page.goto("/viajes/nuevo");
  await page
    .getByRole("button", { name: "Prefiero completar un formulario" })
    .click();
  const form = page.getByRole("form", { name: "Datos del viaje" });
  await form.getByLabel("Destino").fill(opts.destination ?? "Bariloche");
  if (opts.origin !== "")
    await form.getByLabel("Salís desde").fill(opts.origin ?? "Zárate");
  await form.getByLabel("Ida").fill("2027-01-10");
  await form.getByLabel("Vuelta").fill("2027-01-16");
  await form.getByLabel("Personas").fill(opts.travelers ?? "2");
  await form.getByLabel("Presupuesto (opcional)").fill("1.500.000");
  await form.getByRole("button", { name: "Sumar opciones" }).click();
  await expect(page).toHaveURL(/\/opciones$/);
  return page.url().replace(/\/opciones$/, "");
}

/** Sube capturas de tests/e2e/fixtures y espera que terminen de leerse. */
export async function uploadShots(page: Page, names: string[]) {
  await page
    .getByLabel("Elegir capturas")
    .setInputFiles(names.map((n) => `tests/e2e/fixtures/${n}.png`));
  await expect(page.getByText("Leyendo…")).toHaveCount(0, { timeout: 30_000 });
}

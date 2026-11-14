# Radar de fuentes: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar arriba de la pestaña Opciones una sección "Buscar en otros sitios" con precios de referencia de Travelpayouts para los días cercanos a la ida y enlaces que abren la misma búsqueda en 17 sitios, recordando cuáles ya se abrieron.

**Architecture:** Lógica pura de fechas y consulta en `src/domain/radar/`. Lista declarativa de sitios y proveedor de precios (real y simulado) en `src/integrations/radar/`. Caché de precios y marcas de revisado en Postgres, con repositorio y acciones de servidor en `src/server/`. Un componente cliente `RadarPanel` en `src/ui/radar/` que la página de Opciones muestra antes de `OptionsBoard`.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript estricto, Drizzle + Postgres (PGlite en pruebas), Zod 4, date-fns-tz, Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-radar-de-fuentes-design.md`

## Global Constraints

- Antes de escribir código de Next, leer la guía que corresponda en `node_modules/next/dist/docs/` (regla de `AGENTS.md`).
- La app nunca descarga ni lee las páginas de los sitios: solo arma direcciones que abre el navegador de Matias.
- Un precio de Travelpayouts siempre lleva la etiqueta "referencia". Nunca se muestra como verificado ni se guarda como partida de costo.
- Un día sin datos se muestra como "sin datos". Nunca se interpola ni se estima.
- `RADAR_FAKE=1` con `NODE_ENV=production` impide arrancar la app (mismo criterio que `AI_FAKE`).
- Sin `TRAVELPAYOUTS_TOKEN` la sección muestra solo los enlaces y el texto "Precios de referencia no configurados".
- Caché de precios: 6 horas. Ventana: 3 días antes y 3 después de la ida.
- Textos de la interfaz en español rioplatense, copiados tal cual de la sección 7 del spec:
  - "No pude traer los precios de referencia ahora. Los enlaces funcionan igual."
  - "Nadie buscó esta ruta en los últimos días. Usá los enlaces."
  - "El token de Travelpayouts no es válido. Revisá `TRAVELPAYOUTS_TOKEN`."
  - "Elegí los aeropuertos para buscar vuelos."
  - "Abre la página principal: cargá los datos a mano."
- Repositorios: todo acceso verifica que el viaje sea del workspace (`assertTrip` / `ownsTrip` de `src/server/repos/child.ts`).

## Review Focus

1. Fecha de vuelta corrida un día: `endAt` se guarda como 23:59 en Buenos Aires, que en UTC ya es el día siguiente. Las fechas de la consulta salen en la zona del viaje (`startTz`, `endTz`), nunca con `toISOString()`. Prueba en Task 2.
2. Viaje con chicos o bebés: los sitios que no reciben chicos en la dirección muestran "Sumá los chicos a mano" junto al botón, para que no se abra una búsqueda con menos personas sin aviso. Pruebas en Task 3 y Task 7.
3. Nombres con tildes y espacios ("San Carlos de Bariloche", "Zárate"): las direcciones los codifican bien. Prueba en Task 3.
4. Viaje que sale en menos de 3 días: los días anteriores a hoy no se consultan ni se muestran. Prueba en Task 2.
5. Respuesta de Travelpayouts con precio 0, negativo o campos faltantes: esa entrada se descarta y el día queda "sin datos", nunca "$0". Prueba en Task 4.

---

### Task 1: Esquema y migración `0002_radar`

**Files:**
- Modify: `src/server/db/schema.ts` (tabla `trips` y dos tablas nuevas al final)
- Create: `drizzle/0002_radar.sql` y `drizzle/meta/*` (generados)
- Test: `src/server/db/radar-schema.test.ts`

**Interfaces:**
- Produces: columnas `trips.originIata: string | null`, `trips.destinationIata: string | null`; tablas `radarChecks` (`tripId`, `siteId`, `openedAt`, clave primaria `(tripId, siteId)`, `tripId` con `on delete cascade`) y `priceCache` (`key` text pk, `payload` jsonb, `fetchedAt` timestamptz no nulo).

- [ ] **Step 1: Escribir la prueba que falla**

```ts
describe("esquema del radar", () => {
  it("guarda códigos IATA en el viaje", async () => {
    // crear usuario, workspace y viaje como en isolation.test.ts, con originIata "BUE", destinationIata "BRC"
    expect(trip.originIata).toBe("BUE");
    expect(trip.destinationIata).toBe("BRC");
  });
  it("radar_checks no admite dos filas para el mismo sitio y viaje", async () => {
    await db.insert(radarChecks).values({ tripId, siteId: "booking", openedAt: new Date() });
    await expect(db.insert(radarChecks).values({ tripId, siteId: "booking", openedAt: new Date() })).rejects.toThrow();
  });
  it("borrar el viaje borra sus marcas", async () => {
    await db.delete(trips).where(eq(trips.id, tripId));
    expect(await db.select().from(radarChecks)).toHaveLength(0);
  });
  it("price_cache guarda payload y fecha", async () => {
    await db.insert(priceCache).values({ key: "k", payload: { a: 1 }, fetchedAt: new Date("2026-11-14T12:00:00Z") });
    const [row] = await db.select().from(priceCache);
    expect(row!.payload).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run src/server/db/radar-schema.test.ts`
Expected: FAIL (no existen `radarChecks`, `priceCache` ni las columnas).

- [ ] **Step 3: Agregar columnas y tablas en `schema.ts` y generar la migración**

Columnas `origin_iata` y `destination_iata` (`text`, nulas) en `trips`. Tablas `radar_checks` y `price_cache` con los nombres de Interfaces. Luego: `npm run db:generate -- --name radar` y confirmar que el SQL quedó en `drizzle/0002_radar.sql`.

- [ ] **Step 4: Correr la prueba y las de esquema existentes**

Run: `npx vitest run src/server/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db drizzle
git commit -m "feat(radar): esquema y migración 0002_radar"
```

---

### Task 2: Consulta y fechas del radar (dominio puro)

**Files:**
- Create: `src/domain/radar/query.ts`
- Test: `src/domain/radar/query.test.ts`

**Interfaces:**
- Produces:
  - `interface RadarQuery` exactamente como en la sección 6.2 del spec.
  - `buildRadarQuery(trip: Pick<Trip, "originIata" | "destinationIata" | "originLabel" | "destinationLabel" | "startAt" | "startTz" | "endAt" | "endTz" | "rooms">, travelers: { kind: "adult" | "child" | "infant" }[]): RadarQuery`
  - `shiftDeparture(q: RadarQuery, newDepart: string): RadarQuery`: cambia la ida y corre la vuelta la misma cantidad de días.
  - `windowDates(depart: string, ret: string, windowDays: number, today: string): { depart: string; return: string }[]`: de `depart - windowDays` a `depart + windowDays`, misma duración, sin días anteriores a `today`, en orden.
  - `hasKids(q: RadarQuery): boolean`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
const trip = {
  originIata: "BUE", destinationIata: "BRC", originLabel: "Zárate", destinationLabel: "Bariloche",
  startAt: new Date("2027-01-10T03:00:00Z"), startTz: "America/Argentina/Buenos_Aires",
  endAt: new Date("2027-01-17T02:59:00Z"), endTz: "America/Argentina/Buenos_Aires", rooms: 1,
};
it("toma las fechas en la zona del viaje", () => {
  const q = buildRadarQuery(trip, [{ kind: "adult" }, { kind: "adult" }]);
  expect(q.depart).toBe("2027-01-10");
  expect(q.return).toBe("2027-01-16");
});
it("cuenta personas por tipo", () => {
  const q = buildRadarQuery(trip, [{ kind: "adult" }, { kind: "child" }, { kind: "infant" }]);
  expect([q.adults, q.children, q.infants]).toEqual([1, 1, 1]);
  expect(hasKids(q)).toBe(true);
});
it("corre la vuelta al cambiar la ida", () => {
  const q = shiftDeparture(buildRadarQuery(trip, [{ kind: "adult" }]), "2027-01-11");
  expect([q.depart, q.return]).toEqual(["2027-01-11", "2027-01-17"]);
});
it("arma la ventana de 7 días con la misma duración", () => {
  const w = windowDates("2027-01-10", "2027-01-16", 3, "2026-11-14");
  expect(w).toHaveLength(7);
  expect(w[0]).toEqual({ depart: "2027-01-07", return: "2027-01-13" });
  expect(w[6]).toEqual({ depart: "2027-01-13", return: "2027-01-19" });
});
it("no incluye días pasados", () => {
  expect(windowDates("2026-11-15", "2026-11-20", 3, "2026-11-14").map((d) => d.depart))
    .toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
});
it("cruza fin de mes", () => {
  expect(windowDates("2027-02-01", "2027-02-05", 3, "2026-11-14")[0]!.depart).toBe("2027-01-29");
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/domain/radar/query.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar en `src/domain/radar/query.ts`**

Fechas con `formatInTimeZone` de `date-fns-tz`. La aritmética de días sobre cadenas `YYYY-MM-DD` con `date-fns` en UTC para no depender de la zona del servidor. `rooms` sale de `trip.rooms`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run src/domain/radar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/radar
git commit -m "feat(radar): consulta y ventana de fechas"
```

---

### Task 3: Lista de sitios

**Files:**
- Create: `src/integrations/radar/sites.ts`
- Test: `src/integrations/radar/sites.test.ts`

**Interfaces:**
- Consumes: `RadarQuery` (Task 2).
- Produces:
  - `interface RadarSite` como en la sección 6.2 del spec, más `supportsChildren: boolean` (la dirección lleva chicos y bebés).
  - `RADAR_SITES: readonly RadarSite[]` con los 17 sitios en el orden del boceto.
  - `RADAR_GROUPS: { id: RadarSite["group"]; label: string }[]` con las etiquetas "Vuelos", "Aerolíneas", "Micros", "Alojamiento".
  - `findSite(id: string): RadarSite | undefined`

Sitios iniciales. Las direcciones son el punto de partida y se confirman en el Step 5:

| id | group | prefills | supportsChildren | Dirección para la consulta fija* |
|---|---|---|---|---|
| google-flights | vuelos | true | false | `https://www.google.com/travel/flights?q=Flights%20from%20BUE%20to%20BRC%20on%202027-01-10%20through%202027-01-16%20for%202%20adults&hl=es-419` |
| skyscanner | vuelos | true | false | `https://www.skyscanner.com.ar/transporte/vuelos/bue/brc/270110/270116/?adultsv2=2&rtn=1` |
| kayak | vuelos | true | false | `https://www.kayak.com.ar/flights/BUE-BRC/2027-01-10/2027-01-16/2adults` |
| despegar-vuelos | vuelos | true | true | `https://www.despegar.com.ar/shop/flights/results/roundtrip/BUE/BRC/2027-01-10/2027-01-16/2/0/0` |
| almundo | vuelos | false | false | `https://almundo.com.ar/` |
| aerolineas | aerolineas | false | false | `https://www.aerolineas.com.ar/` |
| flybondi | aerolineas | false | false | `https://flybondi.com/ar` |
| jetsmart | aerolineas | false | false | `https://jetsmart.com/ar/es/` |
| latam | aerolineas | false | false | `https://www.latamairlines.com/ar/es` |
| gol | aerolineas | false | false | `https://www.voegol.com.br/es` |
| plataforma10 | micros | false | false | `https://www.plataforma10.com.ar/` |
| centraldepasajes | micros | false | false | `https://www.centraldepasajes.com.ar/` |
| booking | alojamiento | true | false | `https://www.booking.com/searchresults.es.html?ss=Bariloche&checkin=2027-01-10&checkout=2027-01-16&group_adults=2&no_rooms=1` |
| airbnb | alojamiento | true | true | `https://www.airbnb.com.ar/s/Bariloche/homes?checkin=2027-01-10&checkout=2027-01-16&adults=2&children=0&infants=0` |
| vrbo | alojamiento | true | false | `https://www.vrbo.com/search?destination=Bariloche&startDate=2027-01-10&endDate=2027-01-16&adults=2` |
| google-hotels | alojamiento | false | false | `https://www.google.com/travel/search?q=hoteles%20en%20Bariloche&hl=es-419` |
| despegar-alojamiento | alojamiento | false | false | `https://www.despegar.com.ar/hoteles/` |

\* Consulta fija: BUE → BRC, "Zárate" → "Bariloche", 2027-01-10 al 2027-01-16, 2 adultos, 0 chicos, 0 bebés, 1 habitación. Los sitios de vuelos y aerolíneas devuelven `null` si falta algún IATA; micros y alojamiento usan los textos. `verifiedAt` arranca en `""`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
const q: RadarQuery = { originIata: "BUE", destinationIata: "BRC", originLabel: "Zárate", destinationLabel: "Bariloche",
  depart: "2027-01-10", return: "2027-01-16", adults: 2, children: 0, infants: 0, rooms: 1 };
it.each(EXPECTED)("%s arma la dirección esperada", (id, url) => {
  expect(findSite(id)!.buildUrl(q)).toBe(url);
}); // EXPECTED: las 17 filas de la tabla
it("son 17 sitios con id único", () => {
  expect(new Set(RADAR_SITES.map((s) => s.id)).size).toBe(17);
});
it("vuelos y aerolíneas devuelven null sin IATA", () => {
  const sin = { ...q, destinationIata: null };
  for (const s of RADAR_SITES.filter((s) => s.group === "vuelos" || s.group === "aerolineas")) {
    expect(s.buildUrl(sin)).toBeNull();
  }
});
it("codifica tildes y espacios", () => {
  const url = findSite("booking")!.buildUrl({ ...q, destinationLabel: "San Carlos de Bariloche" })!;
  expect(new URL(url).searchParams.get("ss")).toBe("San Carlos de Bariloche");
  expect(findSite("airbnb")!.buildUrl({ ...q, destinationLabel: "Zárate" })).toContain("/s/Z%C3%A1rate/homes");
});
it("lleva chicos y bebés donde se puede", () => {
  const kids = { ...q, children: 1, infants: 1 };
  expect(findSite("despegar-vuelos")!.buildUrl(kids)).toMatch(/\/2\/1\/1$/);
  expect(findSite("airbnb")!.buildUrl(kids)).toContain("children=1&infants=1");
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/integrations/radar/sites.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/integrations/radar/sites.ts`**

Cada `buildUrl` arma la dirección con `URL` y `URLSearchParams`, o con `encodeURIComponent` para los segmentos de ruta. Para Skyscanner las fechas van como `YYMMDD` y los códigos en minúscula.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run src/integrations/radar`
Expected: PASS.

- [ ] **Step 5: Verificar las direcciones en un navegador**

Abrir cada dirección con `prefills: true` para la consulta fija. Si la búsqueda llega completa (origen, destino, fechas y personas), poner la fecha de hoy en `verifiedAt`. Si no, pasarla a `prefills: false` con la página principal del sitio y actualizar la fila de la prueba. Sin navegador disponible, dejar `verifiedAt: ""` y anotar en el informe de la tarea que la verificación queda para Matias (Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/integrations/radar
git commit -m "feat(radar): lista de 17 sitios con búsqueda armada"
```

---

### Task 4: Proveedor de precios de referencia (Travelpayouts y simulado)

**Files:**
- Modify: `src/integrations/types.ts` (agregar `ReferenceFare` y `ReferencePriceProvider`)
- Create: `src/integrations/radar/travelpayouts.ts`, `src/integrations/radar/fake.ts`, `src/integrations/radar/index.ts`, `src/integrations/radar/guard.ts`, `src/integrations/radar/messages.ts`
- Modify: `scripts/migrate.ts` (llamar `assertRadarConfigSafe(process.env)` junto a `assertAiConfigSafe`)
- Test: `src/integrations/radar/travelpayouts.test.ts`, `src/integrations/radar/index.test.ts`

**Interfaces:**
- Consumes: `windowDates` (Task 2), `Result`, `ok`, `err`, `ProviderResult`.
- Produces:
  - `ReferenceFare` como en la sección 6.3 del spec, más `oneWay: boolean`.
  - `ReferencePriceProvider` como en la sección 6.3 del spec, con `calendar(q: { origin; destination; depart; return; windowDays; currency: string; today: string })`. Devuelve un `ReferenceFare` por día con datos. Los días sin datos no aparecen.
  - `RADAR_MESSAGES` con las claves `unavailable`, `no_data`, `bad_token`, `no_airports`, `no_prefill`, `not_configured` y los textos de Global Constraints. `not_configured` = "Precios de referencia no configurados".
  - Códigos de error: `"not_configured"`, `"bad_token"`, `"unavailable"`.
  - `travelpayoutsProvider(token: string, fetchFn?: typeof fetch): ReferencePriceProvider`
  - `fakeReferencePrices: ReferencePriceProvider`. Para BUE→BRC devuelve precios fijos en 5 de los 7 días de la ventana, con el más bajo el día siguiente a la ida. Para cualquier otra ruta devuelve una lista vacía. `places` devuelve BUE (city, "Buenos Aires") para "Zárate" y BRC (city, "San Carlos de Bariloche") para "Bariloche".
  - `getReferencePrices(): ReferencePriceProvider`: simulado si `RADAR_FAKE=1`, real si hay `TRAVELPAYOUTS_TOKEN`, y si no uno que responde `err("not_configured", ...)`.
  - `assertRadarConfigSafe(env: NodeJS.ProcessEnv): void`

Llamadas de la implementación real (confirmar la forma de la respuesta con un token real antes de cerrar la tarea):
- Por cada día de `windowDates`: `GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=BUE&destination=BRC&departure_at=2027-01-10&return_at=2027-01-16&currency=ars&market=ar&sorting=price&direct=false&one_way=false&limit=1&token=…`. Si `data` viene vacío, repetir ese día con `one_way=true` y sin `return_at`, y marcar `oneWay: true`. Se toma `data[0]`: `price` (en unidades de la moneda, se multiplica por 100 y se redondea), `airline`, `transfers`, `departure_at` y el campo `currency` de la respuesta. `foundAt` queda `null` si la respuesta no trae cuándo se vio.
- HTTP 401 o 403 → `err("bad_token", ...)`. Error de red, 5xx o tiempo agotado (8 s) → se reintenta una vez y después `err("unavailable", ...)`.
- `places(term)`: `GET https://autocomplete.travelpayouts.com/places2?term=…&locale=es&types[]=city&types[]=airport`, se mapean `code`, `name` y `type`.

- [ ] **Step 1: Escribir las pruebas que fallan** (con `fetchFn` simulado)

```ts
it("convierte el precio a centavos y marca ida y vuelta", async () => {
  const p = travelpayoutsProvider("t", fetchReturning({ success: true, currency: "ars",
    data: [{ price: 105000, airline: "FO", transfers: 1, departure_at: "2027-01-10T06:00:00-03:00" }] }));
  const r = await p.calendar({ origin: "BUE", destination: "BRC", depart: "2027-01-10", return: "2027-01-16", windowDays: 0, currency: "ARS", today: "2026-11-14" });
  expect(r.ok && r.data.data[0]).toMatchObject({ date: "2027-01-10", amountCents: 10500000, currency: "ARS", oneWay: false, airline: "FO", transfers: 1 });
  expect(r.ok && r.data.source).toBe("Travelpayouts");
});
it("cae a solo ida cuando no hay ida y vuelta", async () => { /* primera respuesta data: [], segunda con precio → oneWay: true */ });
it("descarta precios 0, negativos o sin número", async () => {
  // data: [{ price: 0 }], [{ price: -5 }], [{}] → el día no aparece
});
it("401 es bad_token", async () => { /* status 401 → error.code "bad_token" */ });
it("500 se reintenta una vez y después es unavailable", async () => { /* fetchFn llamado 2 veces */ });
it("los parámetros llevan market=ar y la moneda en minúscula", async () => { /* inspeccionar la URL pedida */ });
```

En `index.test.ts`:

```ts
it("RADAR_FAKE en producción no arranca", () => {
  expect(() => assertRadarConfigSafe({ NODE_ENV: "production", RADAR_FAKE: "1" } as NodeJS.ProcessEnv)).toThrow();
});
it("sin token responde not_configured", async () => { /* getReferencePrices() con env vacío */ });
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/integrations/radar/travelpayouts.test.ts src/integrations/radar/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar los módulos**

Respuestas validadas con Zod (`z.object(...).loose()`), con `price` como `z.number().positive()` por entrada: una entrada inválida se descarta, no rompe el día. Los días se piden en paralelo. `guard.ts` sin imports, igual que `src/integrations/ai/guard.ts`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run src/integrations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/integrations scripts/migrate.ts
git commit -m "feat(radar): proveedor de precios de referencia (Travelpayouts y simulado)"
```

---

### Task 5: Caché de precios

**Files:**
- Create: `src/server/services/reference-prices.ts`
- Test: `src/server/services/reference-prices.test.ts`

**Interfaces:**
- Consumes: `ReferencePriceProvider` (Task 4), tabla `priceCache` (Task 1).
- Produces: `getCalendar(db: Db, provider: ReferencePriceProvider, q: { origin: string; destination: string; depart: string; return: string; currency: string; today: string }, now?: Date): Promise<Result<{ fares: ReferenceFare[]; fetchedAt: string; source: string }>>`. Usa `windowDays: 3` y una vigencia de 6 h. La clave es `` `tp:${origin}:${destination}:${depart}:${return}:${currency}` ``.

- [ ] **Step 1: Escribir las pruebas que fallan** (PGlite y un proveedor que cuenta llamadas)

```ts
it("la segunda consulta dentro de 6 h no llama al proveedor", async () => {
  await getCalendar(db, counting, q, new Date("2026-11-14T12:00:00Z"));
  const r = await getCalendar(db, counting, q, new Date("2026-11-14T17:59:00Z"));
  expect(counting.calls).toBe(1);
  expect(r.ok && r.data.fetchedAt).toBe("2026-11-14T12:00:00.000Z");
});
it("después de 6 h vuelve a consultar", async () => { /* 18:01 → calls 2 */ });
it("guarda también una ruta sin datos", async () => { /* fares [] cacheado, segunda llamada no consulta */ });
it("no guarda errores", async () => { /* proveedor con err("unavailable") → la próxima vez vuelve a llamar */ });
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/server/services/reference-prices.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `getCalendar`**

Upsert sobre `price_cache.key` con `onConflictDoUpdate`.

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run src/server/services/reference-prices.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/reference-prices.ts src/server/services/reference-prices.test.ts
git commit -m "feat(radar): caché de precios de referencia de 6 horas"
```

---

### Task 6: Marcas de revisado, aeropuertos y acciones de servidor

**Files:**
- Create: `src/server/repos/radar.ts`, `src/server/actions/radar.ts`
- Modify: `src/server/repos/index.ts` (agregar `radar: makeRadarRepo(db)`)
- Test: `src/server/repos/radar.test.ts`

**Interfaces:**
- Consumes: `findSite` (Task 3), `getReferencePrices` (Task 4), `getCalendar` (Task 5), `buildRadarQuery` y `shiftDeparture` (Task 2), `trips.update`, `assertTrip` y `ownsTrip`.
- Produces:
  - `makeRadarRepo(db)` con `listChecks(ctx, tripId): Promise<{ siteId: string; openedAt: Date }[]>`, `markOpened(ctx, tripId, siteId, at: Date): Promise<void>` (upsert, actualiza la hora) y `reset(ctx, tripId): Promise<void>`.
  - Acciones (`"use server"`, `requireCtx`, viaje validado como en `quick.ts`):
    - `markSiteOpened(tripId: string, siteId: string): Promise<Result<{ openedAt: string }>>`: rechaza un `siteId` que no está en `RADAR_SITES`.
    - `resetRadarChecks(tripId: string): Promise<Result<null>>`
    - `saveAirports(tripId: string, originIata: string, destinationIata: string): Promise<Result<null>>`: pasa los códigos a mayúscula y exige `/^[A-Z]{3}$/`.
    - `suggestPlaces(term: string): Promise<Result<{ code: string; name: string; kind: "city" | "airport" }[]>>`: término de 2 a 60 caracteres.
    - `loadCalendar(tripId: string, depart?: string): Promise<Result<{ fares: ReferenceFare[]; fetchedAt: string; source: string }>>`: arma la consulta con `buildRadarQuery` (y `shiftDeparture` si viene `depart`) y usa la moneda del viaje. Sin IATA → `err("no_airports", ...)`.

- [ ] **Step 1: Escribir las pruebas del repositorio que fallan**

```ts
it("marca, actualiza la hora y lista", async () => {
  await r.radar.markOpened(w1, tripId, "booking", new Date("2026-11-14T10:00:00Z"));
  await r.radar.markOpened(w1, tripId, "booking", new Date("2026-11-14T11:00:00Z"));
  const checks = await r.radar.listChecks(w1, tripId);
  expect(checks).toHaveLength(1);
  expect(checks[0]!.openedAt.toISOString()).toBe("2026-11-14T11:00:00.000Z");
});
it("reset borra solo las marcas de ese viaje", async () => { /* dos viajes, reset en uno */ });
it("otro workspace no ve ni marca", async () => {
  expect(await r.radar.listChecks(w2, tripId)).toEqual([]);
  await expect(r.radar.markOpened(w2, tripId, "booking", new Date())).rejects.toThrow(NotFoundError);
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/server/repos/radar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el repositorio y las acciones**

Las acciones son capas finas sobre el repositorio y los servicios. No se prueban por separado: las cubre el E2E de Task 8.

- [ ] **Step 4: Correr las pruebas y el chequeo de tipos**

Run: `npx vitest run src/server/repos && npm run typecheck`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/server/repos src/server/actions/radar.ts
git commit -m "feat(radar): marcas de revisado, aeropuertos y acciones"
```

---

### Task 7: Sección "Buscar en otros sitios" en Opciones

**Files:**
- Create: `src/ui/radar/RadarPanel.tsx`, `src/ui/radar/FareCalendar.tsx`, `src/ui/radar/AirportPicker.tsx`, `src/ui/radar/view.ts`
- Modify: `src/app/(app)/viajes/[id]/opciones/page.tsx` (cargar viajeros, códigos y marcas, y renderizar `RadarPanel` antes de `OptionsBoard`)
- Test: `src/ui/radar/view.test.ts`

**Interfaces:**
- Consumes: acciones de Task 6, `RADAR_SITES`, `RADAR_GROUPS`, `RADAR_MESSAGES`, `RadarQuery` y `hasKids`.
- Produces:
  - `siteButtons(q: RadarQuery, checks: { siteId: string; openedAt: string }[]): { group: string; label: string; sites: { id: string; name: string; url: string | null; checked: boolean; note: string | null }[] }[]`. `note` vale "Abre la página principal: cargá los datos a mano." cuando `prefills` es false, y "Sumá los chicos a mano" cuando `prefills` es true, `supportsChildren` es false y `hasKids(q)`. Los grupos de vuelos y aerolíneas quedan con sus sitios en `url: null` si falta IATA.
  - `cheapestDay(fares: ReferenceFare[]): string | null`
  - `displayFare(fare: ReferenceFare, baseCurrency: string, usdRate: number | null): { amountCents: number; currency: string }`: si la tarifa viene en USD, el viaje usa otra moneda y hay tipo de cambio USD→moneda del viaje, la convierte. Si no, la deja como vino.
  - `<RadarPanel tripId query checks hasOptions baseCurrency usdRate />`: `<details>` abierto cuando `hasOptions` es false. `usdRate` sale de los tipos de cambio que la página ya carga con `getTripData`.

Pantalla, según el boceto de la sección 5 del spec:
- Encabezado "Buscar en otros sitios" con la ruta, las fechas y las personas, y "Cambiar" (abre `AirportPicker`).
- Sin IATA: en lugar del calendario y de los grupos de vuelos va "Elegí los aeropuertos para buscar vuelos." con `AirportPicker`, que usa `suggestPlaces` sobre `originLabel` y `destinationLabel` y guarda con `saveAirports`.
- `FareCalendar` pide `loadCalendar` al montarse y muestra "Buscando precios de referencia…" mientras espera. Etiqueta fija: "Precios de referencia · vistos por otros usuarios hace 1 a 7 días, no son precio final". Siete columnas con el monto o "sin datos". El día más barato con "más bajo", el de la ida resaltado y la línea de detalle del más barato (aerolínea, escalas, "solo ida" si corresponde, "consultado hace X" desde `fetchedAt`). Si la moneda devuelta no es la del viaje, se muestra en esa moneda con su código.
- Tocar un día vuelve a armar los enlaces con `shiftDeparture` (solo en el estado del componente) y muestra "Enlaces con salida el D mmm" y "Volver a las fechas del viaje".
- Errores: `unavailable`, `bad_token`, `not_configured` y lista vacía (`no_data`) muestran el texto de `RADAR_MESSAGES` en lugar del calendario. Los enlaces se siguen viendo.
- Cada botón es un `<a target="_blank" rel="noopener noreferrer">` cuyo `onClick` llama `markSiteOpened` sin cancelar la navegación, y queda con ✓. Al pie: "Revisaste N de 17 · Empezar de nuevo" (`resetRadarChecks`) y "Lo que encuentres, pegalo como link o captura acá abajo ↓".
- Estilo: el actual (tarjeta tipo pasaje, verde ruta, modo oscuro), usable a 390 px.

- [ ] **Step 1: Escribir las pruebas que fallan para `view.ts`**

```ts
it("arma 4 grupos con 17 sitios y marca los revisados", () => {
  const g = siteButtons(q, [{ siteId: "booking", openedAt: "2026-11-14T10:00:00Z" }]);
  expect(g.map((x) => x.label)).toEqual(["Vuelos", "Aerolíneas", "Micros", "Alojamiento"]);
  expect(g.flatMap((x) => x.sites)).toHaveLength(17);
  expect(g[3]!.sites.find((s) => s.id === "booking")!.checked).toBe(true);
});
it("avisa que hay que sumar chicos a mano", () => {
  const s = siteButtons({ ...q, children: 1 }, []).flatMap((x) => x.sites);
  expect(s.find((x) => x.id === "kayak")!.note).toBe("Sumá los chicos a mano");
  expect(s.find((x) => x.id === "airbnb")!.note).toBeNull();
});
it("sitios sin búsqueda armada llevan su nota", () => {
  expect(siteButtons(q, []).flatMap((x) => x.sites).find((x) => x.id === "flybondi")!.note)
    .toBe("Abre la página principal: cargá los datos a mano.");
});
it("cheapestDay devuelve el día de menor precio", () => { /* tres tarifas → la fecha de la menor */ });
it("convierte USD con el tipo de cambio del viaje y si no lo deja en USD", () => {
  const f = { date: "2027-01-10", amountCents: 10000, currency: "USD", airline: null, transfers: null, foundAt: null, oneWay: false };
  expect(displayFare(f, "ARS", 1200)).toEqual({ amountCents: 12000000, currency: "ARS" });
  expect(displayFare(f, "ARS", null)).toEqual({ amountCents: 10000, currency: "USD" });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run src/ui/radar/view.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `view.ts`, los componentes y el cambio en la página**

- [ ] **Step 4: Correr las pruebas, el chequeo de tipos y el lint**

Run: `npx vitest run src/ui && npm run typecheck && npm run lint`
Expected: PASS, sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/ui/radar "src/app/(app)/viajes/[id]/opciones/page.tsx"
git commit -m "feat(radar): sección Buscar en otros sitios en Opciones"
```

---

### Task 8: Recorrido completo, configuración y documentación

**Files:**
- Create: `tests/e2e/radar.spec.ts`
- Modify: `playwright.config.ts` (agregar `RADAR_FAKE: "1"` al `env` del `webServer`), `.env.example` (`TRAVELPAYOUTS_TOKEN=` y `RADAR_FAKE=`), `DEPLOY.md` (sección Travelpayouts), `README.md` (estado del MVP: el radar en "Funciona con datos reales" y los sitios sin verificar, si quedaron, en "Requiere credenciales o servicios externos")

**Interfaces:**
- Consumes: todo lo anterior. Helpers de `tests/e2e/helpers.ts` para registrarse y crear un viaje.

- [ ] **Step 1: Escribir el E2E** (celular, `RADAR_FAKE=1`, `AI_FAKE=1`)

```ts
test("radar: aeropuertos, calendario, enlaces y vuelta a la carga rápida", async ({ page, context }) => {
  // crear viaje con el helper existente (destino Bariloche, origen Zárate, 2 personas); las fechas de abajo
  // se reemplazan por las que tenga ese viaje
  // crear viaje "Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate"
  // en Opciones: ver "Elegí los aeropuertos para buscar vuelos.", elegir BUE y BRC
  // ver la etiqueta de precios de referencia y 7 columnas, al menos una "sin datos" y una "más bajo"
  // tocar el día siguiente a la ida → "Enlaces con salida el 11 ene"
  // el href de Google Flights contiene "2027-01-11" y "2027-01-17"
  // clic en Booking: capturar la pestaña nueva con context.waitForEvent("page") y comprobar que su URL empieza con
  //   "https://www.booking.com/searchresults" (cerrarla sin esperar a que cargue, route.abort para no salir a internet)
  // aparece ✓ en Booking y "Revisaste 1 de 17"; recargar la página y sigue marcado
  // "Empezar de nuevo" → "Revisaste 0 de 17"
  // pegar un link simulado en la carga rápida → aparece la tarjeta (camino existente con AI_FAKE)
});
test("radar: ruta sin datos muestra el aviso y los enlaces", async ({ page }) => {
  // viaje a otro destino, aeropuertos BUE y MDZ → "Nadie buscó esta ruta en los últimos días. Usá los enlaces."
});
```

- [ ] **Step 2: Correrlo**

Run: `npx playwright test tests/e2e/radar.spec.ts`
Expected: PASS.

- [ ] **Step 3: Actualizar la configuración y la documentación**

En `DEPLOY.md`, los pasos para Matias: registrarse en Travelpayouts, conectar el programa Aviasales, copiar el token de la sección de API y cargarlo en Railway como `TRAVELPAYOUTS_TOKEN`. Agregar la verificación manual de la sección 8 del spec, con la lista de sitios que quedaron con `verifiedAt: ""`.

- [ ] **Step 4: Correr toda la batería**

Run: `npm run typecheck && npm run lint && npm test && npx playwright test`
Expected: todo en verde, incluidas las pruebas existentes.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/radar.spec.ts playwright.config.ts .env.example DEPLOY.md README.md
git commit -m "test(radar): recorrido E2E y documentación de Travelpayouts"
```

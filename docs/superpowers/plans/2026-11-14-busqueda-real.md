# Búsqueda real con SerpApi: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al entrar a Opciones de un viaje con aeropuertos la app traiga sola vuelos (Google Flights) y alojamientos (Google Hotels) reales vía SerpApi, los guarde como tarjetas y arme las 3 opciones sin carga manual.

**Architecture:** Proveedor SerpApi en `src/integrations/search/` que normaliza las respuestas a tipos propios, y conversión a `OfferDraft` en el mismo módulo. Servicio `runTripSearch` en `src/server/services/trip-search.ts` que decide si buscar, guarda con `saveOffers` y registra la búsqueda en `trip_searches`. Lista fija de aeropuertos en `src/domain/search/airports.ts`. Componente cliente `AutoSearch` en Opciones.

**Tech Stack:** Next.js 16, TypeScript estricto, Drizzle + Postgres (PGlite en pruebas), Zod 4, date-fns-tz, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-busqueda-real-design.md`

## Global Constraints

- Antes de escribir código de Next, leer la guía que corresponda en `node_modules/next/dist/docs/` (regla de `AGENTS.md`).
- Nunca inventar un precio: una opción sin `price` (o una propiedad sin `total_rate`) no se convierte en oferta.
- `SEARCH_FAKE=1` con `NODE_ENV=production` impide arrancar (mismo criterio que `AI_FAKE` y `RADAR_FAKE`; se chequea también en `scripts/migrate.ts`).
- Sin `SERPAPI_KEY` la app funciona como hoy y la sección dice el mensaje de "no configurada".
- Moneda de la búsqueda: la del viaje si es `ARS` o `USD`; si no, `USD`.
- Parámetros fijos de SerpApi: `hl=es`, `gl=ar`. Endpoint `https://serpapi.com/search.json`.
- 5 vuelos y 6 alojamientos por búsqueda. Caché de respuestas crudas: 6 horas, salvo `force`.
- Textos de la interfaz, tal cual la sección 7 del spec:
  - "Búsqueda automática no configurada. Cargá SERPAPI_KEY en Railway."
  - "La clave de SerpApi no es válida. Revisá SERPAPI_KEY."
  - "Se terminaron las búsquedas de SerpApi de este mes. Podés seguir con el radar y la carga rápida."
  - "No pude buscar ahora. Probá de nuevo en un rato."
  - "Google no mostró vuelos con precio para estas fechas."
  - "No encontré alojamiento para N personas en esas fechas." (N = tamaño del grupo)
  - "Vuelta: confirmala en Google Flights."
- Otros textos del spec §5: "Buscando vuelos y alojamiento…", "Volver a buscar", "Vuelta: se confirma al elegir esta opción", "Búsqueda automática", "Google Flights y Google Hotels".
- Todo acceso a un viaje verifica el workspace (`trips.require(ctx, …)`).

## Review Focus

1. Volver a abrir o recargar Opciones no gasta búsquedas ni duplica tarjetas: con la misma `params_key` no se llama al proveedor. Prueba en Task 5 y en el E2E de Task 7.
2. Viaje con chicos: vuelos con `children` e `infants_on_lap`; hoteles con `children` y `children_ages`, y la capacidad del grupo cuenta a todos. Pruebas en Task 2 y Task 3.
3. Alojamiento chico para el grupo: "Capacidad para 2" con 4 viajeros queda afuera; sin dato de capacidad se mantiene. Prueba en Task 3.
4. Viaje con moneda que no es ARS ni USD: se busca en USD y las ofertas quedan en USD. Prueba en Task 5.
5. Una oferta importada que Matias editó sobrevive a "Volver a buscar", y una con reserva también. Prueba en Task 5.

---

### Task 1: Lista fija de aeropuertos

**Files:**
- Create: `src/domain/search/airports.ts`, `src/domain/search/airports.test.ts`
- Modify: `src/server/actions/radar.ts` (`suggestPlaces` usa la lista y deja de llamar a Travelpayouts)

**Interfaces:**
- Produces:
  - `interface Airport { code: string; city: string; region: string; country: string; flightIds: string; aliases: string[] }`. `flightIds` es lo que se manda a Google Flights ("EZE,AEP" para BUE, igual a `code` en el resto).
  - `AIRPORTS: readonly Airport[]`: aeropuertos comerciales de Argentina, más SCL, MVD, PDP, ASU, VVI, LPB, GRU, GIG, FLN, POA y SSA. BUE con alias "Zárate", "Campana", "Ezeiza", "Aeroparque", "CABA", "Capital Federal".
  - `searchAirports(term: string, limit?: number): Airport[]` (por defecto 6): sin tildes ni mayúsculas, compara código exacto, ciudad, alias y región; primero los de Argentina.
  - `findAirport(code: string): Airport | undefined`
  - `suggestPlaces(term)` devuelve `{ code, name: city, kind: "city" }[]` desde `searchAirports`, con el país agregado al nombre cuando no es Argentina ("Santiago (Chile)").

- [ ] **Step 1: Pruebas que fallan**

```ts
it("Zárate y Campana sugieren BUE", () => {
  expect(searchAirports("Zárate")[0]!.code).toBe("BUE");
  expect(searchAirports("campana")[0]!.code).toBe("BUE");
});
it("Bariloche sugiere BRC sin tildes ni mayúsculas", () => {
  expect(searchAirports("BARILOCHE")[0]!.code).toBe("BRC");
  expect(searchAirports("san carlos de bariloche")[0]!.code).toBe("BRC");
});
it("un código exacto va primero", () => {
  expect(searchAirports("MDZ")[0]!.code).toBe("MDZ");
});
it("BUE se busca en Ezeiza y Aeroparque", () => {
  expect(findAirport("BUE")!.flightIds).toBe("EZE,AEP");
  expect(findAirport("BRC")!.flightIds).toBe("BRC");
});
it("nunca sugiere aeropuertos fuera de la lista (Surat, Ciudad Victoria)", () => {
  expect(searchAirports("Surat")).toEqual([]);
});
it("respeta el límite y prioriza Argentina", () => {
  const r = searchAirports("san", 3);
  expect(r.length).toBeLessThanOrEqual(3);
  expect(r[0]!.country).toBe("Argentina");
});
```

- [ ] **Step 2: Correrlas y ver que fallan** — Run: `npx vitest run src/domain/search/airports.test.ts` · Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `airports.ts` y cambiar `suggestPlaces`**
- [ ] **Step 4: Correr** — Run: `npx vitest run src/domain/search && npx playwright test tests/e2e/radar.spec.ts` (con `CHROMIUM_PATH` si hace falta) · Expected: PASS. El E2E del radar busca "Buenos Aires" y "Mendoza": tienen que seguir apareciendo "BUE · Buenos Aires", "BRC · San Carlos de Bariloche" y "MDZ · Mendoza" (ajustar `city` en la lista para que coincida).
- [ ] **Step 5: Commit** — `feat(busqueda): lista fija de aeropuertos`

---

### Task 2: Proveedor SerpApi y simulado

**Files:**
- Create: `src/integrations/search/types.ts`, `serpapi.ts`, `fake.ts`, `guard.ts`, `messages.ts`, `index.ts`, `serpapi.test.ts`, `index.test.ts`
- Modify: `scripts/migrate.ts` (llamar `assertSearchConfigSafe`)

**Interfaces:**
- Produces (`types.ts`):

```ts
export type SearchCurrency = "ARS" | "USD";
export interface FlightQuery { departureId: string; arrivalId: string; outboundDate: string; returnDate: string; adults: number; children: number; infants: number; currency: SearchCurrency }
export interface HotelQuery { q: string; checkIn: string; checkOut: string; adults: number; children: number; currency: SearchCurrency }
export interface FlightLeg { from: string; to: string; depart: string; arrive: string; durationMin: number; airline: string; flightNumber: string } // depart/arrive "YYYY-MM-DD HH:MM" locales
export interface FlightOption { legs: FlightLeg[]; totalMin: number; price: number | null; departureToken: string | null; best: boolean }
export interface FlightsResult { options: FlightOption[] }
export interface Property { kind: "hotel" | "vacation_rental"; name: string; link: string | null; lat: number | null; lng: number | null; total: number | null; source: string | null; rating5: number | null; reviews: number | null; capacity: number | null; hotelClass: number | null; amenities: string[]; info: string[]; freeCancellation: boolean }
export interface HotelsResult { properties: Property[] }
export type SearchErrorCode = "not_configured" | "bad_key" | "no_credits" | "unavailable";
export interface TravelSearch {
  flights(q: FlightQuery): Promise<Result<FlightsResult>>;
  returnFlights(q: FlightQuery, departureToken: string): Promise<Result<FlightsResult>>;
  hotels(q: HotelQuery): Promise<Result<HotelsResult>>;
}
```

- `SEARCH_MESSAGES` en `messages.ts` con las claves `not_configured`, `bad_key`, `no_credits`, `unavailable`, `no_flights`, `return_failed` y `noLodging(n: number): string`, con los textos de Global Constraints.
- `serpApiSearch(key: string, fetchFn?: typeof fetch): TravelSearch`. Parámetros:
  - Vuelos: `engine=google_flights`, `departure_id`, `arrival_id`, `outbound_date`, `return_date`, `type=1`, `adults`, `children`, `infants_on_lap`, `currency`, `hl=es`, `gl=ar`, `api_key`.
  - Vuelta: lo mismo más `departure_token`.
  - Hoteles: `engine=google_hotels`, `q`, `check_in_date`, `check_out_date`, `adults`, `children`, `children_ages` (una edad de 8 por chico, separadas por coma; solo si `children > 0`), `currency`, `hl=es`, `gl=ar`, `api_key`.
- Normalización:
  - `best_flights` → `best: true`, `other_flights` → `best: false`. `price` ausente → `null`.
  - En hoteles, `total_rate.extracted_lowest` → `total`; `prices[0].source` → `source`; `overall_rating` → `rating5`; capacidad sacada de `essential_info` ("Capacidad para N"); `type: "vacation rental"` → `kind: "vacation_rental"`; `freeCancellation` si algún `prices[].free_cancellation`.
  - Validación con Zod por entrada; una inválida se descarta.
- Errores:
  - HTTP 401 → `bad_key`.
  - HTTP 429, o cuerpo con `error` que contenga "run out of searches" → `no_credits`.
  - Cuerpo con otro `error` → `unavailable`.
  - Red o 5xx → un reintento, después `unavailable`. Tiempo límite 20 s.
- `fakeTravelSearch: TravelSearch`: lee los JSON de `__fixtures__` y los normaliza con las mismas funciones que el real. Si `arrivalId`/`q` no son BRC/Bariloche, devuelve listas vacías. `returnFlights` devuelve los mismos vuelos con aeropuertos y fechas invertidos.
- `getTravelSearch(): TravelSearch`: simulado con `SEARCH_FAKE=1`, real con `SERPAPI_KEY`, y si no uno que responde `err("not_configured", …)`.
- `assertSearchConfigSafe(env)`, sin imports.

- [ ] **Step 1: Pruebas que fallan** (fixtures reales y `fetch` simulado como en `src/integrations/radar/travelpayouts.test.ts`)

```ts
it("normaliza vuelos reales: 7 opciones, 4 mejores, Flybondi sin precio", async () => {
  const r = await serpApiSearch("k", replying(flightsFixture)).flights(q);
  expect(r.ok && r.data.options).toHaveLength(7);
  expect(r.ok && r.data.options.filter((o) => o.best)).toHaveLength(4);
  expect(r.ok && r.data.options[0]).toMatchObject({
    price: 733920, totalMin: 145, departureToken: "tok-AR1682",
    legs: [{ from: "EZE", to: "BRC", depart: "2027-01-10 18:20", arrive: "2027-01-10 20:45", airline: "Aerolíneas Argentinas", flightNumber: "AR 1682" }],
  });
  expect(r.ok && r.data.options[3]!.price).toBeNull();
});
it("normaliza hoteles reales", async () => {
  const r = await serpApiSearch("k", replying(hotelsFixture)).hotels(hq);
  expect(r.ok && r.data.properties).toHaveLength(6);
  expect(r.ok && r.data.properties[2]).toMatchObject({ kind: "vacation_rental", name: "Nahuel Departamentos", total: 600000, capacity: 6, rating5: 4.91, reviews: 32, source: "AlquilerArgentina" });
  expect(r.ok && r.data.properties[1]!.freeCancellation).toBe(true);
  expect(r.ok && r.data.properties[5]).toMatchObject({ kind: "hotel", hotelClass: 2, capacity: null, source: null });
});
it("parámetros de vuelos con chicos", async () => { /* children=1, infants_on_lap=1, type=1, hl=es, gl=ar, currency=ARS, departure_id=EZE,AEP */ });
it("hoteles con chicos mandan children_ages", async () => { /* children=2 → children_ages=8,8; sin chicos no va el parámetro */ });
it("401 es bad_key", async () => {});
it("cuerpo con 'Your account has run out of searches.' es no_credits", async () => {});
it("429 es no_credits", async () => {});
it("500 se reintenta una vez y después es unavailable", async () => {});
it("returnFlights manda departure_token", async () => {});
```

En `index.test.ts`: `SEARCH_FAKE` en producción tira error; sin clave responde `not_configured` con su mensaje; el simulado devuelve los fixtures para BRC y listas vacías para MDZ.

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/integrations/search` · FAIL.
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Correr** — `npx vitest run src/integrations/search && npm run typecheck` · PASS.
- [ ] **Step 5: Commit** — `feat(busqueda): proveedor SerpApi y simulado con respuestas reales`

---

### Task 3: De resultados a ofertas

**Files:**
- Create: `src/integrations/search/to-drafts.ts`, `src/integrations/search/to-drafts.test.ts`

**Interfaces:**
- Consumes: tipos de Task 2, `OfferDraft` de `src/integrations/ai/types.ts`.
- Produces:
  - `pickFlights(r: FlightsResult, max?: number): { picked: FlightOption[]; missingAirlines: string[] }` (por defecto 5): solo con `price`; primero los `best` en su orden, después el resto por precio; sin repetir el primer `flightNumber`. `missingAirlines` son las aerolíneas que solo aparecieron sin precio, sin repetir.
  - `flightToDraft(o: FlightOption, currency: SearchCurrency): OfferDraft`:
    - `kind "vuelo"`, `direction "ida_y_vuelta"`, `basis "total"`.
    - `name` con los números de vuelo unidos por " + ", `company` con la aerolínea del primer tramo.
    - `from` y `to` del primer y del último tramo; `depart` y `arrive` como "YYYY-MM-DDTHH:MM".
    - `durationMin = totalMin`, `stops = legs.length - 1`, `price`, `currency`, `nights null`, `score null`, `comfort 3`, `doubtful []`.
    - `detail`: "Precio ida y vuelta para todos los pasajeros. Vuelta: se confirma al elegir esta opción."
  - `pickLodging(r: HotelsResult, groupSize: number, max?: number): Property[]` (por defecto 6): con `total`; descarta `capacity !== null && capacity < groupSize`. Toma la mitad (redondeo hacia arriba) más barata y completa con las de mejor `rating5` que no estén, en ese orden.
  - `lodgingToDraft(p: Property, stay: { checkIn: string; checkOut: string; currency: SearchCurrency }): OfferDraft`:
    - `kind "alojamiento"`, `direction null`, `name`, `company` = `source ?? "Google Hotels"`.
    - `depart` = `checkIn`, `arrive` = `checkOut`, `price = total`, `basis "total"`, `nights` = días entre fechas.
    - `score` = `"${rating5}/5"` o `null`, `comfort` = `hotelClass` acotado a 1..5 o 3.
    - `detail` = `info` y las primeras 4 `amenities`, separadas por " · ".
  - `lodgingExtras(p: Property): { lat: number | null; lng: number | null; capacity: number | null; reviewCount: number | null; amenities: string[]; flexibleCancellation: boolean; kind: "hotel" | "apartment" }`
  - `chooseReturn(r: FlightsResult): FlightOption | null`: la primera `best` con precio; si no hay, la primera con precio; si no, `null`.

- [ ] **Step 1: Pruebas que fallan** (con los fixtures normalizados por `fakeTravelSearch`)

```ts
it("elige 5 vuelos con precio, primero los mejores, e informa Flybondi", async () => {
  const { picked, missingAirlines } = pickFlights(flights);
  expect(picked.map((o) => o.price)).toEqual([733920, 821437, 867320, 901940, 1036051]);
  expect(missingAirlines).toEqual(["Flybondi"]);
});
it("convierte un vuelo en oferta de ida y vuelta", () => {
  expect(flightToDraft(flights.options[0]!, "ARS")).toMatchObject({
    kind: "vuelo", direction: "ida_y_vuelta", basis: "total", price: 733920, currency: "ARS",
    company: "Aerolíneas Argentinas", name: "AR 1682", from: "EZE", to: "BRC",
    depart: "2027-01-10T18:20", arrive: "2027-01-10T20:45", durationMin: 145, stops: 0,
  });
});
it("descarta alojamientos chicos para el grupo y mantiene los sin dato", () => {
  const names = pickLodging(hotels, 4).map((p) => p.name);
  expect(names).not.toContain("Lagos del Sur");                        // capacidad 2
  expect(names).toContain("Nahuel Departamentos");                      // capacidad 6
  expect(names).toContain("Tangoinn Hostel Downtown Bariloche");        // sin dato
});
it("mitad más baratos y mitad mejor calificados, sin repetir", () => {
  const p = pickLodging(hotels, 2, 4);
  expect(p.map((x) => x.total)).toEqual([420000, 540000, 777390, 600000]);
});
it("convierte un alojamiento con total de la estadía y calificación", () => {
  const nahuel = hotels.properties.find((p) => p.name === "Nahuel Departamentos")!;
  expect(lodgingToDraft(nahuel, { checkIn: "2027-01-10", checkOut: "2027-01-16", currency: "ARS" })).toMatchObject({
    kind: "alojamiento", price: 600000, basis: "total", nights: 6, score: "4.91/5", company: "AlquilerArgentina",
    depart: "2027-01-10", arrive: "2027-01-16",
  });
  expect(lodgingExtras(nahuel)).toMatchObject({ capacity: 6, kind: "apartment", reviewCount: 32, lat: -41.15037155151367 });
});
it("chooseReturn prefiere la primera mejor con precio", () => {
  expect(chooseReturn(flights)!.price).toBe(733920);
  expect(chooseReturn({ options: [] })).toBeNull();
});
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/integrations/search/to-drafts.test.ts` · FAIL.
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Correr** — `npx vitest run src/integrations/search` · PASS.
- [ ] **Step 5: Commit** — `feat(busqueda): resultados de Google a ofertas`

---

### Task 4: Esquema y fuente "búsqueda"

**Files:**
- Modify: `src/server/db/schema.ts` (tabla `tripSearches`; columna `transportOptions.externalRef`)
- Create: `drizzle/0003_busqueda.sql` y `drizzle/meta/*` (`npm run db:generate -- --name busqueda`)
- Modify: `src/server/services/offers.ts`:
  - `OfferSource` suma `{ kind: "busqueda"; provider: string; url: string | null; consultedAt: string }` y `{ kind: "busqueda_editada" }`.
  - `sourceLabel` devuelve `"Google Flights · 14/11 16:05"` (fecha y hora de `consultedAt` en `America/Argentina/Buenos_Aires`) y `"Búsqueda editada"`.
  - `saveOne` guarda `url` también para `busqueda`.
  - `updateOfferTx` pasa una fila con `source === "busqueda"` a `"busqueda_editada"`, en sus dos caminos: el de actualización y el de borrar y volver a guardar.
- Test: `src/server/services/offers.test.ts` (agregar), `src/server/db/busqueda-schema.test.ts`

**Interfaces:**
- Produces:
  - `tripSearches`: `tripId` uuid, clave primaria y referencia a `trips` con `on delete cascade`; `paramsKey` text; `searchedAt` timestamptz; `flightsCount` int; `lodgingCount` int; `missingAirlines` jsonb `string[]` por defecto `[]`; `error` text nulo.
  - `transportOptions.externalRef` text nulo (guarda el `departure_token`).

- [ ] **Step 1: Pruebas que fallan**

```ts
it("tripSearches guarda una fila por viaje y se borra con el viaje", async () => { /* insert, segundo insert con mismo tripId rechaza, delete trip → 0 filas */ });
it("saveOffers con fuente busqueda guarda url, source y rótulo con hora", async () => {
  const [saved] = await saveOffers(db, ctx, tripId, [flightDraft], { kind: "busqueda", provider: "Google Flights", url: "https://www.google.com/travel/flights?q=x", consultedAt: "2026-11-14T19:05:00Z" });
  const t = await r.transport.require(ctx, saved!.id);
  expect([t.source, t.url]).toEqual(["busqueda", "https://www.google.com/travel/flights?q=x"]);
  const items = await r.costItems.list(ctx, tripId);
  expect(items[0]!.source).toBe("Google Flights · 14/11 16:05");
});
it("editar una oferta importada la marca como busqueda_editada", async () => { /* updateOffer cambiando el precio → source "busqueda_editada" */ });
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/server/db/busqueda-schema.test.ts src/server/services/offers.test.ts` · FAIL.
- [ ] **Step 3: Implementar y generar la migración**
- [ ] **Step 4: Correr** — `npx vitest run src/server && npm run typecheck` · PASS (incluidas las pruebas existentes de ofertas).
- [ ] **Step 5: Commit** — `feat(busqueda): tabla trip_searches y fuente de oferta "búsqueda"`

---

### Task 5: Servicio `runTripSearch`

**Files:**
- Create: `src/server/services/trip-search.ts`, `src/server/services/trip-search.test.ts`

**Interfaces:**
- Consumes:
  - `TravelSearch` y las funciones de Task 3.
  - `buildRadarQuery` (`src/domain/radar/query.ts`) y `findAirport` (Task 1).
  - `saveOffers`, `deleteOption` (`src/server/services/options.ts`), las tablas de Task 4 y `priceCache`.
- Produces:
  - `interface TripSearchSummary { flights: number; lodging: number; missingAirlines: string[]; searchedAt: string; skipped: boolean; messages: string[] }`
  - `searchParamsKey(q: RadarQuery, currency: SearchCurrency): string`: une aeropuertos, fechas, adultos, chicos, bebés, habitaciones y moneda.
  - `runTripSearch(db: Db, ctx: Ctx, tripId: string, search: TravelSearch, opts?: { force?: boolean; now?: Date }): Promise<Result<TripSearchSummary>>`
  - `getTripSearch(db: Db, ctx: Ctx, tripId: string): Promise<{ paramsKey: string; searchedAt: Date; flightsCount: number; lodgingCount: number; missingAirlines: string[]; error: string | null } | null>`

Comportamiento de `runTripSearch`:
- Sin códigos IATA → `err("no_airports", RADAR_MESSAGES.no_airports)`.
- Con fila de la misma `params_key` y sin `force` → `ok({ …, skipped: true })` sin llamar al proveedor.
- Si no, busca vuelos y hoteles en paralelo. Vuelos con `departureId = findAirport(origin)?.flightIds ?? origin` (lo mismo para destino). Hoteles con `q = destinationLabel`.
- Las respuestas crudas pasan por `price_cache` con clave `serp:flights:<params>` / `serp:hotels:<params>` y 6 horas de vigencia; `force` no lee la caché.
- Si los dos fallan → devuelve el error de vuelos y no borra nada.
- Si al menos uno sale bien, borra las ofertas del viaje con `source = "busqueda"` sin reserva (las de `"busqueda_editada"` y las reservadas quedan). Guarda las nuevas con `saveOffers`:
  - vuelos: `provider "Google Flights"`, `url` = dirección de Google Flights de `src/integrations/radar/sites.ts` (`findSite("google-flights")`) y `externalRef = departureToken` en el tramo de ida;
  - hoteles: `provider "Google Hotels"`, `url = p.link ?? findSite("google-hotels")`, y aplica `lodgingExtras` con `r.lodging.update`.
- Hace upsert de `trip_searches`. `messages` junta los textos de error de cada parte y los de "sin resultados" (sin vuelos con precio, sin alojamiento para N).
- Moneda: `trip.baseCurrency` si es ARS o USD; si no, USD.

- [ ] **Step 1: Pruebas que fallan** (PGlite, `fakeTravelSearch` envuelto para contar llamadas)

```ts
it("importa 5 vuelos y 6 alojamientos y deja listas las 3 opciones", async () => {
  const r = await runTripSearch(db, ctx, tripId, counting, { now });
  expect(r.ok && r.data).toMatchObject({ flights: 5, lodging: 6, missingAirlines: ["Flybondi"], skipped: false });
  const p = proposalsFromLoaded(await loadTrip(db, ctx, tripId));
  expect(p.missing).toEqual([]);
});
it("con los mismos datos no vuelve a buscar ni duplica", async () => {
  await runTripSearch(db, ctx, tripId, counting, { now });
  const r = await runTripSearch(db, ctx, tripId, counting, { now });
  expect(r.ok && r.data.skipped).toBe(true);
  expect(counting.calls).toBe(2); // vuelos + hoteles de la primera
  expect((await loadTrip(db, ctx, tripId)).transport.filter((t) => t.leg === "outbound")).toHaveLength(5);
});
it("force reemplaza solo lo que no se tocó", async () => {
  // importar; editar un vuelo (updateOffer) y reservar un alojamiento (bookings.create); force
  // → la editada y la reservada siguen; el total de ofertas de búsqueda vuelve a 5 + 6 más las 2 conservadas
});
it("viaje en BRL busca en USD", async () => { /* el proveedor recibe currency "USD" y los costItems quedan en USD */ });
it("sin aeropuertos devuelve no_airports", async () => {});
it("si fallan los dos no borra lo anterior", async () => {});
it("otro workspace no puede buscar en el viaje", async () => { /* rechaza con NotFoundError */ });
it("ruta sin resultados deja los dos mensajes", async () => { /* destino MDZ → messages con "Google no mostró vuelos con precio para estas fechas." y "No encontré alojamiento para 2 personas en esas fechas." */ });
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/server/services/trip-search.test.ts` · FAIL.
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Correr** — `npx vitest run src/server && npm run typecheck` · PASS.
- [ ] **Step 5: Commit** — `feat(busqueda): runTripSearch importa vuelos y alojamiento sin repetir`

---

### Task 6: La vuelta al elegir una opción

**Files:**
- Modify: `src/server/services/trip-search.ts` (agregar `fillReturnFlights`)
- Modify: `src/server/actions/quick.ts` (`chooseProposalAction`) y `src/server/actions/bookings.ts` (`chooseScenarioAction`): después de elegir, llaman a `fillReturnFlights(db, ctx, tripId, getTravelSearch())`. Un error no corta la elección.
- Test: `src/server/services/trip-search.test.ts`

**Interfaces:**
- Produces: `fillReturnFlights(db: Db, ctx: Ctx, tripId: string, search: TravelSearch): Promise<{ filled: number; failed: number }>`.
  - Recorre las reservas del viaje cuyo dueño es un tramo de ida con `externalRef`, cuyo hermano de vuelta (mismo `pairId`) no tiene `segments`.
  - Pide `returnFlights` con la misma consulta de la búsqueda y el token, y elige con `chooseReturn`.
  - Escribe un segmento por tramo en la vuelta (horarios de salida en `trip.endTz`, de llegada en `trip.startTz`), con `provider` y `serviceNumber` de la vuelta.
  - Si falla, agrega a `notes` del tramo de vuelta "Vuelta: confirmala en Google Flights." (una sola vez).

- [ ] **Step 1: Pruebas que fallan**

```ts
it("al elegir completa la vuelta con un solo pedido", async () => {
  // importar, chooseProposal de la más barata, fillReturnFlights
  // → la vuelta tiene segments con from "BRC" y la fecha 2027-01-16; el simulado se llamó 1 vez para returnFlights
});
it("si falla deja la nota y no rompe", async () => {
  // proveedor con returnFlights err("unavailable") → failed 1, notes contiene "Vuelta: confirmala en Google Flights."
});
it("no vuelve a pedir una vuelta ya completa", async () => {});
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/server/services/trip-search.test.ts` · FAIL.
- [ ] **Step 3: Implementar y llamar desde las dos acciones**
- [ ] **Step 4: Correr** — `npx vitest run src/server && npm run typecheck` · PASS.
- [ ] **Step 5: Commit** — `feat(busqueda): completar la vuelta al elegir`

---

### Task 7: Pantalla, configuración y recorrido completo

**Files:**
- Create: `src/server/actions/search.ts`, `src/ui/search/AutoSearch.tsx`, `src/ui/search/view.ts`, `src/ui/search/view.test.ts`, `tests/e2e/busqueda.spec.ts`
- Modify:
  - `src/app/(app)/viajes/[id]/opciones/page.tsx`: carga `getTripSearch` y calcula `needsSearch`; renderiza `AutoSearch` entre `RadarPanel` y `OptionsBoard`.
  - `src/ui/radar/RadarPanel.tsx`: `<details>` deja de estar controlado por `hasOptions` después del primer render, para que no se cierre solo al llegar las tarjetas.
  - `tests/e2e/radar.spec.ts`: abrir la sección después de cada recarga.
  - `playwright.config.ts`: `SEARCH_FAKE: "1"`.
  - `.env.example`, `DEPLOY.md` (sección SerpApi: crear cuenta, copiar la clave de "Your Private API Key" del panel, cargar `SERPAPI_KEY` en Railway; plan gratis de 250 búsquedas por mes; cada viaje usa 2 y elegir una opción usa 1 más), `README.md`.

**Interfaces:**
- Consumes: `runTripSearch`, `getTripSearch`, `searchParamsKey`, `getTravelSearch`, `SEARCH_MESSAGES`.
- Produces:
  - Acción `runSearch(tripId: string, force?: boolean): Promise<Result<TripSearchSummary>>` (`requireCtx`, uuid válido, `revalidatePath` del viaje).
  - `summaryText(s: { flights: number; lodging: number; searchedAt: string }, now?: Date): string` → "✓ 5 vuelos y 6 alojamientos · consultado hoy 16:05" ("ayer" o "14/11" según corresponda, hora de Buenos Aires).
  - `missingText(airlines: string[]): string | null` → "Flybondi también vuela esta ruta, pero Google no muestra su precio".
  - `<AutoSearch tripId configured needsSearch paramsKey summary messages missingAirlines />`:
    - Sin configurar: texto "no configurada".
    - Cuando `needsSearch` es `true` (al montarse o cuando pasa a `true` después de guardar los aeropuertos), dispara `runSearch(tripId)` una sola vez por `paramsKey` (un `ref` guarda la última clave disparada, así un doble montaje de React no busca dos veces). Muestra "Buscando vuelos y alojamiento…" y después hace `router.refresh()`. La página pasa `paramsKey` como prop.
    - Muestra `summaryText`, los `messages`, `missingText` con enlace al sitio de esa aerolínea si está en `RADAR_SITES` y el botón "Volver a buscar" (`force`).
- `needsSearch` = clave configurada (o simulado), viaje con los dos IATA y sin fila de `trip_searches` con la misma `searchParamsKey`.

- [ ] **Step 1: Pruebas que fallan**

`view.test.ts`:

```ts
it("summaryText", () => {
  const now = new Date("2026-11-14T20:00:00Z");
  expect(summaryText({ flights: 5, lodging: 6, searchedAt: "2026-11-14T19:05:00Z" }, now)).toBe("✓ 5 vuelos y 6 alojamientos · consultado hoy 16:05");
  expect(summaryText({ flights: 1, lodging: 0, searchedAt: "2026-11-13T19:05:00Z" }, now)).toBe("✓ 1 vuelo y 0 alojamientos · consultado ayer 16:05");
});
it("missingText", () => {
  expect(missingText(["Flybondi"])).toBe("Flybondi también vuela esta ruta, pero Google no muestra su precio");
  expect(missingText([])).toBeNull();
});
```

`busqueda.spec.ts` (celular, `SEARCH_FAKE=1`):

```ts
test("viaje nuevo: aeropuertos y las 3 opciones sin cargar nada", async ({ page }) => {
  // registrarse, createQuickTrip (Bariloche), elegir BUE y BRC en el radar y guardar
  // → "Buscando vuelos y alojamiento…" y después "✓ 5 vuelos y 6 alojamientos"
  // → aparecen tarjetas "Aerolíneas Argentinas" y "Nahuel Departamentos" con "Google Flights ·" / "Google Hotels ·"
  // → "Flybondi también vuela esta ruta, pero Google no muestra su precio"
  // → "Ver mis 3 opciones" lleva a las propuestas con precio
  // recargar → mismas 11 tarjetas, sin "Buscando…"
});
test("Volver a buscar reemplaza las importadas", async ({ page }) => { /* contar tarjetas antes y después: iguales */ });
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/ui/search && npx playwright test tests/e2e/busqueda.spec.ts` · FAIL.
- [ ] **Step 3: Implementar la acción, la vista, el componente, los cambios de página, el radar y la configuración**
- [ ] **Step 4: Correr todo** — `npm run typecheck && npm run lint && npm test && npx playwright test` · todo PASS, incluidos los E2E existentes.
- [ ] **Step 5: Commit** — `feat(busqueda): búsqueda automática en Opciones`

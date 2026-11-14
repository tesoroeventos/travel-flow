# TravelFlow: búsqueda real de vuelos y alojamiento

Fecha: 2026-11-14 · Estado: aprobado por Matias · Rama: `feat/busqueda-real`

## 1. Por qué

Con el radar de fuentes (PR #3) Matias abría los sitios sin tipear, pero igual tenía que mirar cada uno y traer las ofertas a mano. Lo dijo así: "sigue pidiendo tres opciones y todo manual, es inviable". La app es de uso propio (él y sus amigos), así que puede usar un servicio pago o gratuito sin pensar en lo comercial.

Criterio de éxito: con un viaje creado y los aeropuertos elegidos, al entrar a Opciones la app trae sola vuelos y alojamientos reales, los convierte en tarjetas y arma las 3 opciones sin que Matias cargue nada.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos
- Buscar vuelos de ida y vuelta con Google Flights y alojamiento con Google Hotels, a través de SerpApi.
- Convertir los mejores resultados en tarjetas de oferta por el mismo camino que la carga rápida, para que las 3 opciones salgan solas.
- Gastar pocas búsquedas: 2 por viaje, más 1 cuando se elige una opción.
- Reemplazar las sugerencias de aeropuerto de Travelpayouts (daban resultados como Surat o Ciudad Victoria) por una lista fija.

No objetivos
- Reservar o pagar dentro de la app.
- Micros y autos (siguen con la carga rápida y el radar).
- Viajes con escalas en varias ciudades o solo ida.
- Mostrar cuántas búsquedas quedan en la cuenta de SerpApi.

Anti-objetivos
- Inventar precios o mostrar un vuelo sin precio como si tuviera.
- Volver a importar duplicados cada vez que se abre Opciones.
- Borrar una oferta que Matias editó o eligió.
- Gastar búsquedas sin que haga falta (por ejemplo, al recargar la página).

## 3. Enfoques considerados

| Enfoque | Contra | Decisión |
|---|---|---|
| A. SerpApi (Google Flights y Google Hotels) | SerpApi obtiene los datos leyendo páginas de Google: choca con la regla del documento original de no usar scraping que viole condiciones de servicio. SerpApi asume el riesgo legal | Elegido por Matias ("esta es una app de uso propio") |
| B. Duffel a nombre de Tesoro Eventos | Verificación de empresa; pensado para vender pasajes | Descartado por ahora |
| C. Seguir con el radar y la carga rápida | Es lo que Matias llamó inviable | Queda como complemento |

## 4. Lo que muestran las respuestas reales

Respuestas reales del 14/11/2026, recortadas y guardadas en `src/integrations/search/__fixtures__/`:

- `google_flights` (EZE,AEP → BRC, 10 al 16/01/2027, 2 adultos, ARS): `best_flights` (4) y `other_flights` (14). Cada opción trae `flights[]` (tramos con aeropuertos, horarios locales "YYYY-MM-DD HH:MM", aerolínea, número de vuelo, duración), `total_duration`, `price` (total de ida y vuelta para todos los pasajeros, en la moneda pedida), `type: "Round trip"` y `departure_token`. Los vuelos de Flybondi vienen sin `price`. La vuelta no viene: se pide aparte con `departure_token` (1 búsqueda más).
- `google_hotels` (q=Bariloche, mismas fechas, 2 adultos, ARS): 20 `properties`, de tipo `hotel` o `vacation rental`. Cada una trae `name`, `link` (no siempre), `gps_coordinates`, `rate_per_night` y `total_rate` (`extracted_lowest`, número), `prices[]` con `source` (Expedia.es, AlquilerArgentina…), `overall_rating`, `reviews`, `essential_info` ("Capacidad para 6", "2 dormitorios"), `amenities`, `extracted_hotel_class` y cancelación gratuita en `prices[].free_cancellation`.

## 5. Lo que ve Matias

En Opciones, arriba de las tarjetas y debajo del radar:

```
Búsqueda automática                       Google Flights y Google Hotels
✓ 5 vuelos y 6 alojamientos · consultado hoy 16:05     [Volver a buscar]
Flybondi también vuela esta ruta, pero Google no muestra su precio → [Ver en Flybondi]
```

- Al abrir Opciones de un viaje con aeropuertos y sin búsqueda previa para esos datos, la búsqueda arranca sola y muestra "Buscando vuelos y alojamiento…". Al terminar, la página se actualiza con las tarjetas y las 3 opciones.
- Las tarjetas importadas dicen de dónde salen y cuándo se consultaron ("Google Flights · 14/11 16:05", "Google Hotels · Expedia.es · 14/11 16:05") y tienen el enlace a la página de Google o del alojamiento.
- La tarjeta de vuelo muestra la ida con horarios y "Vuelta: se confirma al elegir esta opción". El precio es el total de ida y vuelta.
- "Volver a buscar" vuelve a consultar (2 búsquedas), borra las tarjetas importadas que Matias no tocó y trae las nuevas.
- Sin `SERPAPI_KEY`, la sección dice "Búsqueda automática no configurada" y todo lo demás funciona como hoy.

## 6. Diseño técnico

### 6.1 Proveedor (`src/integrations/search/`)
- `serpapi.ts`: `serpApiSearch(key, fetchFn)` con `flights(q)`, `returnFlights(q, departureToken)` y `hotels(q)`. Llama `https://serpapi.com/search.json` con `engine`, `api_key`, `hl=es`, `gl=ar`, `currency` (moneda del viaje) y pasajeros (`adults`, `children`, `infants_on_lap`; en hoteles `adults`, `children`, `children_ages`). Respuestas validadas con Zod, entrada por entrada; una entrada inválida se descarta.
- Errores: 401 → `bad_key`; búsquedas agotadas (429 o `error` que lo diga) → `no_credits`; red o 5xx → un reintento y `unavailable`.
- `fake.ts`: devuelve los fixtures reales. `SEARCH_FAKE=1` en producción no arranca (mismo criterio que `AI_FAKE`).
- `index.ts`: `getTravelSearch()` elige simulado, real o no configurado.

### 6.2 De resultado a oferta (`src/domain/search/`)
Funciones puras, probadas con los fixtures:
- `pickFlights(result, max = 5)`: solo opciones con `price`; primero las de `best_flights`, después las más baratas, sin repetir número de vuelo. Devuelve también la lista de aerolíneas que aparecieron sin precio.
- `flightToDraft(option, q)`: `OfferDraft` de tipo `vuelo`, `direction: "ida_y_vuelta"`, `basis: "total"`, horarios del primer y último tramo, `stops` = tramos − 1, `company` = aerolínea, `name` = números de vuelo.
- `pickLodging(result, groupSize, max = 6)`: con `total_rate`; descarta las que dicen "Capacidad para N" con N menor al grupo; la mitad más baratas y la mitad mejor calificadas, sin repetir.
- `lodgingToDraft(property, q)`: `OfferDraft` de tipo `alojamiento`, precio total de la estadía, más los datos que hoy la carga rápida no tiene (lat/lng, capacidad, calificación sobre 10, cantidad de opiniones, amenities, cancelación gratuita, tipo departamento u hotel).

### 6.3 Guardado y repetición
- Nueva fuente de oferta `{ kind: "busqueda", provider: "Google Flights" | "Google Hotels", url, consultedAt }`. El rótulo de la tarjeta usa `provider` y la hora.
- Nueva tabla `trip_searches (trip_id, params_key, searched_at, flights_count, lodging_count, missing_airlines jsonb)`, una fila por viaje. `params_key` combina aeropuertos, fechas, pasajeros y moneda.
- `runTripSearch(db, ctx, tripId, { force })`: si existe una búsqueda con la misma `params_key` y no es `force`, no hace nada. Si no, busca vuelos y hoteles en paralelo, borra las ofertas con `source = "busqueda"` que no fueron editadas, elegidas ni reservadas, guarda las nuevas con `saveOffers` y actualiza `trip_searches`. Se guardan en caché (`price_cache`, 6 horas) las respuestas crudas.
- Una oferta importada que Matias edita pasa a `source = "busqueda_editada"` y deja de borrarse.

### 6.4 Vuelta al elegir
Al elegir una propuesta (`chooseScenario`) cuyo vuelo vino de la búsqueda, se pide la vuelta con `departure_token` y se completan los tramos del tramo de vuelta. Se elige la vuelta con el mismo precio total o, si hay varias, la primera de `best_flights`. Si falla, la tarjeta sigue con "Vuelta: confirmala en Google Flights" y la elección no se bloquea.

### 6.5 Aeropuertos
`src/domain/search/airports.ts`: lista fija de aeropuertos comerciales de Argentina y de los principales de Chile, Uruguay, Paraguay, Bolivia y Brasil, con código, ciudad, provincia o país y alias (por ejemplo "Zárate" y "Campana" → BUE con EZE y AEP). El selector busca ahí, sin red y sin tildes. Para Buenos Aires se usa `EZE,AEP` en la búsqueda. Se sigue aceptando cualquier código de 3 letras. `suggestPlaces` deja de usar Travelpayouts.

## 7. Errores y mensajes

| Situación | Mensaje |
|---|---|
| Sin clave | "Búsqueda automática no configurada. Cargá SERPAPI_KEY en Railway." |
| Clave inválida | "La clave de SerpApi no es válida. Revisá SERPAPI_KEY." |
| Búsquedas agotadas | "Se terminaron las búsquedas de SerpApi de este mes. Podés seguir con el radar y la carga rápida." |
| SerpApi no responde | "No pude buscar ahora. Probá de nuevo en un rato." |
| Sin vuelos con precio | "Google no mostró vuelos con precio para estas fechas." |
| Sin alojamiento para el grupo | "No encontré alojamiento para N personas en esas fechas." |
| No se pudo traer la vuelta | "Vuelta: confirmala en Google Flights." |

## 8. Pruebas

- Unitarias con los fixtures reales: selección y conversión de vuelos (Flybondi sin precio queda afuera y se informa), alojamientos (capacidad, precio total, calificación de 5 a 10), aeropuertos (Zárate → BUE, tildes), validación de respuestas raras.
- Proveedor con `fetch` simulado: parámetros, errores 401, agotado, 5xx con reintento.
- Integración (PGlite): `runTripSearch` importa, no repite con los mismos datos, `force` reemplaza solo lo no tocado, la vuelta se completa al elegir.
- E2E con `SEARCH_FAKE=1`: viaje nuevo → aeropuertos → tarjetas importadas → "Ver mis 3 opciones" sin cargar nada.

## 9. Configuración

| Variable | Valor |
|---|---|
| `SERPAPI_KEY` | Clave de la cuenta de SerpApi (plan gratis: 250 búsquedas por mes) |

## 10. Decisiones tomadas por Claude, aprobadas por Matias

- La búsqueda arranca sola al entrar a Opciones; "Volver a buscar" para actualizar.
- 5 vuelos y 6 alojamientos por búsqueda.
- La vuelta se pide recién al elegir una opción.
- Lista fija de aeropuertos en lugar de sugerencias de un servicio.
- El radar y el calendario de Travelpayouts quedan como están.

## 11. A criterio de quien construye

- La lista exacta de aeropuertos y alias.
- La edad que se manda en `children_ages` cuando el viaje tiene chicos sin edad cargada (la app no guarda edades).
- Cómo marcar "editada" una oferta importada sin tocar el resto del flujo de edición.

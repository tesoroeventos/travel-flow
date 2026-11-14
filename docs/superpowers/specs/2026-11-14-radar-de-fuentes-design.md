# TravelFlow: radar de fuentes

Fecha: 2026-11-14 · Estado: para revisar · Rama: `feat/radar`

Primera etapa de lo que el documento "Travel Finder" llama búsqueda real de vuelos y alojamientos. El resto de ese documento (recomendaciones por perfil, optimizador de presupuesto, mapa, alertas, comparador de destinos, asistente conversacional, monetización) queda para después.

## 1. Por qué

Matias siente que las agencias como Despegar o Almundo muestran su propio inventario, ordenado como les conviene, y que afuera hay mucho más. Quiere ver todo lo que hay y decidir él.

La prueba de la carga rápida (15/10) ya lo había mostrado: la app leyó bien las capturas, pero los 11 minutos del viaje de prueba se fueron en buscar ofertas en otras apps, escribiendo origen, destino, fechas y personas en cada una. El radar apunta a ese tiempo.

La app es para uso personal de Matias y sus amigos. No hay nada comercial en este ciclo.

Criterio de éxito: con un viaje ya creado, desde una sola pantalla Matias ve los precios de referencia de los días cercanos y abre la misma búsqueda en todos los sitios que le importan, con un clic por sitio y sin volver a escribir nada. Sabe cuáles ya revisó. Lo que encuentra lo trae con la carga rápida que ya existe (link o captura) y desde ahí siguen las 3 propuestas, el itinerario y los gastos como hoy.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos
- Precios de referencia por día de salida, en una ventana de 3 días antes y 3 después de la ida del viaje.
- Enlaces que abren la búsqueda ya completa en buscadores, agencias, aerolíneas, empresas de micros y plataformas de alojamiento.
- Registro de qué sitios abrió para cada viaje.
- Agregar un sitio nuevo sin tocar pantallas: una entrada en una lista y su prueba.

No objetivos (este ciclo)
- Reservar o pagar.
- Precios automáticos de alojamiento (no hay API accesible para una persona).
- Duffel u otra API con precio en tiempo real. Queda como etapa B si Matias decide activar una cuenta a nombre de Tesoro Eventos.
- Afiliados, publicidad, suscripción.
- Alertas de precios, mapa, asistente conversacional, comparar destinos.

Anti-objetivos (sería un fracaso aunque funcione)
- Mostrar un precio de caché como si fuera precio final o como precio verificado.
- Inventar precios, o completar huecos del calendario con estimaciones.
- Que la app entre sola a los sitios y copie resultados (scraping).
- Que un enlace abra una búsqueda con fechas, destino o personas equivocadas sin que Matias se dé cuenta.

## 3. Enfoques considerados

| Enfoque | Qué es | Contra | Decisión |
|---|---|---|---|
| A. Radar de fuentes | Precios de referencia de Travelpayouts + enlaces con la búsqueda ya armada + la carga rápida existente para traer el precio verificado | El precio final lo trae Matias con un paso manual; alojamiento solo con enlaces | Elegido por Matias |
| B. A + Duffel | Precios reales en tiempo real de vuelos y hoteles dentro de la app | Activación en modo real con datos de empresa (KYC); Duffel está pensado para vender, usarlo solo para buscar puede chocar con sus condiciones; cobertura de low-cost argentinas desconocida | Queda para después |
| C. Agente que navega los sitios | La app abre los sitios y lee resultados | Choca con la regla de no scrapear y se rompe con cada cambio de diseño | Descartado |

## 4. Restricciones conocidas

- Stack existente: Next.js 16 (leer `node_modules/next/dist/docs/` antes de escribir código, ver `AGENTS.md`), Drizzle, PGlite en pruebas, Zod, `Result` de `src/domain/result.ts`.
- Travelpayouts, Data API de Aviasales:
  - Token gratis después de registrarse en Travelpayouts y conectarse al programa Aviasales.
  - Devuelve precios en caché, armados con búsquedas de otros usuarios de los últimos 2 a 7 días. Los datos son por mercado: lo que se buscó en un mercado no aparece en otro.
  - Límites por hora del orden de 600 consultas para `prices_for_dates` y `grouped_prices`. Para uso personal sobra.
  - No tiene API de hoteles.
  - La búsqueda en tiempo real exige 50.000 usuarios mensuales, así que no aplica.
- Los enlaces son navegación normal de Matias en su navegador. La app nunca descarga ni lee esas páginas.

## 5. Lo que ve Matias

Una sección nueva arriba de todo en la pestaña Opciones, antes de la zona de capturas. Está abierta cuando el viaje todavía no tiene opciones cargadas y plegada cuando ya tiene.

```
Buscar en otros sitios          BUE → BRC · 10 al 16 ene · 2 adultos   [Cambiar]

Precios de referencia · vistos por otros usuarios hace 1 a 7 días, no son precio final
   7 ene    8 ene    9 ene   [10 ene]   11 ene   12 ene   13 ene
   98.000  112.000    sin    105.000    87.000   90.000    sin
                     datos               más bajo          datos
   11 ene: Flybondi, 1 escala · consultado hace 3 h

Vuelos       [Google Flights ✓] [Skyscanner] [Kayak] [Despegar] [Almundo]
Aerolíneas   [Aerolíneas Argentinas] [Flybondi] [JetSMART] [LATAM] [GOL]
Micros       [Plataforma 10] [Central de Pasajes]
Alojamiento  [Booking] [Airbnb] [Vrbo] [Google Hotels] [Despegar]

Revisaste 1 de 17 · [Empezar de nuevo]
Lo que encuentres, pegalo como link o captura acá abajo ↓
```

Comportamiento
- Cada botón abre el sitio en una pestaña nueva con la búsqueda completa y queda marcado como revisado con la hora. "Empezar de nuevo" borra las marcas del viaje.
- Los sitios que no aceptan la búsqueda armada en la dirección muestran un ícono y el texto "Abre la página principal: cargá los datos a mano". Así nunca se confunden con una búsqueda ya hecha.
- Tocar un día del calendario cambia la fecha de ida de los enlaces de vuelos, no la del viaje. La vuelta se corre los mismos días para mantener la duración. Un aviso dice "Enlaces con salida el 11 ene" y "Volver a las fechas del viaje".
- Los precios de referencia se muestran en la moneda del viaje si Travelpayouts la acepta. Si no, en dólares, convertidos con el tipo de cambio que ya tiene el viaje cuando existe. Siempre llevan la etiqueta "referencia".
- "Cambiar" edita los códigos de origen y destino (ver 6.1).

## 6. Diseño técnico

### 6.1 Códigos de aeropuerto

Los viajes guardan origen y destino como texto libre ("Zárate", "Bariloche"). Los enlaces de vuelos y Travelpayouts necesitan códigos IATA.

- Columnas nuevas en `trips`: `origin_iata text null` y `destination_iata text null`. Aceptan código de ciudad (BUE) o de aeropuerto (EZE).
- La primera vez que se abre el radar sin códigos, se piden con sugerencias de la búsqueda de lugares de Travelpayouts sobre `originLabel` y `destinationLabel`. Matias elige una y queda guardada. Para un lugar sin aeropuerto (Zárate) la sugerencia es la ciudad con aeropuerto más cercana (BUE).
- Sin códigos, los vuelos y las aerolíneas se ocultan y se muestra "Elegí los aeropuertos para buscar vuelos". Micros y alojamiento funcionan igual, porque usan el texto.

### 6.2 Lista de sitios

Archivo `src/integrations/radar/sites.ts`, una lista declarativa:

```ts
interface RadarQuery {
  originIata: string | null;
  destinationIata: string | null;
  originLabel: string;
  destinationLabel: string;
  depart: string;   // YYYY-MM-DD
  return: string;   // YYYY-MM-DD
  adults: number;
  children: number;
  infants: number;
  rooms: number;
}

interface RadarSite {
  id: string;                 // "google-flights", "booking"...
  name: string;
  group: "vuelos" | "aerolineas" | "micros" | "alojamiento";
  prefills: boolean;          // false: abre la página principal
  verifiedAt: string;         // última vez que se probó el formato a mano
  buildUrl(q: RadarQuery): string | null; // null si faltan datos (por ejemplo, sin IATA)
}
```

- Personas: se cuentan desde `travelers.kind` (adult, child, infant). Habitaciones desde `trips.rooms`.
- Cada sitio tiene una prueba unitaria con una consulta fija y la dirección esperada.
- Sumar un sitio es sumar una entrada y su prueba. La pantalla lee la lista.

### 6.3 Precios de referencia

Interfaz nueva en `src/integrations/types.ts`, en la línea de los contratos existentes:

```ts
interface ReferenceFare {
  date: string;          // salida
  amountCents: number;
  currency: Currency;
  airline: string | null;
  transfers: number | null;
  foundAt: string | null; // cuándo lo vio el usuario que buscó
}

interface ReferencePriceProvider {
  calendar(q: { origin: string; destination: string; depart: string; return: string; windowDays: number })
    : Promise<Result<ProviderResult<ReferenceFare[]>>>;
  places(term: string): Promise<Result<ProviderResult<{ code: string; name: string; kind: "city" | "airport" }[]>>>;
}
```

- Implementación real en `src/integrations/radar/travelpayouts.ts`, con el token en `TRAVELPAYOUTS_TOKEN`. Las respuestas se validan con Zod y se tratan como dato no confiable.
- Implementación simulada en `src/integrations/radar/fake.ts` para pruebas y E2E, con la misma regla que la IA: si `NODE_ENV=production` y `RADAR_FAKE=1`, la app no inicia.
- Sin token, la sección muestra solo los enlaces y el texto "Precios de referencia no configurados".
- Caché en Postgres, tabla `price_cache (key text primary key, payload jsonb, fetched_at timestamptz)`, válida por 6 horas. La clave combina origen, destino, fechas y moneda. La pantalla muestra "consultado hace X" con `fetched_at`.
- Un día sin datos se muestra como "sin datos". Nunca se interpola.

### 6.4 Datos

Migración `0002_radar`:
- `trips.origin_iata`, `trips.destination_iata`.
- `radar_checks (trip_id uuid references trips on delete cascade, site_id text, opened_at timestamptz, primary key (trip_id, site_id))`.
- `price_cache` (6.3).

Los repositorios de `radar_checks` respetan el aislamiento por workspace como el resto de `src/server/repos`.

## 7. Errores y mensajes

| Situación | Mensaje |
|---|---|
| Travelpayouts no responde o devuelve error | "No pude traer los precios de referencia ahora. Los enlaces funcionan igual." (se reintenta una vez) |
| Ruta sin datos en caché | "Nadie buscó esta ruta en los últimos días. Usá los enlaces." |
| Token inválido | "El token de Travelpayouts no es válido. Revisá `TRAVELPAYOUTS_TOKEN`." (solo en el registro del servidor y un aviso corto en pantalla) |
| Sin códigos de aeropuerto | "Elegí los aeropuertos para buscar vuelos." |
| Sitio sin búsqueda armada | "Abre la página principal: cargá los datos a mano." |

## 8. Pruebas

- Unitarias: dirección de cada sitio, conteo de personas por tipo, corrimiento de fechas al tocar el calendario, validación de respuestas de Travelpayouts, caché (vigente, vencida), días sin datos.
- Integración (PGlite): guardar códigos IATA, marcar y reiniciar sitios revisados, aislamiento por workspace.
- E2E (Playwright, celular, `RADAR_FAKE=1` y `AI_FAKE=1`): abrir Opciones de un viaje sin códigos, elegir aeropuertos, ver el calendario, tocar un día, abrir un sitio (se verifica la URL de la pestaña nueva sin navegar fuera), ver la marca, pegar un link simulado y llegar a las 3 propuestas.
- Manual (Matias): un viaje real, abrir cada sitio y confirmar que la búsqueda llega completa. Actualizar `verifiedAt` de los que pasen y marcar `prefills: false` los que no.

## 9. Configuración nueva en Railway

| Variable | Valor |
|---|---|
| `TRAVELPAYOUTS_TOKEN` | Token de la cuenta de Travelpayouts con el programa Aviasales conectado |

`DEPLOY.md` explica cómo registrarse, conectar Aviasales y copiar el token.

## 10. Decisiones tomadas por Claude (Matias puede cambiarlas)

- El radar vive arriba de Opciones y no en una pestaña aparte, porque ahí es donde vuelve lo que se encuentra.
- Se suman micros (Plataforma 10, Central de Pasajes) aunque el documento original habla solo de vuelos, porque la carga rápida ya maneja micros y en Argentina suelen ser una alternativa real.
- Ventana de 3 días antes y 3 después de la ida, como la opción más corta del documento original.
- Los sitios se marcan como revisados solos al abrirlos.
- Caché de 6 horas.
- Lista inicial de sitios: la del boceto de la sección 5. Las aerolíneas se muestran siempre, aunque no vuelen la ruta; el sitio de la aerolínea lo dirá.
- El calendario muestra precio de ida y vuelta con la misma duración del viaje cuando Travelpayouts lo tiene. Si solo hay precios de ida, se muestran con la etiqueta "solo ida".
- El radar aparece solo en la vista con sesión iniciada, no en la página pública compartida.

## 11. Lo que queda a criterio de quien construye

- El formato exacto de cada dirección. Hay que probarlo en el navegador antes de fijarlo y anotar la fecha en `verifiedAt`. Si un sitio no acepta búsqueda armada, va con `prefills: false`.
- Qué endpoint de Travelpayouts da el mínimo por día de salida con menos llamadas (probablemente `grouped_prices` agrupado por fecha de salida), qué mercado usar para rutas desde Argentina y si acepta pesos argentinos como moneda.
- El endpoint de búsqueda de lugares para las sugerencias de códigos.
- Los detalles visuales, dentro del estilo actual (tarjetas tipo pasaje, verde ruta, modo oscuro, 390 px).

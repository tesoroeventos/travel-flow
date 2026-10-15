# TravelFlow: carga rápida con IA

Fecha: 2026-10-15 · Estado: para revisar · Rama: `feat/carga-rapida`

## 1. Por qué

El MVP del 14/10 calcula bien, pero cargar un viaje a mano es tan lento que Matias abandonó después del primer vuelo. El prototipo descartable (artifact "TravelFlow Carga Rápida") probó otro camino: frase para el viaje, capturas que lee la IA y tres propuestas automáticas. Resultado de la prueba real: la IA leyó todo sin errores y la carga dentro de la app fue rápida; los 11 minutos totales se fueron en buscar las ofertas en otras apps.

**Objetivo:** llevar ese flujo a la app real, con su diseño, sin perder lo que ya funciona (costos, itinerario, gastos, exportar, compartir).

**Usuarios por ahora:** Matias y sus amigos, con código de invitación. La venta queda fuera de este ciclo.

**Criterio de éxito:** con las capturas a mano, un viaje con 3 transportes y 2 alojamientos llega a las 3 propuestas en menos de 5 minutos, sin corregir datos en la mayoría de los casos.

## 2. Alcance

**Entra**
1. Crear viaje con una frase o un formulario corto de una pantalla.
2. Pantalla única **Opciones**: capturas (varias a la vez, soltar, elegir o pegar), links, "Uso mi auto" y carga a mano.
3. Lectura con IA desde el servidor (capturas, texto de links, frase del viaje, estimación de auto).
4. Pantalla **Tus 3 opciones**: la más barata, la más rápida y la más cómoda, con "Cambiar algo", "Ver todas" y "Elegir esta".
5. Rediseño visual de toda la app con el estilo del prototipo.
6. Límite diario de lecturas con IA por persona.

**No entra (queda para después)**
- "Compartir → TravelFlow" en Android (Web Share Target).
- Venta, planes y cobros.
- Búsqueda automática de vuelos y hoteles con APIs de proveedores.
- Guardar las capturas.

**Se quita de la interfaz** (el código de dominio queda): asistente de 3 pasos, pantallas separadas de transporte, alojamiento y actividades, editor de partidas de costo, comparador con pesos y umbral de empate, armado manual de escenarios.

## 3. Recorrido

```
Inicio ─► Viaje nuevo ─► Opciones ─► Tus 3 opciones ─► Elegir esta ─► Confirmar ─► Itinerario · Gastos · Exportar
          (frase/form)   (capturas,   (barata, rápida,
                          links, auto) cómoda)
```

Pestañas del viaje: **Opciones · Propuestas · Itinerario · Gastos**. Confirmar se abre desde "Elegir esta"; Exportar, Imprimir y Compartir quedan en un menú del viaje. Datos del viaje (fechas, personas, presupuesto, desde dónde) se editan con el mismo formulario corto.

### 3.1 Viaje nuevo
- Campo grande "Tu viaje en una frase". La IA devuelve destino, origen, ida, vuelta, personas, presupuesto y moneda, y marca lo que supuso.
- Se muestra el formulario corto ya completo; lo supuesto se resalta en amarillo. "Prefiero completar un formulario" lo abre vacío.
- Obligatorios: destino, ida, vuelta (no anterior a la ida) y personas (1 a 20). Opcionales: desde dónde y presupuesto.
- Al guardar se crea el viaje con:
  - `startAt` = ida a las 00:00 y `endAt` = vuelta a las 23:59.
  - Zona horaria `America/Argentina/Buenos_Aires` en ambos extremos, editable en el formulario.
  - N viajeros "Viajero 1…N".
  - `budgetCents` 0 cuando no hay presupuesto. La interfaz muestra 0 como "Sin presupuesto".

### 3.2 Opciones
- Zona para soltar o elegir capturas (varias), Ctrl+V para pegar imágenes, campo para pegar un link, botones "Uso mi auto" y "A mano".
- **Captura:** el navegador la achica a 1600 px de lado mayor en JPEG antes de subirla, y se suben de a dos a la vez. Mientras se lee, la tarjeta muestra la miniatura y "Leyendo…".
- **Una captura puede traer varias ofertas** (por ejemplo, una lista de resultados): se crean hasta 6 tarjetas y el usuario borra las que no quiere.
- **Link:**
  - El servidor abre la página y extrae el texto útil (título, meta, JSON-LD, texto visible) y se lo pasa a la IA.
  - Si el sitio bloquea o no hay texto suficiente, la tarjeta dice: "Este sitio no deja leer el link. Subí una captura de la página."
- **Uso mi auto:**
  - Pide modelo o consumo. La IA estima distancia, horas de manejo, peajes y precio del litro, siempre solo ida.
  - Se guardan como supuestos en las partidas del cálculo de auto existente (`carCostItems`), duplicados para ida y vuelta.
  - Requiere "desde dónde" en el viaje.
- **A mano:** abre una tarjeta vacía en modo edición.
- **Tarjetas** agrupadas en Ida, Vuelta, Ida y vuelta, Alojamiento y En destino.
  - Cada una muestra tipo, nombre, empresa, tramo, horarios, duración, escalas, puntaje, detalle, precio total en la moneda del viaje y cómo se cobra.
  - Lo dudoso se marca en amarillo con "Revisá: …".
  - El lápiz edita en la misma tarjeta y la papelera borra.
- **Precios en dólares:** aparece una vez "¿A cuánto tomás el dólar?" y se guarda como tipo de cambio USD→moneda del viaje con fecha de hoy y fuente "Ingresado por vos".
- **En destino** (actividades, auto de alquiler, otros): casilla "Sumar a las 3 opciones", marcada por defecto.
- **Barra inferior:** "Para comparar falta: cómo volvés, dónde te alojás…" o "Listo. N combinaciones posibles" con el botón "Ver mis 3 opciones".

### 3.3 Tus 3 opciones
- Se calculan cada vez que se abre la pantalla (no se guardan) a partir de todas las combinaciones posibles.
- **Tarjetas:**
  - Etiqueta(s) y total en grande, con el monto por persona.
  - Una línea de por qué se propone.
  - Tres datos: viaje total, confort y presupuesto (sobra o falta).
  - Lista de piezas con su precio.
  - Si una combinación gana en dos criterios, se muestra una sola tarjeta con las dos etiquetas.
- **Cambiar algo:** selectores de transporte y alojamiento. La tarjeta pasa a "Ajustada", con "Volver a la propuesta". El ajuste vive en la URL (`?barata=plan,aloj`) para no tocar la base.
- **Ver las N combinaciones:** tabla ordenada por total.
- **Elegir esta:**
  - Crea un escenario con nombre ("La más barata", etc.) y las selecciones de esa combinación, y lo marca elegido con `chooseScenario`.
  - Lleva a Confirmar.
  - Si ya había un escenario elegido, lo reemplaza: se borra el escenario anterior creado por esta pantalla.

## 4. Lógica de propuestas (dominio puro)

Archivo nuevo `src/domain/decision/proposals.ts`, sin acceso a base de datos.

- **Planes de transporte:**
  - Cada par ida y vuelta (`pairId` igual) es un plan cerrado.
  - Además, cada ida sin par se combina con cada vuelta sin par.
- **Combinaciones:** planes × alojamientos. Sin alojamientos cargados no hay combinaciones; la barra pide uno.
- **Extras:** las opciones "En destino" incluidas se suman a todas las combinaciones.
- **Costo:**
  - Se calcula con el motor existente (`computeScenarioCosts`) sobre las partidas de las piezas, con los tipos de cambio del viaje.
  - Si falta un precio o un tipo de cambio, la combinación queda incompleta y no compite.
- **Tiempo de viaje:** suma, por tramo, de la duración de los segmentos más el margen de terminal:
  - Vuelo: 150 min.
  - Micro y tren: 60 min.
  - Auto: 0.
  - Si un tramo no tiene horarios, el tiempo es desconocido y esa combinación pierde en "más rápida".
- **Confort:** promedio del confort de los tramos (1–5, `comfortRating`), promediado con el confort del alojamiento (1–5, `qualityRating`). Sin dato vale 3.
- **Ganadores:**
  - Más barata: menor costo; empata el menor tiempo.
  - Más rápida: menor tiempo; empata el menor costo.
  - Más cómoda: mayor confort; empata el menor costo.
- **Explicaciones:**
  - Barata: "Ahorrás $X frente a la más rápida".
  - Rápida: "N h de viaje sumando ida y vuelta… Son M h menos que la más barata".
  - Cómoda: "Combina vuelo directo con Hotel X (8,6/10)".

## 5. IA en el servidor

Módulo `src/integrations/ai/`, con una interfaz única y dos implementaciones:

```ts
interface TravelAI {
  parseTrip(text: string, today: string): Promise<Result<TripDraft>>;
  readImage(image: Buffer, mime: string, ctx: TripContext): Promise<Result<OfferDraft[]>>;
  readPage(text: string, url: string, ctx: TripContext): Promise<Result<OfferDraft[]>>;
  estimateCar(input: CarAsk): Promise<Result<CarEstimate>>;
}
```

- **Real:**
  - Usa `@anthropic-ai/sdk`. La clave va en `ANTHROPIC_API_KEY`.
  - Modelo por defecto `claude-sonnet-5-5` para capturas, links y auto, y `claude-haiku-5-5` para la frase del viaje. Ambos se configuran con `AI_MODEL` y `AI_MODEL_FAST`.
  - Las instrucciones son las del prototipo, que ya funcionaron, y la respuesta se valida con Zod.
- **Simulada** (`AI_FAKE=1`): respuestas fijas para pruebas y E2E. Nunca se usa en producción; al arrancar, si `NODE_ENV=production` y `AI_FAKE=1`, la app no inicia.
- **Sin clave:** las funciones de IA muestran "La lectura automática no está configurada. Cargá la opción a mano." El resto de la app funciona.
- **Costo de referencia:** precios publicados de Sonnet 5.5, US$2 por millón de tokens de entrada y US$10 por millón de salida. Una captura achicada más las instrucciones ronda los 3.000 tokens de entrada y 600 de salida, así que cuesta alrededor de **1 centavo de dólar**.
- **Límite diario:** 60 lecturas con IA por usuario por día (frase, captura, link y auto cuentan 1 cada una), configurable con `AI_DAILY_LIMIT`. Se registra en la tabla nueva `ai_usage (user_id, day, count)`. Al superarlo: "Llegaste al límite de lecturas de hoy. Mañana se renueva; mientras tanto podés cargar a mano."
- **Seguridad en links:**
  - Solo `http`/`https` y sin credenciales en la URL.
  - Se bloquean direcciones privadas, locales y de metadatos (resolviendo el DNS antes de conectar).
  - Hasta 3 redirecciones, con la misma validación en cada salto.
  - Tiempo máximo 8 s y hasta 2 MB de respuesta.
  - El texto que se manda a la IA se corta a 30.000 caracteres.
- **Capturas:**
  - Solo JPEG, PNG, WebP o GIF, de hasta 8 MB cada una y hasta 10 por tanda.
  - Se procesan en memoria y no se guardan.
- **Lo que devuelve la IA es dato no confiable:** se valida, se recorta y nunca se ejecuta ni se interpreta como instrucción.

## 6. Datos

Cambios de esquema (migración `0001_carga_rapida`):
- `transport_options.pair_id uuid null`: une la ida y la vuelta de una oferta "ida y vuelta" (precio en la ida, la vuelta sin partidas).
- `transport_options.in_proposals boolean default true` y `activities.in_proposals boolean default true`: la casilla "Sumar a las 3 opciones" de lo que va en destino.
- `transport_options.source text null` y `lodging_options.source`, `activities.source`: `"captura"`, `"link"`, `"auto"` o `"manual"`.
- Tabla `ai_usage`.

Cómo se guarda cada tarjeta:

| Tarjeta | Tabla | Notas |
|---|---|---|
| Vuelo, micro, tren | `transport_options` con un segmento | `leg` outbound/return según el sentido. "Ida y vuelta" crea dos filas con el mismo `pair_id`. `provider` = empresa, `serviceNumber` = nombre, `comfortRating` = confort, `notes` = detalle, `url` si vino de un link. |
| Auto propio | dos `transport_options` (`own_car`) con `pair_id` | Las partidas salen de `carCostItems` para la ida y la vuelta; los supuestos (km, consumo, litro, peajes) quedan visibles y editables. |
| Auto de alquiler | `transport_options` con `leg` internal (`rental_car`) | Va "En destino". |
| Alojamiento | `lodging_options` | Check-in y check-out por defecto: ida 14:00 y vuelta 10:00. `rating` = puntaje sobre 10 (estrellas × 2). `qualityRating` = confort. |
| Actividad u otro | `activities` | Fecha por defecto: el primer día completo del viaje. |

Cada tarjeta lleva una partida de costo:
- Importe, moneda y unidad mapeada (`total`, `per_person`, `per_night`, `per_person_night`, `per_day`).
- Categoría según el tipo y certeza "estimado".
- Fuente "Captura" o el dominio del link, con fecha de consulta de hoy.

Las propuestas no se guardan. Lo que se guarda es el escenario elegido (sección 3.3).

## 7. Diseño visual

El estilo del prototipo se lleva a toda la app:
- **Fuentes:** Bricolage Grotesque para títulos y Figtree para el texto, autoalojadas con @fontsource.
- **Colores:** verde ruta como acento, fondo verdoso claro y amarillo para "revisá".
- **Tarjetas** tipo pasaje con talón troquelado y botones grandes.
- **Modo oscuro** completo.
- **Pantallas que se rediseñan:** ingreso y registro, inicio con la lista de viajes, viaje nuevo, Opciones, Propuestas, Confirmar, Itinerario, Gastos, Exportar/Imprimir y la página pública compartida.
- El viaje de demostración se vuelve a generar con el modelo nuevo (pares, `in_proposals`) y la página pública muestra sus 3 propuestas.

## 8. Errores y mensajes

| Situación | Mensaje |
|---|---|
| Captura sin ofertas | "No encontré una opción de viaje en esta captura." + Reintentar / Cargar a mano / Quitar |
| Respuesta inválida de la IA | "No pude entender esta captura. Reintentá o cargala a mano." |
| Link bloqueado | "Este sitio no deja leer el link. Subí una captura de la página." |
| Sin clave de API | "La lectura automática no está configurada. Cargá la opción a mano." |
| Límite diario | "Llegaste al límite de lecturas de hoy…" |
| Auto sin origen | "Falta desde dónde salís. Completalo en los datos del viaje." |
| Error de la API (caída, saturación) | "No se pudo leer ahora. Probá de nuevo en un rato." (se reintenta una vez automáticamente) |

## 9. Pruebas

- **Unitarias:**
  - Propuestas: planes, pares, combinaciones incompletas, empates, explicaciones y extras.
  - Mapeo de ofertas a filas y partidas.
  - Validación de respuestas de la IA.
  - Extracción de texto de HTML.
  - Bloqueo de direcciones privadas en links.
  - Límite diario.
- **Integración** (PGlite): crear viaje desde borrador, guardar ofertas (incluido "ida y vuelta" y auto), elegir propuesta → escenario elegido → itinerario generado.
- **E2E** (Playwright, celular, `AI_FAKE=1`):
  - Frase → formulario → 3 capturas simuladas → dólar → 3 opciones → cambiar algo → elegir → confirmar → itinerario → gasto → exportar.
  - Errores: captura ilegible y link bloqueado.
  - Página pública de la demo.
- **Manual (Matias):** viaje real con capturas y un link de Booking/Despegar contra la IA real en Railway.
- Las pruebas del MVP que cubren pantallas eliminadas se reemplazan. Las de dominio, servicios, itinerario, gastos y exportación se mantienen verdes.

## 10. Configuración nueva en Railway

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de la consola de Claude (platform.claude.com) |
| `AI_DAILY_LIMIT` | Opcional, por defecto 60 |
| `AI_MODEL`, `AI_MODEL_FAST` | Opcionales |

`DEPLOY.md` explica cómo crear la clave y cargar saldo.

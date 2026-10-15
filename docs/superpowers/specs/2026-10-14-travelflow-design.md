# TravelFlow — Diseño del Núcleo MVP (sub-proyecto 1)

- Fecha: 2026-10-14
- Estado: aprobado por secciones en conversación; pendiente revisión de este documento
- Brief de origen: "PROYECTO: TRAVELFLOW — Plataforma inteligente de logística y planificación de viajes" (secciones 1–21)

---

## 1. Contexto y objetivo

### 1.1 Propósito
TravelFlow es un **producto para vender**. El segmento comercial (viajero final, agencia o empresa) **todavía no está definido**, por lo que el núcleo se diseña neutro: ninguna función específica de agencias o empresas en este ciclo.

### 1.2 Mercado
Latinoamérica. Interfaz en español neutro; varias monedas desde el inicio (monedas ISO de LatAm + USD + EUR). Formato de números con locale `es-419`.

### 1.3 Validación (en este orden)
1. **Demo** para posibles clientes: online, con viaje de ejemplo y enlace público de solo lectura.
2. **Uso propio** en un viaje real con datos cargados a mano.
3. **Beta** con 5–20 usuarios invitados.

### 1.4 Criterio de éxito del MVP
Un usuario puede, **desde el celular**, armar un viaje Buenos Aires → Bariloche completo, comparar 3 escenarios con costo puerta a puerta verificable, elegir uno, generar el itinerario y exportar itinerario y presupuesto.

### 1.5 Descomposición del brief
| # | Sub-proyecto | Este ciclo |
|---|---|---|
| 1 | Núcleo MVP (brief §19) | **Sí** |
| 2 | Mapa logístico y evaluación de ubicación (§7 ubicación, §12) | No |
| 3 | Gastos grupales (saldos, quién paga a quién) + Documentación (§13 parcial, §14) | No |
| 4 | Asistente IA en lenguaje natural (§15) | No |
| 5 | Integraciones reales: vuelos, hoteles, clima, tipo de cambio, calendario (§16) | No |
| — | Comparación de destinos (§5) | No (ciclo posterior a definir) |

---

## 2. Stack

- Next.js (App Router) + React + TypeScript (modo estricto)
- Tailwind CSS
- PostgreSQL + Drizzle ORM (migraciones con drizzle-kit)
- Auth.js — credenciales email + contraseña, hash argon2
- Zod para validación
- Librería de gráficos: Recharts
- Pruebas: Vitest (dominio e integración), Playwright (E2E)
- Despliegue: GitHub + Railway (app + Postgres). CI con GitHub Actions.

---

## 3. Arquitectura

### 3.1 Capas
```
src/
  domain/          TypeScript puro. Sin imports de Next, React ni base de datos.
    money/           Money (centavos + moneda), conversión con tasa explícita, redondeo
    costs/           motor de costos por escenario
    decision/        puntaje ponderado + explicación
    itinerary/       generación cronológica, alertas, diff
  server/          db (esquema Drizzle), repositorios, acciones del servidor, auth, validación Zod
  integrations/    interfaces de proveedores; implementaciones "manual" y "demo"
  app/             rutas Next.js (pantallas)
  ui/              componentes reutilizables
```
Regla de dependencias: `app/ui → server → domain`. `domain` no depende de nada. `integrations` implementa interfaces definidas en `domain`.

### 3.2 Principio: los totales se calculan, no se guardan
La base guarda solo **partidas individuales**. Todo total, subtotal, desvío o puntaje se calcula en `domain` cada vez que se pide. Consecuencia: un cambio de precio actualiza automáticamente todas las pantallas y exportaciones.

### 3.3 Flujo de una operación
pantalla → acción del servidor → validación Zod → repositorio (con control de espacio) → base → motor de dominio → pantalla.

Las acciones devuelven siempre `Result<T>`: `{ ok: true, data }` o `{ ok: false, error: { code, message } }` con mensaje en español.

---

## 4. Modelo de datos

Convenciones: ids UUID; `created_at`/`updated_at` en todas las tablas; importes en **enteros de centavos** (`bigint`) + `currency` (ISO 4217, 3 letras); instantes en `timestamptz` (UTC) + campo `tz` (zona IANA) cuando importa la hora local.

### 4.1 Cuentas
- **users**: id, email (único), name, password_hash.
- **workspaces**: id, name, kind (`personal` — único valor en el MVP).
- **workspace_members**: workspace_id, user_id, role (`owner` | `member`).
- **invite_codes**: code, max_uses, used_count, expires_at.

Al registrarse se crea un workspace personal con el usuario como `owner`.

### 4.2 Viaje
- **trips**: id, workspace_id, name, origin_label, start_at, start_tz, end_at, end_tz, base_currency, budget_amount (centavos), contingency_pct, contingency_categories (array de categorías), tie_threshold_pct (default 5), trip_type, preferences (jsonb), constraints (jsonb), status (`planning` | `confirmed` | `in_progress` | `closed`), chosen_scenario_id (nullable), is_demo, public_share_token (nullable).
- **travelers**: id, trip_id, name, kind (`adult` | `child` | `infant`). Las cantidades por tipo se calculan contando.
- **stops**: id, trip_id, position, label, arrive_date, leave_date. (Paradas en orden; viaje multidestino.)

`preferences` y `constraints` son jsonb validados con Zod (campos de los pasos 2 y 3 del brief §4). En el MVP solo se guardan y se muestran; no filtran automáticamente.

### 4.3 Alternativas
- **transport_options**: id, trip_id, leg (`outbound` | `return` | `internal`), mode (`flight` | `bus` | `train` | `own_car` | `rental_car` | `taxi_app` | `public_transport` | `ferry` | `private_transfer` | `mixed`), provider, from_label, to_label, depart_at, depart_tz, arrive_at, arrive_tz, segments (jsonb: escalas/transbordos con horarios), baggage_notes, cancellation_policy, distance_km (nullable), service_number (nullable), url, comfort_rating (1–5, nullable), notes.
- **lodging_options**: id, trip_id, stop_id (nullable), kind (`hotel` | `apartment` | `hostel` | `rental_house` | `cabin` | `camping` | `other`), name, address, check_in_at, check_in_tz, check_out_at, check_out_tz, rating (nullable), review_count (nullable), amenities (array: breakfast, parking, kitchen, wifi, ac, pool, accessible), capacity, rooms, beds, distance_center_km (nullable), lat, lng (nullable), cancellation_policy, url, quality_rating (1–5, nullable), notes.
- **activities**: id, trip_id, name, address, lat, lng (nullable), date, start_time (nullable), duration_min, fixed_time (bool), requires_booking (bool), access_mode, travel_min_from_prev (nullable), distance_km (nullable), url, notes.

### 4.4 Partidas de costo (`cost_items`)
Cada partida cuelga de **exactamente uno**: transport_option, lodging_option, activity o scenario (partidas propias del escenario: comida, seguro, etc.).

Campos: id, trip_id, owner_type, owner_id, label, amount (centavos), currency, unit (`total` | `per_person` | `per_night` | `per_person_night` | `per_day`), quantity (decimal, default 1), category (13 categorías, ver §5.1), cost_type (`fixed` | `variable` | `optional`), refundable (bool), source, consulted_at, includes_taxes (bool | null = desconocido), certainty (`estimated` | `confirmed`), assumptions (jsonb, nullable — p. ej. km, consumo, precio por litro), is_demo.

### 4.5 Escenarios y decisión
- **scenarios**: id, trip_id, name, description, position.
- **scenario_selections**: scenario_id, owner_type (`transport_option` | `lodging_option` | `activity`), owner_id. Un escenario incluye alternativas por selección.
- **scenario_item_toggles**: scenario_id, cost_item_id, included (bool). Para incluir/excluir partidas opcionales por escenario.
- **scenario_ratings**: scenario_id, criterion (`comfort` | `lodging_quality` | `experience`), value (1–5).
- **decision_weights**: trip_id, criterion (8 criterios), weight (0–10).
- **bookings**: id, trip_id, owner_type, owner_id, booking_status (`selected` | `booking_pending` | `booking_confirmed`), payment_status (`payment_pending` | `paid`), confirmation_code (nullable), notes.

### 4.6 Durante el viaje
- **expenses**: id, trip_id, date, category, description, amount, currency, payment_method, paid_by_traveler_id, participant_ids (array), payment_status, receipt_url (nullable, sin subida de archivos en el MVP).

### 4.7 Monedas
- **exchange_rates**: id, workspace_id, from_currency, to_currency, rate (`numeric(20,10)`), as_of (fecha), source.
Se usa la tasa más reciente con `as_of ≤` fecha de referencia del viaje (hoy si está en planificación). Si no hay tasa directa, se intenta la inversa (1/rate). **No se encadenan conversiones** en el MVP.

### 4.8 Itinerario e historial
- **itinerary_overrides**: trip_id, entry_key, position (nullable), note (nullable). Ajustes manuales sobre el itinerario generado.
- **trip_events**: id, trip_id, user_id, at, entity, entity_id, action, before (jsonb), after (jsonb).

### 4.9 Calculadora de auto
Una función de dominio genera partidas a partir de: km totales, consumo (l/100 km), precio por litro, peajes, estacionamiento, alquiler, seguro, depósito (reembolsable), km adicional, devolución en otra ubicación y desgaste opcional (por km). Los supuestos quedan en `assumptions` de cada partida.

---

## 5. Motor de costos (`domain/costs`)

### 5.1 Categorías (brief §8)
`transport_outbound`, `transport_return`, `transport_internal`, `lodging`, `food`, `activities`, `insurance`, `documents_visas`, `baggage`, `parking_tolls`, `shopping_personal`, `contingency`, `other`.

### 5.2 Entradas
Viaje (fechas, viajeros, moneda base, presupuesto, % y categorías de imprevistos), partidas del escenario (de las alternativas seleccionadas + propias, filtradas por toggles), tasas de cambio.

### 5.3 Cálculo por partida
- Multiplicador por unidad:
  - `total` → 1
  - `per_person` → N viajeros
  - `per_night` → noches
  - `per_person_night` → N × noches
  - `per_day` → días
- Noches de un alojamiento = días de calendario entre check-in y check-out (en hora local).
- Días del viaje = días de calendario entre salida y regreso, **inclusive**.
- Importe de partida = amount × multiplicador × quantity, redondeado a centavos (half-even).
- Conversión a moneda base con la tasa aplicable, redondeo half-even a centavos. Se conservan importe original y convertido.

### 5.4 Salidas
- `total` (excluye reembolsables; excluye imprevistos)
- `contingency` = % × suma de partidas de las categorías seleccionadas (se muestra aparte)
- `totalWithContingency`
- `perPerson` = total ÷ viajeros
- `perPersonPerDay` = total ÷ días ÷ viajeros
- `deviation` = totalWithContingency − presupuesto (positivo = excede)
- `byCategory`
- `confirmed` vs `estimated`; `paid` vs `pending` (según bookings)
- `refundableHeld` (depósitos: dinero inmovilizado, no costo)
- `byCostType` (fijo / variable / opcional)
- `warnings[]`

Las divisiones se hacen en centavos con redondeo half-even; los resultados de división se marcan como valores derivados en la UI.

### 5.5 Comparación entre escenarios
Ahorro absoluto = A − B. Ahorro % = (A − B) ÷ A × 100, con A = escenario de referencia elegido por el usuario (por defecto el más caro).

### 5.6 Advertencias
- `missing_outbound_transport`, `missing_return_transport`
- `uncovered_nights` (noches del viaje sin alojamiento seleccionado)
- `missing_exchange_rate` (from→to); la partida queda fuera del total y el total se marca **incompleto**
- `stale_price` (consulted_at mayor a 14 días, configurable)
- `unknown_taxes` (includes_taxes desconocido)

---

## 6. Motor de decisión (`domain/decision`)

### 6.1 Criterios y datos
| Criterio | Fuente | Mejor es |
|---|---|---|
| Precio total | motor de costos | menor |
| Tiempo de viaje | suma de duraciones de ida + regreso (+ traslados cargados) | menor |
| Transbordos | conteo de segmentos − 1 en ida y regreso | menor |
| Ubicación | distancia promedio alojamiento ↔ actividades (si hay coordenadas) o `distance_center_km` | menor |
| Flexibilidad | % del costo en partidas reembolsables o con cancelación flexible | mayor |
| Comodidad | `scenario_ratings.comfort` (1–5) | mayor |
| Calidad del alojamiento | `scenario_ratings.lodging_quality` | mayor |
| Experiencia general | `scenario_ratings.experience` | mayor |

### 6.2 Cálculo
1. Por criterio, normalizar 0–1 entre el mejor y el peor escenario.
2. **Umbral de empate**: si (peor − mejor) ÷ mejor < `tie_threshold_pct` (default 5 %), el criterio es empate y todos reciben 1.
3. Si un escenario no tiene dato para un criterio, el criterio se excluye **para todos** y se emite aviso `criterion_missing_data`. Nunca se inventa un valor.
4. Puntaje = Σ(peso × valor) ÷ Σ pesos de criterios incluidos.

### 6.3 Explicación
Texto determinístico por plantillas a partir de diferencias reales, p. ej.: "B cuesta 12 % menos que A, pero suma unas 3 h de viaje." / "En tiempo de viaje, A y B empatan." Cada cifra del texto se puede rastrear a un dato.

### 6.4 Libertad de elección
La recomendación es sugerencia. El usuario elige cualquier escenario como ganador.

---

## 7. Confirmación, itinerario y gastos

### 7.1 Confirmar mi viaje
1. El usuario elige el escenario ganador (`trips.chosen_scenario_id`).
2. Cada alternativa del escenario se registra en `bookings` con `selected` + `payment_pending`.
3. El usuario cambia estados manualmente. La app **nunca** marca algo como reservado o pagado por sí sola.
4. Resumen final antes de generar el itinerario (alternativas, totales, estados).

### 7.2 Generador de itinerario (`domain/itinerary`)
Entrada: escenario elegido, viaje, overrides. Salida: lista ordenada de entradas `{ key, kind, start, end, tz, title, details, cost?, alerts[] }` agrupadas por día local.

**Día de salida** (calculado hacia atrás):
- Salida de casa = salida del servicio − anticipación − traslado.
- Anticipación sugerida: vuelo nacional 2 h, internacional 3 h, micro/tren 30 min, auto 0. Editable; marcada como sugerencia.
- Traslado: minutos cargados a mano (default vacío → aviso `missing_transfer_time`).
- Incluye escalas, llegada, traslado al alojamiento y check-in.

**Días de estadía**: bloques mañana (06–12), mediodía (12–15), tarde (15–20), noche (20–06). Actividades sin hora se ubican por orden en el bloque mañana.

**Día de regreso**: check-out, traslado, anticipación, servicio, escalas, llegada, traslado a casa, costos pendientes y estado de cierre.

**Alertas**:
- `overlap` — dos entradas se superponen
- `insufficient_travel_time` — hueco menor al traslado cargado
- `tight_connection` — < 60 min entre vuelos; < 15 min entre micros/trenes
- `outside_lodging_dates` — actividad fuera de las noches de alojamiento
- `arrival_before_checkin`

**Reordenamiento**: manual (arrastrar, guardado en overrides). Botón "ordenar por cercanía": vecino más cercano por distancia en línea recta (haversine) sobre actividades con coordenadas, respetando las de hora fija. Deshabilitado si no hay coordenadas.

**Recálculo**: el itinerario se regenera siempre desde los datos. Al cambiar un vuelo, hotel o actividad, se compara la versión anterior (último snapshot mostrado) con la nueva y se listan las entradas que cambiaron.

**Vistas MVP**: cronológica y diaria. Calendario vía .ics. Mapa en sub-proyecto 2.

### 7.3 Gastos reales
Formulario de carga (campos §4.6). Panel comparativo: presupuesto inicial, estimado del escenario elegido, real acumulado, disponible (presupuesto − real), desvío por categoría. Mismo motor de monedas.

---

## 8. Pantallas y navegación

Menú (solo lo que funciona):
- **Dashboard**: viajes activos y próximos, presupuesto vs. estimado vs. real, accesos rápidos.
- **Mis viajes**: lista, duplicar, eliminar.
- **Crear viaje**: asistente en 3 pasos (datos generales, preferencias, restricciones) → ficha del viaje.
- **Dentro de cada viaje** (pestañas): Resumen · Transporte · Alojamiento · Actividades · Comparador · Confirmar · Itinerario · Gastos.
- **Configuración**: perfil, tipos de cambio, preferencias de visualización (modo claro/oscuro).

Transporte: ordenar por menor precio, menor duración, mejor precio-tiempo (precio ÷ horas), menos transbordos, mayor comodidad.
Alojamiento: filtros por precio por noche, precio total, servicios, distancia al centro, capacidad.
Comparador: tabla de escenarios lado a lado, gráfico de distribución por categoría, barras por escenario, costo por persona y diario, ahorro absoluto y %, confirmado vs. estimado, pesos y explicación.

Diseño: pensado primero para celular (390 px), modo claro y oscuro, PWA instalable (manifest). Sin modo sin conexión en el MVP.

---

## 9. Exportación
- Itinerario y presupuesto en **PDF** desde una vista de impresión (`/trips/[id]/print`) con estilos `@media print`.
- Itinerario en **.ics** (un evento por entrada con hora).
- Presupuesto en **CSV** (una fila por partida con importe original, convertido, categoría, certeza).
- Las exportaciones usan los mismos cálculos que la pantalla.

---

## 10. Datos demo
- Seed: viaje **Buenos Aires → Bariloche, 7 días, 2 adultos**, moneda ARS, con 3 escenarios:
  - A: avión + hotel céntrico + transporte público
  - B: auto propio + departamento alejado
  - C: micro + hostel + traslados puntuales
- Todas las partidas con `is_demo = true` y `source = "Dato de demostración"`. Banner fijo "Precios ficticios".
- Enlace público de solo lectura (`/share/[token]`), sin login.
- "Duplicar como mío": copia el viaje al workspace del usuario; cada partida pierde `is_demo` recién al editarse.

---

## 11. Seguridad y acceso
- Registro solo con código de invitación válido.
- Contraseñas con argon2. Sesiones de Auth.js.
- Todos los repositorios reciben `workspaceId` y filtran por él; nunca se consulta un viaje solo por id.
- Enlace público: token aleatorio de 32 bytes; solo lectura; revocable.
- Tests de autorización: un usuario no puede leer ni modificar viajes de otro workspace.

---

## 12. Manejo de errores
- Validación Zod con mensajes en español junto al campo.
- Acciones del servidor devuelven `Result<T>`; la UI muestra el error sin romper la pantalla.
- Fallas de base de datos: mensaje + reintentar.
- Advertencias de cálculo (§5.6, §7.2) se muestran donde ocurren; el resto de la pantalla funciona.
- Integraciones: interfaz común `fetchX(): Promise<Result<{ data, source, fetchedAt }>>`. En el MVP solo implementaciones manual/demo.

---

## 13. Pruebas
- **Vitest — dominio**: money (redondeo, conversión, inversa, falta de tasa), costos (cada unidad, noches, días, imprevistos, reembolsables, advertencias), decisión (normalización, empate, criterios faltantes, explicación), itinerario (cálculo hacia atrás, alertas, zonas horarias, diff). Incluye el caso Bariloche **calculado a mano** como test de referencia.
- **Vitest — integración**: repositorios contra Postgres de prueba; tests de aislamiento entre workspaces.
- **Playwright** a 390×844: registro con invitación → crear viaje → cargar transporte, alojamiento y actividades → 3 escenarios → elegir → confirmar → itinerario → cargar gasto → exportar CSV/ics y abrir vista de impresión.
- CI: GitHub Actions corre lint, typecheck, Vitest y Playwright en cada push.

---

## 14. Despliegue
- Repositorio GitHub. Railway: servicio Next.js + Postgres. Variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`.
- Migraciones Drizzle al desplegar. Seed demo ejecutable por comando.
- Requiere credenciales del usuario (GitHub y Railway) para el despliegue final.

---

## 15. Fuera de alcance (este ciclo)
Mapas y rutas, comparación de destinos, división de gastos grupales y saldos, documentación y subida de archivos, asistente IA, integraciones con APIs externas, conversión encadenada de monedas, modo sin conexión, funciones de agencia/empresa, vista de calendario integrada.

---

## 16. Entrega final
Resumen con tres listas: funciona con datos reales cargados por el usuario; usa datos simulados (demo); requiere credenciales o servicios externos.

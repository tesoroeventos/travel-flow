# TravelFlow — Núcleo MVP — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el núcleo MVP de TravelFlow: crear un viaje, cargar alternativas con partidas de costo, comparar ≥3 escenarios con costo puerta a puerta verificable, elegir uno, generar el itinerario, registrar gastos reales, exportar, con demo pública, todo usable a 390 px.

**Architecture:** App Next.js única en cuatro capas: `domain/` (TypeScript puro: dinero, costos, decisión, itinerario), `server/` (Drizzle + repositorios con control de workspace + servicios + acciones), `integrations/` (interfaces; solo manual/demo) y `app/` + `ui/`. Los totales nunca se guardan: los servicios arman la entrada del dominio desde la base y el dominio calcula.

**Tech Stack:** Node 22, Next.js 16 (App Router), React, TypeScript estricto, Tailwind CSS 4, Drizzle ORM 0.45 (postgres-js en producción, PGlite en tests y E2E), Auth.js v5 (next-auth@beta, credenciales), @node-rs/argon2, Zod, decimal.js, date-fns + date-fns-tz, Recharts, @dnd-kit/sortable, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-travelflow-design.md`

## Global Constraints

- Idioma de la interfaz: español neutro. Formato de números y monedas: locale `es-419`.
- Dinero: entero de centavos (`number`, verificado con `Number.isSafeInteger`) + `currency` ISO 4217 de 3 letras. Nunca `float` para importes. Tasas y cantidades: `decimal.js`, guardadas como string decimal.
- Redondeo a centavos: **half-even** en todas partes.
- Conversión: tasa directa o inversa (1/rate). **Sin encadenar** conversiones.
- Instantes: ISO UTC + zona IANA (`tz`); días y noches se cuentan en **fecha local**.
- Días del viaje: días de calendario entre salida y regreso, **inclusive**. Noches de alojamiento: días de calendario entre check-in y check-out.
- Umbral de empate por defecto: **5 %**. Precio viejo: **14 días** desde `consulted_at`.
- Anticipación sugerida: vuelo nacional **120 min**, internacional **180 min**, micro/tren **30 min**, resto **0**.
- Conexión ajustada: **< 60 min** entre vuelos; **< 15 min** entre micros/trenes.
- Bloques: mañana 06–12, mediodía 12–15, tarde 15–20, noche 20–06. Actividad sin hora: arranca **09:00** y se encadena.
- Demo: banner con el texto exacto **"Precios ficticios"**; `source` = **"Dato de demostración"**.
- Registro solo con código de invitación. Contraseñas con argon2.
- Todo repositorio recibe `workspaceId` y filtra por él.
- Viewport de prueba móvil: **390×844**.
- La app nunca cambia por sí sola el estado de una reserva o pago.

## Review Focus

1. **Importes escritos en formato latinoamericano** (`1.234,56`, `1500000`, `12,5`): se convierten a centavos correctamente; formatos ambiguos o inválidos se rechazan con mensaje en español → test en Task 2.
2. **Fechas invertidas o iguales** (regreso antes de la salida, check-out antes o igual al check-in): validación lo rechaza; el dominio nunca devuelve noches o días negativos → tests en Task 4 y Task 13.
3. **Divisiones por cero en decisión** (mejor valor = 0, todos los escenarios iguales, un solo escenario): sin `NaN` ni `Infinity`; empate cuando corresponde → test en Task 7.
4. **Borrar una alternativa usada en un escenario o reserva**: se borran sus selecciones y reservas, el escenario recalcula, y si era el escenario elegido el itinerario muestra el cambio → test en Task 12.
5. **Viajes que cruzan husos horarios o la medianoche**: entradas agrupadas por fecha local del lugar, duración real en minutos → test en Task 8.

---

## Mapa de archivos

```
src/
  domain/
    result.ts                     Result<T>, ok(), err()
    money/money.ts                Money, add, multiply, roundHalfEven, format
    money/parse.ts                parseAmount (formato LatAm)
    money/rates.ts                ExchangeRate, findRate, convert
    time/calendar.ts              localDate, tripDays, nights, minutesBetween, blockOf
    costs/types.ts                CostUnit, CostCategory, CostItemInput, CostSummary…
    costs/engine.ts               computeScenarioCosts
    costs/coverage.ts             computeCoverage
    costs/compare.ts              compareScenarios
    costs/car.ts                  carCostItems
    decision/types.ts             Criterion, ScenarioMetrics, ScoreResult
    decision/score.ts             scoreScenarios
    decision/explain.ts           explainScores
    decision/metrics.ts           metricsFromScenario
    itinerary/types.ts            ItineraryInput, Itinerary, ItineraryEntry, AlertCode
    itinerary/generate.ts         generateItinerary, defaultAdvanceMin
    itinerary/alerts.ts           detectAlerts
    itinerary/order.ts            orderByProximity, haversineKm
    itinerary/diff.ts             diffItineraries
    __fixtures__/bariloche.ts     caso calculado a mano (§ Task 5)
  server/
    db/schema.ts                  tablas Drizzle
    db/client.ts                  createDb(url), Db
    db/test-db.ts                 createTestDb()
    repos/*.ts                    un archivo por agregado
    services/*.ts                 lógica de aplicación (ctx + db + input)
    auth/*.ts                     Auth.js, registro, invitaciones
    validation/*.ts               esquemas Zod
    export/csv.ts, export/ics.ts
  integrations/types.ts           interfaz de proveedores
  app/                            rutas
  ui/                             componentes
scripts/seed-demo.ts, scripts/create-invite.ts, scripts/migrate.ts
tests/e2e/*.spec.ts
```

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/domain/result.ts`, `src/domain/result.test.ts`, `.gitignore`, `.env.example`
- Test: `src/domain/result.test.ts`

**Interfaces:**
- Produces: `type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }`; `ok<T>(data: T): Result<T>`; `err(code: string, message: string): Result<never>`. Scripts npm: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `seed:demo`, `invite`.

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack` (conservar `docs/`). Agregar `"strict": true` y `"noUncheckedIndexedAccess": true` en tsconfig. Instalar `vitest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`.
- [ ] **Step 2: Test que falla** — `result.test.ts`: `ok(5)` es `{ ok: true, data: 5 }`; `err('x','y')` es `{ ok: false, error: { code: 'x', message: 'y' } }`.
- [ ] **Step 3:** `npm test` → FAIL (módulo no existe).
- [ ] **Step 4:** Implementar `src/domain/result.ts`.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run build` → todo PASS.
- [ ] **Step 6:** Commit `chore: scaffold Next.js + Vitest + Result`.

---

### Task 2: Dinero y parseo de importes

**Files:**
- Create: `src/domain/money/money.ts`, `src/domain/money/parse.ts`
- Test: `src/domain/money/money.test.ts`, `src/domain/money/parse.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` (Task 1).
- Produces:
  - `type Currency = string`; `interface Money { cents: number; currency: Currency }`
  - `money(cents: number, currency: Currency): Money` — lanza si no es entero seguro o la moneda no tiene 3 letras mayúsculas.
  - `addMoney(a: Money, b: Money): Money` — lanza si las monedas difieren.
  - `roundHalfEven(value: Decimal): number` — a entero de centavos.
  - `multiplyCents(cents: number, factor: Decimal.Value): number` — half-even.
  - `divideCents(cents: number, divisor: number): number | null` — `null` si divisor ≤ 0.
  - `formatMoney(m: Money, locale = 'es-419'): string` — con `Intl.NumberFormat` (style currency).
  - `parseAmount(input: string): Result<number>` — devuelve centavos.
  - `SUPPORTED_CURRENCIES` = `['ARS','BOB','BRL','CLP','COP','CRC','DOP','GTQ','HNL','MXN','NIO','PAB','PEN','PYG','UYU','VES','USD','EUR']`.

- [ ] **Step 1: Tests que fallan**
  - `multiplyCents(1, '0.5')` → `0`; `multiplyCents(3, '0.5')` → `2`; `multiplyCents(5, '0.5')` → `2` (half-even).
  - `divideCents(125503000, 14)` → `8964500`; `divideCents(100, 0)` → `null`.
  - `addMoney(money(100,'ARS'), money(1,'USD'))` lanza.
  - `parseAmount('1.234,56')` → `ok(123456)`; `'1500000'` → `ok(150000000)`; `'1234,5'` → `ok(123450)`; `'0'` → `ok(0)`; `' 12 '` → `ok(1200)`.
  - `parseAmount('12,345')` → `err('too_many_decimals', 'Usá como máximo 2 decimales')`; `'-5'` → `err('negative', 'El importe no puede ser negativo')`; `''` → `err('empty', 'Ingresá un importe')`; `'1.23.4'` y `'abc'` → `err('invalid', 'Formato inválido. Ejemplo: 1.234,56')`.
- [ ] **Step 2:** `npx vitest run src/domain/money` → FAIL.
- [ ] **Step 3:** Implementar. Regla de `parseAmount`: el punto es separador de miles **solo** en grupos de 3 dígitos (`^\d{1,3}(\.\d{3})+(,\d{1,2})?$`), la coma es el decimal; sin puntos: `^\d+(,\d{1,2})?$`. Un punto que no forma grupos de miles válido → `invalid`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(domain): dinero en centavos y parseo LatAm`.

---

### Task 3: Tipos de cambio y conversión

**Files:**
- Create: `src/domain/money/rates.ts`
- Test: `src/domain/money/rates.test.ts`

**Interfaces:**
- Consumes: `Money`, `multiplyCents`, `Result` (Tasks 1–2).
- Produces:
  - `interface ExchangeRate { from: Currency; to: Currency; rate: string; asOf: string /*YYYY-MM-DD*/; source: string }`
  - `findRate(rates: ExchangeRate[], from: Currency, to: Currency, asOf: string): { factor: Decimal; inverse: boolean; rate: ExchangeRate } | null` — misma moneda → factor 1 sin `rate` (devolver un objeto con `rate` sintético `source: 'identity'`).
  - `convert(m: Money, to: Currency, rates: ExchangeRate[], asOf: string): Result<{ money: Money; factor: string; rateAsOf: string | null; rateSource: string | null }>` — error `missing_exchange_rate` con mensaje `Falta tipo de cambio ${from}→${to}`.

- [ ] **Step 1: Tests que fallan**
  - Con `{USD→ARS 1000.50, asOf 2027-01-01}`: `convert(money(6000,'USD'),'ARS',rates,'2027-01-10')` → `6003000` ARS.
  - Inversa: `convert(money(100050,'ARS'),'USD',rates,'2027-01-10')` → `100` USD, `factor` = `1/1000.50` como string.
  - Toma la tasa más reciente con `asOf ≤ fecha`: con tasas 2026-12-01 (900) y 2027-01-01 (1000.50), fecha 2026-12-15 usa 900; fecha 2027-01-02 usa 1000.50.
  - Tasa con `asOf` posterior a la fecha → no se usa → `err('missing_exchange_rate','Falta tipo de cambio USD→ARS')`.
  - Sin encadenar: con `USD→ARS` y `ARS→CLP`, `USD→CLP` → error.
  - Misma moneda → mismo importe, `rateSource` `null`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. Preferir tasa directa sobre inversa cuando ambas existen para la misma fecha.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `feat(domain): conversión con tasa explícita`.

---

### Task 4: Calendario y husos horarios

**Files:**
- Create: `src/domain/time/calendar.ts`
- Test: `src/domain/time/calendar.test.ts`

**Interfaces:**
- Produces:
  - `localDate(utcIso: string, tz: string): string` — `YYYY-MM-DD`.
  - `localTime(utcIso: string, tz: string): string` — `HH:mm`.
  - `zonedToUtc(date: string, time: string, tz: string): string` — ISO UTC.
  - `tripDays(startUtc: string, startTz: string, endUtc: string, endTz: string): number` — inclusive; lanza `RangeError` si el fin es anterior al inicio.
  - `nights(checkInUtc: string, checkOutUtc: string, tz: string): number` — lanza `RangeError` si check-out ≤ check-in en fecha local… salvo misma fecha → `0`? **Decisión:** check-out con fecha local ≤ check-in → `RangeError('El check-out debe ser posterior al check-in')`.
  - `minutesBetween(aUtc: string, bUtc: string): number`.
  - `blockOf(localHHmm: string): 'morning' | 'midday' | 'afternoon' | 'night'`.
  - `addDays(date: string, n: number): string`; `datesBetween(start: string, endInclusive: string): string[]`.

- [ ] **Step 1: Tests que fallan** (tz `America/Argentina/Buenos_Aires`, abreviada BA)
  - `tripDays(zonedToUtc('2027-01-10','08:00',BA),BA, zonedToUtc('2027-01-16','20:00',BA),BA)` → `7`.
  - `nights(zonedToUtc('2027-01-10','15:00',BA), zonedToUtc('2027-01-16','10:00',BA), BA)` → `6`.
  - `localDate(zonedToUtc('2027-01-10','23:30',BA), BA)` → `'2027-01-10'` (en UTC ya es 11).
  - `minutesBetween(zonedToUtc('2027-03-01','13:00',BA), zonedToUtc('2027-03-02','06:30','Europe/Madrid'))` → `810`.
  - Fin antes del inicio → `RangeError`. Check-out igual a check-in (misma fecha) → `RangeError`.
  - `blockOf('05:59')` → `night`; `'06:00'` → `morning`; `'12:00'` → `midday`; `'15:00'` → `afternoon`; `'20:00'` → `night`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar con `date-fns-tz` (`formatInTimeZone`, `fromZonedTime`).
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `feat(domain): calendario con zonas horarias`.

---

### Task 5: Motor de costos

**Files:**
- Create: `src/domain/costs/types.ts`, `src/domain/costs/engine.ts`, `src/domain/costs/coverage.ts`, `src/domain/__fixtures__/bariloche.ts`
- Test: `src/domain/costs/engine.test.ts`, `src/domain/costs/coverage.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces (`types.ts`):
  - `type CostUnit = 'total' | 'per_person' | 'per_night' | 'per_person_night' | 'per_day'`
  - `const COST_CATEGORIES = ['transport_outbound','transport_return','transport_internal','lodging','food','activities','insurance','documents_visas','baggage','parking_tolls','shopping_personal','contingency','other'] as const`; `type CostCategory`.
  - `CATEGORY_LABELS: Record<CostCategory, string>` — "Transporte de ida", "Transporte de regreso", "Transporte interno", "Alojamiento", "Alimentación", "Actividades y entradas", "Seguros", "Documentación y visados", "Equipaje", "Estacionamiento y peajes", "Compras y gastos personales", "Imprevistos", "Otros gastos".
  - `interface CostItemInput { id: string; label: string; amountCents: number; currency: Currency; unit: CostUnit; quantity: string; category: CostCategory; costType: 'fixed'|'variable'|'optional'; refundable: boolean; certainty: 'estimated'|'confirmed'; includesTaxes: boolean | null; consultedAt: string | null; nights: number | null; paymentStatus: 'payment_pending' | 'paid' }`
  - `interface ScenarioCostInput { travelers: number; tripDays: number; baseCurrency: Currency; budgetCents: number; contingencyPct: string; contingencyCategories: CostCategory[]; rateDate: string; today: string; staleDays: number; rates: ExchangeRate[]; items: CostItemInput[]; coverage: Coverage }`
  - `interface Coverage { hasOutbound: boolean; hasReturn: boolean; uncoveredNights: number }`
  - `type CostWarningCode = 'missing_outbound_transport'|'missing_return_transport'|'uncovered_nights'|'missing_exchange_rate'|'stale_price'|'unknown_taxes'`; `interface CostWarning { code: CostWarningCode; itemId?: string; detail?: string }`
  - `interface CostLine { itemId: string; multiplier: string; originalCents: number; originalCurrency: Currency; convertedCents: number | null; factor: string | null; status: 'counted' | 'refundable' | 'missing_rate' }`
  - `interface CostSummary { totalCents: number; contingencyCents: number; totalWithContingencyCents: number; perPersonCents: number | null; perPersonPerDayCents: number | null; deviationCents: number; byCategory: Record<CostCategory, number>; byCostType: Record<'fixed'|'variable'|'optional', number>; confirmedCents: number; estimatedCents: number; paidCents: number; pendingCents: number; refundableHeldCents: number; incomplete: boolean; lines: CostLine[]; warnings: CostWarning[] }`
- Produces (funciones): `computeScenarioCosts(input: ScenarioCostInput): CostSummary`; `computeCoverage(args: { tripStartUtc; tripStartTz; tripEndUtc; tripEndTz; lodgings: { checkInUtc: string; checkOutUtc: string; tz: string }[]; legs: ('outbound'|'return'|'internal')[] }): Coverage`.
- Produces (fixture): `barilocheScenarioA(): ScenarioCostInput` con los datos de abajo.

**Fixture Bariloche A** (BA tz, 2 adultos, ARS, presupuesto 1.500.000,00, imprevistos 10 % sobre `food` + `activities`, salida 2027-01-10 08:00, regreso 2027-01-16 20:00 → 7 días; tasa USD→ARS 1000.50 al 2027-01-01):

| Partida | Importe | Unidad | Categoría | Otros | Resultado ARS |
|---|---|---|---|---|---|
| Vuelo ida | 120.000,00 ARS | per_person | transport_outbound | confirmed, paid | 240.000,00 |
| Vuelo vuelta | 110.000,00 ARS | per_person | transport_return | estimated | 220.000,00 |
| Hotel | 80.000,00 ARS | per_night (nights 6) | lodging | | 480.000,00 |
| Depósito hotel | 50.000,00 ARS | total | lodging | refundable | (retenido 50.000,00) |
| Comida | 25.000,00 ARS | per_day | food | variable | 175.000,00 |
| Seguro | 30,00 USD | per_person | insurance | | 60.030,00 |
| Excursión | 40.000,00 ARS | per_person | activities | optional | 80.000,00 |

- [ ] **Step 1: Tests que fallan** (`engine.test.ts`, valores en centavos)
  - Fixture A: `totalCents 125503000`, `contingencyCents 2550000`, `totalWithContingencyCents 128053000`, `deviationCents -21947000`, `perPersonCents 62751500`, `perPersonPerDayCents 8964500`, `refundableHeldCents 5000000`, `confirmedCents 24000000`, `estimatedCents 101503000`, `paidCents 24000000`, `pendingCents 101503000`, `byCategory.lodging 48000000`, `byCategory.insurance 6003000`, `byCostType.optional 8000000`, `incomplete false`.
  - Sin tasa USD→ARS: seguro queda `status 'missing_rate'`, `totalCents 119500000`, `incomplete true`, warning `missing_exchange_rate` con `itemId` del seguro.
  - `per_person_night` con 2 viajeros y nights 3 → multiplicador `6`. `per_night` con `nights: null` usa `tripDays - 1`.
  - `amountCents 101`, `unit 'total'`, `quantity '0.5'` → `convertedCents 50` (101 × 0,5 = 50,5 → half-even 50).
  - `consultedAt` hace 15 días respecto de `today` → `stale_price`; 14 días → sin aviso.
  - `includesTaxes null` → `unknown_taxes`.
  - Coverage `{ hasOutbound: false, hasReturn: true, uncoveredNights: 2 }` → warnings `missing_outbound_transport` y `uncovered_nights` con `detail '2'`.
  - `travelers 0` → `perPersonCents null`, `perPersonPerDayCents null` (no lanza).
- [ ] **Step 2: Tests que fallan** (`coverage.test.ts`): viaje 2027-01-10→2027-01-16 (6 noches), hotel 10→13 y otro 14→16 → `uncoveredNights 1`; legs `['outbound','internal']` → `hasReturn false`.
- [ ] **Step 3:** Correr → FAIL.
- [ ] **Step 4:** Implementar. Orden: multiplicador → `amount × mult × quantity` half-even → convertir → acumular. Imprevistos = `contingencyPct/100 × Σ byCategory[c]` de las categorías elegidas, half-even. Reembolsables no suman a nada salvo `refundableHeldCents`. `estimated`/`confirmed` y `paid`/`pending` sobre partidas contadas.
- [ ] **Step 5:** Correr → PASS.
- [ ] **Step 6:** Commit `feat(domain): motor de costos con caso Bariloche`.

---

### Task 6: Comparación de escenarios y calculadora de auto

**Files:**
- Create: `src/domain/costs/compare.ts`, `src/domain/costs/car.ts`
- Test: `src/domain/costs/compare.test.ts`, `src/domain/costs/car.test.ts`

**Interfaces:**
- Consumes: `CostSummary`, `CostItemInput` (Task 5).
- Produces:
  - `compareScenarios(items: { scenarioId: string; totalWithContingencyCents: number }[], referenceId?: string): { referenceId: string; rows: { scenarioId: string; savingCents: number; savingPct: string | null }[] }` — referencia por defecto = el más caro; `savingPct` con 1 decimal (`'12.0'`), `null` si la referencia es 0.
  - `interface CarParams { km: string; consumptionLPer100: string; fuelPriceCents: number; currency: Currency; tollsCents: number; parkingCents: number; rentalCents: number; insuranceCents: number; depositCents: number; extraKm: string; extraKmPriceCents: number; dropOffCents: number; wearPerKmCents: number | null; leg: 'outbound' | 'return' | 'internal' }`
  - `carCostItems(p: CarParams): Omit<CostItemInput, 'id'>[]` — una partida por concepto con importe > 0; `unit 'total'`; categoría combustible/alquiler/seguro/km/devolución/desgaste = `transport_<leg>`, peajes y estacionamiento = `parking_tolls`; depósito `refundable: true`; desgaste `costType 'optional'`; cada partida lleva en `label` el supuesto (p. ej. `Combustible: 3.200 km × 8 l/100 km × $1.200,00/l`). Agregar `assumptions: Record<string,string>` al tipo de salida.

- [ ] **Step 1: Tests que fallan**
  - `compareScenarios([{A, 100000000},{B, 88000000}])` → referencia A; fila B `savingCents 12000000`, `savingPct '12.0'`; fila A `0`, `'0.0'`.
  - Referencia con total 0 → `savingPct null`.
  - Auto: `km '3200'`, `consumption '8'`, `fuelPriceCents 120000` ARS → combustible `30720000`; peajes `2500000` en `parking_tolls`; desgaste `1500`/km → `4800000` opcional; `depositCents 0` → sin partida de depósito; `depositCents 10000000` → partida reembolsable.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `feat(domain): comparación de escenarios y calculadora de auto`.

---

### Task 7: Motor de decisión

**Files:**
- Create: `src/domain/decision/types.ts`, `score.ts`, `explain.ts`, `metrics.ts`
- Test: `src/domain/decision/score.test.ts`, `explain.test.ts`, `metrics.test.ts`

**Interfaces:**
- Consumes: `CostSummary` (Task 5), `minutesBetween` (Task 4).
- Produces:
  - `const CRITERIA = ['price','travel_time','transfers','location','flexibility','comfort','lodging_quality','experience'] as const`; `type Criterion`; `HIGHER_IS_BETTER: Set<Criterion>` = flexibility, comfort, lodging_quality, experience.
  - `CRITERION_LABELS` en español: Precio total, Tiempo de viaje, Transbordos, Ubicación, Flexibilidad, Comodidad, Calidad del alojamiento, Experiencia general.
  - `interface ScenarioMetrics { scenarioId: string; name: string; values: Partial<Record<Criterion, number>> }` — price en centavos, travel_time en minutos, location en km, flexibility en % (0–100), ratings 1–5.
  - `interface ScoreResult { scores: { scenarioId: string; score: number; perCriterion: Partial<Record<Criterion, number>> }[]; ties: Criterion[]; excluded: Criterion[]; warnings: { code: 'criterion_missing_data'; criterion: Criterion }[]; recommendedId: string | null }`
  - `scoreScenarios(metrics: ScenarioMetrics[], weights: Record<Criterion, number>, tieThresholdPct: number): ScoreResult`
  - `explainScores(metrics: ScenarioMetrics[], result: ScoreResult, referenceId: string): string[]`
  - `metricsFromScenario(args: { scenarioId: string; name: string; summary: CostSummary; legs: { leg: 'outbound'|'return'|'internal'; segments: { departUtc: string; arriveUtc: string }[] }[]; locationKm: number | null; flexiblePct: number | null; ratings: Partial<Record<'comfort'|'lodging_quality'|'experience', number>> }): ScenarioMetrics` — travel_time = Σ minutos de primer departure a última arrival de cada leg outbound/return; transfers = Σ (segmentos − 1) de outbound/return; sin legs outbound/return → travel_time y transfers ausentes.

- [ ] **Step 1: Tests que fallan**
  - A `{price 100000000, travel_time 120}`, B `{price 88000000, travel_time 300}`, pesos price 10, travel_time 5, resto 0 → A `0.3333` (4 decimales), B `0.6667`, `recommendedId 'B'`.
  - Empate: A price 100000000, B 97000000 (diferencia 3,09 % < 5) → `ties` incluye `price`, ambos `perCriterion.price = 1`.
  - Mejor valor 0: A transfers 0, B transfers 1 → no hay `NaN`; A 1, B 0. Todos iguales (0 y 0) → empate.
  - Un solo escenario → score 1 y `recommendedId` ese escenario.
  - Falta `comfort` en B → `excluded` contiene `comfort`, warning `criterion_missing_data`, score calculado sin comfort.
  - Todos los pesos 0 → todos score 0, `recommendedId null`.
  - `explainScores` del primer caso con referencia A contiene exactamente `'B cuesta 12 % menos que A, pero suma unas 3 h de viaje.'`; caso empate contiene `'En precio total, A y B empatan.'`.
  - `metricsFromScenario` con ida 10:00→12:20 (1 segmento) y vuelta 17:00→19:10 con 2 segmentos → `travel_time 270`, `transfers 1`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. Empate: sea `best`, `worst`; si `best === worst` → empate; si `best === 0` → no aplica % (solo empate si iguales); si no, `Math.abs(worst - best) / Math.abs(best) * 100 < tieThresholdPct` → empate. Normalización: `(worst - v)/(worst - best)` para "menor es mejor", inverso para "mayor es mejor". Explicación: plantilla de precio `"{X} cuesta {p} % menos que {R}"` con `p` entero redondeado; tiempo `", pero suma unas {h} h de viaje"` con horas redondeadas, solo si suma ≥ 30 min; empates `"En {criterio en minúscula}, {A} y {B} empatan."`.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `feat(domain): motor de decisión con umbral de empate`.

---

### Task 8: Generador de itinerario

**Files:**
- Create: `src/domain/itinerary/types.ts`, `generate.ts`, `alerts.ts`
- Test: `src/domain/itinerary/generate.test.ts`, `alerts.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces (`types.ts`):
  - `interface Segment { from: string; to: string; departUtc: string; departTz: string; arriveUtc: string; arriveTz: string }`
  - `interface TransportLeg { id: string; leg: 'outbound'|'return'|'internal'; mode: TransportMode; international: boolean; provider: string; serviceNumber: string | null; segments: Segment[]; transferToMin: number | null; transferFromMin: number | null; advanceMin: number | null }`
  - `type TransportMode = 'flight'|'bus'|'train'|'own_car'|'rental_car'|'taxi_app'|'public_transport'|'ferry'|'private_transfer'|'mixed'`
  - `interface LodgingStay { id: string; name: string; address: string; checkInUtc: string; checkOutUtc: string; tz: string }`
  - `interface ActivityInput { id: string; name: string; address: string; date: string; startTime: string | null; durationMin: number; fixedTime: boolean; tz: string; lat: number | null; lng: number | null; travelMinFromPrev: number | null; costCents: number | null; requiresBooking: boolean; url: string | null; notes: string | null }`
  - `interface ItineraryOverride { entryKey: string; position: number | null; note: string | null }`
  - `type EntryKind = 'leave_home'|'transfer'|'departure'|'arrival'|'connection'|'check_in'|'check_out'|'activity'|'return_home'`
  - `type AlertCode = 'overlap'|'insufficient_travel_time'|'tight_connection'|'outside_lodging_dates'|'arrival_before_checkin'|'missing_transfer_time'`
  - `interface ItineraryEntry { key: string; kind: EntryKind; startUtc: string; endUtc: string | null; tz: string; localDate: string; localTime: string; block: Block; title: string; details: Record<string, string>; sourceId: string; suggested: boolean; note: string | null; alerts: AlertCode[] }`
  - `interface Itinerary { days: { date: string; entries: ItineraryEntry[] }[]; alerts: { code: AlertCode; entryKeys: string[] }[] }`
  - `interface ItineraryInput { tripTz: string; legs: TransportLeg[]; lodgings: LodgingStay[]; activities: ActivityInput[]; overrides: ItineraryOverride[] }`
- Produces (funciones): `defaultAdvanceMin(mode: TransportMode, international: boolean): number`; `generateItinerary(input: ItineraryInput): Itinerary`; `detectAlerts(entries: ItineraryEntry[], lodgings: LodgingStay[], legs: TransportLeg[]): { code: AlertCode; entryKeys: string[] }[]`.
- Claves estables: `` `${kind}:${sourceId}:${index}` ``.

- [ ] **Step 1: Tests que fallan** (BA)
  - Ida vuelo nacional AR 1672 10:00→12:20, `transferToMin 45`, `advanceMin null` → entrada `leave_home` 07:15 con `suggested true`; `transfer` 07:15–08:00; `departure` 10:00; `arrival` 12:20.
  - Mismo con `transferToMin null` → alerta `missing_transfer_time` y `leave_home` = 08:00 (sin traslado).
  - `international true` → anticipación 180 → `leave_home` 06:15 con traslado 45.
  - Hotel check-in 15:00 2027-01-10 → entrada `check_in`; arrival 12:20 antes del check-in → alerta `arrival_before_checkin`.
  - Actividades 2027-01-12 sin hora, 60 min y 90 min con `travelMinFromPrev 30` → 09:00 y 10:30.
  - Vuelta: check-out 10:00 2027-01-16, vuelo 17:00, `transferFromMin 40` al llegar → entradas `check_out`, `departure`, `arrival`, `return_home` (arrival + 40).
  - **Review Focus 5:** vuelo BA 2027-03-01 13:00 → Madrid 2027-03-02 06:30 (`Europe/Madrid`): `arrival` en día `'2027-03-02'` con `localTime '06:30'`; `details.durationMin '810'`.
  - Override `{ entryKey: 'activity:x:0', note: 'Llevar abrigo' }` → `note` aplicado.
  - `days` ordenados por fecha; entradas ordenadas por `startUtc` salvo overrides de posición.
- [ ] **Step 2: Tests que fallan** (`alerts.test.ts`)
  - Actividades 10:00 (120 min) y 11:00 (60 min) mismo día → `overlap` con ambas claves.
  - Fin 10:00, siguiente 10:20 con `travelMinFromPrev 30` → `insufficient_travel_time`.
  - Vuelo con segmentos llegada 12:00, salida 12:40 → `tight_connection`; 13:00 → sin alerta. Micro con 10 min → `tight_connection`; 15 min → sin alerta.
  - Actividad 2027-01-20 con alojamiento hasta 2027-01-16 → `outside_lodging_dates`.
- [ ] **Step 3:** Correr → FAIL.
- [ ] **Step 4:** Implementar. Salida de casa = `departUtc` del primer segmento − anticipación − traslado. Conexiones: una entrada `connection` por cada par de segmentos consecutivos.
- [ ] **Step 5:** Correr → PASS.
- [ ] **Step 6:** Commit `feat(domain): generador de itinerario con alertas`.

---

### Task 9: Orden por cercanía y diferencias de itinerario

**Files:**
- Create: `src/domain/itinerary/order.ts`, `src/domain/itinerary/diff.ts`
- Test: `src/domain/itinerary/order.test.ts`, `diff.test.ts`

**Interfaces:**
- Consumes: `ActivityInput`, `Itinerary` (Task 8).
- Produces:
  - `haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number`
  - `orderByProximity(activities: ActivityInput[], start: { lat: number; lng: number }): Result<ActivityInput[]>` — por día; las de `fixedTime` quedan en su índice; las flexibles con coordenadas se reordenan por vecino más cercano en los huecos; error `missing_coordinates` (`'Cargá coordenadas en las actividades para ordenarlas por cercanía'`) si ninguna flexible tiene coordenadas.
  - `diffItineraries(prev: Itinerary, next: Itinerary): { added: string[]; removed: string[]; changed: string[] }` — `changed` = misma clave con `startUtc`, `endUtc` o `title` distinto.

- [ ] **Step 1: Tests que fallan**
  - `haversineKm` Bariloche centro (-41.1335, -71.3103) a Cerro Catedral (-41.1703, -71.4393) ≈ `11.6` (± 0.2).
  - Inicio en el hotel; actividades flexibles lejos (Catedral), cerca (Centro Cívico -41.1334,-71.3097) → orden `[cerca, lejos]`.
  - Una actividad `fixedTime` en índice 1 sigue en índice 1.
  - Sin coordenadas → `err('missing_coordinates', …)`.
  - Diff: vuelo que cambia de 10:00 a 12:00 → su clave en `changed`; actividad borrada → `removed`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(domain): orden por cercanía y diff de itinerario`.

---

### Task 10: Esquema de base de datos y clientes

**Files:**
- Create: `drizzle.config.ts`, `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/db/test-db.ts`, `scripts/migrate.ts`, `drizzle/` (migraciones generadas)
- Test: `src/server/db/schema.test.ts`

**Interfaces:**
- Produces:
  - Tablas de la spec §4 con nombres en snake_case y exportadas en camelCase (`trips`, `travelers`, `stops`, `transportOptions`, `lodgingOptions`, `activities`, `costItems`, `scenarios`, `scenarioSelections`, `scenarioItemToggles`, `scenarioRatings`, `decisionWeights`, `bookings`, `expenses`, `exchangeRates`, `itineraryOverrides`, `tripEvents`, `users`, `workspaces`, `workspaceMembers`, `inviteCodes`).
  - Columnas que la spec implica y se agregan en `transport_options`: `international boolean default false`, `transfer_to_min integer null`, `transfer_from_min integer null`, `advance_min integer null`; `segments jsonb` con forma `Segment[]` (Task 8). En `trips`: `stale_days integer default 14`, `home_label text`.
  - Importes: `bigint('…', { mode: 'number' })`. Decimales: `numeric` como string. Enums como `pgEnum` con los valores de la spec.
  - Claves foráneas con `onDelete: 'cascade'` desde todo lo que cuelga de `trips`; `scenario_selections`, `bookings` y `scenario_item_toggles` se limpian por servicio (Task 12) porque son polimórficas.
  - `type Db` (base Drizzle común a postgres-js y PGlite); `createDb(url: string): Db` — `url` que empieza con `pglite://` usa PGlite en ese directorio; si no, postgres-js.
  - `createTestDb(): Promise<Db>` — PGlite en memoria con migraciones aplicadas.
  - `scripts/migrate.ts` aplica `drizzle/` contra `DATABASE_URL`.

- [ ] **Step 1: Test que falla:** `createTestDb()` y luego insertar user → workspace → trip → cost item, leerlo; borrar el trip borra el cost item.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar y `npm run db:generate`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(db): esquema Drizzle y clientes Postgres/PGlite`.

---

### Task 11: Repositorios con aislamiento por workspace e historial

**Files:**
- Create: `src/server/repos/trips.ts`, `travelers.ts`, `options.ts` (transporte, alojamiento, actividades), `cost-items.ts`, `scenarios.ts` (escenario, selecciones, toggles, ratings, pesos), `bookings.ts`, `expenses.ts`, `rates.ts`, `overrides.ts`, `events.ts`, `src/server/context.ts`
- Test: `src/server/repos/isolation.test.ts`, `src/server/repos/events.test.ts`

**Interfaces:**
- Consumes: `Db`, esquema (Task 10).
- Produces:
  - `interface Ctx { userId: string; workspaceId: string }`
  - Cada repo es `makeXRepo(db: Db)` con métodos que reciben `ctx` primero: `list(ctx, tripId)`, `get(ctx, id)`, `create(ctx, input)`, `update(ctx, id, patch)`, `remove(ctx, id)`. Todo acceso a entidades hijas verifica que el `trip_id` pertenezca a `ctx.workspaceId` (join o subconsulta); si no, devuelve `null` / lanza `NotFoundError`.
  - `tripsRepo.getByShareToken(token: string)` — único método sin `ctx`; solo lectura.
  - `eventsRepo.log(ctx, { tripId, entity, entityId, action: 'create'|'update'|'delete', before, after })`; todos los `create/update/remove` de los repos lo llaman.

- [ ] **Step 1: Tests que fallan**
  - Dos workspaces W1, W2. Un viaje en W1. Con ctx de W2: `trips.get` → `null`; `costItems.list(ctxW2, tripW1)` → `[]`; `costItems.update(ctxW2, itemW1, …)` lanza `NotFoundError`; `trips.remove(ctxW2, tripW1)` lanza.
  - Actualizar el nombre de un viaje registra un evento `update` con `before.name` y `after.name`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(server): repositorios con aislamiento y historial`.

---

### Task 12: Servicio de análisis del viaje

**Files:**
- Create: `src/server/services/trip-analysis.ts`, `src/server/services/options.ts`, `src/server/services/scenarios.ts`
- Test: `src/server/services/trip-analysis.test.ts`, `src/server/services/options.test.ts`

**Interfaces:**
- Consumes: repos (Task 11), dominio (Tasks 5–9).
- Produces:
  - `analyzeTrip(db: Db, ctx: Ctx, tripId: string, opts?: { today?: string }): Promise<TripAnalysis>` donde `TripAnalysis = { trip; scenarios: { id; name; summary: CostSummary; metrics: ScenarioMetrics }[]; comparison: ReturnType<typeof compareScenarios>; score: ScoreResult; explanation: string[] }`. Arma `CostItemInput` desde partidas de las alternativas seleccionadas + partidas propias, aplicando toggles (opcionales con toggle `included=false` se omiten), `nights` desde el alojamiento dueño, `paymentStatus` desde bookings. `rateDate` = hoy si `status='planning'`, si no la fecha de salida.
  - `buildItinerary(db, ctx, tripId): Promise<Itinerary | null>` — desde el escenario elegido; `null` si no hay escenario elegido.
  - `deleteOption(db, ctx, ownerType, ownerId): Promise<void>` — borra la alternativa, sus partidas, sus `scenario_selections`, sus `bookings` y los toggles de sus partidas, en una transacción.
  - `updateCostItem(db, ctx, id, patch)` — pone `is_demo=false` al editar.
- [ ] **Step 1: Tests que fallan**
  - Cargar en la base el caso Bariloche A (helper `seedBarilocheA(db, ctx)` dentro del test o en `src/server/services/__fixtures__/`): `analyzeTrip` devuelve para A `totalCents 125503000` (mismo número que Task 5).
  - Toggle `included=false` sobre la excursión → `totalCents 117503000`.
  - **Review Focus 4:** escenario elegido incluye el hotel; `deleteOption(lodging)` → selecciones y reservas del hotel desaparecen, `analyzeTrip` de A muestra warning `uncovered_nights` con `detail '6'`, y `buildItinerary` no tiene `check_in`.
  - Editar el importe de una partida demo → `is_demo` pasa a `false`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(server): análisis de viaje e integridad al borrar alternativas`.

---

### Task 13: Validación, autenticación e invitaciones

**Files:**
- Create: `src/server/validation/trip.ts`, `options.ts`, `expense.ts`, `rate.ts`, `auth.ts`; `src/server/auth/auth.ts` (config Auth.js), `src/server/auth/register.ts`, `src/server/auth/session.ts`; `src/app/api/auth/[...nextauth]/route.ts`; `scripts/create-invite.ts`; `src/app/(auth)/login/page.tsx`, `src/app/(auth)/registro/page.tsx`
- Test: `src/server/validation/trip.test.ts`, `src/server/auth/register.test.ts`

**Interfaces:**
- Produces:
  - Esquemas Zod con mensajes en español: `tripCreateSchema` (paso 1: nombre, origen, destino principal, alternativos, salida/regreso con hora y tz, flexibilidad en días, adultos ≥1, niños ≥0, bebés ≥0, habitaciones ≥1, tipo, presupuesto vía `parseAmount`, moneda en `SUPPORTED_CURRENCIES`), `tripPreferencesSchema` (paso 2), `tripConstraintsSchema` (paso 3), `transportOptionSchema`, `lodgingOptionSchema`, `activitySchema`, `costItemSchema`, `expenseSchema`, `exchangeRateSchema`, `registerSchema`.
  - `register(db, { email, name, password, inviteCode }): Promise<Result<{ userId; workspaceId }>>` — valida código (existe, no vencido, `used_count < max_uses`), hashea con argon2, crea usuario + workspace personal (`'Mi espacio'`) + membresía owner, incrementa `used_count`, en una transacción.
  - `requireCtx(): Promise<Ctx>` — desde la sesión; redirige a `/login` si no hay.
  - `npm run invite -- --uses 20 --days 60` imprime un código de 10 caracteres.
- [ ] **Step 1: Tests que fallan**
  - **Review Focus 2:** regreso antes de la salida → error `'La fecha de regreso debe ser posterior a la salida'`; check-out ≤ check-in en `lodgingOptionSchema` → `'El check-out debe ser posterior al check-in'`.
  - Presupuesto `'1.500.000'` → `150000000` centavos.
  - `register` con código inexistente → `err('invalid_invite','Código de invitación inválido')`; vencido → `err('expired_invite','El código de invitación venció')`; agotado → `err('used_invite','El código de invitación ya se usó')`; email repetido → `err('email_taken','Ya existe una cuenta con ese email')`; válido → crea workspace y `used_count` sube a 1; el hash no es la contraseña en texto.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (Auth.js v5, `Credentials`, sesión JWT con `userId` y `workspaceId`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(auth): registro con invitación y validaciones`.

---

### Task 14: Shell de la app, tema y dashboard

**Files:**
- Create: `src/ui/` (`Button`, `Card`, `Field`, `MoneyInput`, `MoneyText`, `Badge`, `Tabs`, `EmptyState`, `ErrorBanner`, `DemoBanner`, `ThemeToggle`), `src/app/(app)/layout.tsx` (menú inferior en móvil, lateral en escritorio), `src/app/(app)/page.tsx` (Dashboard), `src/app/(app)/viajes/page.tsx` (Mis viajes), `src/app/(app)/configuracion/page.tsx`, `src/app/manifest.ts`, `public/icons/*`
- Test: `tests/e2e/shell.spec.ts`, `playwright.config.ts`, `tests/e2e/global-setup.ts`

**Interfaces:**
- Consumes: `requireCtx`, `analyzeTrip`, `formatMoney`.
- Produces: `MoneyInput` (usa `parseAmount`, muestra el error), `MoneyText` (usa `formatMoney`), `DemoBanner` con el texto exacto `"Precios ficticios"`. Playwright: proyecto móvil 390×844; `webServer` con `DATABASE_URL=pglite://./.data/e2e`, `global-setup` migra, crea un código de invitación y lo deja en `process.env.E2E_INVITE`.
- Antes de diseñar pantallas, cargar el skill `frontend-design` y definir tokens de color (claro/oscuro) en `globals.css`.
- [ ] **Step 1: Test E2E que falla:** registrarse con `E2E_INVITE` → llega al Dashboard; ve "Viajes activos", "Próximos viajes" y el acceso "Crear viaje"; el menú tiene Dashboard, Mis viajes, Crear viaje, Configuración; alternar el tema cambia `data-theme` en `<html>`; no hay scroll horizontal (`document.documentElement.scrollWidth <= 390`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Dashboard: por viaje, presupuesto vs. estimado del escenario elegido (o del más barato si no hay elegido) vs. gasto real. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): shell, tema, dashboard y PWA`.

---

### Task 15: Asistente de creación de viaje y ficha

**Files:**
- Create: `src/app/(app)/viajes/nuevo/page.tsx` + componentes del asistente, `src/app/(app)/viajes/[id]/layout.tsx` (pestañas: Resumen · Transporte · Alojamiento · Actividades · Comparador · Confirmar · Itinerario · Gastos), `src/app/(app)/viajes/[id]/page.tsx` (Resumen/ficha y edición), `src/server/actions/trips.ts`
- Test: `tests/e2e/trip-wizard.spec.ts`

**Interfaces:**
- Consumes: esquemas (Task 13), `tripsRepo`, `travelersRepo`, `stopsRepo`.
- Produces: acciones `createTrip(input): Promise<Result<{ id }>>`, `updateTrip(id, patch)`, `deleteTrip(id)`, `duplicateTrip(id)`; los viajeros se crean como filas (`Adulto 1`, `Niño 1`…, renombrables). Multidestino: lista de paradas reordenable.
- [ ] **Step 1: Test E2E que falla:** crear "Bariloche 2027" (origen Zárate, destino Bariloche, 2027-01-10 08:00 → 2027-01-16 20:00, 2 adultos, presupuesto `1.500.000`, ARS) recorriendo los 3 pasos; la ficha muestra "7 días", "2 viajeros" y "$ 1.500.000,00"; volver a "Mis viajes" lo lista; recargar la página conserva todo. Regreso antes de la salida muestra el mensaje de Task 13 en el paso 1.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): asistente de viaje en 3 pasos`.

---

### Task 16: Transporte, alojamiento, actividades y partidas

**Files:**
- Create: `src/app/(app)/viajes/[id]/transporte/page.tsx`, `alojamiento/page.tsx`, `actividades/page.tsx`, `src/ui/CostItemsEditor.tsx`, `src/ui/CarCalculator.tsx`, `src/ui/SourceBadge.tsx`, `src/server/actions/options.ts`
- Test: `tests/e2e/options.spec.ts`, `src/ui/sort.test.ts`

**Interfaces:**
- Consumes: `carCostItems`, servicios de Task 12, `computeScenarioCosts` para el costo total por alternativa.
- Produces:
  - `CostItemsEditor`: alta/edición/borrado de partidas con importe, moneda, unidad, cantidad, categoría, tipo, reembolsable, fuente, fecha de consulta, impuestos (sí/no/no sé), estimado/confirmado. `SourceBadge` muestra "Estimado"/"Confirmado", fuente y fecha.
  - Tarjeta de transporte: proveedor, horarios locales, duración, escalas, precio por persona y total del grupo (partidas convertidas), costos adicionales, enlace.
  - `sortTransport(options, by: 'price'|'duration'|'price_per_hour'|'transfers'|'comfort')` en `src/ui/sort.ts`; alternativas sin dato van al final.
  - Alojamiento: filtros por precio por noche, total, servicios, distancia al centro, capacidad; muestra total de la estadía y por persona; depósitos aparte como "retenido".
  - Actividades: fecha, hora opcional, duración, hora fija, coordenadas opcionales, reserva requerida, partidas.
- [ ] **Step 1: Tests que fallan**
  - `sort.test.ts`: por `price_per_hour` (precio total ÷ horas), una opción sin duración va última.
  - E2E: en "Bariloche 2027" cargar vuelo ida y vuelta con importe `120.000` por persona → la tarjeta muestra total del grupo "$ 240.000,00"; cargar auto propio con la calculadora (3.200 km, 8 l/100 km, `1.200` por litro) → aparece partida "Combustible" de "$ 307.200,00"; cargar hotel 80.000 por noche → "Total estadía $ 480.000,00" y "Por persona $ 240.000,00"; editar un importe actualiza el total sin recargar.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): alternativas con partidas y calculadora de auto`.

---

### Task 17: Comparador de escenarios

**Files:**
- Create: `src/app/(app)/viajes/[id]/comparador/page.tsx`, `src/ui/ScenarioBuilder.tsx`, `src/ui/charts/CategoryDonut.tsx`, `src/ui/charts/ScenarioBars.tsx`, `src/ui/WeightsPanel.tsx`, `src/server/actions/scenarios.ts`
- Test: `tests/e2e/comparator.spec.ts`

**Interfaces:**
- Consumes: `analyzeTrip` (Task 12), `CATEGORY_LABELS`, `CRITERION_LABELS`.
- Produces: crear/renombrar/borrar escenarios; elegir alternativas por tramo; agregar partidas propias (comida, seguro…); interruptor de partidas opcionales; calificar comodidad/calidad/experiencia 1–5; pesos 0–10; % y categorías de imprevistos; umbral de empate. Vista: tabla lado a lado (total, imprevistos, total con imprevistos, por persona, por día por persona, desvío, confirmado vs. estimado, pagado vs. pendiente, fijo/variable/opcional, retenido en depósitos, ahorro absoluto y %), dona por categoría (Recharts), barras por escenario, recomendación con explicación y advertencias (texto en español por cada `CostWarningCode`). Cargar el skill `dataviz` antes de los gráficos. Totales incompletos se marcan "Incompleto: falta tipo de cambio USD→ARS".
- [ ] **Step 1: Test E2E que falla:** con alternativas cargadas, crear 3 escenarios A, B y C; la tabla muestra 3 columnas; cambiar el precio del vuelo en Transporte y volver → el total de A cambió; apagar una partida opcional → baja el total; con pesos precio 10 aparece una recomendación con una frase que contiene "% menos que"; agregar partida en USD sin tasa → aparece "Incompleto".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): comparador de escenarios con recomendación`.

---

### Task 18: Confirmar mi viaje

**Files:**
- Create: `src/app/(app)/viajes/[id]/confirmar/page.tsx`, `src/server/services/confirm.ts`, `src/server/actions/bookings.ts`
- Test: `src/server/services/confirm.test.ts`, `tests/e2e/confirm.spec.ts`

**Interfaces:**
- Produces: `chooseScenario(db, ctx, tripId, scenarioId)` — fija `chosen_scenario_id`, `status='confirmed'`, crea bookings `selected` + `payment_pending` para cada alternativa del escenario que no tenga booking (no pisa estados ya cambiados); `setBookingStatus(db, ctx, bookingId, { bookingStatus?, paymentStatus?, confirmationCode? })`. Pantalla: resumen final con alternativas, totales del escenario y estados con etiquetas "Alternativa seleccionada", "Reserva pendiente", "Reserva confirmada", "Pago pendiente", "Pago realizado"; botón "Generar itinerario".
- [ ] **Step 1: Tests que fallan**
  - Elegir A crea N bookings `selected`/`payment_pending`; cambiar a otro escenario y volver no pisa un booking marcado `booking_confirmed`.
  - Marcar el vuelo de ida como "Pago realizado" → `analyzeTrip` lo cuenta en `paidCents`.
  - E2E: elegir escenario, cambiar un estado, recargar → persiste; el resumen muestra el presupuesto definitivo.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: confirmar viaje con estados de reserva y pago`.

---

### Task 19: Pantalla de itinerario

**Files:**
- Create: `src/app/(app)/viajes/[id]/itinerario/page.tsx`, `src/ui/ItineraryTimeline.tsx`, `src/ui/ItineraryDay.tsx`, `src/server/actions/itinerary.ts`, `src/server/services/itinerary-snapshot.ts`
- Test: `tests/e2e/itinerary.spec.ts`

**Interfaces:**
- Consumes: `buildItinerary`, `orderByProximity`, `diffItineraries`, overrides repo.
- Produces: vistas "Cronológica" y "Por día" (bloques Mañana/Mediodía/Tarde/Noche); arrastrar actividades con `@dnd-kit/sortable` (sensor táctil) + botones subir/bajar, guarda overrides de posición; notas por entrada; botón "Ordenar por cercanía" deshabilitado con el mensaje de Task 9 si no hay coordenadas; alertas resaltadas en la entrada; horas sugeridas con etiqueta "Sugerido". Snapshot: al mostrar, se guarda el itinerario en `trips.itinerary_snapshot jsonb` (agregar columna + migración); si el nuevo difiere, banner "Cambió tu itinerario" con la lista de `added/removed/changed`, y botón "Entendido" que actualiza el snapshot.
- [ ] **Step 1: Test E2E que falla:** con escenario elegido, la vista muestra "Salir de casa 07:15" (vuelo 10:00, traslado 45); dos actividades superpuestas muestran la alerta "Se superponen"; mover una actividad y recargar conserva el orden; cambiar la hora del vuelo a 12:00 → aparece "Cambió tu itinerario".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ui): itinerario con reordenamiento y aviso de cambios`.

---

### Task 20: Gastos reales y tipos de cambio

**Files:**
- Create: `src/app/(app)/viajes/[id]/gastos/page.tsx`, `src/server/services/expenses.ts`, `src/server/actions/expenses.ts`, `src/server/actions/rates.ts`; modificar `src/app/(app)/configuracion/page.tsx` (sección "Tipos de cambio")
- Test: `src/server/services/expenses.test.ts`, `tests/e2e/expenses.spec.ts`

**Interfaces:**
- Produces: `expenseReport(db, ctx, tripId): Promise<{ budgetCents; estimatedCents | null; actualCents; availableCents; byCategory: Record<CostCategory, { estimatedCents: number; actualCents: number; deviationCents: number }>; incomplete: boolean; warnings: CostWarning[] }>` — gastos convertidos con la tasa a la fecha del gasto; `estimated` desde el escenario elegido (sin imprevistos en el por-categoría; con imprevistos en el total). CRUD de tipos de cambio por workspace (par, tasa, fecha, fuente).
- [ ] **Step 1: Tests que fallan**
  - Viaje A elegido; gastos: comida 30.000 ARS y 20 USD (tasa 1000.50) → `actualCents 5001000`, `byCategory.food.actualCents 5001000`, `byCategory.food.deviationCents` = `5001000 - 17500000` = `-12499000`; `availableCents` = `150000000 - 5001000` = `144999000`.
  - Gasto en EUR sin tasa → `incomplete true`, warning `missing_exchange_rate`.
  - E2E: cargar tasa USD→ARS en Configuración; cargar un gasto en USD; el panel muestra real acumulado y disponible.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: gastos reales con comparación y tipos de cambio`.

---

### Task 21: Exportaciones

**Files:**
- Create: `src/server/export/csv.ts`, `src/server/export/ics.ts`, `src/app/(app)/viajes/[id]/exportar/presupuesto.csv/route.ts`, `itinerario.ics/route.ts`, `src/app/(app)/viajes/[id]/imprimir/page.tsx`
- Test: `src/server/export/csv.test.ts`, `ics.test.ts`, `tests/e2e/export.spec.ts`

**Interfaces:**
- Produces:
  - `budgetCsv(analysisScenario: { name: string; summary: CostSummary }, items: CostItemInput[]): string` — separador `;`, BOM UTF-8, columnas `Partida;Categoría;Importe original;Moneda;Multiplicador;Importe convertido;Moneda base;Estado;Certeza;Fuente;Fecha de consulta`, más filas finales `Total`, `Imprevistos`, `Total con imprevistos`, `Por persona`, `Desvío`. Importes con formato `es-419` sin símbolo (`1.234,56`).
  - `itineraryIcs(itinerary: Itinerary, tripName: string): string` — RFC 5545, `DTSTART`/`DTEND` en UTC (`Z`), `UID` = `${entry.key}@travelflow`, líneas plegadas a 75 octetos, CRLF.
  - Vista `/imprimir`: itinerario por día + tabla de presupuesto del escenario elegido + banner demo si corresponde; `@media print` sin menú.
- [ ] **Step 1: Tests que fallan**
  - CSV del fixture A: fila del seguro contiene `30,00;USD;2;60.030,00;ARS`; fila `Total` contiene `1.255.030,00`; el depósito tiene `Estado` `Retenido`.
  - ICS: el vuelo de ida tiene `DTSTART:20270110T130000Z` (10:00 BA); el texto termina en `END:VCALENDAR\r\n`; ninguna línea supera 75 octetos.
  - E2E: descargar CSV e ICS devuelve 200 con `content-type` `text/csv` y `text/calendar`; la página de impresión muestra el total.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: exportar presupuesto CSV, itinerario ICS y vista de impresión`.

---

### Task 22: Demo, enlace público y "Duplicar como mío"

**Files:**
- Create: `scripts/seed-demo.ts`, `src/server/services/demo.ts`, `src/app/share/[token]/page.tsx` (+ subrutas de solo lectura reutilizando componentes), `src/server/actions/share.ts`
- Test: `src/server/services/demo.test.ts`, `tests/e2e/demo.spec.ts`

**Interfaces:**
- Consumes: servicios de Tasks 12, 18; fixture Bariloche (Task 5) como fuente de los números del escenario A.
- Produces:
  - `seedDemo(db): Promise<{ tripId: string; shareToken: string }>` — workspace `"Demo"`, viaje "Buenos Aires → Bariloche (demo)" 7 días 2 adultos ARS con escenarios A (avión + hotel céntrico + transporte público), B (auto propio con calculadora + departamento alejado + auto) y C (micro + hostel + traslados puntuales), actividades con coordenadas, A elegido; todas las partidas `is_demo=true`, `source "Dato de demostración"`. Idempotente (si existe, no duplica). Imprime la URL `/share/<token>`.
  - `createShareLink(db, ctx, tripId)` (token de 32 bytes, base64url), `revokeShareLink`.
  - `duplicateTripToWorkspace(db, fromTripId, ctx)` — copia viaje, viajeros, alternativas, partidas (mantiene `is_demo`), escenarios, selecciones, toggles, ratings, pesos; no copia bookings, gastos ni token.
  - `/share/[token]`: resumen, comparador e itinerario en solo lectura, `DemoBanner` si el viaje es demo, botón "Duplicar como mío" (si no hay sesión, lleva a `/registro?next=…`).
- [ ] **Step 1: Tests que fallan**
  - `seedDemo` dos veces → un solo viaje demo; `analyzeTrip` del escenario A → `totalCents 125503000`.
  - `duplicateTripToWorkspace` → el viaje nuevo pertenece a `ctx.workspaceId`, partidas con `is_demo true`; editar una → `false`; el original sin cambios.
  - Token revocado → `/share/<token>` responde 404.
  - E2E: abrir `/share/<token>` sin sesión → ve "Precios ficticios", 3 escenarios y el itinerario; no hay botones de edición.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: viaje demo, enlace público y duplicar`.

---

### Task 23: Flujo completo, CI y despliegue

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`, `.github/workflows/ci.yml`, `railway.json`, `DEPLOY.md`, `README.md`, `src/integrations/types.ts`, `src/integrations/manual.ts`
- Modify: `package.json` (`start` = `node --import tsx scripts/migrate.ts && next start`)

**Interfaces:**
- Produces:
  - `src/integrations/types.ts`: `interface ProviderResult<T> { data: T; source: string; fetchedAt: string }`; interfaces `FlightSearchProvider`, `LodgingSearchProvider`, `ExchangeRateProvider`, `RoutingProvider`, cada una con un método que devuelve `Promise<Result<ProviderResult<…>>>`; `manual.ts` implementa todas devolviendo `err('not_configured','Integración no configurada: cargá los datos a mano')`.
  - CI: `npm ci`, `lint`, `typecheck`, `test`, `npx playwright install --with-deps chromium`, `test:e2e`.
  - `DEPLOY.md`: pasos para Railway (crear proyecto desde GitHub, agregar Postgres, variables `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, comando `npm run seed:demo` y `npm run invite`).
- [ ] **Step 1: Test E2E que falla** (`full-flow.spec.ts`, 390×844): registro con invitación → crear viaje → cargar ida, vuelta, hotel y 2 actividades → 3 escenarios → elegir → confirmar → itinerario muestra "Salir de casa" → cargar un gasto → descargar CSV e ICS → abrir impresión. Sin scroll horizontal en ninguna pantalla visitada.
- [ ] **Step 2:** Correr → arreglar lo que falle (usar `superpowers:systematic-debugging`).
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → todo PASS.
- [ ] **Step 4:** Commit `chore: flujo E2E completo, CI y guía de despliegue`.
- [ ] **Step 5:** Escribir el resumen final de la spec §16 (real / demo / requiere credenciales) en `README.md`. El despliegue en Railway lo hace el usuario o se hace con sus credenciales.

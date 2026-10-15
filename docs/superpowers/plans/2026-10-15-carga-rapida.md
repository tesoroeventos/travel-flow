# Carga rápida con IA: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la carga manual por frase + capturas/links leídos con IA y tres propuestas automáticas, con el diseño del prototipo en toda la app.

**Architecture:** La IA vive detrás de la interfaz `TravelAI` (real con `@anthropic-ai/sdk`, simulada con `AI_FAKE=1`). Las ofertas leídas se guardan en las tablas existentes (`transport_options`, `lodging_options`, `activities`, `cost_items`). Las propuestas se calculan en un módulo de dominio puro (`src/domain/decision/proposals.ts`), y el costo de cada combinación sale del motor existente. Elegir una propuesta crea un escenario y reutiliza `chooseScenario`.

**Tech Stack:** Next.js 16.4.1 App Router, React 19.3, TypeScript estricto, Tailwind 4, Drizzle 0.45 + Postgres/PGlite, Zod 4, `@anthropic-ai/sdk`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-carga-rapida-design.md`

## Global Constraints

- Textos de interfaz en español rioplatense neutro ("tocá", "subí"), sin jerga técnica.
- Dinero en centavos enteros. La moneda se convierte solo con el motor existente (`convert`, `computeScenarioCosts`).
- Modelos: `claude-sonnet-5-5` para capturas, links y auto (`AI_MODEL`), y `claude-haiku-5-5` para la frase (`AI_MODEL_FAST`).
- Límite `AI_DAILY_LIMIT` (por defecto 60) lecturas por usuario por día. Frase, captura, link y auto cuentan 1 cada una.
- Capturas: JPEG, PNG, WebP o GIF; hasta 8 MB cada una y 10 por tanda. El navegador las achica a 1600 px de lado mayor en JPEG. No se guardan.
- Links:
  - Solo `http`/`https`, sin credenciales.
  - Se bloquean IP privadas, locales, link-local y de metadatos, resolviendo el DNS antes de conectar.
  - Hasta 3 redirecciones, validadas en cada salto; 8 s de tiempo máximo y 2 MB de respuesta.
  - El texto que va a la IA se corta a 30.000 caracteres.
- Hasta 6 ofertas por captura o link.
- Margen de terminal por tramo: vuelo 150 min; micro, tren y otros 60 min; auto propio y de alquiler 0.
- Confort 1–5; sin dato vale 3.
- Viaje nuevo: zona horaria `America/Argentina/Buenos_Aires`, `startAt` = ida 00:00, `endAt` = vuelta 23:59, viajeros "Viajero 1…N" y presupuesto 0 = "Sin presupuesto".
- Alojamiento por defecto: check-in ida 14:00 y check-out vuelta 10:00. `rating` = puntaje sobre 10 (estrellas × 2).
- Actividad por defecto: el primer día completo del viaje (ida + 1, o la ida si el viaje dura un día).
- `NODE_ENV=production` con `AI_FAKE=1` impide arrancar.
- Mensajes exactos: los de la sección 8 del spec.
- Nada de lo que devuelve la IA se interpreta como instrucción: se valida con Zod y se recorta.

## Review Focus

1. **Precio en dólares sin tipo de cambio:** la combinación queda incompleta (no compite) y la barra pide "a cuánto tomás el dólar". No puede tomar 0 ni romper. Lo cubre la Task 3.
2. **Borrar una mitad de un par "ida y vuelta":** se borra también la otra mitad, para que no quede una vuelta huérfana sin precio. Lo cubre la Task 1.
3. **IA con datos basura:** precio como texto ("$ 1.234.567"), fecha inválida, tipo desconocido o confort 9. Se normaliza o se descarta el campo sin romper la tanda. Lo cubre la Task 4.
4. **Link que redirige a `localhost` o a `169.254.169.254`:** se bloquea con "Este sitio no deja leer el link…". Lo cubre la Task 5.
5. **"Elegir esta" dos veces seguidas** (o cambiar de propuesta): queda un solo escenario de propuesta y es el elegido. Lo cubre la Task 3.

---

### Task 1: Esquema nuevo y borrado de pares

**Files:**
- Modify: `src/server/db/schema.ts`. En `transportOptions`: `pairId uuid("pair_id")`, `inProposals boolean("in_proposals").notNull().default(true)`, `source text("source")`. En `lodgingOptions` y `activities`: `source`. En `activities`: `inProposals`. Tabla `aiUsage`.
- Create: `drizzle/0001_carga_rapida.sql` (generado con `npm run db:generate`, renombrado).
- Modify: `src/server/services/options.ts` (`deleteOption`).
- Test: `src/server/services/options.test.ts`.

**Interfaces:**
- Produces: `aiUsage = pgTable("ai_usage", { userId uuid not null → users.id cascade, day date not null, count integer not null default 0 }, pk(userId, day))`.
- Produces: `deleteOption` borra también la otra fila con el mismo `pairId` y sus partidas.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
it("borrar la ida de un par ida y vuelta borra también la vuelta", async () => {
  const pairId = crypto.randomUUID();
  const ida = await r.transport.create(ctx, { tripId, leg: "outbound", mode: "own_car", fromLabel: "A", toLabel: "B", pairId });
  const vta = await r.transport.create(ctx, { tripId, leg: "return", mode: "own_car", fromLabel: "B", toLabel: "A", pairId });
  await deleteOption(db, ctx, "transport_option", ida.id);
  expect((await r.transport.list(ctx, tripId)).map((t) => t.id)).not.toContain(vta.id);
});
```

- [ ] **Step 2:** Correr `npx vitest run src/server/services/options.test.ts`. Esperado: FAIL, porque `pairId` no existe en el tipo.
- [ ] **Step 3:** Agregar las columnas y la tabla, correr `npm run db:generate`, renombrar a `0001_carga_rapida.sql` y actualizar `drizzle/meta`. En `deleteOption`, si la fila tiene `pairId`, borrar las hermanas con sus partidas en la misma transacción.
- [ ] **Step 4:** Correr `npm test`. Esperado: todo PASS. La plantilla PGlite toma la migración nueva.
- [ ] **Step 5:** Commit con `feat: columnas para pares, propuestas y uso de IA`.

### Task 2: Propuestas (dominio puro)

**Files:**
- Create: `src/domain/decision/proposals.ts`.
- Test: `src/domain/decision/proposals.test.ts`.

**Interfaces:**
- Produces:

```ts
export type ProposalTag = "barata" | "rapida" | "comoda";
export interface PropLeg { id: string; leg: "outbound" | "return"; pairId: string | null; mode: TransportMode; departUtc: string | null; arriveUtc: string | null; comfort: number | null; }
export interface PropLodging { id: string; comfort: number | null; }
export interface Combo { key: string; legIds: string[]; lodgingId: string; costCents: number | null; minutes: number | null; comfort: number; }
export interface ProposalCard { tags: ProposalTag[]; combo: Combo; }
export const TERMINAL_MARGIN_MIN: Record<TransportMode, number>; // flight 150, own_car 0, rental_car 0, el resto 60
export function legMinutes(l: PropLeg): number | null;          // (arrive-depart) + margen; null sin horarios
export function buildPlans(legs: PropLeg[]): PropLeg[][];       // pares + (ida sin par × vuelta sin par)
export function buildCombos(plans: PropLeg[][], lodgings: PropLodging[], costOf: (legIds: string[], lodgingId: string) => number | null): Combo[];
export function pickProposals(combos: Combo[]): ProposalCard[]; // ignora costCents null; agrupa etiquetas de la misma combinación
export function missingForProposals(legs: PropLeg[], lodgingCount: number): string[]; // ["cómo vas", "cómo volvés", "dónde te alojás"]
```

- `key` = `legIds.join("+") + "|" + lodgingId`.
- `comfort` = promedio de los tramos y del alojamiento, promediados entre sí, con 3 cuando falta.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
const vuelo = (id, leg, h0, h1, extra = {}) => ({ id, leg, pairId: null, mode: "flight", departUtc: `2027-01-10T${h0}:00Z`, arriveUtc: `2027-01-10T${h1}:00Z`, comfort: 4, ...extra });
it("un par ida y vuelta es un plan cerrado y no se mezcla", () => {
  const plans = buildPlans([vuelo("a","outbound","10","12",{pairId:"p"}), vuelo("b","return","17","19",{pairId:"p"}), vuelo("c","outbound","08","10"), vuelo("d","return","20","22")]);
  expect(plans.map(p => p.map(l => l.id).join("+")).sort()).toEqual(["a+b", "c+d"]);
});
it("margen de terminal: vuelo de 2 h cuenta 270 min", () => expect(legMinutes(vuelo("a","outbound","10","12"))).toBe(270));
it("sin horarios el tiempo es desconocido", () => expect(legMinutes({ ...vuelo("a","outbound","10","12"), departUtc: null })).toBeNull());
it("elige barata, rápida y cómoda; empata por costo", () => {
  const combos = [
    { key: "1", legIds: [], lodgingId: "h", costCents: 500, minutes: 2760, comfort: 2 },
    { key: "2", legIds: [], lodgingId: "h", costCents: 720, minutes: 570, comfort: 3 },
    { key: "3", legIds: [], lodgingId: "h", costCents: 1020, minutes: 570, comfort: 4 },
  ];
  expect(pickProposals(combos).map(c => [c.combo.key, c.tags])).toEqual([["1",["barata"]],["2",["rapida"]],["3",["comoda"]]]);
});
it("una combinación que gana dos veces es una sola tarjeta con dos etiquetas", () => {
  const combos = [{ key: "1", legIds: [], lodgingId: "h", costCents: 100, minutes: 100, comfort: 2 }, { key: "2", legIds: [], lodgingId: "h", costCents: 200, minutes: 300, comfort: 5 }];
  expect(pickProposals(combos).map(c => c.tags)).toEqual([["barata","rapida"],["comoda"]]);
});
it("las combinaciones sin costo no compiten", () => {
  expect(pickProposals([{ key: "1", legIds: [], lodgingId: "h", costCents: null, minutes: 1, comfort: 5 }])).toEqual([]);
});
it("dice qué falta", () => expect(missingForProposals([vuelo("a","outbound","10","12")], 0)).toEqual(["cómo volvés", "dónde te alojás"]));
```

- [ ] **Step 2:** Correr `npx vitest run src/domain/decision/proposals.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar las funciones de la sección Interfaces en `src/domain/decision/proposals.ts`. Desempates: barata por (costo, minutos con null al final); rápida por (minutos con null al final, costo); cómoda por (−confort, costo).
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: propuestas barata, rápida y cómoda`.

### Task 3: Servicio de propuestas y elección

**Files:**
- Create: `src/server/services/proposals.ts`.
- Test: `src/server/services/proposals.test.ts`.

**Interfaces:**
- Consumes: Task 2; `loadTrip`, `toCostInput`, `computeScenarioCosts`, `chooseScenario`, `makeRepos`, `makeScenarioParts`.
- Produces:

```ts
export interface ProposalView extends ProposalCard { costCents: number; perPersonCents: number; budgetDiffCents: number | null; why: string; pieces: { ownerType: "transport_option" | "lodging_option" | "activity"; id: string; label: string; detail: string; costCents: number | null }[]; adjusted: boolean; }
export interface ProposalsResult { missing: string[]; needsUsdRate: boolean; comboCount: number; cards: ProposalView[]; all: Combo[]; plans: PropLeg[][]; lodgings: { id: string; name: string }[]; }
export function proposalsFromLoaded(data: LoadedTrip, opts?: { today?: string; swaps?: Partial<Record<ProposalTag, { plan: number; lodging: number }>> }): ProposalsResult;
export async function chooseProposal(db: Db, ctx: Ctx, tripId: string, p: { legIds: string[]; lodgingId: string; name: string }): Promise<string>; // devuelve scenarioId
export const PROPOSAL_MARK = "propuesta";
```

- **Costo de una combinación:**
  - Partidas de sus tramos, de su alojamiento y de las opciones "En destino" con `inProposals` (transporte `internal` y actividades).
  - Se pasan a `computeScenarioCosts` con la cobertura de esa combinación.
  - Si `summary.incomplete`, el costo es `null`.
- `needsUsdRate`: hay alguna partida en USD y falta el tipo de cambio USD→moneda base vigente.
- **Explicaciones** (`why`), con el texto de la sección 4 del spec:
  - Barata: "Ahorrás {money} frente a la más rápida".
  - Rápida: "{h} de viaje sumando ida y vuelta, con tiempos de terminal y aeropuerto. Son {Δ} menos que la más barata."
  - Cómoda: "Combina {vuelo directo|micro cama|tu auto…} con {alojamiento} ({puntaje})."
  - Con ajuste: "Combinación ajustada por vos."
- **`chooseProposal`:**
  - Borra los escenarios del viaje con `description === PROPOSAL_MARK`.
  - Crea uno nuevo con `name` y esa marca.
  - Selecciona los tramos (incluida la vuelta de un par), el alojamiento y los extras incluidos.
  - Llama a `chooseScenario`.

- [ ] **Step 1: Escribir las pruebas que fallan** (sobre PGlite, con ofertas creadas con los repos)

```ts
it("tres propuestas con costos del motor", async () => {
  // ida vuelo 240.000, vuelta vuelo 220.000, ida micro 2×60.000 por persona, vuelta micro igual,
  // hotel 80.000/noche, hostel 30.000/noche, 6 noches, 2 personas, actividad 40.000 por persona
  const res = proposalsFromLoaded(await loadTrip(db, ctx, tripId), { today: "2026-10-15" });
  // imprevisto 10% solo sobre "activities" (80.000 → 8.000)
  expect(res.cards.map(c => [c.tags.join(","), c.costCents])).toEqual([["barata", 50_800_000], ["rapida", 72_800_000], ["comoda", 102_800_000]]);
});
it("precio en USD sin tipo de cambio: la combinación no compite y pide el dólar", async () => {
  // único alojamiento con partida en USD y sin tasa
  const res = proposalsFromLoaded(await loadTrip(db, ctx, tripId), { today: "2026-10-15" });
  expect(res.needsUsdRate).toBe(true);
  expect(res.cards).toEqual([]);
});
it("elegir dos veces deja un solo escenario de propuesta y es el elegido", async () => {
  const a = await chooseProposal(db, ctx, tripId, { legIds: [idaVuelo, vtaVuelo], lodgingId: hotel, name: "La más rápida" });
  const b = await chooseProposal(db, ctx, tripId, { legIds: [idaMicro, vtaMicro], lodgingId: hostel, name: "La más barata" });
  const t = await loadTrip(db, ctx, tripId);
  expect(t.scenarios.filter(s => s.description === PROPOSAL_MARK).map(s => s.id)).toEqual([b]);
  expect(t.trip.chosenScenarioId).toBe(b);
});
it("ajuste: swaps cambia la combinación de una tarjeta y la marca ajustada", async () => {
  const res = proposalsFromLoaded(data, { today: "2026-10-15", swaps: { barata: { plan: indexOfBusPlan, lodging: indexOfHotel } } });
  expect(res.cards[0]).toMatchObject({ adjusted: true, costCents: 80_800_000, why: "Combinación ajustada por vos." });
});
it("sin alojamiento: missing incluye 'dónde te alojás' y no hay tarjetas", async () => {
  expect(proposalsFromLoaded(sinAlojamiento)).toMatchObject({ missing: ["dónde te alojás"], cards: [] });
});
```

Los totales esperados se calculan a mano en la prueba, con el imprevisto del 10% sobre las categorías por defecto, igual que en el fixture de Bariloche.

- [ ] **Step 2:** Correr `npx vitest run src/server/services/proposals.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar, reutilizando `toCostInput`/`toTransportLeg` de `trip-analysis.ts` para pasar los datos al formato del dominio.
- [ ] **Step 4:** Correr `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: servicio de propuestas y elección`.

### Task 4: Interfaz de IA, validación y versión simulada

**Files:**
- Create: `src/integrations/ai/types.ts`, `schemas.ts`, `prompts.ts`, `fake.ts`, `anthropic.ts`, `index.ts`.
- Test: `src/integrations/ai/schemas.test.ts`, `src/integrations/ai/index.test.ts`.
- Modify: `package.json` (agregar `@anthropic-ai/sdk`).

**Interfaces:**
- Produces:

```ts
export interface TripContext { origin: string | null; destination: string; startDate: string; endDate: string; travelers: number; today: string; }
export type OfferKind = "vuelo" | "micro" | "tren" | "auto_alquiler" | "alojamiento" | "actividad" | "otro";
export interface OfferDraft { kind: OfferKind; direction: "ida" | "vuelta" | "ida_y_vuelta" | null; name: string; company: string; from: string; to: string; depart: string | null /* YYYY-MM-DDTHH:MM local */; arrive: string | null; durationMin: number | null; stops: number | null; price: number | null; currency: "ARS" | "USD"; basis: "total" | "por_persona" | "por_noche" | "por_persona_por_noche" | "por_dia"; nights: number | null; score: string | null; comfort: number; detail: string; doubtful: string[]; }
export interface TripDraft { destination: string | null; origin: string | null; startDate: string | null; endDate: string | null; travelers: number | null; budget: number | null; currency: "ARS" | "USD"; doubtful: string[]; }
export interface CarAsk { origin: string; destination: string; model: string | null; consumptionLPer100: number | null; today: string; }
export interface CarEstimate { km: number; hours: number; tolls: number; consumptionLPer100: number; fuelPrice: number; route: string; doubtful: string[]; }
export type AiErrorCode = "not_configured" | "no_offers" | "bad_response" | "upstream" | "limit" | "blocked" | "bad_input";
export interface TravelAI {
  parseTrip(text: string, today: string): Promise<Result<TripDraft>>;
  readImage(image: Buffer, mime: string, ctx: TripContext): Promise<Result<OfferDraft[]>>;
  readPage(text: string, url: string, ctx: TripContext): Promise<Result<OfferDraft[]>>;
  estimateCar(input: CarAsk): Promise<Result<CarEstimate>>;
}
export function getAI(): TravelAI; // AI_FAKE=1 → fake; sin ANTHROPIC_API_KEY → todo devuelve err("not_configured", "La lectura automática no está configurada. Cargá la opción a mano.")
export function assertAiConfigSafe(env: NodeJS.ProcessEnv): void; // lanza si NODE_ENV=production y AI_FAKE=1
export function parseOffers(raw: unknown): OfferDraft[]; // en schemas.ts: tolerante, recorta a 6
```

- **`prompts.ts`:** las instrucciones del prototipo, adaptadas a los nombres de campo de arriba. Piden JSON con las claves en español del prototipo, y `schemas.ts` las traduce.
- **`anthropic.ts`:**
  - `messages.create` con imagen base64 o texto, `max_tokens` 2000, y la respuesta JSON extraída del primer bloque de texto.
  - Si hay error 429/5xx, un reintento después de 1,5 s y después `err("upstream", "No se pudo leer ahora. Probá de nuevo en un rato.")`.
- **`fake.ts`:**
  - Respuestas fijas según el nombre o el texto: capturas que contienen `vuelo-ida`, `vuelo-vuelta`, `micro`, `hotel`, `hostel`, `usd`, `ilegible` en el nombre del archivo, que se pasa por `mime` con `;name=`.
  - Una frase fija para "Bariloche…" y un auto fijo.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("normaliza precio en texto, recorta y descarta lo inválido", () => {
  const [o] = parseOffers({ opciones: [{ tipo: "vuelo", sentido: "ida", nombre: "AR 1672", precio: "$ 1.234.567", moneda: "ARS", base: "total", salida: "2027-13-40T99:99", confort: 9, dudosos: ["precio"] }] });
  expect(o).toMatchObject({ kind: "vuelo", direction: "ida", price: 1234567, depart: null, comfort: 5 });
  expect(o.doubtful).toContain("depart");
});
it("tipo desconocido pasa a 'otro'; transporte sin sentido pasa a 'ida' y queda dudoso", …);
it("más de 6 ofertas se recortan a 6", …);
it("sin clave, getAI responde not_configured", async () => { delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_FAKE; expect(await getAI().parseTrip("x", "2026-10-15")).toMatchObject({ ok: false, code: "not_configured" }); });
it("producción con AI_FAKE=1 no arranca", () => expect(() => assertAiConfigSafe({ NODE_ENV: "production", AI_FAKE: "1" } as never)).toThrow());
```

- [ ] **Step 2:** Correr `npx vitest run src/integrations/ai`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `parseOffers` usa `parseAmount` del dominio cuando el precio viene como texto, y `num` tolerante para "1,5 millones" en `parseTrip`. Llamar a `assertAiConfigSafe(process.env)` en `scripts/migrate.ts` (que corre al arrancar).
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: interfaz de IA con versión real y simulada`.

### Task 5: Lectura segura de links

**Files:**
- Create: `src/integrations/fetch-page.ts`, `src/integrations/html-text.ts`.
- Test: `src/integrations/fetch-page.test.ts`, `src/integrations/html-text.test.ts`.

**Interfaces:**
- Produces:

```ts
export function isBlockedAddress(ip: string): boolean; // 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 0/8, 100.64/10, ::1, fc00::/7, fe80::/10, ::ffff:mapeadas
export async function fetchPage(url: string, deps?: { lookup?: (host: string) => Promise<string[]>; fetchImpl?: typeof fetch }): Promise<Result<{ finalUrl: string; html: string }>>;
export function htmlToText(html: string): string; // title + meta description/og:* + JSON-LD + texto visible sin script/style, espacios colapsados, cortado a 30.000
```

- Cualquier fallo devuelve `err("blocked", "Este sitio no deja leer el link. Subí una captura de la página.")`: esquema inválido, credenciales, IP bloqueada, más de 3 redirecciones, estado distinto de 2xx, tiempo agotado o más de 2 MB.
- Una página con menos de 200 caracteres de texto útil también cuenta como bloqueada.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it.each(["127.0.0.1","10.1.2.3","172.20.0.1","192.168.0.5","169.254.169.254","::1","::ffff:127.0.0.1","fd00::1"])("bloquea %s", ip => expect(isBlockedAddress(ip)).toBe(true));
it("bloquea una redirección hacia localhost", async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://localhost/admin" } }));
  const r = await fetchPage("https://ok.example/x", { lookup: async (h) => h === "localhost" ? ["127.0.0.1"] : ["93.184.216.34"], fetchImpl });
  expect(r).toMatchObject({ ok: false, code: "blocked" });
});
it("rechaza ftp: y credenciales en la URL", …);
it("htmlToText incluye JSON-LD y og:title, y descarta scripts", …);
```

- [ ] **Step 2:** Correr `npx vitest run src/integrations`. Esperado: FAIL.
- [ ] **Step 3:** Implementar con `redirect: "manual"`, `AbortSignal.timeout(8000)`, lectura del cuerpo en streaming con corte a 2 MB, `dns.promises.lookup(host, { all: true })` por defecto y un User-Agent de navegador común.
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: lectura segura de páginas para links`.

### Task 6: Límite diario de IA

**Files:**
- Create: `src/server/services/ai-quota.ts`.
- Test: `src/server/services/ai-quota.test.ts`.

**Interfaces:**
- Produces: `export async function consumeAiQuota(db: Db, userId: string, today: string, limit = Number(process.env.AI_DAILY_LIMIT ?? 60)): Promise<Result<{ remaining: number }>>`.
  - Hace un upsert atómico: `insert … on conflict do update set count = ai_usage.count + 1 where ai_usage.count < limit returning count`.
  - Si no devuelve fila, responde `err("limit", "Llegaste al límite de lecturas de hoy. Mañana se renueva; mientras tanto podés cargar a mano.")`.

- [ ] **Step 1: Escribir las pruebas que fallan:** con `limit` 2, la tercera llamada del mismo día falla con `limit`, y al día siguiente vuelve a dar ok.
- [ ] **Step 2:** Correr la prueba. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr la prueba. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: límite diario de lecturas con IA`.

### Task 7: Guardar ofertas, auto y tipo de cambio

**Files:**
- Create: `src/server/services/offers.ts`.
- Test: `src/server/services/offers.test.ts`.

**Interfaces:**
- Consumes: `OfferDraft`, `CarEstimate` (Task 4); `carCostItems`; repos.
- Produces:

```ts
export type OfferSource = { kind: "captura" } | { kind: "link"; url: string } | { kind: "manual" } | { kind: "auto" };
export interface SavedOffer { ownerType: "transport_option" | "lodging_option" | "activity"; id: string; pairId: string | null; }
export async function saveOffers(db: Db, ctx: Ctx, tripId: string, drafts: OfferDraft[], source: OfferSource): Promise<SavedOffer[]>;
export async function saveCarOffer(db: Db, ctx: Ctx, tripId: string, est: CarEstimate, model: string | null): Promise<SavedOffer[]>; // dos filas own_car con pairId
export interface OfferEdit extends Partial<OfferDraft> { car?: { km: number; hours: number; consumptionLPer100: number; fuelPrice: number; tolls: number } }
export async function updateOffer(db: Db, ctx: Ctx, ref: { ownerType: SavedOffer["ownerType"]; id: string }, edit: OfferEdit): Promise<void>;
export async function setInProposals(db: Db, ctx: Ctx, ref: { ownerType: "transport_option" | "activity"; id: string }, value: boolean): Promise<void>;
export async function setUsdRate(db: Db, ctx: Ctx, tripId: string, perUsd: number, today: string): Promise<void>; // fuente "Ingresado por vos"
export function offerCardsFromLoaded(data: LoadedTrip): OfferCard[]; // vista para la pantalla Opciones
export interface OfferCard { ownerType: SavedOffer["ownerType"]; id: string; group: "ida" | "vuelta" | "ida_y_vuelta" | "alojamiento" | "destino"; kind: OfferKind | "auto_propio"; name: string; company: string; route: string; when: string; detail: string; score: string | null; totalCents: number | null; priceNote: string; currency: string; doubtful: string[]; inProposals: boolean | null; source: string | null; edit: OfferEdit; }
```

- El mapeo sigue la tabla de la sección 6 del spec.
- **Horarios:**
  - Se convierten con `zonedToUtc` usando `trip.startTz` para la ida y `trip.endTz` para la vuelta.
  - Si solo hay salida y duración, la llegada = salida + duración.
  - Si no hay salida, se guarda la opción sin segmentos.
- Lo dudoso se guarda en `notes` como `[revisar:precio,salida]` al final del texto. `offerCardsFromLoaded` lo lee y lo saca del texto que se muestra. Al editar una opción, se limpia.
- `ida_y_vuelta` crea dos filas con el mismo `pairId`. La partida va en la ida con categoría `transport_outbound`, y la vuelta queda sin partidas.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// salida "2027-01-10T10:00" en Buenos Aires
it("vuelo de ida con horarios crea transporte con un segmento y su partida", …expect(t.segments[0].departUtc).toBe("2027-01-10T13:00:00.000Z"); expect(item).toMatchObject({ category: "transport_outbound", amountCents: 24_000_000, source: "Captura" }));
it("ida y vuelta crea dos filas con el mismo pairId y una sola partida", …expect(rows[0].pairId).toBe(rows[1].pairId); expect(items).toHaveLength(1));
it("alojamiento sin horarios toma 14:00 y 10:00; '4 estrellas' guarda rating 8", …expect(l.checkInAt.toISOString()).toBe("2027-01-10T17:00:00.000Z"); expect(l.rating).toBe("8.0"));
it("auto propio: dos filas own_car con partidas de nafta y peajes por tramo", …expect(fuel.amountCents).toBe(Math.round(1650 * 7 / 100 * 1300 * 100)); expect(tolls.amountCents).toBe(1_500_000));
it("la marca [revisar:…] se muestra como dudosa y desaparece al editar", …expect(card.doubtful).toEqual(["price"]); /* después de updateOffer */ expect(card2.doubtful).toEqual([]));
it("setUsdRate guarda USD→ARS con fecha de hoy", …expect(rate).toMatchObject({ base: "USD", quote: "ARS", asOf: "2026-10-15", source: "Ingresado por vos" }));
```

- [ ] **Step 2:** Correr `npx vitest run src/server/services/offers.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr la prueba. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: guardar ofertas leídas, auto y dólar`.

### Task 8: Viaje rápido y acciones del servidor

**Files:**
- Create: `src/server/services/quick-trip.ts`, `src/server/actions/quick.ts`.
- Test: `src/server/services/quick-trip.test.ts`, `src/server/actions/quick.test.ts` (solo la validación y el armado del contexto, sin Next).

**Interfaces:**
- Consumes: Tasks 3–7; `createTrip`, `updateTrip`, `requireCtx`, `getDb`.
- Produces:

```ts
// quick-trip.ts
export interface QuickTrip { destination: string; origin: string | null; startDate: string; endDate: string; travelers: number; budget: number | null; currency: "ARS" | "USD"; tz?: string; }
export const quickTripSchema: z.ZodType<QuickTrip>; // mensajes: "Falta el destino", "Falta la fecha de ida", "La vuelta tiene que ser después de la ida", "Entre 1 y 20 personas"
export function toTripForm(q: QuickTrip): TripForm;  // name = destino, originLabel = origen ?? "", horas 00:00/23:59, presupuesto 0 si null
export function tripContext(data: LoadedTrip, today: string): TripContext;
// actions/quick.ts ("use server")
export async function parseTripAction(text: string): Promise<Result<TripDraft>>;
export async function saveQuickTripAction(_: FormState, fd: FormData): Promise<FormState>;           // crea o actualiza (campo tripId) y redirige a /viajes/[id]/opciones
export async function readImageAction(tripId: string, fd: FormData): Promise<Result<SavedOffer[]>>; // campo "image"; valida tipo y tamaño
export async function readLinkAction(tripId: string, url: string): Promise<Result<SavedOffer[]>>;
export async function carAction(tripId: string, model: string | null, consumption: string | null): Promise<Result<SavedOffer[]>>;
export async function manualOfferAction(tripId: string): Promise<SavedOffer>;
export async function updateOfferAction(tripId: string, ref: { ownerType: SavedOffer["ownerType"]; id: string }, edit: OfferEdit): Promise<Result<void>>;
export async function deleteOfferAction(tripId: string, ref: { ownerType: SavedOffer["ownerType"]; id: string }): Promise<void>;
export async function inProposalsAction(tripId: string, ref: { ownerType: "transport_option" | "activity"; id: string }, value: boolean): Promise<void>;
export async function usdRateAction(tripId: string, value: string): Promise<Result<void>>;
export async function chooseProposalAction(tripId: string, p: { legIds: string[]; lodgingId: string; name: string }): Promise<void>; // redirige a /viajes/[id]/confirmar
```

- Toda acción que usa IA hace dos cosas antes de llamarla: verifica que el viaje sea del espacio de trabajo y llama a `consumeAiQuota`.
- `carAction` sin origen responde `err("bad_input", "Falta desde dónde salís. Completalo en los datos del viaje.")`.
- Todas revalidan `/viajes/[id]` con `revalidatePath(..., "layout")`.

- [ ] **Step 1: Escribir las pruebas que fallan:**
  - `quickTripSchema` rechaza la vuelta antes de la ida y acepta un viaje de un día.
  - `toTripForm` arma `startAt` 03:00Z y `endAt` 02:59Z del día siguiente para Buenos Aires.
  - `tripContext` usa "Viajero" × N para la cantidad.
- [ ] **Step 2:** Correr las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr `npm test && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: viaje rápido y acciones de carga`.

### Task 9: Base visual nueva

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `package.json` (`@fontsource-variable/bricolage-grotesque`, `@fontsource/figtree` 400/500/600/700; se quitan las fuentes Barlow).
- Modify: `src/ui/Button.tsx`, `src/ui/Field.tsx`, `src/ui/AppNav.tsx`, `src/ui/TripTabs.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/viajes/[id]/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/registro/page.tsx`, `src/app/(app)/page.tsx`, `src/ui/TripCardView.tsx`.
- Create: `src/ui/Ticket.tsx`, `src/ui/Note.tsx`.
- Test: `tests/e2e/shell.spec.ts` (se actualiza).

**Interfaces:**
- Produces: tokens CSS iguales a los del prototipo (`--paper --card --ink --muted --line --route --route-ink --route-soft --sun --sun-soft --sun-line --alert --alert-soft`), mapeados en `@theme inline`, con claro y oscuro por `data-theme` y `prefers-color-scheme`.
- Produces: `<Ticket icon thumb? kind title meta? when? detail? flag? price priceNote actions? footer?>` con talón troquelado que pasa abajo en menos de 520 px, y `<Note tone="info"|"warn">`.
- Produces: `TripTabs` con Opciones, Propuestas, Itinerario y Gastos, más un menú "Más" con Datos del viaje, Exportar, Imprimir y Compartir.

- [ ] **Step 1:** Actualizar `shell.spec.ts`: el inicio muestra "Tus viajes" y "Viaje nuevo", el ingreso muestra "Ingresar", y no hay scroll horizontal a 390 px en claro ni en oscuro.
- [ ] **Step 2:** Correr `npm run test:e2e -- shell`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los tokens, las fuentes, los componentes y el rediseño de ingreso, registro e inicio.
- [ ] **Step 4:** Correr `npm run test:e2e -- shell && npm run lint && npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: nueva base visual`.

### Task 10: Pantalla Viaje nuevo y Datos del viaje

**Files:**
- Create: `src/ui/QuickTripForm.tsx` (cliente).
- Modify: `src/app/(app)/viajes/nuevo/page.tsx`, `src/app/(app)/viajes/[id]/editar/page.tsx`.
- Delete: `src/ui/TripWizard.tsx`.
- Test: `tests/e2e/quick-trip.spec.ts` (reemplaza a `trip-wizard.spec.ts`).

**Interfaces:**
- Consumes: `parseTripAction`, `saveQuickTripAction`.
- Comportamiento: campo "Tu viaje en una frase", botón "Armar mi viaje" y link "Prefiero completar un formulario".
  - Después de leer la frase, el formulario corto se completa y lo dudoso queda con la clase `doubt` y el texto "· revisá".
  - Errores de la frase: "No entendí la frase. Probá con destino, fechas y cuántos van, o usá el formulario."
  - `editar` usa el mismo formulario con `tripId`.

- [ ] **Step 1:** Escribir la prueba con `AI_FAKE=1`: se escribe "Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate", y el formulario muestra Bariloche, Zárate, 2027-01-10, 2027-01-16 y 2. Al guardar, la URL termina en `/opciones`. Agregar el caso de formulario con la vuelta antes de la ida, que muestra "La vuelta tiene que ser después de la ida".
- [ ] **Step 2:** Correr `npm run test:e2e -- quick-trip`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Agregar `AI_FAKE: "1"` al `webServer.env` de `playwright.config.ts`.
- [ ] **Step 4:** Correr la prueba. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: viaje nuevo con una frase`.

### Task 11: Pantalla Opciones

**Files:**
- Create: `src/app/(app)/viajes/[id]/opciones/page.tsx`, `src/ui/options/OptionsBoard.tsx` (cliente), `src/ui/options/OfferEditor.tsx`, `src/ui/options/resize.ts`, `src/ui/options/queue.ts`.
- Test: `src/ui/options/queue.test.ts`, `tests/e2e/options-board.spec.ts`.

**Interfaces:**
- Consumes: `offerCardsFromLoaded`, `proposalsFromLoaded` (para la barra: `missing`, `needsUsdRate`, `comboCount`) y las acciones de la Task 8.
- Produces:
  - `export function runQueue<T>(items: T[], worker: (t: T) => Promise<void>, concurrency = 2): Promise<void>` en `queue.ts`.
  - `export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob>` en `resize.ts`: JPEG con calidad 0,85; si falla, devuelve el archivo original.
- Comportamiento, igual al prototipo:
  - Zona para soltar o elegir capturas, Ctrl+V, campo de link, "Uso mi auto", "A mano".
  - Tarjetas de lectura con miniatura local (URL de objeto) y "Leyendo…"; las de error con Reintentar, Cargar a mano y Quitar.
  - Grupos Ida, Vuelta, Ida y vuelta, Alojamiento y En destino.
  - Edición dentro de la tarjeta y casilla "Sumar a las 3 opciones".
  - Panel del dólar.
  - Barra inferior fija "Para comparar falta…" / "Listo. N combinaciones posibles", con el botón "Ver mis 3 opciones" que lleva a `/propuestas`.
  - Después de cada acción, `router.refresh()`.

- [ ] **Step 1:** Escribir las pruebas.
  - `queue.test.ts`: nunca más de 2 a la vez y procesa todo.
  - E2E con `AI_FAKE=1`:
    - Subir `vuelo-ida.png`, `vuelo-vuelta.png` y `hotel.png` (fixtures en `tests/e2e/fixtures/`) muestra 3 tarjetas y "Listo. 1 combinación posible".
    - `ilegible.png` muestra "No encontré una opción de viaje en esta captura." y su "Cargar a mano" abre el editor.
    - `usd.png` muestra "¿A cuánto tomás el dólar?" y bloquea el botón hasta cargarlo.
    - Un link a `http://127.0.0.1/x` muestra "Este sitio no deja leer el link. Subí una captura de la página."
    - "Uso mi auto" con modelo crea "Ida y vuelta · Tu auto".
    - Editar un precio actualiza el total.
    - No hay scroll horizontal a 390 px.
- [ ] **Step 2:** Correr `npx vitest run src/ui/options && npm run test:e2e -- options-board`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: pantalla Opciones con capturas, links y auto`.

### Task 12: Pantalla Propuestas

**Files:**
- Create: `src/app/(app)/viajes/[id]/propuestas/page.tsx`, `src/ui/proposals/ProposalCard.tsx`, `src/ui/proposals/SwapPanel.tsx` (cliente), `src/ui/proposals/swaps.ts`.
- Test: `src/ui/proposals/swaps.test.ts`, `tests/e2e/proposals.spec.ts`.

**Interfaces:**
- Consumes: `proposalsFromLoaded(data, { swaps })` y `chooseProposalAction`.
- Produces:
  - `export function parseSwaps(sp: Record<string, string | string[] | undefined>): Partial<Record<ProposalTag, { plan: number; lodging: number }>>`: lee `?barata=2,1` y descarta lo inválido.
  - `export function swapHref(base: string, current: URLSearchParams, tag: ProposalTag, v: { plan: number; lodging: number } | null): string`.
- La página muestra lo que hace falta mientras `missing` no esté vacío. Si no:
  - Título "Tus 3 opciones para {destino}".
  - Tarjetas con etiquetas, total, monto por persona, `why`, los tres datos (viaje total, confort, presupuesto), piezas, "Cambiar algo" y "Volver a la propuesta", y "Elegir esta".
  - `<details>` con la tabla "Ver las N combinaciones".

- [ ] **Step 1:** Escribir las pruebas.
  - `swaps.test.ts`: `?barata=1,0` da `{ barata: { plan: 1, lodging: 0 } }`, y `?rapida=x` se ignora.
  - E2E (sigue a la Task 11 con ida y vuelta en vuelo y en micro, más dos alojamientos):
    - Aparecen "La más barata", "La más rápida" y "La más cómoda".
    - Cambiar el alojamiento de la barata muestra "Ajustada".
    - "Elegir esta" lleva a Confirmar con "Escenario elegido".
- [ ] **Step 2:** Correr las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit con `feat: pantalla Tus 3 opciones`.

### Task 13: Resto de pantallas con el estilo nuevo, y limpieza

**Files:**
- Modify: `src/app/(app)/viajes/[id]/page.tsx` (redirige a `/opciones` si no hay escenario elegido y a `/itinerario` si lo hay), `confirmar`, `itinerario`, `gastos`, `imprimir`, `exportar`, `src/app/share/[token]/page.tsx`, `src/ui/itinerary/*`, `src/ui/ExpenseForm.tsx`, `src/ui/BookingRow.tsx`, `src/ui/BudgetReadOnly.tsx`.
- Delete:
  - Las páginas `transporte`, `alojamiento`, `actividades` y `comparador`, que pasan a ser redirecciones en `next.config.ts` (`transporte|alojamiento|actividades` → `opciones`, `comparador` → `propuestas`).
  - `src/ui/TransportForm.tsx`, `LodgingForm.tsx`, `ActivityForm.tsx`, `CostItemsEditor.tsx`, `CarCalculator.tsx`, `QuickPrice.tsx`, `src/ui/comparator/*`.
  - Las acciones que solo usaban esas pantallas (`options.ts`, `scenarios.ts`, `segments.ts` en `actions/`), si `typecheck` confirma que no tienen otros usos.
- Modify: `src/server/services/demo.ts`. La demo se genera con `saveOffers`/`saveCarOffer` (pares e `inProposals`) y, en la página compartida, muestra sus 3 propuestas con `proposalsFromLoaded`, sin "Elegir esta".
- Test: se actualizan `tests/e2e/confirm|itinerary|expenses|export|demo|timezones.spec.ts` para que lleguen por el flujo nuevo. Se borran `options|comparator|trip-wizard.spec.ts`. Los helpers de `tests/e2e/helpers.ts` pasan a `createQuickTrip`, `uploadShots` y `choose`.

- [ ] **Step 1:** Actualizar las pruebas E2E.
  - `demo.spec.ts`: la página pública muestra "Precios ficticios" y las tres etiquetas.
  - `/viajes/[id]/comparador` redirige a `/propuestas`.
- [ ] **Step 2:** Correr `npm run test:e2e`. Esperado: FAIL en las rutas y en las pantallas nuevas.
- [ ] **Step 3:** Implementar el rediseño y la limpieza.
- [ ] **Step 4:** Correr `npm test && npm run lint && npm run typecheck && npm run test:e2e`. Esperado: todo PASS.
- [ ] **Step 5:** Commit con `feat: estilo nuevo en todas las pantallas y limpieza de la carga anterior`.

### Task 14: Flujo completo, documentación y verificación

**Files:**
- Modify: `tests/e2e/full-flow.spec.ts`, `README.md`, `DEPLOY.md` (sección "Clave de la API de Claude": crear la clave en platform.claude.com, cargar saldo, variable `ANTHROPIC_API_KEY`, opcionales `AI_DAILY_LIMIT`, `AI_MODEL`, `AI_MODEL_FAST`), `.env.example`, `docs/superpowers/decisiones-mvp.md` (decisiones de este ciclo).

- [ ] **Step 1:** Reescribir `full-flow.spec.ts` para que haga, a 390 px y con `AI_FAKE=1`:
  1. Frase, formulario y 5 capturas.
  2. Dólar y auto.
  3. Ver las 3 opciones, cambiar algo y elegir.
  4. Confirmar.
  5. Itinerario con "Salir de casa".
  6. Gasto de $ 35.000,00.
  7. CSV y .ics con 200.
  8. Imprimir.
  9. Inicio con el viaje.
  En cada paso, sin scroll horizontal.
- [ ] **Step 2:** Correr `npm run test:e2e -- full-flow`. Esperado: PASS (o corregir lo que falle).
- [ ] **Step 3:** Escribir la documentación.
- [ ] **Step 4:** Correr la verificación completa: `npm test && npm run lint && npm run typecheck && npm run build && npm run test:e2e`. Esperado: todo verde, con los conteos anotados en el commit.
- [ ] **Step 5:** Commit con `docs: guía de la clave de IA y decisiones del ciclo`.

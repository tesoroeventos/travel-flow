# TravelFlow

Plataforma de planificación y logística de viajes: compará combinaciones completas de transporte, alojamiento y actividades con el **costo real puerta a puerta**, elegí la que te conviene y generá el itinerario desde que salís de casa hasta que volvés.

Núcleo MVP (sub-proyecto 1). Diseño: `docs/superpowers/specs/2026-10-14-travelflow-design.md`. Plan: `docs/superpowers/plans/2026-10-14-travelflow-mvp.md`. Despliegue: `DEPLOY.md`.

## Qué hace

1. **Crear viaje** en 3 pasos: datos generales (multidestino, viajeros, presupuesto y moneda), preferencias y restricciones.
2. **Cargar alternativas** de transporte (con escalas y zona horaria por tramo), alojamiento y actividades. Cada una con partidas de costo: importe, moneda, unidad (total, por persona, por noche, por persona por noche, por día), categoría, fijo/variable/opcional, reembolsable, fuente, fecha de consulta, impuestos y estimado/confirmado. Calculadora de auto con supuestos visibles.
3. **Comparar escenarios**: tabla lado a lado con total, imprevistos, por persona, por día, desvío contra el presupuesto, ahorro frente a una referencia, confirmado/estimado, pagado/pendiente, por tipo y por categoría; gráfico de composición; recomendación ponderada con explicación en texto y umbral de empate.
4. **Confirmar mi viaje**: escenario elegido y estado de cada reserva y pago (la app nunca reserva ni paga por su cuenta).
5. **Itinerario** cronológico y por día: salida de casa calculada hacia atrás, conexiones, check-in/out, actividades encadenadas, alertas (superposición, traslado insuficiente, conexión ajustada, fuera de fechas, llegada antes del check-in), orden manual o por cercanía, notas y aviso cuando un cambio lo afecta.
6. **Gastos reales** en cualquier moneda, convertidos con la tasa vigente a su fecha: presupuesto vs. estimado vs. real, disponible y desvío por categoría.
7. **Exportar**: presupuesto CSV, itinerario .ics para el calendario y vista para imprimir o guardar PDF.
8. **Compartir y demo**: enlace público de solo lectura, viaje de demostración y "Duplicar como mío".

## Stack

Next.js 16 (App Router) · TypeScript estricto · Tailwind CSS 4 · Postgres con Drizzle ORM (PGlite en desarrollo y pruebas) · sesiones firmadas con jose + argon2 · Zod · decimal.js · date-fns-tz · dnd-kit · Vitest · Playwright.

```
src/domain/        lógica pura: dinero, monedas, costos, decisión, itinerario
src/server/        base de datos, repositorios (aislados por workspace), servicios, acciones, exportación
src/integrations/  contratos para APIs externas (en el MVP: carga manual)
src/app, src/ui    pantallas y componentes
```

## Estado del MVP

### Funciona con datos reales cargados por el usuario
- Cuentas con código de invitación, espacios de trabajo aislados y sesiones seguras.
- Viajes, viajeros, paradas, preferencias y restricciones; historial de cambios por viaje.
- Alternativas y partidas de costo con todos los atributos; calculadora de auto.
- Motor de costos (centavos enteros, redondeo half-even, conversión explícita sin encadenar, imprevistos, reembolsables, avisos de datos faltantes o viejos).
- Escenarios, comparador, recomendación con pesos y umbral de empate.
- Confirmación con estados de reserva y pago.
- Itinerario con zonas horarias, alertas, reordenamiento y aviso de cambios.
- Gastos reales y tipos de cambio por fecha.
- Exportación CSV, .ics y vista de impresión/PDF.
- Enlaces públicos de solo lectura y duplicación de viajes.
- Uso desde el celular (390 px) e instalable como app (PWA), modo claro y oscuro.

### Usa datos simulados
- El viaje de demostración Buenos Aires → Bariloche (3 escenarios): todos sus precios llevan la marca "Dato de demostración" y la página muestra "Precios ficticios".

### Requiere credenciales o servicios externos
- **Despliegue**: cuenta de GitHub y de Railway (ver `DEPLOY.md`).
- **Integraciones** (sub-proyecto 5, no incluidas): búsqueda de vuelos y hoteles, tipo de cambio automático, rutas y distancias reales, clima, calendario. El contrato está en `src/integrations/types.ts`; hoy todas responden "Integración no configurada: cargá los datos a mano".
- **Fuera de este ciclo**: mapa logístico, comparación de destinos, división de gastos grupales, documentación con archivos, asistente de IA.

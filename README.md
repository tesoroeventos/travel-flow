# TravelFlow

Plataforma de planificación y logística de viajes: compará combinaciones completas de transporte, alojamiento y actividades con el **costo real puerta a puerta**, elegí la que te conviene y generá el itinerario desde que salís de casa hasta que volvés.

Diseño: `docs/superpowers/specs/2026-10-14-travelflow-design.md` (MVP) y `docs/superpowers/specs/2026-10-15-carga-rapida-design.md` (carga rápida). Despliegue: `DEPLOY.md`.

## Qué hace

1. **Viaje nuevo en una frase**: "Bariloche del 10 al 16 de enero, somos 2, salimos de Zárate, presupuesto 1,5 millones". La IA completa el formulario corto y marca en amarillo lo que supuso. También se puede llenar a mano.
2. **Opciones con capturas y links**: soltás varias capturas de Despegar, Booking, la aerolínea o la empresa de micros (o pegás el link) y cada oferta aparece como una tarjeta tipo pasaje con precio, fechas y horarios. "Uso mi auto" estima distancia, nafta, peajes y horas. Todo se corrige en la tarjeta.
3. **Tus 3 opciones**: la más barata, la más rápida y la más cómoda, calculadas sobre todas las combinaciones, con el porqué, el costo por persona, el tiempo de viaje puerta a terminal y lo que sobra o falta del presupuesto. "Cambiar algo" ajusta una pieza.
4. **Confirmar**: estado de cada reserva y pago (la app nunca reserva ni paga por su cuenta).
5. **Itinerario** puerta a puerta con zonas horarias, alertas, orden manual y aviso cuando un cambio lo afecta.
6. **Gastos reales** en cualquier moneda, presupuesto vs. estimado vs. real.
7. **Exportar**: presupuesto CSV, itinerario .ics y vista para imprimir o guardar PDF.
8. **Compartir y demo**: enlace público de solo lectura con las 3 opciones, viaje de demostración y "Duplicar como mío".

## Stack

Next.js 16 (App Router) · API de Claude (lectura de capturas y links) · TypeScript estricto · Tailwind CSS 4 · Postgres con Drizzle ORM (PGlite en desarrollo y pruebas) · sesiones firmadas con jose + argon2 · Zod · decimal.js · date-fns-tz · dnd-kit · Vitest · Playwright.

```
src/domain/        lógica pura: dinero, monedas, costos, decisión, itinerario
src/server/        base de datos, repositorios (aislados por workspace), servicios, acciones, exportación
src/integrations/  IA (TravelAI real y simulada), lectura segura de links, contratos de APIs externas
src/app, src/ui    pantallas y componentes
```

## Estado del MVP

### Funciona con datos reales
- Cuentas con código de invitación, espacios de trabajo aislados y sesiones seguras.
- Carga rápida: frase del viaje, capturas y links leídos con IA (con `ANTHROPIC_API_KEY`), auto propio estimado, carga a mano.
- Las 3 propuestas sobre todas las combinaciones, con el motor de costos (centavos enteros, half-even, conversión explícita, imprevistos).
- Confirmación, itinerario con zonas horarias y alertas, gastos reales, exportación CSV/.ics/PDF.
- Enlaces públicos de solo lectura y duplicación de viajes.
- Uso desde el celular (390 px), instalable como app (PWA), modo claro y oscuro.

### Usa datos simulados
- El viaje de demostración Buenos Aires → Bariloche (3 escenarios): todos sus precios llevan la marca "Dato de demostración" y la página muestra "Precios ficticios".

### Requiere credenciales o servicios externos
- **Despliegue**: cuenta de GitHub y de Railway (ver `DEPLOY.md`).
- **IA**: clave de la API de Claude en `ANTHROPIC_API_KEY` (ver `DEPLOY.md`). Sin clave, todo se carga a mano.
- **Más adelante**: "Compartir → TravelFlow" en Android, búsqueda automática de vuelos y hoteles, tipo de cambio automático, rutas reales.
- **Fuera de este ciclo**: mapa logístico, comparación de destinos, división de gastos grupales, documentación con archivos, asistente de IA.

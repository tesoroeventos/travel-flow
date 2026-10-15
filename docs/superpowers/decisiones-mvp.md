# TravelFlow MVP — Decisiones tomadas durante la implementación

Registro de cada decisión que no estaba fijada en la spec o el plan, con lo que cuesta si fue equivocada. Generado al cerrar la implementación (2026-10-15).

## Decisiones

- T19 adds trips.itinerary_snapshot — add column in T10 schema up-front — avoids a second migration — cost if wrong: one unused column until T19.
- T22.seedDemo ← T5 fixture is a ScenarioCostInput, not DB rows — seedDemo reuses the DB seeding helper from T12 (seedBarilocheA) and extends it with B and C — cost if wrong: refactor of a test helper.
- todos grouped by phase (6) instead of 23 widget items — less noise for the user; ledger keeps per-task lines — cost if wrong: none.
- Task 1: Google Fonts no se pueden descargar desde este entorno — se quita next/font/google y se usa fuente del sistema; la tipografía se define en Task 14 — cost if wrong: elegir fuente auto-hospedada más tarde.
- Task 1: typecheck = "next typegen && tsc --noEmit" (Next 16 genera tipos globales como LayoutProps) — cost if wrong: none.
- Task 1: @types/node fijado a ^22 (peer de vitest 5) — cost if wrong: none.
- Task 2: Intl "es-419" formatea 1,234.56, que contradice el formato de carga 1.234,56 del plan — se muestra con es-AR (punto de miles, coma decimal; ARS "$", USD "US$") y la carga usa el mismo formato — cost if wrong: usuarios de México/Centroamérica ven un formato distinto al suyo; un selector de formato por usuario es trabajo futuro.
- Task 2: "12.5" se rechaza como formato inválido (un punto solo es separador de miles) — cost if wrong: quien escriba decimales con punto recibe el mensaje con el ejemplo.
- Task 3: findRate devuelve rate null para misma moneda (en vez de un rate sintético 'identity') — más simple; convert expone rateSource null como pide el test — cost if wrong: none.
- Task 5: CostLine.originalCents = total de la línea en moneda original (unitario × multiplicador × cantidad), no el unitario — es lo que se convierte; el CSV de Task 21 toma el unitario de la partida — cost if wrong: renombrar un campo.
- Task 5: stale_price con detail = días de antigüedad; missing_exchange_rate con detail "USD→ARS" — la UI necesita el par para el texto "Falta tipo de cambio" — cost if wrong: none.
- Task 5: el desvío incluye imprevistos (spec §5.4) — cost if wrong: el aviso de exceso es más prudente.
- Task 6: combustible es costType 'variable' (depende del recorrido real); assumptions incluye 'concept' para identificar cada partida — cost if wrong: reclasificar.
- Task 7: solo cuentan criterios con peso > 0; un criterio con peso 0 sin datos no genera aviso — evita ruido — cost if wrong: none.
- Task 7: si hay empate en el primer puesto entre varios escenarios, recommendedId = null (no se recomienda) — no inventar una preferencia — cost if wrong: el usuario no ve recomendación cuando hay empate total.
- Task 7: explicación abre con "Con tus prioridades, conviene X." y agrega variantes "más caro / ahorra tiempo" y "solo tiempo" — cost if wrong: texto.
- Task 8: "Salir de casa" solo para el primer tramo de ida; "Llegada a casa" solo para el último de regreso; transfer:<leg>:0 = hacia la terminal, transfer:<leg>:1 = desde la terminal — cost if wrong: claves de override cambian.
- Task 8: también se avisa missing_transfer_time en la vuelta cuando falta transferFromMin — simetría con la ida — cost if wrong: un aviso de más.
- Task 8: alertas probadas a través de generateItinerary (no detectAlerts aislado) — prueba el comportamiento real — cost if wrong: none.
- Task 8: los overrides de posición ordenan actividades dentro del día antes de asignar horarios; las actividades con hora mantienen su hora — cost if wrong: el orden manual no mueve actividades con hora fija.
- Task 9: actividades flexibles sin coordenadas van al final de su día (en su orden original) — cost if wrong: el usuario las reordena a mano.
- Task 10: columnas adicionales que la spec implica: trips.destination_label, alternative_destinations, flexibility_days, rooms, trip_type, reference_scenario_id, itinerary_snapshot; transport/lodging.flexible_cancellation (para el criterio Flexibilidad); travelers.position — cost if wrong: columnas sin uso.
- Task 10: contingency_categories por defecto = food, activities, transport_internal; contingency_pct por defecto 10 — valores razonables editables — cost if wrong: el usuario los cambia.
- Task 10: Postgres devuelve numeric con escala ("1.0000"); el dominio usa decimal.js así que es equivalente — cost if wrong: none.
- Task 11: un repositorio genérico makeChildRepo para todas las tablas con trip_id (en vez de un archivo por agregado) + trips, rates, events; selecciones/toggles/ratings/pesos/overrides se agregan en Task 12 con sus tests — menos código duplicado — cost if wrong: tipado interno con any en un solo archivo.
- Task 11: el historial (trip_events) no tiene FK a trips para conservar el registro de viajes borrados — cost if wrong: filas huérfanas.
- Task 12: pesos por defecto (precio 5, tiempo 3, transbordos 2, ubicación 2, flexibilidad 1, comodidad 3, calidad 2, experiencia 2) para que haya recomendación sin configurar nada — cost if wrong: el usuario los ajusta.
- Task 12: el itinerario incluye solo las actividades seleccionadas en el escenario elegido — coherente con "Confirmar mi viaje: actividades principales" — cost if wrong: el usuario tiene que seleccionar las actividades en el escenario.
- Task 12: flexibilidad = % del total en partidas de alternativas con cancelación flexible (columna flexible_cancellation); ubicación = distancia promedio alojamiento↔actividades si hay coordenadas, si no distancia al centro — cost if wrong: criterios menos precisos.
- Task 12: partidas opcionales incluidas por defecto; el interruptor las excluye por escenario — cost if wrong: none.
- Task 13: sesiones propias firmadas con jose (cookie HttpOnly, 30 días) según la guía oficial de Next 16, en lugar de Auth.js v5 (sigue en beta y solo hace falta email+contraseña) — desvío de la spec §2/§11 — cost if wrong: agregar OAuth más adelante requiere integrar una librería.
- Task 13: cacheComponents desactivado (modelo dinámico clásico, documentado como soportado) — la app es casi toda por usuario — cost if wrong: menos prerender estático.
- Task 13: verifyLogin y token.ts agregados (el plan no los nombraba) con tests; form.ts (helpers de formularios) se escribió antes que su test — test agregado después, desvío de TDD en un helper chico — cost if wrong: bajo.
- Task 13: con PGlite, getDb() aplica las migraciones al iniciar (dev/E2E sin pasos extra) — cost if wrong: none (Postgres usa scripts/migrate.ts).
- Task 13: dirección visual (skill frontend-design): Barlow + Barlow Condensed auto-hospedadas, paleta tinta/papel/ruta/señal/alerta, elemento propio "línea de ruta" — cost if wrong: retoque estético.
- Task 14: BOOTSTRAP_INVITE_CODE (env) asegura un código de invitación al iniciar — lo usan las pruebas E2E y sirve para el primer acceso en producción — cost if wrong: si se deja configurado en producción, cualquiera con el código puede registrarse (hasta 1000 usos).
- Task 14: Playwright usa el Chromium preinstalado (CHROMIUM_PATH) porque la descarga está bloqueada en este entorno; en CI se instala normal — cost if wrong: none.
- Task 14: servicio sumExpenses (gasto real convertido a la fecha de cada gasto) creado ya para el dashboard; Task 20 lo reutiliza — cost if wrong: none.
- Task 14: selector de tema también en el encabezado (no solo en Configuración) — cost if wrong: none.
- Task 15: "Duplicar viaje" se implementa en Task 22 (duplicateTripToWorkspace) y se reutiliza para "Duplicar como mío" — evita dos copias del mismo código — cost if wrong: la acción de duplicar aparece recién con la demo.
- Task 15: la cantidad de viajeros se edita desde "Editar datos" (agrega/quita los últimos de cada tipo, conserva nombres); los nombres se editan en la ficha — cost if wrong: none.
- Task 15: loadTrip ahora incluye stops (para dibujar la línea de ruta con paradas) — cost if wrong: none.
- Task 16: al crear una alternativa se puede cargar un "precio rápido" (importe, moneda, unidad) que se guarda como su primera partida; el resto se agrega como partidas — menos pasos en el celular — cost if wrong: none.
- Task 16: escalas se cargan como tramos encadenados (campo "Escala en"), con zona horaria de llegada por tramo — cost if wrong: UI algo más larga para vuelos con escalas.
- Task 16: campos de formulario con ids únicos (useId) porque hay varios formularios por página; Field pasa a ser componente cliente — cost if wrong: none.
- Task 16: toCostInput extraído de scenarioItems para reutilizarlo en optionCost — refactor sin cambio de comportamiento (tests verdes) — cost if wrong: none.
- Task 17: gráfico como barras apiladas horizontales en HTML (no Recharts ni dona) — el skill dataviz desaconseja tortas para comparar composición; 13 categorías se agrupan en 6 (Transporte, Alojamiento, Alimentación, Actividades, Seguros y trámites, Otros e imprevistos) con la paleta categórica validada (claro y oscuro); la tabla es la vista accesible obligatoria por el aviso de contraste en claro — cost if wrong: se pierde la animación/tooltip de Recharts.
- Task 17: duplicar escenario agregado (copia selecciones, interruptores, calificaciones y partidas propias) — acelera armar variantes — cost if wrong: none.
- Task 17: groups.ts se escribió antes que su test (test agregado en el mismo paso) — desvío menor de TDD — cost if wrong: bajo.
- Task 17: indicador "Guardando…" en las casillas del escenario; las pruebas esperan la confirmación del servidor ("N alternativas elegidas") antes de navegar — cost if wrong: none.
- Task 18: el E2E de confirmación no se corrió en rojo antes de crear la página (la ruta no existía, el fallo era seguro) — desvío de proceso, los tests de servicio sí se vieron fallar — cost if wrong: bajo.
- Task 18: el radio de "Elegí el escenario" preselecciona el elegido o, si no hay, el recomendado — cost if wrong: none.
- Task 19: la copia de referencia del itinerario se guarda sin historial (no es un cambio del usuario); un reordenamiento manual actualiza la referencia solo si no había cambios externos pendientes — así el aviso "Cambió tu itinerario" no informa lo que hizo el propio usuario — cost if wrong: none.
- Task 19: reordenar con botones Subir/Bajar en ambas vistas + arrastre (dnd-kit) dentro de cada día — cost if wrong: none.
- Task 20: gastos sin participantes elegidos guardan [] (la división grupal llega en el sub-proyecto 3); fmtRate extraído con test — cost if wrong: none.
- Task 21: el CSV exporta el escenario elegido (o ?escenario=id, o el más económico si no hay elegido); el PDF se genera con "Imprimir o guardar PDF" del navegador sobre /imprimir — sin librería de PDF en el servidor — cost if wrong: el formato del PDF depende del navegador.
- Task 21: rutas de exportación devuelven 302 a /login sin sesión y 404 para viajes ajenos — cost if wrong: none.
- Task 22: el seed de Bariloche pasa de fixture de tests a src/server/services/demo-data.ts (lo usan la demo y los tests); su tipo de cambio rige desde 2026-01-01 para que la demo convierta con la fecha real — cost if wrong: none (tests verdes).
- Task 22: la demo vive en un workspace propio con un usuario de sistema sin contraseña utilizable; SEED_DEMO=true la siembra al iniciar (idempotente) y DEMO_SHARE_TOKEN fija el enlace — cost if wrong: un usuario de sistema extra en la base.
- Task 22: duplicar copia los tipos de cambio que el destino no tenga (si no, la copia quedaría incompleta) y mantiene el escenario elegido, sin reservas, gastos ni enlace — cost if wrong: el usuario recibe tasas de la demo en su configuración.
- Task 22: "Ver un viaje de ejemplo" en el ingreso, y "Compartir"/"Duplicar viaje" en la ficha de cada viaje — cost if wrong: none.
- Task 22: el E2E de la demo se escribió después de la implementación (no se vio en rojo) — desvío de proceso; los tests de servicio sí se vieron fallar — cost if wrong: bajo.
- Task 23: tsx pasa a dependencia de producción (npm start aplica migraciones con scripts/migrate.ts antes de next start) — cost if wrong: dependencia extra en producción.
- Task 23: arranque de producción verificado con PGlite (migraciones, demo, /login 200, /share 200); con Postgres real no se pudo probar en este entorno (no hay servidor Postgres) — cost if wrong: un error de conexión aparecería recién en Railway.
- Task 23: el E2E full-flow pasó en la primera corrida (cubre funciones ya construidas, no código nuevo) — cost if wrong: none.
- Final: fixed I6 tasas copiadas sin indicar origen — demo.test 'Copiado de «…»' RED→GREEN. se siguen copiando (sin ellas la copia queda incompleta) pero con la fuente marcada — cost if wrong: el usuario puede borrarlas en Configuración.
- Final: I7 (la demo se vuelve a sembrar si alguien revoca su enlace) re-calificado Minor — el usuario demo no puede iniciar sesión, solo se revoca tocando la base — cost if wrong: un segundo viaje demo.
- Final: I8 (sesiones no revocables) re-calificado Minor para el MVP de un solo workspace por usuario; documentado como pendiente — cost if wrong: un token robado vale hasta 30 días.
- Final: I10 (tras registrarse desde la demo hay que tocar "Duplicar" otra vez) re-calificado Minor — cost if wrong: un clic más.
- Final: rate limiting de /login y /registro (declinado por el revisor) — queda para endurecimiento de producción; argon2 frena fuerza bruta — cost if wrong: intentos masivos de contraseña posibles.

## Arreglos de la revisión final

- C1 mezcla entre viajes del mismo workspace (selecciones, interruptores, partidas, reservas, edición de dueño) — cross-trip.test.ts RED(5/6)→GREEN, suite 237/237. El fixture de isolation.test.ts tenía un dueño inválido y quedaba salteado; corregido.
- I2/I3/I4 zonas horarias (destino del viaje, salida del primer tramo según ida/vuelta, alojamiento) — trip.test 'acepta una zona horaria distinta' RED→GREEN + e2e timezones.spec RED→GREEN, suite unit verde.
- M3 (re-calificado Important: el itinerario mostraba el precio unitario como costo) — 'el costo de una actividad en el itinerario es su total' RED→GREEN, server 104/104.
- I5 getDb cacheaba una inicialización fallida — memo.test 'si falla, el próximo llamado vuelve a intentar' RED→GREEN.
- I1 referenceScenarioId sin validar — scenarios.test 'el escenario de referencia tiene que ser del mismo viaje' RED→GREEN.
- I6 tasas copiadas sin indicar origen — demo.test 'Copiado de «…»' RED→GREEN. se siguen copiando (sin ellas la copia queda incompleta) pero con la fuente marcada — cost if wrong: el usuario puede borrarlas en Configuración.
- I9 .env.example ignorado por .gitignore — `git check-ignore` lo mostraba ignorado → ahora versionado.
- M10 (re-calificado Important: el código inicial no vencía) — register.test 'crea el código con vencimiento a 14 días y no lo renueva' RED→GREEN.

## Pendientes menores (no se corrigieron)

- M1 precio rápido ignorado al editar (el formulario no lo muestra).
- M2 al borrar el escenario elegido el viaje queda en estado "confirmado".
- M4 actividades en un hueco entre dos alojamientos no se marcan "fuera de fechas".
- M5 columna CSV "Importe original" es el unitario; renombrar a "Importe unitario".
- M6 nombres no latinos generan archivo "viaje".
- M7 gastos ordenados por fecha de carga en el repositorio (la página los ordena por fecha).
- M8 el hash de contraseña se calcula aun con código inválido (intencional).
- M9 sin largo máximo en campos de texto.

## Ciclo 2: carga rápida con IA (2026-10-15)

- - Rates are workspace-scoped (r.rates.list(ctx)), spec says "del viaje": Ruling: setUsdRate writes a workspace rate asOf today — engine already selects by date — cost if wrong: another trip in the same workspace sees the same USD rate (desired anyway).
- Task 3: Ruling: chooseProposal también borra reservas 'selected/payment_pending' de piezas que ya no están en la propuesta — sino quedan reservas huérfanas en Confirmar — costo si está mal: se pierde una reserva sin estado que el usuario tendría que volver a marcar
- Task 4: Ruling: Result de error es {ok:false,error:{code,message}} (forma existente), no {ok:false,code} como decía el plan — se respeta el tipo del proyecto — costo: ninguno.
- Task 4: Ruling: precios de la IA con toNumber tolerante (como el prototipo) en vez de parseAmount, que no acepta "$" ni "US$" — costo: ninguno.
- Task 4: Ruling: assertAiConfigSafe vive en guard.ts sin imports para que scripts/migrate.ts lo use sin alias "@/" — costo: ninguno.
- Task 5: Ruling: el fetch por defecto usa undici con lookup que vuelve a validar en la conexión (evita DNS rebinding); se agrega la dependencia undici — costo: una dependencia más. La regla de <200 caracteres útiles va en readLinkAction (Task 8).
- Task 7: Ruling: una opción sin precio no tiene partida; las propuestas la listan en missing ("el precio de “X”") y costOf devuelve null — el spec pide que no compita y la barra lo pida — costo: ninguno.
- Task 7: Ruling: auto propio sale a las 08:00 del día de ida/vuelta (editable desde Itinerario) para tener horarios y competir en "más rápida" — costo: horario supuesto.
- Task 7: Ruling: cambiar el tipo a otra tabla, o pasar de/a "ida y vuelta", borra y vuelve a crear la opción (cambia el id) — costo: si estaba en el escenario elegido, sale de él.
- Task 7: Ruling: helper itemsTotalCents en services/costing.ts usado por ofertas y propuestas.
- Task 8: Ruling: los viajeros se crean con setTravelerCounts existente ("Adulto 1…N") en vez de "Viajero 1…N" — reutiliza el código y la pantalla de viajeros — costo: solo el nombre mostrado.
- Task 8: Ruling: sin origen se guarda originLabel "" (columna not null) y la app lo trata como "falta desde dónde salís".
- Task 8: Ruling: manualOfferAction(tripId, kind) recibe el tipo (la UI pregunta qué cargar) — evita crear en una tabla y mover después.
- Task 8: Ruling: no hay actions/quick.test.ts aparte; la validación vive en quick-trip.ts (probada) y las acciones se cubren por E2E — costo: menos cobertura unitaria de acciones.
- Task 8: Ruling: un link bloqueado no consume cupo; la captura sí consume antes de llamar a la IA.
- Task 9: Ruling: se mantienen los nombres de tokens existentes (ink, surface, route, signal…) con los valores del prototipo (+ signal-line, shadow-card) para que toda la app cambie de estilo sin reescribir cada componente — costo: nombres distintos a los del prototipo (sun → signal).
- Task 10: Ruling: página mínima /opciones creada acá (la llena la Task 11) porque la redirección del formulario la necesita; trip-wizard.spec.ts borrado junto con el asistente — costo: ninguno.
- Task 11: Ruling: además de runQueue, queue.ts exporta createLimiter(2) compartido por todas las tandas, para que nunca haya más de 2 lecturas a la vez aunque se suelten capturas en momentos distintos.
- Task 11: Ruling: el selector "El precio es" pasa a llamarse "Cómo se cobra" (más claro y evita confundir con "Precio").
- Task 11: Ruling: "A mano" usa un selector de tipo al lado del botón (sigue Task 8).
- Task 13: Ruling: el resumen del viaje redirige (Opciones o Itinerario); viajeros, compartir, duplicar y borrar pasan a "Datos del viaje" (TripAdmin) — preferencias y restricciones del asistente viejo ya no se muestran — costo: esos datos viejos quedan guardados pero invisibles.
- Task 13: Ruling: el formulario corto suma "Zona horaria de salida" y "Zona horaria del lugar que visitás" (plegadas) — el spec pedía zona editable y el modelo tiene startTz/endTz — costo: ninguno.
- Task 13: Ruling: en la demo el auto propio se arma como par (pairId) y las actividades gratis quedan fuera de las propuestas (inProposals=false), para que la demo muestre las 3 propuestas sin "falta el precio".
- Task 13: Ruling: una actividad sin precio bloquea las propuestas ("el precio de …") igual que cualquier opción; para algo gratis se carga precio 0 — costo: un paso más para lo gratuito.
- Task 13: Ruling: se agrega .prettierrc.json con printWidth 120 (el estilo del proyecto); los archivos nuevos de tareas 1–12 quedaron a 80 y se reformatean en la Task 14.
- Task 13: Ruling: E2E usan getByLabel(..., { exact: true }) para "Ida", "Vuelta", "Destino" (coinciden por subcadena con "salida" y las zonas horarias).

# Despliegue en Railway

TravelFlow es una sola app Next.js con Postgres. En producción usa Postgres de Railway; para desarrollo local usa PGlite (Postgres embebido, sin instalar nada).

## 1. Subir el código a GitHub

```bash
git remote add origin https://github.com/tesoroeventos/travel-flow.git
git push -u origin master
```

## 2. Crear el proyecto en Railway

1. **New Project → Deploy from GitHub repo** y elegí el repositorio.
2. En el mismo proyecto: **New → Database → PostgreSQL**.
3. En el servicio de la app, pestaña **Variables**, agregá:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Referencia a la base: `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | Un secreto de al menos 32 caracteres (`openssl rand -base64 32`) |
| `APP_URL` | La URL pública que te asigne Railway (ej. `https://travelflow.up.railway.app`) |
| `SEED_DEMO` | `true` para crear el viaje de demostración al iniciar (opcional) |
| `DEMO_SHARE_TOKEN` | Opcional: fija el enlace de la demo (`/share/<valor>`) |
| `BOOTSTRAP_INVITE_CODE` | Opcional: un código de invitación inicial (hasta 1000 usos). Vence a los 14 días de creado y no se renueva; después usá `npm run invite`. |

4. **Settings → Networking → Generate Domain** para tener la URL pública.

`railway.json` ya define el build (`npm run build`) y el arranque (`npm start`), que aplica las migraciones antes de iniciar.

## 3. Códigos de invitación

El registro solo funciona con código. Para crear uno desde tu computadora, con la `DATABASE_URL` pública de Railway:

```bash
DATABASE_URL="postgresql://..." npm run invite -- --uses 20 --days 60
```

Imprime un código de 10 caracteres. También podés usar `BOOTSTRAP_INVITE_CODE` (ver arriba).

## 4. Demo para posibles clientes

Con `SEED_DEMO=true`, la demo se crea sola al iniciar. Si preferís hacerlo a mano:

```bash
DATABASE_URL="postgresql://..." APP_URL="https://tu-app.up.railway.app" npm run seed:demo
```

Muestra el enlace público de solo lectura. También aparece como "Ver un viaje de ejemplo" en la pantalla de ingreso.

## Desarrollo local

```bash
cp .env.example .env   # completar AUTH_SECRET
npm install
npm run dev            # crea la base PGlite en .data/dev y aplica migraciones
```

## Pruebas

```bash
npm test               # dominio, servicios y repositorios (Vitest + PGlite)
npm run test:e2e       # flujo completo en tamaño celular (Playwright)
```

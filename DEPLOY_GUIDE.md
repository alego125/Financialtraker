# 🚀 Guía de Deploy — FinTrack
## Stack: Neon · Render · Vercel (100% gratuito)

```
[Vercel]          [Render]               [Neon]
Frontend  ──────▶  Backend API    ──────▶  PostgreSQL
(React)            (Node/Express)          (Serverless)
  FREE               FREE                   FREE
```

> ⚠️ **Render free tier** pone el backend a dormir tras 15 minutos de inactividad.
> El primer request después de eso tarda ~30 segundos (cold start). Es normal.

---

## Antes de empezar — subir el código a GitHub

Si no tenés el repo en GitHub todavía:

```bash
# En la raíz del proyecto (donde están /backend y /frontend)
git init
cp deploy/root-.gitignore .gitignore
git add .
git commit -m "fintrack initial commit"
```

Creá un repo en https://github.com/new (puede ser privado) y:
```bash
git remote add origin https://github.com/TU_USUARIO/fintrack.git
git branch -M main
git push -u origin main
```

---

## PASO 1 — Base de datos: Neon

1. Creá cuenta en https://neon.tech (gratis, sin tarjeta de crédito)
2. "Create a project" → Nombre: `fintrack`, Region: la más cercana a vos
3. Una vez creado, en el dashboard buscá la sección **Connection Details**
4. Seleccioná el rol `neondb_owner` y copiá **dos URLs**:

   **URL con pooler** (para la app en producción):
   ```
   postgresql://neondb_owner:xxx@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   → Esta va como `DATABASE_URL`

   **URL directa** (para migraciones):
   ```
   postgresql://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   → Esta va como `DIRECT_URL`

   > La diferencia: la URL con pooler tiene `-pooler` en el hostname. La directa no.

---

## PASO 2 — Backend: Render

### 2.1 — Crear el servicio

1. Ir a https://render.com → "New +" → **Web Service**
2. Conectá tu cuenta de GitHub y seleccioná el repo `fintrack`
3. Completá la configuración:

   | Campo | Valor |
   |-------|-------|
   | Name | `fintrack-api` |
   | Root Directory | `backend` |
   | Environment | `Node` |
   | Region | Oregon (US West) |
   | Branch | `main` |
   | Build Command | `npm install && npx prisma generate` |
   | Start Command | `npx prisma migrate deploy && node server.js` |
   | Plan | **Free** |

### 2.2 — Variables de entorno en Render

En "Environment" → "Add Environment Variable", agregá una por una:

```
DATABASE_URL   = [URL CON POOLER de Neon]
DIRECT_URL     = [URL DIRECTA de Neon]
JWT_SECRET     = [clave aleatoria — ver abajo cómo generar]
JWT_EXPIRES_IN = 7d
NODE_ENV       = production
FRONTEND_URL   = https://fintrack.vercel.app   ← completar después del paso 3
```

Para generar `JWT_SECRET` (ejecutá esto en tu terminal):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.3 — Deploy

Click **"Create Web Service"**. Render va a buildear y deployar.
Esperá a que aparezca "Live" (puede tardar 2-3 minutos la primera vez).

Copiá la URL pública, ejemplo: `https://fintrack-api.onrender.com`

### 2.4 — Verificar

Abrí en el navegador:
```
https://fintrack-api.onrender.com/api/health
```
Debe responder: `{"status":"ok","ts":"..."}`

---

## PASO 3 — Frontend: Vercel

### 3.1 — Crear el proyecto

1. Ir a https://vercel.com → "Add New..." → **Project**
2. Importá el repo `fintrack` de GitHub
3. Configurá el proyecto:

   | Campo | Valor |
   |-------|-------|
   | Root Directory | `frontend` |
   | Framework Preset | Vite (detectado automático) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

### 3.2 — Variables de entorno en Vercel

En "Environment Variables" (antes de hacer deploy):
```
VITE_API_URL = https://fintrack-api.onrender.com/api
```
(reemplazá con la URL real de tu backend de Render)

### 3.3 — Deploy

Click **"Deploy"**. Vercel construye y publica en ~1 minuto.

Copiá la URL del frontend, ejemplo: `https://fintrack.vercel.app`

---

## PASO 4 — Conectar frontend ↔ backend (CORS)

Volvé a **Render** → tu servicio → **Environment** y actualizá:
```
FRONTEND_URL = https://fintrack.vercel.app
```
(la URL real que te dio Vercel)

Render hace redeploy automático. Listo.

---

## Archivos incluidos — dónde va cada uno

| Archivo descargado        | Copiarlo a                        |
|---------------------------|-----------------------------------|
| `backend-server.js`       | `backend/server.js`               |
| `backend-schema.prisma`   | `backend/prisma/schema.prisma`    |
| `backend-render.yaml`     | `backend/render.yaml`             |
| `backend-Procfile`        | `backend/Procfile`                |
| `backend-.env.example`    | `backend/.env.example`            |
| `frontend-vercel.json`    | `frontend/vercel.json`            |
| `frontend-vite.config.js` | `frontend/vite.config.js`         |
| `frontend-.env.example`   | `frontend/.env.example`           |
| `root-.gitignore`         | `.gitignore` (raíz del proyecto)  |

---

## Límites del tier gratuito

| Servicio | Límite | Para FinTrack |
|----------|--------|---------------|
| **Neon** | 0.5 GB storage, 191hs compute/mes | ✅ Más que suficiente |
| **Render** | 750 hs/mes, cold start 30s | ✅ Suficiente (1 usuario/pocos usuarios) |
| **Vercel** | 100 GB bandwidth, deploys ilimitados | ✅ Sin límite práctico |

---

## Troubleshooting

**CORS error en el navegador**
→ Verificá que `FRONTEND_URL` en Render sea exactamente `https://fintrack.vercel.app` sin `/` al final.

**"Can't reach database" en Render**
→ Asegurate de haber seteado tanto `DATABASE_URL` (con pooler) como `DIRECT_URL` (directa). Neon requiere ambas.

**Frontend muestra pantalla en blanco / rutas no funcionan**
→ Verificá que `frontend/vercel.json` esté en el repo. Ese archivo configura el redirect de SPA.

**Render dice "Build failed"**
→ Revisá que Root Directory esté seteado como `backend` en la configuración del servicio.

**Variables de entorno de Vite no funcionan**
→ Las variables para Vite DEBEN empezar con `VITE_`. Cualquier otra no llega al frontend.

**Cold start muy lento**
→ Es normal en Render free. El primer request tras 15min de inactividad tarda ~30s.
Para evitarlo podés usar https://uptimerobot.com (gratis) para hacer ping al backend cada 14 minutos.

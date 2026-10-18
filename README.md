# FinTrack

Seguimiento financiero con React, Express, Prisma y PostgreSQL. Requiere Node 22.12 o posterior y PostgreSQL 14 o posterior.

## Arranque desde vacío

Crear una base PostgreSQL local vacía `fintrack`. Copiar `backend/.env.example` a `backend/.env` y completar ambas URLs y un JWT_SECRET aleatorio largo. Desde `backend`: ejecutar `npm ci`, `npx prisma generate`, `npx prisma migrate deploy` y `npm run dev`. En otra terminal, desde `frontend`: ejecutar `npm ci` y `npm run dev`. Abrir http://localhost:5173 y registrarse.

El seed (`npm run seed` desde backend) es opcional, crea una contraseña demo conocida y sólo se debe usar en una base de desarrollo descartable. No subir archivos .env.

## Verificación

Desde backend: `npm test` y `npx prisma validate`. Desde frontend: `npm run build`.

La integración requiere una base local descartable llamada por ejemplo `fintrack_integrity_test_local`. Definir TEST_DATABASE_URL, DATABASE_URL y DIRECT_URL con esa base, aplicar `npx prisma migrate deploy` desde backend y ejecutar `npm run test:integration`. La suite rechaza hosts remotos y nombres ajenos al prefijo de pruebas. No usar datos personales. CI reproduce estos pasos con PostgreSQL aislado.

## Configuración

Ver ejemplos .env en cada directorio. VITE_API_URL usa `/api` y el proxy de Vite en desarrollo; en producción usar un proxy propio o la API HTTPS terminada en `/api`. Las variables VITE_ son públicas y requieren recompilar al cambiar.

Las sesiones usan cookie HttpOnly y CSRF en escrituras. Producción requiere HTTPS; preferir frontend y API bajo el mismo sitio para evitar bloqueo de cookies de terceros. FRONTEND_URL debe listar orígenes exactos separados por comas. No usar comodines de previews.

La IA requiere GEMINI_API_KEY sólo en backend. Sin clave informa indisponibilidad. La recuperación automática por correo está desactivada; no se anuncia un envío operativo.

Los importes ARS y USD se informan por separado. Las exportaciones tabulares son CSV compatible con Excel; no se usa la dependencia xlsx sin parche de seguridad.

## Archivos activos

El backend arranca en `backend/server.js`, usa `backend/prisma/schema.prisma` y migraciones versionadas. El frontend usa `frontend/index.html` y `frontend/src/main.jsx`. Las copias prefijadas backend-* son referencias históricas, no entradas de despliegue; no se eliminaron copias de trabajo.

Ver [despliegue](DEPLOY_GUIDE.md) y [operación y backups](docs/OPERATIONS.md).

# Despliegue de FinTrack

Guía de preparación: no acredita publicación, verificación de proveedores externos ni backup de datos reales. Comprobar precios y límites vigentes con cada proveedor.

## Backend

Usar Node 22.12 o posterior y directorio backend. Build: `npm ci && npx prisma generate`. Migración previa: `npx prisma migrate deploy`. Inicio: `node server.js`; `npm start` también incluye migración.

Provisionar PostgreSQL. DATABASE_URL es la conexión de la app; DIRECT_URL la conexión directa para migraciones. Usar TLS cuando lo requiera el proveedor. Configurar NODE_ENV=production, JWT_SECRET aleatorio largo, JWT_EXPIRES_IN=7d, PORT y FRONTEND_URL con los orígenes HTTPS exactos. Generar el secreto en una terminal privada con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Guardar credenciales en el gestor de secretos del alojamiento.

No usar seed, migrate reset ni db push en producción. Probar migraciones sobre una copia aislada y verificar un backup restaurable antes de migrar. La readiness `/api/ready` debe responder 200 cuando PostgreSQL sea accesible; `/api/health` sólo comprueba el proceso. Revisar logs sin publicar cookies, credenciales ni información financiera.

backend/render.yaml es una referencia que requiere revisar región, plan y secretos. Los archivos backend/backend-* no son entradas activas.

## Frontend

Directorio frontend; `npm ci`, `npm run build`; servir dist con fallback SPA. frontend/vercel.json incluye cabeceras y rutas de referencia. VITE_API_URL se incorpora al compilar.

La cookie de producción es Secure, HttpOnly y sin Domain, con CSRF en escrituras. Preferir app.example.com y api.example.com, o un proxy /api en el mismo origen. En sitios separados, comprobar login, recarga, logout y cambio de contraseña en navegadores reales: las políticas de cookies de terceros pueden impedir sesiones.

La CSP permite connect-src HTTPS para admitir la API configurada. Reducirlo al dominio real al desplegar. Permite Google Fonts y estilos inline para gráficos; mantener frame-ancestors none, object-src none y base-uri self.

## Validación y reversión

Ejecutar CI y auditar dependencias. Verificar TLS, CORS rechazando orígenes desconocidos, CSRF, revocación y exportaciones. Probar escritura/lectura sólo con datos de prueba autorizados. Consultar el [runbook](docs/OPERATIONS.md).

Conservar el artefacto anterior; sólo revertir código si es compatible con el esquema migrado. Prisma no revierte automáticamente migraciones. Ante incompatibilidades, detener escrituras y decidir corrección hacia adelante o restauración verificada. Restaurar pierde modificaciones posteriores al respaldo y requiere una decisión operativa explícita.

## Destinos confirmados para esta publicación

Frontend: https://financialtraker.vercel.app. Backend: https://financialtraker.onrender.com. La compilación de producción usa /api y vercel.json lo reenvía a Render antes del fallback SPA, evitando depender de cookies de terceros. VITE_API_URL sigue disponible para desarrollo; para alojar el frontend en otro proveedor hay que configurar el proxy equivalente. FRONTEND_URL en Render debe incluir exactamente https://financialtraker.vercel.app (sin barra final). NODE_ENV=production, Node>=22.12 y JWT_SECRET>=32caracteres. Verificar DATABASE_URL,DIRECT_URL, respaldo y registro de migraciones antes del despliegue del backend; actualizar backend antes del frontend.

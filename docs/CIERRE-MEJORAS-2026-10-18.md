# Cierre de bloques de reparación — 2026-10-18

Se completaron los bloques de código de la auditoría: autorización y recuperación segura; integridad transaccional y fondos; precisión de inversiones y separación ARS/USD; migraciones; reporting SQL; exportaciones completas; solicitudes cancelables; accesibilidad de modales; sesiones, CSRF y revocación; servidor, IA configurable, dependencias, CI y documentación operativa.

## Resultado verificado

- 66 pruebas unitarias/controladores/utilidades correctas.
- 21 pruebas de integración correctas con PostgreSQL local aislado, incluidos concurrencia, rollback, agregados NUMERIC, filtros, HTTP de registro/cookie/CSRF/cambio de contraseña/revocación/logout/CORS/readiness.
- Prisma generate, validate, migrate deploy y comparación base→schema sin diferencias, según ejecución local.
- Build producción frontend correcto: 1002 módulos y mayor chunk 443.56 kB, carga por página con lazy/Suspense.
- Playwright con API simulada: login, ausencia de JWT almacenado, cuentas móvil 375 px sin overflow, foco/Shift+Tab/Escape/restauración en modal.
- PDF jsPDF4/AutoTable5 smoke correcto. CSV seguro sustituye XLSX y conserva resumen por moneda.
- npm audit de producción backend y frontend: cero vulnerabilidades. Backend completo: cero.

## Seguridad de sesión

Cookie HttpOnly, Secure en producción y prefijo __Host; CSRF por sesión; token sólo en cookie y CSRF sólo en memoria. Cambiar contraseña/email exige contraseña actual y revoca otras sesiones. Logout revoca todas. Un cambio entre pestañas detectado por CSRF exige recargar sin repetir automáticamente una escritura. Cookies antiguas/JWT anteriores requieren iniciar sesión nuevamente.

CORS permite únicamente FRONTEND_URL explícitos (localhost sólo fuera de producción), límites por IP en memoria, mensajes internos genéricos con requestId y JSON limitado. backend-server.js delega al servidor canónico. /api/ready comprueba conexión y columna de sesiones; no equivale a reconciliación del libro contable.

## Operación y límites concretos

No se modificaron datos reales ni se desplegó. Aplicar la migración de sesiones y configurar JWT_SECRET (mínimo32), FRONTEND_URL exacto, URLs de base y orígenes HTTPS antes de publicar. GEMINI_API_KEY y GEMINI_MODEL habilitan IA: ruta autenticada y limitada, timeout15s, prompt12000; sin configuración devuelve503. La disponibilidad del proveedor externo no se probó con una clave real.

Persisten 7 avisos del tooling CSS de Tailwind3 (5 altos,2 moderados), fuera del artefacto de producción. Mitigación y migración futura: docs/DEPENDENCIES.md. No se afirma una auditoría completa sin avisos. Los límites en memoria son por proceso; escalar múltiples instancias requiere almacén compartido. CI fue creado y sus comandos probados localmente; no se ejecutó GitHub Actions remoto. Backup/restauración documentados, sin intervenir infraestructura real. Graphify local no pudo regenerarse por un fallo de trampoline uv; no se utilizó el grafo como evidencia del código actualizado.

Las exportaciones detectan páginas incompletas/duplicadas y totales cambiantes; no son una instantánea transaccional ante ediciones simultáneas que conservan la cantidad. Los módulos grandes se redujeron mediante utilidades compartidas; una descomposición integral adicional y benchmarks con volúmenes reales pertenecen a mantenimiento posterior, no son necesarios para los fallos reproducidos corregidos.

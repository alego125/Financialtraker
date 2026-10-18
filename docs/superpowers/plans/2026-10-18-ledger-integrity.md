# Segunda etapa: integridad contable y migraciones

Objetivo: A04 y parte de A07/A11 de la auditoría. Conservar React, Express, Prisma y PostgreSQL.

- [x] Reproducir mediante pruebas el borrado de ingresos gastados, transferencias editadas sin fondos y cotizaciones negativas.
- [x] Ejecutar lecturas y escrituras de movimientos, transferencias, pagos, cuentas y cambios dentro de transacciones Serializable.
- [x] Enviar la respuesta HTTP sólo después del commit; reintentar únicamente P2034, como máximo tres intentos.
- [x] Eliminar reintentos de sentencias ante errores de conexión con resultado ambiguo.
- [x] Comprobar efectos netos sobre cuenta y moneda anteriores y nuevas al editar/borrar.
- [x] Restaurar estructuras ausentes en una migración nueva anterior a InvestmentPosition, sin editar migraciones históricas.
- [x] Probar migraciones desde vacío y comparar con schema.prisma: sin diferencias.
- [x] Probar concurrencia, rollback y conservación de datos sobre PostgreSQL temporal local.

Las transacciones pasan explícitamente el cliente Prisma a los controladores y sus auxiliares: las consultas de validación y las escrituras usan el mismo cliente. Las respuestas de rechazo abortan la transacción completa. Los cambios de divisas verifican el débito en ARS al comprar y en USD al vender. La cancelación sigue eliminando ambos movimientos, pero ahora se rechaza si el destino ya gastó los fondos.

Pruebas: `npm test`; `npm run test:integration` con TEST_DATABASE_URL apuntando exclusivamente a localhost/127.0.0.1 y una base cuyo nombre comience con fintrack_integrity_test. El archivo de integración rechaza otras bases antes de cargar Prisma. TEST_PSQL_BIN permite seleccionar psql. No se cargan credenciales de producción para estas pruebas.

Instancia temporal: PostgreSQL 18, 127.0.0.1:55439, datos en .test-postgres/ (ignorado). La primera prueba de migración encontró un error de sintaxis en SQL nuevo; se corrigió y se repitió el despliegue sobre otra base vacía. No se utilizó reset ni se modificaron datos reales.

Limitaciones: el modelo sigue calculando saldos con Number; la aritmética decimal integral, el reporting por moneda y la atomicidad de inversiones siguen pendientes. La protección de concurrencia de esta etapa cubre los controladores de movimientos, transferencias y cuentas/cambios; no supone que todos los escritores del sistema ya estén corregidos. Los saldos iniciales continúan siendo editables conforme a la funcionalidad existente.

No aplicar automáticamente esta migración a producción sin contrastar una copia de su esquema e historial: el entorno real pudo recibir SQL manual, constraints con otros nombres o tipos incompatibles. La migración preserva las tablas y columnas existentes; no convierte estructuras incompatibles ni intenta reparar datos históricos. No se ejecutó despliegue de la aplicación.

Resultado final: 29/29 pruebas unitarias/de controladores y 7/7 pruebas de integración con PostgreSQL pasaron; 41 archivos superaron la revisión sintáctica. Los mensajes P2034 observados durante la prueba son los conflictos concurrentes provocados deliberadamente, gestionados por el reintento. La migración se pudo volver a ejecutar conservando una cuenta de prueba con saldo 123,45 y el usuario existente. La comparación final del esquema no detectó diferencias. La instancia temporal fue apagada al terminar; su directorio permanece ignorado para inspección local.

Graphify no pudo actualizarse: `uv trampoline failed to canonicalize script path`. El mapa previo no refleja todavía estos cambios. No hubo cambios en el frontend ni verificación visual en esta etapa.

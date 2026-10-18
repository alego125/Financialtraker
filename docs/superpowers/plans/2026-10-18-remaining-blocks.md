# Cierre de bloques pendientes

Autorización: continuar todos los bloques restantes sin nuevas consultas. No desplegar ni tocar datos reales.

- [ ] Autenticación: cookie HttpOnly, CSRF, revocación al cambiar contraseña/cerrar todas las sesiones; rate limit; validación de configuración, CORS explícito y errores seguros.
- [ ] Transporte: validación uniforme de body/query, fechas, paginación limitada, tipos monetarios y reglas simétricas.
- [ ] IA: ruta activa autenticada, configuración de modelo por entorno, timeout y tratamiento de fallos; cliente HTTP común.
- [ ] Exportaciones completas y por moneda; solicitudes cancelables y errores visibles; modales accesibles.
- [ ] Reporting y saldos: filtros compartidos, agregación en DB, aritmética decimal y tratamiento de cuentas compartidas/transferencias.
- [ ] Operación: readiness de DB, CI reproducible, dependencias, arranque desde vacío, documentación vigente y runbook de backup/restauración.
- [ ] Revisión independiente, pruebas unitarias/HTTP/integración, build, navegador/PDF y resultados medidos; cerrar servicios temporales.

Trabajo dividido por dominios independientes según la guía de agentes paralelos: frontend, reporting backend y seguridad/validación/operación. La recuperación automática seguirá desactivada, pues ya existe recuperación manual visible: no se inventará un servicio de email operativo sin credenciales. La verificación de proveedores externos, backups y despliegues reales se documentará explícitamente sin afirmar acciones no realizadas.

# Primera etapa de correcciones

Objetivo: cerrar A01, A02 y A03 y proteger movimientos derivados (A05) de la auditoría del 17/10. Autorización: el usuario pidió comenzar la implementación tras recibir el informe.

Decisiones: conservar la recuperación manual visible y responder 410 al endpoint inseguro sin consultar usuarios ni modificar contraseñas; cancelar eliminando atómicamente transferencia y sus dos movimientos, conforme al modelo actual que no conserva cancelaciones. No ejecutar migraciones ni modificar datos reales.

- [x] Crear pruebas Node de regresión con controladores reales y persistencia simulada; observar los fallos originales (14 fallos de aserción antes del cambio).
- [x] Desactivar recuperación automática insegura.
- [x] Validar las cuentas del estado final al crear/editar movimientos, tipo de cuenta, moneda, exclusividad y saldo; proteger movimientos de transferencias e inversiones al editar/borrar.
- [x] Corregir cancelación y verificar saldo original y ausencia de movimientos sueltos.
- [x] Ejecutar suite, revisión sintáctica y registrar límites y siguientes etapas.

Pendiente de otras etapas: concurrencia real y atomicidad general, migraciones, reporting multimoneda, precisión y atomicidad de inversiones, informes PDF, IA, infraestructura y experiencia de usuario. No presentar esta etapa como reparación integral.

Verificación: `npm test` en backend, 20/20 pruebas; revisión sintáctica de 34 archivos sin fallos. Pruebas de controladores con persistencia simulada: no sustituyen PostgreSQL real, ni verifican bloqueos, carreras, aislamiento o rollback del motor. No se instalaron dependencias, no se ejecutó el servidor ni el build del frontend. Graphify no pudo actualizarse por `uv trampoline failed to canonicalize script path`.

Limitaciones deliberadas: la cancelación sigue eliminando historial, como la implementación previa; no hay estado persistente de cancelación. Los movimientos anteriores que ya hayan sido corrompidos no se reparan automáticamente. Las validaciones de saldo todavía no hacen atómicas lectura y escritura, y retirar/modificar un ingreso puede afectar fondos usados después: será parte de la siguiente etapa de integridad contable. Sin despliegue ni migraciones ejecutadas.

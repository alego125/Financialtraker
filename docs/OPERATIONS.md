# Operación y recuperación

## Salud

GET /api/health comprueba el proceso; GET /api/ready comprueba acceso a PostgreSQL. Un 503 exige revisar disponibilidad, URL y TLS. Un 401 exige nueva sesión; un 403 en escritura puede señalar CSRF/origen inválido; un 429 exige esperar.

El rate limit es por proceso en memoria; reiniciarlo borra sus contadores y las réplicas no comparten estado. Para escalar, añadir límite central en proxy o almacenamiento compartido. Confiar únicamente en proxies conocidos.

## Backup PostgreSQL

Los comandos son instrucciones, no un respaldo ejecutado. Usar cliente compatible con el servidor. Configurar conexiones en servicios libpq y contraseña en pgpass.conf con permisos restringidos: nunca secretos en comandos, repositorios o logs. Crear previamente un directorio privado. Ejemplo PowerShell con servicio `fintrack_backup`:

```powershell
$env:PGSERVICE = 'fintrack_backup'
pg_dump --format=custom --no-owner --no-acl --file='D:/Backups/fintrack-2026-10-18.dump'
if ($LASTEXITCODE -ne 0) { throw 'Backup falló' }
pg_restore --list 'D:/Backups/fintrack-2026-10-18.dump'
if ($LASTEXITCODE -ne 0) { throw 'Archivo inválido' }
Remove-Item Env:PGSERVICE
```

Cifrar el dump, limitar acceso, guardar una copia independiente y definir retención. pg_restore --list sólo comprueba catálogo legible, no recuperación completa.

## Ensayo de restauración

Crear una base vacía descartable fintrack_restore_drill y un servicio libpq homónimo que apunte exclusivamente a ella. Verificar destino antes de restaurar:

```powershell
$env:PGSERVICE = 'fintrack_restore_drill'
psql --no-psqlrc --command='SELECT current_database(), inet_server_addr();'
# Confirmar que es la base aislada, nunca producción.
pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname='service=fintrack_restore_drill' 'D:/Backups/fintrack-2026-10-18.dump'
if ($LASTEXITCODE -ne 0) { throw 'Restauración falló' }
psql --no-psqlrc --command='SELECT COUNT(*) FROM "User"; SELECT COUNT(*) FROM "Transaction";'
Remove-Item Env:PGSERVICE
```

No añadir --clean contra una base existente. Comparar recuentos con el origen del respaldo y verificar saldos, permisos y transacciones en la aplicación contra la copia aislada. Registrar fecha, duración, versión y resultado. Retirar acceso y eliminar la copia según política de datos después del ensayo autorizado.

## Dependencias

Usar npm ci y locks versionados. Auditar backend y frontend por separado con npm audit; no aplicar --force automáticamente. Los avisos sin parche del tooling CSS se revisan en docs/DEPENDENCIES.md. Compilar sólo fuentes/configuración confiables del repositorio. No procesar CSS de usuarios ni exponer Vite o watchers a redes públicas. El artefacto estático no incluye Tailwind/Node.

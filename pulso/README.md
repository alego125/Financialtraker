# Pulso Finanzas

Aplicación de finanzas personales para uso individual. Requiere Python 3.10 o posterior.

## Inicio

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app
```

Abrí http://127.0.0.1:8000. La documentación REST está en http://127.0.0.1:8000/docs. SQLite se crea automáticamente en `pulso.sqlite3`. Podés cambiar la ruta con la variable `PULSO_DB`.

La base empieza vacía. Desde el resumen podés crear una cuenta o cargar datos de ejemplo. Las cuentas admiten saldos negativos. Un saldo inicial negativo representa deuda.

Los reportes y presupuestos se expresan en ARS. La serie histórica usa el tipo de cambio vigente y las transferencias conservan el cambio aplicado al registrarlas. Las metas se actualizan manualmente y no modifican los saldos de las cuentas.

La PWA se instala desde un navegador compatible en localhost o mediante HTTPS. Con el servidor desconectado se puede abrir la interfaz instalada. Las operaciones y consultas financieras requieren conexión y los datos de la API quedan fuera de la caché. El servidor local carece de autenticación y, por defecto, Uvicorn escucha solo en loopback.

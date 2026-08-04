# Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec

**Date:** 2026-08-03
**Status:** Approved (pending implementation plan)

## Goal

Hoy, al entrar al detalle de una cuenta (`Cuentas → Ver detalle`), las pestañas **Movimientos** y **Transferencias** son de solo lectura. El pedido es poder editar transacciones y transferencias directamente desde ahí, sin tener que ir a otra pantalla.

## Context / Decisions Made During Brainstorming

- **Edición de transacciones**: reusar `TransactionModal` (`frontend/src/components/ui/TransactionModal.jsx`), el mismo componente ya usado en Dashboard y Transacciones — ya soporta modo edición completo (`transaction` prop) vía `PUT /transactions/:id`. No requiere cambios de backend ni un componente nuevo.
- **Edición de transferencias**: edición **completa** (monto, cuenta origen, cuenta destino, moneda, fecha, comentario), no solo fecha. El backend ya tiene `PUT /transfers/:id/full` (`fullUpdate` en `backend/src/controllers/transfers.controller.js:451`) implementado y funcional desde una sesión anterior, pero nunca quedó conectado a ninguna pantalla — se usará ahora por primera vez.
- **Filas de transferencia dentro de "Movimientos"**: la pestaña Movimientos mezcla transacciones sueltas con las dos filas que genera cada transferencia (identificadas por `tx.transferId`). Al clickear editar en una de esas filas, se abre el **editor de transferencias** (no el de transacciones sueltas) — evita el riesgo de editar solo un lado de una transferencia por error.
- **Nuevo endpoint backend necesario**: las filas de "Movimientos" solo tienen `tx.transferId`, no el registro completo de la transferencia (cuentas origen/destino, moneda, etc. en formato editable). La pestaña "Transferencias" del mismo panel sí tiene el registro completo (ya lo trae `AccountTransfersList`), así que ahí no hace falta fetch adicional. Para el caso de Movimientos, se agrega `GET /transfers/:id` al backend (mismo patrón de autorización por `initiatorId` que ya usan `update`/`fullUpdate`/`remove` en `transfers.controller.js`).

## Architecture

### Backend
- **Nuevo endpoint**: `GET /transfers/:id` en `backend/src/routes/transfers.js` → nueva función `getOne` en `backend/src/controllers/transfers.controller.js`, exportada junto a las demás. Busca `prisma.transfer.findFirst({ where: { id, initiatorId: req.userId }, include: INCLUDE })` (mismo `include` que ya usan `list`/`fullUpdate` para traer nombres/colores de cuentas) y responde con el mismo shape enriquecido (`enrichTransfer`) que usa `list`. 404 si no existe o no pertenece al usuario.
- **Sin cambios** en `create`, `update`, `fullUpdate`, `cancel`, `remove` — ya están completos y probados.

### Frontend (todo en `frontend/src/pages/AccountsPage.jsx`)
- **`TransactionModal`**: sin cambios — se importa y usa tal cual ya se usa en otras páginas.
- **`TransferModal`**: se le agrega una prop opcional `transfer`. Cuando está presente:
  - El formulario se precarga con los valores del transfer (`amount`, `date`, `currency`, `comment`, y `fromId`/`toId` reconstruidos a partir de `fromAccountId`/`fromSharedAccountId`/`toAccountId`/`toSharedAccountId` al formato compuesto `"personal::<id>"` / `"shared::<id>"` que el formulario ya usa internamente).
  - El título del modal cambia a "Editar Transferencia" y el botón a "Guardar".
  - `handleSubmit` llama a `PUT /transfers/:id/full` en vez de `POST /transfers` cuando `transfer` está presente.
  - Cuando `transfer` es `null`/`undefined`, el comportamiento es exactamente el actual (creación).
- **`AccountTransfersList`** (pestaña Transferencias del detalle): cada fila gana un botón ✏️ (mismo patrón visual hover que ya usa `TransfersTab`) que abre `TransferModal` con `transfer={t}` (el objeto ya está en memoria, no hace falta fetch).
- **`AccountDetail`** (pestaña Movimientos): cada fila que **no** es transferencia (`!tx.transferId`) gana un botón ✏️ que abre `TransactionModal` con `transaction={tx}`. Cada fila que **sí** es transferencia (`tx.transferId`) gana un botón ✏️ que primero hace `GET /transfers/:id` (con `tx.transferId`) y luego abre `TransferModal` con el resultado.
- **Refresco tras guardar**: tanto el editor de transacciones como el de transferencias, al guardar, deben:
  1. Refrescar la lista de la pestaña activa (`fetchTx`/`fetchTransfers`).
  2. Refrescar el saldo mostrado en la cabecera del panel — mismo mecanismo ya usado para la creación de transferencias (re-fetch de cuentas vía `fetchAll` en `AccountsPage`, y re-set de `detail` con el objeto de cuenta actualizado por id/`isShared`).

## Out of Scope

- Eliminar transacciones/transferencias desde este panel (ya existe en otras pantallas — Transacciones y la pestaña Transferencias general de Cuentas).
- Cambios a `create`/`update`/`cancel`/`remove` de transferencias — ya funcionan.
- Cualquier cambio al modal de "editar fecha" (`EditTransferDateModal`) usado en `TransfersTab` — queda como está, sin relación con este cambio.

## Testing

Sin framework de tests automatizados en este proyecto (convención confirmada). Verificación manual vía navegador: editar una transacción normal desde Movimientos, editar una transferencia desde Transferencias, editar una transferencia desde su fila espejo en Movimientos (confirmando que abre el editor de transferencia y no el de transacción), y confirmar que el saldo de la cabecera se actualiza correctamente en los tres casos.

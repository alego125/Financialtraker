# Financial Tracker — 6 Mejoras (Diseño)

**Fecha:** 2026-05-14  
**Stack:** Node.js + Prisma + PostgreSQL (backend) · Flutter + Provider (mobile)  
**Repositorios:** `expense-tracker/` (backend + frontend web) · `financialtracker_flutter/` (app móvil)

---

## 1. Edición completa de transferencias

### Problema
El endpoint `PUT /transfers/:id` solo actualiza la fecha. No existe forma de modificar monto, cuentas ni moneda sin cancelar y recrear la transferencia.

### Solución backend
Nueva función `fullUpdate` en `transfers.controller.js`:

```
PUT /transfers/:id/full
Body: { amount, date, currency, fromAccountId?, fromSharedAccountId?, toAccountId?, toSharedAccountId?, comment? }
```

Lógica atómica (dentro de `prisma.$transaction`):
1. Verificar que el transfer pertenece al usuario (`initiatorId === userId`)
2. Validar las nuevas cuentas (acceso + no CREDIT como origen + saldo suficiente)
3. Eliminar las 2 `Transaction` vinculadas (`transferId === id`)
4. Actualizar el registro `Transfer` con los nuevos valores
5. Recrear las 2 `Transaction` (EXPENSE en origen, INCOME en destino) con los nuevos datos

Archivos: `backend/src/controllers/transfers.controller.js`, `backend/src/routes/transfers.js`

### Solución Flutter
- `_TransferDetailSheet` → convertir a `StatefulWidget`, añadir botón "Editar" en el header
- `_FullTransferDialog` → añadir parámetro opcional `Transfer? transfer` para precarga (modo edición)
  - En modo edición: título "Editar transferencia", botón "Guardar", llama a `PUT /transfers/:id/full`
  - En modo creación: comportamiento actual
- Añadir campo `date` (DatePicker) y `currency` (ARS/USD) al dialog (también requerido por feature 6)

Archivo: `lib/features/accounts/accounts_page.dart`

---

## 2. Nueva transacción desde detalle de cuenta

### Problema
No hay forma de crear una transacción directamente desde el detalle de una cuenta. El usuario debe salir a la sección Transacciones.

### Solución
`TransactionFormSheet` ya existe como widget reutilizable en `lib/widgets/transaction_form_sheet.dart`. Solo requiere:

1. Añadir parámetros opcionales al constructor:
   - `String? initialAccountId`
   - `String? initialSharedAccountId`
2. En `initState`, si se proveen estos valores, preseleccionar la cuenta y omitirla del dropdown (o marcarla como fija)
3. En `_AccountDetail`: añadir botón "Nueva tx" (ícono `add`) en la fila de action buttons, que invoque `TransactionFormSheet.show(context, initialAccountId: acc.id, onSaved: _loadData)`
4. En `_SharedAccountDetail`: ídem con `initialSharedAccountId`

Archivos: `lib/widgets/transaction_form_sheet.dart`, `lib/features/accounts/accounts_page.dart`

---

## 3. Seleccionar todas las categorías en calculadora

### Problema
El panel de categorías de la calculadora no tiene opción "Todas". El usuario debe seleccionar una por una.

### Solución
Dentro del bloque `if (_catsExpanded)` en `calculator_page.dart`, agregar al inicio del `Wrap` un chip especial "Todas":

- **Estado vacío** (ninguna seleccionada): chip muestra "Todas", al tocar → `_selectedCats = _categories.map((c) => c.id).toList()`
- **Todas seleccionadas**: chip resaltado con check, al tocar → `_selectedCats.clear()`
- **Selección parcial**: chip sin resaltar, al tocar → selecciona las faltantes

El header del desplegable muestra "Todas las categorías" cuando `_selectedCats.length == _categories.length`.

Archivo: `lib/features/calculator/calculator_page.dart`

---

## 4. Pago de tarjeta de crédito

### Problema
El backend (`POST /transfers/pay-credit`) ya está implementado y funciona correctamente. El Flutter `_PayCreditDialog` tiene dos bugs:
1. Llama a `/accounts/${widget.account.id}/pay-credit` (ruta inexistente)
2. No incluye selector de moneda ni cuentas compartidas como origen

### Solución
Corregir `_PayCreditDialog` en `accounts_page.dart`:

1. Cambiar endpoint a `POST /transfers/pay-credit` con body:
   ```json
   {
     "creditAccountId": "<id de la cuenta crédito>",
     "sourceAccountId": "<id de la cuenta origen personal>",
     "sourceSharedAccountId": "<id de la cuenta origen compartida>",
     "amount": 1000,
     "currency": "ARS",
     "date": "2026-05-14"
   }
   ```
2. Añadir `SegmentedButton<String>` ARS / USD para selector de moneda
3. Ampliar el listado de cuentas origen para incluir cuentas compartidas (además de personales)
4. El campo "cuenta origen" es **obligatorio** (quitar opción "Sin especificar")

Archivo: `lib/features/accounts/accounts_page.dart`

---

## 5. Calculadora emergente en campo de monto

### Problema
No hay forma de calcular un monto antes de cargarlo (ej: dividir una factura entre dos personas).

### Solución
Nuevo widget `_CalcModal` (StatefulWidget, solo Flutter, sin cambios de backend):

**Layout:** AlertDialog con título "Calculadora", display del número actual, grid de botones:
```
7  8  9  ÷
4  5  6  ×
1  2  3  −
C  0  .  +
      ✓ (confirmar)
```

**Lógica:**
- Estado: `String _display = '0'`, `double? _operand`, `String? _operator`
- Al presionar operador: guarda `_operand` y `_operator`, limpia display
- Al presionar `✓`: evalúa `_operand <op> double.parse(_display)`, devuelve resultado via `Navigator.pop(context, result)`
- Límite: 12 dígitos en display

**Integración en `TransactionFormSheet`:**
- `IconButton(Icons.calculate_outlined)` sufijo en el `TextField` de monto
- Al tocar: `final result = await showDialog<double>(builder: (_) => _CalcModal())`
- Si `result != null`: `_amount.text = result.toStringAsFixed(2)`

Archivo: `lib/widgets/transaction_form_sheet.dart`

---

## 6. Selección de moneda en transferencias

### Problema
`_FullTransferDialog` no expone el campo `currency` al usuario. El backend ya acepta `currency: 'ARS' | 'USD'` en `POST /transfers`.

### Solución
Añadir en `_FullTransferDialog` (state: `String _currency = 'ARS'`):

```dart
SegmentedButton<String>(
  segments: const [
    ButtonSegment(value: 'ARS', label: Text('ARS')),
    ButtonSegment(value: 'USD', label: Text('USD')),
  ],
  selected: {_currency},
  onSelectionChanged: (s) => setState(() => _currency = s.first),
)
```

Incluir `'currency': _currency` en el body del POST. Este campo también se aplica al modo edición (feature 1).

Archivo: `lib/features/accounts/accounts_page.dart`

---

## Resumen de archivos afectados

| Feature | Archivos backend | Archivos Flutter |
|---|---|---|
| 1. Editar transferencia | `controllers/transfers.controller.js`, `routes/transfers.js` | `accounts_page.dart` |
| 2. Nueva tx desde cuenta | — | `widgets/transaction_form_sheet.dart`, `accounts_page.dart` |
| 3. Todas las categorías | — | `features/calculator/calculator_page.dart` |
| 4. Pago tarjeta (fix + mejoras) | — | `accounts_page.dart` |
| 5. Calculadora de monto | — | `widgets/transaction_form_sheet.dart` |
| 6. Moneda en transferencias | — | `accounts_page.dart` |

## Restricciones y reglas de negocio

- Todas las operaciones que afectan dos cuentas simultáneamente (1, 4) usan `prisma.$transaction` atómica
- Cuenta CREDIT no puede ser origen de transferencia (validación existente, se mantiene)
- Saldo insuficiente retorna HTTP 400 con `code: 'INSUFFICIENT_BALANCE'` (validación existente, se mantiene)
- El campo `currency` en transferencias no implica conversión automática: registra la moneda en que se opera
- La calculadora emergente (5) es puramente client-side, sin llamadas a API

# Account Detail Transfers + Calculator Improvements — Design

**Date:** 2026-07-23
**Status:** Approved

---

## Overview

Four frontend-only UX improvements, no backend changes required (all consumed endpoints already exist):

1. Show transfers (in/out) inside the account detail panel, with an in-place "new transfer" action.
2. Convert the Calculator page's category filter into a multi-select dropdown with "select all".
3. Fix the Calculator's expanded per-category results table: drop the redundant repeated category column, always show the "De" (who) column.
4. Add a popup calculator to the amount field in the transaction form (income + expense).

Stack stays as-is: React/Vite/Tailwind frontend, no new dependencies, no Node/Express changes.

---

## 1. Transfers in Account Detail

**File:** `frontend/src/pages/AccountsPage.jsx` (`AccountDetail` component + state in `AccountsPage`)

- `AccountDetail` gets an internal tab toggle: `Movimientos` / `Transferencias` (same pill-toggle visual pattern already used for the page-level `Cuentas`/`Movimientos` tabs).
- **Movimientos** tab: existing transaction list, `fetchTx` stops passing `includeTransfers=true` (transfers no longer duplicated here now that they have their own tab).
- **Transferencias** tab (new): fetches `GET /transfers?accountId=X` or `?sharedAccountId=X` (endpoint already supports this filter, used today by `TransfersTab`). Each row shows:
  - Direction badge: ⬆ Entrante (green) if this account is the transfer's `to*`, ⬇ Saliente (rose) if it's the `from*`.
  - Counterparty name (`t.fromName`/`t.toName`, whichever side isn't this account), amount (currency-aware via `fmtARS`/`fmtUSD`), date, comment.
  - Same pagination footer style as the transaction list (Pág X/Y, ← Ant / Sig →).
- A **"+ Nueva Transferencia"** button sits in the tab-switcher row (visible regardless of which inner tab is active):
  - `TransferModal` gets a new optional prop `initialFromId` (e.g. `personal::<id>` or `shared::<id>`) to preselect the "Cuenta origen" field.
  - Click behavior: close the `AccountDetail` drawer, open `TransferModal` prefilled with this account as origin. On save (or cancel), reopen `AccountDetail` for the same account with fresh data — mirrors the existing pattern where Editar/Comprar USD/Pagar Tarjeta also close the drawer before opening their modal, but adds a "reopen after" step so the user lands back in the account context automatically.
  - New state in `AccountsPage`: track which account (if any) should be reopened after the transfer modal closes.

No backend changes — `GET /transfers` already accepts `accountId`/`sharedAccountId`.

---

## 2. Calculator category multi-select dropdown

**Files:** `frontend/src/pages/CalculatorPage.jsx` (consumer) + new `frontend/src/components/ui/CategoryMultiSelect.jsx`

- Extract a new `CategoryMultiSelect` component: a button showing a summary (`Todas las categorías` when `selectedCats` is empty, `Todas (N)` when all are explicitly selected, `N seleccionadas` otherwise) that opens a dropdown panel.
- Panel contents: a pinned **"Seleccionar todas"** row at the top (checkbox-style), then the existing per-category rows (color dot + name, tri-color indicator for mine/partner still shown in `both` mode) each with its own checkbox.
- "Seleccionar todas" toggles: if not all currently selected → selects all `displayCats` ids; if all already selected → clears the selection (acts as a toggle-all). Individual rows remain independently togglable after using "select all".
- `CalculatorPage.jsx` keeps its existing state (`selectedCats`, `toggleCat`, `displayCats`, source-mode filtering) untouched — only the rendering of the category picker changes, swapped for `<CategoryMultiSelect categories={displayCats} selected={selectedCats} onChange={setSelectedCats} bothMode={stype === 'both'} partnerName={...} />`.

---

## 3. Calculator expanded results table fix

**File:** `frontend/src/pages/CalculatorPage.jsx` (the per-category expanded `<table>` inside `result.byCategory.map`)

Current columns: `Fecha | [De, only in 'both' mode] | Categoría | Monto | Comentario`. The `Categoría` column is redundant (the table is already nested under that category's expanded header) and `De` disappears outside `both` mode even though the info ("¿es mío o del partner?") is still meaningful and constant per row in that case.

Change:
- Remove the `Categoría` header + cell entirely (frees width, mainly benefiting `Comentario` which is currently visually truncated).
- Always render the `De` column (drop the `stype === 'both'` guard on both `<th>` and `<td>`). Value logic: `stype === 'mine'` → always `Yo`; `stype === 'partner'` → always the active partner's first name; `stype === 'both'` → per-row via existing `tx._fromPartner` flag (unchanged pill styling: emerald "Yo" / orange partner name).
- Resulting columns: `Fecha | De | Monto | Comentario`.

---

## 4. Popup calculator on the amount field

**New file:** `frontend/src/components/ui/MiniCalculatorModal.jsx`
**Modified:** `frontend/src/components/ui/TransactionModal.jsx`

- `MiniCalculatorModal` uses the existing `Modal` component (`size="sm"`), with a readout display and a standard keypad (0-9, `.`, `+ − × ÷`, `( )`, `C`, `⌫`, `=`).
- Expression evaluation uses a small hand-written recursive-descent parser restricted to digits, `.`, `+ - * / ( )` — explicitly **not** `eval()` or `Function()`, to avoid arbitrary code execution from user input.
- `onUseResult(value)` prop: called with the computed numeric result when the user taps "Usar este resultado"; caller is responsible for closing and applying the value.
- `TransactionModal.jsx`: add a small 🧮 button next to the "Monto" input (shared by both INCOME and EXPENSE, so one integration point covers both flows per the request). On result, calls `set('amount', String(result))`.
- Scope: wired only into `TransactionModal` per the request. Built as a standalone, reusable component so it can be added to `TransferModal`/`ExchangeModal`/`PayCreditModal` later without rework, but that's out of scope for this change.

---

## Testing / verification

- Manual verification in the browser (dev server) for all four changes: no automated test suite exists for this frontend today, consistent with the rest of the app.
- Verify balance-sensitive flows (transfer creation from account detail) still hit the existing `INSUFFICIENT_BALANCE` error path unchanged.
- Verify the calculator's expression parser rejects non-numeric/operator input rather than throwing an unhandled exception.

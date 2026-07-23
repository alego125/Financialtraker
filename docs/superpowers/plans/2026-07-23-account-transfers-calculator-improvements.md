# Account Transfers + Calculator Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show transfers in the account detail panel with an in-place "new transfer" action, turn the Calculator's category filter into a multi-select dropdown with "select all", fix the Calculator's expanded results table (drop redundant category column, always show "De"), and add a popup calculator to the transaction amount field.

**Architecture:** All changes are frontend-only React components in the existing Vite app. No backend/API changes — every network call used here already exists (`GET /transfers?accountId=`/`sharedAccountId=`, `GET /categories`, `GET /transactions`). Two new standalone `components/ui/` files (`CategoryMultiSelect.jsx`, `MiniCalculatorModal.jsx`); the rest are surgical edits to `AccountsPage.jsx`, `CalculatorPage.jsx`, and `TransactionModal.jsx`.

**Tech Stack:** React 18, Vite, Tailwind (CSS variables), Axios (`services/api.js`). No new dependencies.

**Testing note:** This frontend has no automated test framework configured (no Jest/Vitest/RTL in `frontend/package.json`) and no existing test files — every other feature in this app is verified manually in the browser. This plan follows that same convention: each task's "verify" step is a manual check via the Vite dev server instead of an automated test run. Spec: `docs/superpowers/specs/2026-07-23-account-transfers-calculator-improvements-design.md`.

---

## Task 1: `TransferModal` accepts a preselected origin account

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (the `TransferModal` function, lines ~266-272)

- [ ] **Step 1: Add the `initialFromId` prop and use it as the default `fromId`**

Replace:
```jsx
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts, partnerAccounts }) {
  const df = { amount:'', date:localToday(), comment:'', fromId:'', toId:'', currency:'ARS' };
  const [form, setForm]         = useState(df);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isBalErr, setIsBalErr] = useState(false);
  useEffect(() => { if (open) { setForm(df); setError(''); setIsBalErr(false); } }, [open]);
```

with:
```jsx
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts, partnerAccounts, initialFromId }) {
  const getDF = () => ({ amount:'', date:localToday(), comment:'', fromId: initialFromId || '', toId:'', currency:'ARS' });
  const [form, setForm]         = useState(getDF);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isBalErr, setIsBalErr] = useState(false);
  useEffect(() => { if (open) { setForm(getDF()); setError(''); setIsBalErr(false); } }, [open, initialFromId]);
```

- [ ] **Step 2: Verify no regression in the existing "Movimientos" tab flow**

Run the frontend dev server (`cd frontend && npm run dev`), open the app, go to **Cuentas → Movimientos → + Nueva**. The modal must still open with an empty "Cuenta origen" (since `TransfersTab`'s `onNew` doesn't pass `initialFromId` yet — that's expected, nothing calls this prop until Task 3).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: TransferModal admite cuenta origen preseleccionada"
```

---

## Task 2: Transfers list inside the account detail panel

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (the `AccountDetail` function, lines ~519-658)

- [ ] **Step 1: Add a new `AccountTransfersList` component right before `AccountDetail`**

Insert this new function directly above `function AccountDetail(...)`:

```jsx
// ── Account Transfers List (used inside AccountDetail) ────────────────────────
function AccountTransfersList({ accountId, isShared }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [total, setTotal]         = useState(0);

  const fetchTransfers = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const param = isShared ? `sharedAccountId=${accountId}` : `accountId=${accountId}`;
      const { data } = await api.get(`/transfers?${param}&page=${pg}&limit=15`);
      setTransfers(data.data); setPages(data.pagination.pages);
      setTotal(data.pagination.total); setPage(pg);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [accountId, isShared]);

  useEffect(() => { fetchTransfers(1); }, [fetchTransfers]);

  if (loading) return <div className="flex items-center justify-center h-32 text-[var(--subtle)] text-sm">Cargando...</div>;

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-6">
        <div className="text-3xl mb-2">↔️</div>
        <div className="text-[var(--muted)] text-sm">Sin transferencias</div>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-[var(--border)]">
        {transfers.map(t => {
          const isOutgoing = isShared ? t.fromSharedAccountId === accountId : t.fromAccountId === accountId;
          const counterparty = isOutgoing ? t.toName : t.fromName;
          const isUSD = t.currency === 'USD';
          return (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface3/40 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                isOutgoing ? 'bg-expense/20 text-expense' : 'bg-income/20 text-income'}`}>
                {isOutgoing ? '⬇' : '⬆'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--text2)] truncate">
                    {isOutgoing ? 'Saliente' : 'Entrante'} — {counterparty}
                  </span>
                  {isUSD && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">USD</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[var(--subtle)] font-mono">{formatDate(t.date)}</span>
                  {t.comment && <span className="text-xs text-[var(--subtle)] break-words">{t.comment}</span>}
                </div>
              </div>
              <div className={`font-mono font-bold text-sm flex-shrink-0 ${isOutgoing ? 'text-expense' : 'text-income'}`}>
                {isOutgoing ? '-' : '+'}{isUSD ? fmtUSD(t.amount) : fmtARS(t.amount)}
              </div>
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
          <span className="text-xs text-[var(--subtle)] font-mono">Pág {page}/{pages} · {total} transferencias</span>
          <div className="flex gap-2">
            <button disabled={page<=1} onClick={()=>fetchTransfers(page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
            <button disabled={page>=pages} onClick={()=>fetchTransfers(page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add the inner tab toggle to `AccountDetail` and stop mixing transfers into "Movimientos"**

In `AccountDetail`, replace the state declarations:
```jsx
function AccountDetail({ account, isShared, onClose, onEdit, onDelete, onExchange, onPayCredit }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [total, setTotal]               = useState(0);
  const PT = { EFECTIVO:'💵', DEBITO:'💳 D', CREDITO:'💳 C', TRANSFERENCIA:'🏦' };

  const fetchTx = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const param = isShared ? `sharedAccountId=${account.id}` : `accountId=${account.id}`;
      const { data } = await api.get(`/transactions?${param}&includeTransfers=true&page=${pg}&limit=15&sortBy=date&sortOrder=desc`);
      setTransactions(data.data); setPages(data.pagination.pages);
      setTotal(data.pagination.total); setPage(pg);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [account.id, isShared]);

  useEffect(() => { fetchTx(1); }, [fetchTx]);
```

with:
```jsx
function AccountDetail({ account, isShared, onClose, onEdit, onDelete, onExchange, onPayCredit, onNewTransfer }) {
  const [innerTab, setInnerTab]         = useState('movements'); // 'movements' | 'transfers'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [total, setTotal]               = useState(0);
  const PT = { EFECTIVO:'💵', DEBITO:'💳 D', CREDITO:'💳 C', TRANSFERENCIA:'🏦' };

  const fetchTx = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const param = isShared ? `sharedAccountId=${account.id}` : `accountId=${account.id}`;
      const { data } = await api.get(`/transactions?${param}&page=${pg}&limit=15&sortBy=date&sortOrder=desc`);
      setTransactions(data.data); setPages(data.pagination.pages);
      setTotal(data.pagination.total); setPage(pg);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [account.id, isShared]);

  useEffect(() => { fetchTx(1); }, [fetchTx]);
```

(Note: `total` now reflects only non-transfer transactions — this only feeds the "Transacciones" count shown in the balance row above, which is fine since it already meant "movimientos", not transfers.)

- [ ] **Step 3: Insert the tab switcher + "+ Nueva Transferencia" button, and branch the content area**

Replace the block that starts the scrollable content area:
```jsx
        <div className="flex-1 overflow-y-auto">
          {loading ? (
```
with:
```jsx
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)]">
            {[['movements','Movimientos'],['transfers','Transferencias']].map(([v,l]) => (
              <button key={v} onClick={() => setInnerTab(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${
                  innerTab===v?'bg-accent text-[var(--text)]':'text-[var(--muted)] hover:text-[var(--text)]'}`}>{l}</button>
            ))}
          </div>
          <button onClick={onNewTransfer} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">+ Nueva Transferencia</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {innerTab === 'transfers' ? (
            <AccountTransfersList accountId={account.id} isShared={isShared} />
          ) : loading ? (
```

- [ ] **Step 4: Close the branch correctly**

The existing `AccountDetail` render already ends the "Movimientos" branch with the transaction-list JSX followed by:
```jsx
          )}
        </div>

        {pages > 1 && (
```
Leave that structure as-is — the added `innerTab === 'transfers' ? (...) : loading ? (...)` ternary from Step 3 simply adds one more branch before the existing `loading ? ... : transactions.length === 0 ? ... : (...)` chain, so the existing closing `)}` still balances correctly. Also wrap the pagination footer so it only shows for the Movimientos tab:

Replace:
```jsx
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <span className="text-xs text-[var(--subtle)] font-mono">Pág {page}/{pages}</span>
```
with:
```jsx
        {innerTab === 'movements' && pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <span className="text-xs text-[var(--subtle)] font-mono">Pág {page}/{pages}</span>
```

- [ ] **Step 5: Verify in the browser**

Run `cd frontend && npm run dev`, open **Cuentas**, click any account with existing transfers (create one first via **Movimientos → + Nueva** if needed), open its detail panel:
- "Movimientos" tab shows only regular transactions (no `↔` transfer rows mixed in anymore).
- "Transferencias" tab shows the transfer(s) for that account with the correct ⬆/⬇ direction and counterparty name.
- The "+ Nueva Transferencia" button renders but does nothing yet (wired in Task 3).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: pestaña de transferencias en el detalle de cuenta"
```

---

## Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (the `AccountsPage` function, lines ~996-1166)

- [ ] **Step 1: Replace the boolean `transferModal` state with an object that carries prefill + reopen info**

Replace:
```jsx
  const [transferModal, setTransferModal] = useState(false);
```
with:
```jsx
  const [transferModal, setTransferModal] = useState({ open:false, initialFromId:'', reopenAccount:null });
```

- [ ] **Step 2: Update the "Movimientos" tab's plain "+ Nueva" button to use the new state shape**

Replace:
```jsx
      {activeTab === 'transfers' && (
        <TransfersTab
          accounts={accounts}
          sharedAccounts={sharedAccounts}
          onNew={() => setTransferModal(true)}
        />
      )}
```
with:
```jsx
      {activeTab === 'transfers' && (
        <TransfersTab
          accounts={accounts}
          sharedAccounts={sharedAccounts}
          onNew={() => setTransferModal({ open:true, initialFromId:'', reopenAccount:null })}
        />
      )}
```

- [ ] **Step 3: Wire `onNewTransfer` on the detail drawer**

Replace:
```jsx
      {/* Detail drawer */}
      {detail && (
        <AccountDetail
          account={detail.account}
          isShared={detail.isShared}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            setModal({ open:true, account:detail.account, isShared:detail.isShared });
          }}
          onDelete={() => handleDelete(detail.account.id, detail.isShared)}
          onExchange={() => {
            setDetail(null);
            setExchangeTarget({ account:detail.account, isShared:detail.isShared });
          }}
          onPayCredit={() => {
            setDetail(null);
            setPayCreditTarget({ account: detail.account, isShared: detail.isShared });
          }}
        />
      )}
```
with:
```jsx
      {/* Detail drawer */}
      {detail && (
        <AccountDetail
          account={detail.account}
          isShared={detail.isShared}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            setModal({ open:true, account:detail.account, isShared:detail.isShared });
          }}
          onDelete={() => handleDelete(detail.account.id, detail.isShared)}
          onExchange={() => {
            setDetail(null);
            setExchangeTarget({ account:detail.account, isShared:detail.isShared });
          }}
          onPayCredit={() => {
            setDetail(null);
            setPayCreditTarget({ account: detail.account, isShared: detail.isShared });
          }}
          onNewTransfer={() => {
            const initialFromId = `${detail.isShared ? 'shared' : 'personal'}::${detail.account.id}`;
            const reopenAccount = { account: detail.account, isShared: detail.isShared };
            setDetail(null);
            setTransferModal({ open:true, initialFromId, reopenAccount });
          }}
        />
      )}
```

- [ ] **Step 4: Update the `TransferModal` usage to consume the new state shape and reopen the detail panel after close**

Replace:
```jsx
      <TransferModal
        open={transferModal}
        accounts={accounts}
        sharedAccounts={sharedAccounts}
        partnerAccounts={partnerAccounts}
        onClose={() => setTransferModal(false)}
        onSaved={fetchAll}
      />
```
with:
```jsx
      <TransferModal
        open={transferModal.open}
        accounts={accounts}
        sharedAccounts={sharedAccounts}
        partnerAccounts={partnerAccounts}
        initialFromId={transferModal.initialFromId}
        onClose={() => {
          const reopenAccount = transferModal.reopenAccount;
          setTransferModal({ open:false, initialFromId:'', reopenAccount:null });
          if (reopenAccount) setDetail(reopenAccount);
        }}
        onSaved={fetchAll}
      />
```

(`TransferModal`'s own `handleSubmit` already calls `onSaved(); onClose();` on success, and its Cancel button calls `onClose` directly — both paths correctly reset state and reopen the originating account detail via this single `onClose` handler.)

- [ ] **Step 5: Verify in the browser**

1. Open **Cuentas**, click into any account, confirm the tab switcher and "+ Nueva Transferencia" button from Task 2 render.
2. Click **+ Nueva Transferencia**: the detail drawer closes, `TransferModal` opens with "Cuenta origen" already set to that account.
3. Complete and submit a transfer: the modal closes and the same account's detail panel reopens automatically, with the new transfer visible under its "Transferencias" tab.
4. Click **Cancelar** instead of submitting: same reopen behavior (detail panel comes back, no transfer created).
5. From **Cuentas → Movimientos → + Nueva** (unrelated to any account detail), confirm the modal still opens with **no** preselected origin and does **not** attempt to reopen any detail panel afterward.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: crear transferencia desde el detalle de cuenta sin perder el contexto"
```

---

## Task 4: `CategoryMultiSelect` component

**Files:**
- Create: `frontend/src/components/ui/CategoryMultiSelect.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useState, useRef, useEffect } from 'react';

export default function CategoryMultiSelect({ categories, selected, onChange, showOwner, partnerName }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = categories.length > 0 && selected.length === categories.length;

  const toggleAll = () => onChange(allSelected ? [] : categories.map(c => c.id));
  const toggleOne = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const label = categories.length === 0
    ? 'Sin categorías disponibles'
    : allSelected
    ? `Todas (${categories.length})`
    : selected.length === 0
    ? 'Todas las categorías'
    : `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={categories.length === 0}
        onClick={() => setOpen(o => !o)}
        className="input text-xs w-full flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{label}</span>
        <span className="text-[var(--subtle)] ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && categories.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-surface2 shadow-2xl">
          {showOwner && (
            <div className="flex gap-3 px-3 py-2 border-b border-[var(--border)]">
              <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Mías
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>{partnerName || 'Partner'}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text2)] hover:bg-surface3 border-b border-[var(--border)]"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
              {allSelected && '✓'}
            </span>
            Seleccionar todas
          </button>
          {categories.map(c => {
            const isChecked = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleOne(c.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text2)] hover:bg-surface3"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
                  {isChecked && '✓'}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#8A8478' }} />
                <span className="truncate flex-1 text-left">{c.name}</span>
                {showOwner && (
                  <span className={`text-xs flex-shrink-0 ${c.owner === 'mine' ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {c.owner === 'mine' ? '(yo)' : `(${(partnerName || '').split(' ')[0]})`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: build succeeds (this component isn't wired into any page yet, so this only checks for syntax errors — Vite will still compile unused files that are valid JS/JSX; if not imported anywhere yet, skip this and instead run `npx eslint src/components/ui/CategoryMultiSelect.jsx` if ESLint is configured, or proceed to Task 5 where it becomes reachable and gets a real browser check).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/CategoryMultiSelect.jsx
git commit -m "feat: componente CategoryMultiSelect con opción seleccionar todas"
```

---

## Task 5: Wire `CategoryMultiSelect` into the Calculator page

**Files:**
- Modify: `frontend/src/pages/CalculatorPage.jsx`

- [ ] **Step 1: Import the new component**

At the top of the file, alongside the existing imports:
```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
```
add:
```jsx
import CategoryMultiSelect from '../components/ui/CategoryMultiSelect';
```

- [ ] **Step 2: Replace the categories filter block**

Replace the entire block (from the `{/* Categorías */}` comment through its closing `</div>`, currently containing the label, the loading spinner, the "both" legend, the chip list, and the "sin selección" hints):
```jsx
          {/* Categorías */}
          <div>
            <label className="label">
              Categorías
              {selectedCats.length > 0 && (
                <span className="ml-2 text-accent-light text-xs">({selectedCats.length} seleccionadas)</span>
              )}
            </label>

            {/* Spinner mientras carga categorías del partner */}
            {loadingPartnerCats && stype !== 'mine' && (
              <p className="text-xs text-[var(--subtle)] mt-2">Cargando categorías...</p>
            )}

            {!loadingPartnerCats && (
              <>
                {/* Leyenda de colores en modo 'both' */}
                {stype === 'both' && displayCats.length > 0 && (
                  <div className="flex gap-3 mt-1 mb-2">
                    <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Mis categorías
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Categorías de {activePartner?.partner?.name}
                    </span>
                  </div>
                )}

                <div className="mt-1 flex flex-wrap gap-2">
                  {displayCats.map(c => {
                    const isSelected = selectedCats.includes(c.id);
                    const isMine     = c.owner === 'mine';
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCat(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? isMine
                              ? 'border-emerald-500 bg-emerald-500/15 text-[var(--text)]'
                              : 'border-orange-400 bg-orange-400/15 text-[var(--text)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-accent/40'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#8A8478' }} />
                        {c.name}
                        {/* En modo 'both' indicamos el dueño en el chip */}
                        {stype === 'both' && (
                          <span className={`text-xs ml-0.5 ${isMine ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {isMine ? '(yo)' : `(${activePartner?.partner?.name?.split(' ')[0]})`}
                          </span>
                        )}
                        {isSelected && <span className="text-accent-light ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                  {selectedCats.length > 0 && (
                    <button onClick={() => setSelectedCats([])} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] px-2">
                      ✕ limpiar
                    </button>
                  )}
                </div>

                {displayCats.length === 0 && !loadingPartnerCats && (
                  <p className="text-xs text-[var(--subtle)] mt-1">
                    {stype !== 'mine' ? 'Sin categorías disponibles para este período' : 'Sin selección = todas las categorías'}
                  </p>
                )}
                {displayCats.length > 0 && selectedCats.length === 0 && (
                  <p className="text-xs text-[var(--subtle)] mt-1">Sin selección = todas las categorías</p>
                )}
              </>
            )}
          </div>
```

with:
```jsx
          {/* Categorías */}
          <div>
            <label className="label">Categorías</label>

            {loadingPartnerCats && stype !== 'mine' ? (
              <p className="text-xs text-[var(--subtle)] mt-2">Cargando categorías...</p>
            ) : (
              <div className="mt-1">
                <CategoryMultiSelect
                  categories={displayCats}
                  selected={selectedCats}
                  onChange={setSelectedCats}
                  showOwner={stype === 'both'}
                  partnerName={activePartner?.partner?.name}
                />
                {selectedCats.length > 0 && (
                  <button onClick={() => setSelectedCats([])} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] mt-1.5">
                    ✕ limpiar selección
                  </button>
                )}
                <p className="text-xs text-[var(--subtle)] mt-1.5">
                  {displayCats.length === 0
                    ? (stype !== 'mine' ? 'Sin categorías disponibles para este período' : 'Sin selección = todas las categorías')
                    : selectedCats.length === 0
                    ? 'Sin selección = todas las categorías'
                    : null}
                </p>
              </div>
            )}
          </div>
```

- [ ] **Step 3: Verify in the browser**

Run `cd frontend && npm run dev`, go to **Calculadora**:
- The category filter now renders as a single dropdown button instead of a wall of chips.
- Clicking it opens a panel with a "Seleccionar todas" row + individual checkboxes.
- Clicking "Seleccionar todas" checks every category; clicking it again clears all; unchecking one after "select all" leaves the rest checked.
- With an active partnership, switch source to "Ambos con..." and confirm the mine/partner legend and per-row owner tag still show correctly inside the dropdown.
- Clicking outside the dropdown closes it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CalculatorPage.jsx
git commit -m "feat: filtro de categorías de la calculadora como dropdown multi-select"
```

---

## Task 6: Fix the Calculator's expanded per-category results table

**Files:**
- Modify: `frontend/src/pages/CalculatorPage.jsx` (the expanded table inside `result.byCategory.map`)

- [ ] **Step 1: Replace the table header**

Replace:
```jsx
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-surface3 border-b border-[var(--border)]">
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Fecha</th>
                                  {stype === 'both' && (
                                    <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">De</th>
                                  )}
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Categoría</th>
                                  <th className="text-right px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Monto</th>
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Comentario</th>
                                </tr>
                              </thead>
```
with:
```jsx
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-surface3 border-b border-[var(--border)]">
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Fecha</th>
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">De</th>
                                  <th className="text-right px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Monto</th>
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Comentario</th>
                                </tr>
                              </thead>
```

- [ ] **Step 2: Replace the table body row**

Replace:
```jsx
                              <tbody className="divide-y divide-[var(--border)]">
                                {cat.transactions.map(tx => (
                                  <tr key={tx.id + (tx._fromPartner ? '-p' : '-m')} className="hover:bg-surface3/50 transition-colors">
                                    <td className="px-3 py-2 font-mono text-[var(--muted)] whitespace-nowrap">{fmtDate(tx.date)}</td>
                                    {stype === 'both' && (
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${tx._fromPartner ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                          {tx._fromPartner ? (activePartner?.partner?.name?.split(' ')[0] || 'Partner') : 'Yo'}
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-[var(--text2)]">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                        {cat.name}
                                      </span>
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                                      {tx.currency === 'USD' ? fmtUSD(tx.amount) : fmtARS(tx.amount)}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--muted)] break-words min-w-0">
                                      {tx.comment || <span className="text-[var(--subtle)] italic">sin comentario</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
```
with:
```jsx
                              <tbody className="divide-y divide-[var(--border)]">
                                {cat.transactions.map(tx => {
                                  const isFromPartner = stype === 'partner' ? true : stype === 'mine' ? false : !!tx._fromPartner;
                                  return (
                                    <tr key={tx.id + (tx._fromPartner ? '-p' : '-m')} className="hover:bg-surface3/50 transition-colors">
                                      <td className="px-3 py-2 font-mono text-[var(--muted)] whitespace-nowrap">{fmtDate(tx.date)}</td>
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isFromPartner ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                          {isFromPartner ? (activePartner?.partner?.name?.split(' ')[0] || 'Partner') : 'Yo'}
                                        </span>
                                      </td>
                                      <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                                        {tx.currency === 'USD' ? fmtUSD(tx.amount) : fmtARS(tx.amount)}
                                      </td>
                                      <td className="px-3 py-2 text-[var(--muted)] break-words min-w-0">
                                        {tx.comment || <span className="text-[var(--subtle)] italic">sin comentario</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
```

- [ ] **Step 3: Verify in the browser**

Run `cd frontend && npm run dev`, go to **Calculadora**, run a calculation, expand a category:
- Table now shows `Fecha | De | Monto | Comentario` (no more repeated category name column).
- In "Mis transacciones" mode, "De" always shows "Yo". In partner-only mode, it always shows the partner's name. In "Ambos" mode, it varies per row as before.
- Comentario column has visibly more room and is less truncated.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CalculatorPage.jsx
git commit -m "fix: tabla de resultados de calculadora sin columna Categoría redundante"
```

---

## Task 7: `MiniCalculatorModal` component with a safe expression parser

**Files:**
- Create: `frontend/src/components/ui/MiniCalculatorModal.jsx`

- [ ] **Step 1: Write the expression parser and component**

```jsx
import { useState } from 'react';
import Modal from './Modal';

// Recursive-descent parser for +,-,*,/,(),. only — intentionally not eval()/Function()
// to avoid executing arbitrary input.
export function evaluateExpression(input) {
  const expr = String(input).replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!expr) return null;
  if (!/^[0-9+\-*/().]+$/.test(expr)) throw new Error('Expresión inválida');

  let pos = 0;
  const peek = () => expr[pos];
  const isDigit = c => c >= '0' && c <= '9';

  function parseNumber() {
    const start = pos;
    while (pos < expr.length && (isDigit(peek()) || peek() === '.')) pos++;
    if (start === pos) throw new Error('Número esperado');
    return parseFloat(expr.slice(start, pos));
  }
  function parseFactor() {
    if (peek() === '-') { pos++; return -parseFactor(); }
    if (peek() === '+') { pos++; return parseFactor(); }
    if (peek() === '(') {
      pos++;
      const val = parseExpr();
      if (peek() !== ')') throw new Error('Falta cerrar paréntesis');
      pos++;
      return val;
    }
    return parseNumber();
  }
  function parseTerm() {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = peek(); pos++;
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : val / rhs;
    }
    return val;
  }
  function parseExpr() {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek(); pos++;
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  const result = parseExpr();
  if (pos !== expr.length) throw new Error('Expresión inválida');
  if (!isFinite(result)) throw new Error('Resultado inválido');
  return result;
}

const KEYS = [
  ['7','8','9','÷'],
  ['4','5','6','×'],
  ['1','2','3','-'],
  ['0','.','⌫','+'],
];

export default function MiniCalculatorModal({ open, onClose, onUseResult }) {
  const [expr, setExpr]   = useState('');
  const [error, setError] = useState('');

  const press = (key) => {
    setError('');
    if (key === '⌫') { setExpr(e => e.slice(0, -1)); return; }
    setExpr(e => e + key);
  };

  const clear = () => { setExpr(''); setError(''); };

  const currentResult = (() => {
    try { return evaluateExpression(expr); } catch { return null; }
  })();

  const handleUse = () => {
    try {
      const result = evaluateExpression(expr);
      if (result === null) return;
      onUseResult(result);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Calculadora" size="sm">
      <div className="space-y-3">
        <div className="bg-surface3 rounded-xl p-3 text-right">
          <div className="text-xs text-[var(--subtle)] font-mono min-h-4 truncate">{expr || '0'}</div>
          <div className="text-xl font-mono font-bold text-[var(--text)] min-h-7">
            {currentResult !== null ? currentResult : '—'}
          </div>
        </div>
        {error && <div className="text-xs text-expense">{error}</div>}
        <div className="grid grid-cols-4 gap-2">
          {KEYS.flat().map(k => (
            <button key={k} type="button" onClick={() => press(k)}
              className="btn-secondary py-2.5 text-sm font-mono">{k}</button>
          ))}
          <button type="button" onClick={() => press('(')} className="btn-secondary py-2.5 text-sm font-mono">(</button>
          <button type="button" onClick={() => press(')')} className="btn-secondary py-2.5 text-sm font-mono">)</button>
          <button type="button" onClick={clear} className="btn-danger py-2.5 text-sm col-span-2">C</button>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          <button type="button" onClick={handleUse} disabled={currentResult === null} className="btn-primary flex-1 disabled:opacity-50">
            Usar este resultado
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Manually verify the parser logic**

This project has no test runner, so verify by temporarily calling the function from the browser console instead of writing an automated test:

1. Run `cd frontend && npm run dev`.
2. Add a throwaway `console.log` reachable from any already-imported module, or simplest: open the component in Task 8's wired-up UI once done and type expressions directly in the popup (`2+2*3` should show `8`, `(2+3)*4` should show `20`, `10/0` should show the error "Resultado inválido", `2+` should show no result until closed with `)` or more digits typed).
3. Confirm no uncaught exception appears in the browser console for any malformed input (e.g. typing just `(` then clicking "Usar este resultado" — button should be disabled since `currentResult` is `null`/errors out).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/MiniCalculatorModal.jsx
git commit -m "feat: componente MiniCalculatorModal con parser aritmético propio"
```

---

## Task 8: Wire the popup calculator into the transaction amount field

**Files:**
- Modify: `frontend/src/components/ui/TransactionModal.jsx`

- [ ] **Step 1: Import the new component and add local state**

Replace:
```jsx
import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from './Modal';
```
with:
```jsx
import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from './Modal';
import MiniCalculatorModal from './MiniCalculatorModal';
```

Replace:
```jsx
  const [isBalanceError, setIsBalanceError] = useState(false);
  const [showPass, setShowPass]     = useState(false); // unused here but pattern is set
```
with:
```jsx
  const [isBalanceError, setIsBalanceError] = useState(false);
  const [showPass, setShowPass]     = useState(false); // unused here but pattern is set
  const [showCalc, setShowCalc]     = useState(false);
```

- [ ] **Step 2: Add the 🧮 button next to the Monto input**

Replace:
```jsx
          <div className="col-span-2">
            <label className="label">Monto</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
```
with:
```jsx
          <div className="col-span-2">
            <label className="label">Monto</label>
            <div className="flex gap-2">
              <input type="number" step="0.01" min="0.01" className="input flex-1" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
              <button type="button" onClick={() => setShowCalc(true)}
                className="btn-secondary px-3 flex-shrink-0" title="Calculadora">🧮</button>
            </div>
          </div>
```

- [ ] **Step 3: Render the popup and wire its result back into the form**

Replace the closing of the component, currently:
```jsx
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : transaction ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```
with:
```jsx
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : transaction ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
      <MiniCalculatorModal
        open={showCalc}
        onClose={() => setShowCalc(false)}
        onUseResult={(result) => {
          set('amount', String(result));
          setShowCalc(false);
        }}
      />
    </Modal>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd frontend && npm run dev`, go to **Transacciones → + Nueva** (or the equivalent add-transaction entry point):
- The 🧮 button appears next to Monto for both "Ingreso" and "Gasto" (same shared field).
- Clicking it opens the calculator popup on top of the transaction form.
- Typing `1500+250*2` and clicking "Usar este resultado" closes the popup and fills Monto with `2000`.
- The rest of the form (category, account, currency, date) is untouched by opening/closing the calculator.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/TransactionModal.jsx
git commit -m "feat: calculadora emergente en el campo Monto del formulario de transacciones"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Task 1-3 → spec §1 (account detail transfers + inline creation). Task 4-5 → spec §2 (multi-select dropdown). Task 6 → spec §3 (table fix, both sub-decisions: drop Categoría, always show De). Task 7-8 → spec §4 (popup calculator, no `eval()`, wired only into `TransactionModal`). No spec section left uncovered.
- **Type/prop consistency:** `initialFromId` (Task 1) is consumed identically in Task 3. `onNewTransfer` prop name matches between Task 2 (added to `AccountDetail`'s signature) and Task 3 (passed by `AccountsPage`). `transferModal` state shape (`{open, initialFromId, reopenAccount}`) is introduced once in Task 3 and used consistently in both places it's referenced (TransfersTab's `onNew`, `AccountDetail`'s `onNewTransfer`, and the `TransferModal` JSX). `CategoryMultiSelect` props (`categories, selected, onChange, showOwner, partnerName`) match between Task 4's definition and Task 5's usage. `evaluateExpression` is exported once (Task 7) — Task 8 doesn't reimplement it, it only consumes `MiniCalculatorModal`'s `onUseResult` callback.
- **No backend tasks needed** — confirmed every consumed endpoint (`GET /transfers`, `GET /categories`, `GET /transactions`) already exists and already supports the required filters.

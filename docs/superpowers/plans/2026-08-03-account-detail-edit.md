# Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar transacciones y transferencias directamente desde las pestañas "Movimientos" y "Transferencias" del panel de detalle de cuenta (`Cuentas → Ver detalle`), sin salir de esa pantalla.

**Architecture:** Reuso de `TransactionModal` (ya soporta edición) para transacciones. Extensión de `TransferModal` (hoy solo crea) para soportar edición completa vía el endpoint `PUT /transfers/:id/full` que ya existe en el backend pero nunca quedó conectado a una pantalla. Un endpoint nuevo, `GET /transfers/:id`, permite abrir el editor de transferencia desde una fila de "Movimientos" (que solo tiene el `transferId`, no el registro completo). Ambos editores viven dentro de `AccountDetail` como instancias locales independientes de las que ya existen para "crear" (que están un nivel arriba, en `AccountsPage`), así el panel de detalle no se cierra al editar.

**Tech Stack:** Node.js/Express/Prisma (backend), React 18/Vite/Tailwind (frontend) — mismo stack que el resto de la app. Sin dependencias nuevas.

**Testing note:** Este proyecto no tiene framework de tests automatizados (confirmado: sin Jest/Vitest, sin script de test). Cada tarea se verifica manualmente — backend vía `curl`, frontend vía el navegador — siguiendo la convención ya establecida en planes anteriores de este repo.

---

## Task 1: Backend — endpoint `GET /transfers/:id`

**Files:**
- Modify: `backend/src/controllers/transfers.controller.js`
- Modify: `backend/src/routes/transfers.js`

- [ ] **Step 1: Agregar la función `getOne`**

En `backend/src/controllers/transfers.controller.js`, insertar justo después del cierre de la función `list` (antes de `create`):

```js
const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId }, include: INCLUDE });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });
    res.json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};
```

Y actualizar el `module.exports` al final del archivo, reemplazando:
```js
module.exports = { list, create, update, fullUpdate, payCreditCard, cancel, remove };
```
con:
```js
module.exports = { list, getOne, create, update, fullUpdate, payCreditCard, cancel, remove };
```

- [ ] **Step 2: Montar la ruta**

En `backend/src/routes/transfers.js`, reemplazar:
```js
const { list, create, update, fullUpdate, payCreditCard, cancel, remove } = require('../controllers/transfers.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);
```
con:
```js
const { list, getOne, create, update, fullUpdate, payCreditCard, cancel, remove } = require('../controllers/transfers.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);
router.get('/:id', getOne);
```

- [ ] **Step 3: Verificar manualmente**

Levantar el backend (`cd backend && npm run dev`), loguearse y obtener un JWT, luego:

```bash
# Traer una transferencia existente para tener un id real
curl -s "http://localhost:3001/api/transfers?limit=1" -H "Authorization: Bearer <TOKEN>"
```

Con el `id` obtenido:
```bash
curl -s "http://localhost:3001/api/transfers/<ID>" -H "Authorization: Bearer <TOKEN>"
```

Esperado: mismo shape que un item de la lista (`fromName`, `toName`, `fromAccountId`/`fromSharedAccountId`, `toAccountId`/`toSharedAccountId`, `amount`, `currency`, `date`, `comment`).

También verificar:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/transfers/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer <TOKEN>"
```
Esperado: `404`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/transfers.controller.js backend/src/routes/transfers.js
git commit -m "feat: endpoint GET /transfers/:id para traer una transferencia puntual"
```

---

## Task 2: Frontend — `TransferModal` soporta modo edición

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (función `TransferModal`, líneas ~266-400)

- [ ] **Step 1: Agregar la prop `transfer` y precargar el formulario cuando está presente**

Reemplazar:
```jsx
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts, partnerAccounts, initialFromId }) {
  // initialFromId expects the composite "personal::<id>" / "shared::<id>" format (same as
  // form.fromId/form.toId and the `val` fields built in fromOptions/toOptions below), not a bare account id.
  const getDF = () => ({ amount:'', date:localToday(), comment:'', fromId: initialFromId || '', toId:'', currency:'ARS' });
  const [form, setForm]         = useState(getDF);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isBalErr, setIsBalErr] = useState(false);
  useEffect(() => { if (open) { setForm(getDF()); setError(''); setIsBalErr(false); } }, [open, initialFromId]);
```
con:
```jsx
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts, partnerAccounts, initialFromId, transfer }) {
  // initialFromId expects the composite "personal::<id>" / "shared::<id>" format (same as
  // form.fromId/form.toId and the `val` fields built in fromOptions/toOptions below), not a bare account id.
  // Cuando `transfer` está presente, el modal edita esa transferencia (PUT .../full) en vez de crear una nueva.
  const idFor = (accountId, sharedAccountId) =>
    accountId ? `personal::${accountId}` : sharedAccountId ? `shared::${sharedAccountId}` : '';
  const getDF = () => transfer
    ? {
        amount: String(transfer.amount), date: transfer.date?.slice(0, 10) || localToday(),
        comment: transfer.comment || '', currency: transfer.currency || 'ARS',
        fromId: idFor(transfer.fromAccountId, transfer.fromSharedAccountId),
        toId:   idFor(transfer.toAccountId,   transfer.toSharedAccountId),
      }
    : { amount:'', date:localToday(), comment:'', fromId: initialFromId || '', toId:'', currency:'ARS' };
  const [form, setForm]         = useState(getDF);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isBalErr, setIsBalErr] = useState(false);
  useEffect(() => { if (open) { setForm(getDF()); setError(''); setIsBalErr(false); } }, [open, initialFromId, transfer]);
```

- [ ] **Step 2: `handleSubmit` llama a `PUT .../full` cuando está editando**

Reemplazar:
```jsx
  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.fromId) return setError('Seleccioná cuenta origen');
    if (!form.toId)   return setError('Seleccioná cuenta destino');
    if (form.fromId === form.toId) return setError('Origen y destino no pueden ser iguales');
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return setError('Monto debe ser mayor a 0');
    setLoading(true);
    try {
      await api.post('/transfers', {
        amount: amt, date: form.date,
        currency: form.currency,
        comment: form.comment || undefined,
        ...parse(form.fromId, 'from'),
        ...parse(form.toId, 'to'),
      });
      onSaved(); onClose();
    } catch(err) {
      setIsBalErr(err.response?.data?.code === 'INSUFFICIENT_BALANCE');
      setError(err.response?.data?.error || 'Error');
    } finally { setLoading(false); }
  };
```
con:
```jsx
  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.fromId) return setError('Seleccioná cuenta origen');
    if (!form.toId)   return setError('Seleccioná cuenta destino');
    if (form.fromId === form.toId) return setError('Origen y destino no pueden ser iguales');
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return setError('Monto debe ser mayor a 0');
    setLoading(true);
    try {
      const payload = {
        amount: amt, date: form.date,
        currency: form.currency,
        comment: form.comment || undefined,
        ...parse(form.fromId, 'from'),
        ...parse(form.toId, 'to'),
      };
      if (transfer) await api.put(`/transfers/${transfer.id}/full`, payload);
      else          await api.post('/transfers', payload);
      onSaved(); onClose();
    } catch(err) {
      setIsBalErr(err.response?.data?.code === 'INSUFFICIENT_BALANCE');
      setError(err.response?.data?.error || 'Error');
    } finally { setLoading(false); }
  };
```

- [ ] **Step 3: Título y texto del botón según el modo**

Reemplazar:
```jsx
  return (
    <Modal open={open} onClose={onClose} title="Nueva Transferencia">
```
con:
```jsx
  return (
    <Modal open={open} onClose={onClose} title={transfer ? 'Editar Transferencia' : 'Nueva Transferencia'}>
```

Reemplazar:
```jsx
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Transfiriendo...' : 'Transferir'}
          </button>
```
con:
```jsx
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : transfer ? 'Actualizar' : 'Transferir'}
          </button>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso (el modo edición todavía no se usa desde ninguna pantalla, esto es solo chequeo de sintaxis; se prueba en el navegador en la Task 5).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: TransferModal admite modo edición (PUT /transfers/:id/full)"
```

---

## Task 3: Frontend — botón de editar en `AccountTransfersList`

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (función `AccountTransfersList`, líneas ~521-599)

- [ ] **Step 1: Agregar las props `onEdit` y `refreshKey`**

Reemplazar:
```jsx
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
```
con:
```jsx
function AccountTransfersList({ accountId, isShared, onEdit, refreshKey }) {
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
  }, [accountId, isShared, refreshKey]);

  useEffect(() => { fetchTransfers(1); }, [fetchTransfers]);
```

(`refreshKey` en las dependencias de `fetchTransfers` hace que la lista se vuelva a traer — desde la página 1 — cada vez que el padre incrementa ese valor después de guardar una edición.)

- [ ] **Step 2: Agregar el botón de editar a cada fila**

Reemplazar:
```jsx
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
```
con:
```jsx
            <div key={t.id} className="group px-5 py-3 flex items-center gap-3 hover:bg-surface3/40 transition-colors">
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
              <button onClick={() => onEdit(t)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs flex-shrink-0 transition-opacity"
                title="Editar transferencia">✏️</button>
            </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso (`onEdit`/`refreshKey` todavía no se pasan desde ningún lado, se conecta en la Task 4; esto solo confirma sintaxis).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: botón de editar en la lista de transferencias del detalle de cuenta"
```

---

## Task 4: Frontend — `AccountDetail` conecta los editores de transacción y transferencia

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx` (función `AccountDetail`, líneas ~601-754)

- [ ] **Step 1: Ampliar la firma del componente y agregar estado local para los editores**

Reemplazar:
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
con:
```jsx
function AccountDetail({ account, isShared, onClose, onEdit, onDelete, onExchange, onPayCredit, onNewTransfer, onRefreshAccount, accounts, sharedAccounts, partnerAccounts }) {
  const [innerTab, setInnerTab]         = useState('movements'); // 'movements' | 'transfers'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [total, setTotal]               = useState(0);
  const [txEdit, setTxEdit]             = useState(null); // transacción en edición
  const [transferEdit, setTransferEdit] = useState(null); // transferencia en edición
  const [refreshKey, setRefreshKey]     = useState(0);
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

  // Después de editar una transacción o transferencia: refresca Movimientos, fuerza
  // el refetch de Transferencias (vía refreshKey) y refresca el saldo de la cabecera.
  const handleSaved = async () => {
    await fetchTx(page);
    setRefreshKey(k => k + 1);
    if (onRefreshAccount) onRefreshAccount();
  };

  // Una fila de Movimientos de tipo transferencia solo tiene el transferId — hay que
  // traer el registro completo antes de poder abrir el editor de transferencias.
  const openTransferEdit = async (transferId) => {
    try {
      const { data } = await api.get(`/transfers/${transferId}`);
      setTransferEdit(data);
    } catch (e) { console.error(e); }
  };
```

- [ ] **Step 2: Agregar el botón de editar a cada fila de "Movimientos", enrutando según si es transferencia**

Reemplazar:
```jsx
            <div className="divide-y divide-[var(--border)]">
              {transactions.map(tx => {
                const isTransfer = !!tx.transferId;
                const isUSD = tx.currency === 'USD';
                return (
                  <div key={tx.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface3/40 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                      isTransfer ? 'bg-accent/20 text-accent-light' :
                      tx.type==='INCOME' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense'}`}>
                      {isTransfer ? '↔' : tx.type==='INCOME' ? '↑' : '↓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--text2)] truncate">
                          {isTransfer ? 'Transferencia' : tx.category?.name || '—'}
                        </span>
                        {isTransfer && <span className="text-xs bg-accent/20 text-accent-light border border-accent/30 px-1.5 py-0.5 rounded-full">transf.</span>}
                        {isUSD && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">USD</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--subtle)] font-mono">{formatDate(tx.date)}</span>
                        {tx.paymentType && <span className="text-xs text-[var(--subtle)]">{PT[tx.paymentType]}</span>}
                        {tx.comment && !isTransfer && <span className="text-xs text-[var(--subtle)] break-words">{tx.comment}</span>}
                      </div>
                    </div>
                    <div className={`font-mono font-bold text-sm flex-shrink-0 ${
                      isTransfer ? 'text-accent-light' :
                      tx.type==='INCOME' ? 'text-income' : 'text-expense'}`}>
                      {tx.type==='INCOME'?'+':'-'}{isUSD ? fmtUSD(tx.amount) : fmtARS(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
```
con:
```jsx
            <div className="divide-y divide-[var(--border)]">
              {transactions.map(tx => {
                const isTransfer = !!tx.transferId;
                const isUSD = tx.currency === 'USD';
                return (
                  <div key={tx.id} className="group px-5 py-3 flex items-center gap-3 hover:bg-surface3/40 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                      isTransfer ? 'bg-accent/20 text-accent-light' :
                      tx.type==='INCOME' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense'}`}>
                      {isTransfer ? '↔' : tx.type==='INCOME' ? '↑' : '↓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--text2)] truncate">
                          {isTransfer ? 'Transferencia' : tx.category?.name || '—'}
                        </span>
                        {isTransfer && <span className="text-xs bg-accent/20 text-accent-light border border-accent/30 px-1.5 py-0.5 rounded-full">transf.</span>}
                        {isUSD && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">USD</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--subtle)] font-mono">{formatDate(tx.date)}</span>
                        {tx.paymentType && <span className="text-xs text-[var(--subtle)]">{PT[tx.paymentType]}</span>}
                        {tx.comment && !isTransfer && <span className="text-xs text-[var(--subtle)] break-words">{tx.comment}</span>}
                      </div>
                    </div>
                    <div className={`font-mono font-bold text-sm flex-shrink-0 ${
                      isTransfer ? 'text-accent-light' :
                      tx.type==='INCOME' ? 'text-income' : 'text-expense'}`}>
                      {tx.type==='INCOME'?'+':'-'}{isUSD ? fmtUSD(tx.amount) : fmtARS(tx.amount)}
                    </div>
                    <button onClick={() => isTransfer ? openTransferEdit(tx.transferId) : setTxEdit(tx)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs flex-shrink-0 transition-opacity"
                      title={isTransfer ? 'Editar transferencia' : 'Editar transacción'}>✏️</button>
                  </div>
                );
              })}
            </div>
```

- [ ] **Step 3: Pasar `onEdit`/`refreshKey` a `AccountTransfersList` y agregar los dos modales de edición**

Reemplazar:
```jsx
          {innerTab === 'transfers' ? (
            <AccountTransfersList accountId={account.id} isShared={isShared} />
          ) : loading ? (
```
con:
```jsx
          {innerTab === 'transfers' ? (
            <AccountTransfersList accountId={account.id} isShared={isShared} refreshKey={refreshKey} onEdit={setTransferEdit} />
          ) : loading ? (
```

Reemplazar el cierre del componente:
```jsx
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
          <button onClick={onEdit} className="flex-1 btn-secondary text-xs py-2">✏️ Editar</button>
          <button onClick={onDelete} className="btn-danger text-xs py-2 px-4">🗑️ Eliminar</button>
        </div>
      </div>
    </div>
  );
}
```
con:
```jsx
        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
          <button onClick={onEdit} className="flex-1 btn-secondary text-xs py-2">✏️ Editar</button>
          <button onClick={onDelete} className="btn-danger text-xs py-2 px-4">🗑️ Eliminar</button>
        </div>
      </div>

      <TransactionModal
        open={!!txEdit}
        transaction={txEdit}
        onClose={() => setTxEdit(null)}
        onSaved={handleSaved}
      />
      <TransferModal
        open={!!transferEdit}
        transfer={transferEdit}
        accounts={accounts}
        sharedAccounts={sharedAccounts}
        partnerAccounts={partnerAccounts}
        onClose={() => setTransferEdit(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
```

(`TransactionModal` y `TransferModal` ya cierran y disparan `onSaved` internamente al guardar con éxito — no hace falta llamar `setTxEdit(null)`/`setTransferEdit(null)` dentro de `onSaved`, alcanza con que `onClose` lo haga.)

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso. `TransactionModal` todavía no está importado en este archivo — el build va a fallar por eso hasta la Task 5, que agrega el import. Si el build falla acá con "TransactionModal is not defined" o similar, es esperado; seguir a la Task 5 antes de considerar esta tarea rota.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: conectar edición de transacciones y transferencias en el detalle de cuenta"
```

---

## Task 5: Frontend — importar `TransactionModal`, pasar props nuevas desde `AccountsPage` y verificar en el navegador

**Files:**
- Modify: `frontend/src/pages/AccountsPage.jsx`

- [ ] **Step 1: Importar `TransactionModal`**

Al inicio del archivo, reemplazar:
```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
```
con:
```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';
import TransactionModal from '../components/ui/TransactionModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
```

- [ ] **Step 2: Pasar `accounts`/`sharedAccounts`/`partnerAccounts`/`onRefreshAccount` al `<AccountDetail>` que renderiza `AccountsPage`**

Reemplazar:
```jsx
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
            const reopenAccount = { id: detail.account.id, isShared: detail.isShared };
            setDetail(null);
            setTransferModal({ open:true, initialFromId, reopenAccount });
          }}
        />
      )}
```
con:
```jsx
      {detail && (
        <AccountDetail
          account={detail.account}
          isShared={detail.isShared}
          accounts={accounts}
          sharedAccounts={sharedAccounts}
          partnerAccounts={partnerAccounts}
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
            const reopenAccount = { id: detail.account.id, isShared: detail.isShared };
            setDetail(null);
            setTransferModal({ open:true, initialFromId, reopenAccount });
          }}
          onRefreshAccount={async () => {
            const fresh = await fetchAll();
            const list = detail.isShared ? fresh.sharedAccounts : fresh.accounts;
            const account = list.find(a => a.id === detail.account.id);
            if (account) setDetail({ account, isShared: detail.isShared });
          }}
        />
      )}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso, sin errores de `TransactionModal is not defined`.

- [ ] **Step 4: Verificar en el navegador**

Levantar backend (`cd backend && npm run dev`) y frontend (`cd frontend && npm run dev`), loguearse, ir a **Cuentas**, abrir el detalle de una cuenta con transacciones y transferencias existentes (crear alguna si hace falta):

1. **Editar una transacción normal**: en "Movimientos", pasar el mouse sobre una fila que NO sea transferencia (sin el badge "transf."), aparece el botón ✏️. Click → se abre el modal de edición de transacción con los datos precargados. Cambiar el monto y guardar → el modal se cierra, la fila se actualiza en la lista, y el saldo ARS/USD de la cabecera refleja el cambio sin tener que cerrar y reabrir el panel.
2. **Editar una transferencia desde "Transferencias"**: cambiar a esa pestaña interna, pasar el mouse sobre una fila, aparece ✏️. Click → se abre el modal de transferencia con título "Editar Transferencia", cuentas/monto/moneda/fecha/comentario precargados. Cambiar el monto y guardar → el modal se cierra, la lista de transferencias se actualiza, y el saldo de la cabecera se actualiza.
3. **Editar una transferencia desde "Movimientos"**: en la pestaña Movimientos, buscar una fila con el badge "transf." (↔), pasar el mouse, click en ✏️. Debe abrirse el mismo editor de transferencia (no el de transacción suelta), con los datos correctos. Guardar un cambio y confirmar que tanto Movimientos como Transferencias (si cambiás de pestaña) y el saldo de la cabecera quedan actualizados.
4. Confirmar que el panel de detalle **no se cierra** en ningún momento durante estos tres flujos (a diferencia de "+ Nueva Transferencia", que sí cierra y reabre el panel).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AccountsPage.jsx
git commit -m "feat: importar TransactionModal y pasar props de edición a AccountDetail"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Edición de transacciones vía `TransactionModal` → Tasks 4-5. Edición completa de transferencias vía el `fullUpdate` ya existente → Tasks 2, 4-5. Ruteo correcto de filas de transferencia dentro de Movimientos hacia el editor de transferencia → Task 4 (`openTransferEdit`). Endpoint `GET /transfers/:id` para ese caso → Task 1. Refresco de listas y saldo tras guardar, sin cerrar el panel → Tasks 4-5 (`handleSaved`, `refreshKey`, `onRefreshAccount`).
- **Type/prop consistency:** `TransferModal`'s nueva prop `transfer` (Task 2) es consumida de forma idéntica en las dos instancias que la usan: la de `AccountDetail` (Task 4, editando) y la ya existente en `AccountsPage` (creación, donde simplemente no se pasa y queda `undefined`, preservando el comportamiento actual). `AccountTransfersList`'s nuevas props `onEdit`/`refreshKey` (Task 3) coinciden exactamente con cómo las pasa `AccountDetail` en la Task 4. `handleSaved`, `openTransferEdit`, `txEdit`, `transferEdit`, `refreshKey` se definen una sola vez (Task 4) y no se redefinen en ningún otro lado.
- **No se tocan**: `create`, `update` (edición de solo fecha), `cancel`, `remove` de transferencias, ni el modal `EditTransferDateModal` de `TransfersTab` — quedan exactamente como están.

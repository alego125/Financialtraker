import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRESET_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16','#7c3aed','#6b7280'];
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const ACCOUNT_TYPES = [
  { value:'REGULAR',    label:'🏦 Cuenta Bancaria', desc:'Ingresos, gastos y transferencias' },
  { value:'INVESTMENT', label:'📈 Inversión',        desc:'Solo transferencias (ej: plazo fijo)' },
  { value:'CREDIT',     label:'💳 Tarjeta Crédito',  desc:'Solo gastos, se paga con transferencia' },
];
const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);

// ── Account Modal ─────────────────────────────────────────────────────────────
function AccountModal({ open, onClose, onSaved, account, isSharedAccount, partners }) {
  const defaultForm = {
    name:'', initialBalance:'0', initialBalanceUSD:'0',
    color:'#3b82f6', accountType:'REGULAR',
    shared: false, partnerId:'',
  };
  const [form, setForm]       = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (account) {
      setForm({
        name:             account.name,
        color:            account.color || '#3b82f6',
        accountType:      account.accountType || 'REGULAR',
        initialBalance:   String(account.initialBalance ?? 0),
        initialBalanceUSD:String(account.initialBalanceUSD ?? 0),
        partnerId:        account.partner?.id || '',
        shared:           !!isSharedAccount,
      });
    } else {
      setForm({ ...defaultForm, partnerId: partners[0]?.partner?.id || '' });
    }
    setError('');
  }, [account, open, isSharedAccount, partners]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    if (form.shared && !form.partnerId && !account) return setError('Seleccioná un partner');
    setLoading(true); setError('');
    try {
      const isEditing = !!account;
      if (isEditing) {
        const payload = {
          name: form.name, color: form.color, accountType: form.accountType,
          initialBalance: parseFloat(form.initialBalance || 0),
          initialBalanceUSD: parseFloat(form.initialBalanceUSD || 0),
        };
        if (isSharedAccount) await api.put(`/shared-accounts/${account.id}`, payload);
        else                 await api.put(`/accounts/${account.id}`, payload);
      } else if (form.shared) {
        await api.post('/shared-accounts', {
          name: form.name, color: form.color, accountType: form.accountType,
          initialBalance: parseFloat(form.initialBalance || 0),
          initialBalanceUSD: parseFloat(form.initialBalanceUSD || 0),
          partnerId: form.partnerId,
        });
      } else {
        await api.post('/accounts', {
          name: form.name, color: form.color, accountType: form.accountType,
          initialBalance: parseFloat(form.initialBalance || 0),
          initialBalanceUSD: parseFloat(form.initialBalanceUSD || 0),
        });
      }
      onSaved(); onClose();
    } catch(err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setLoading(false); }
  };

  const title = account
    ? (isSharedAccount ? 'Editar Cuenta Compartida' : 'Editar Cuenta')
    : 'Nueva Cuenta';
  const showUSD = form.accountType === 'REGULAR' || form.accountType === 'INVESTMENT';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Personal / Shared toggle (only when creating) */}
        {!account && partners.length > 0 && (
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-2">
              {[['personal','👤 Personal'],['shared','💑 Compartida']].map(([v,l]) => (
                <button key={v} type="button"
                  onClick={() => setForm(p => ({ ...p, shared: v === 'shared' }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-display font-semibold border transition-all ${
                    (v === 'shared') === form.shared
                      ? 'bg-accent/20 border-accent/40 text-accent-light'
                      : 'bg-surface3 border-[var(--border2)] text-[var(--muted)] hover:border-[var(--border2)]'
                  }`}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* Partner selector */}
        {form.shared && !account && partners.length > 0 && (
          <div>
            <label className="label">Compartir con</label>
            <select className="input" value={form.partnerId}
              onChange={e => setForm(p => ({ ...p, partnerId: e.target.value }))}>
              {partners.map(p => (
                <option key={p.partner.id} value={p.partner.id}>
                  {p.partner.name} ({p.partner.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" placeholder="Ej: Santander..."
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        {/* Account type — always shown */}
        <div>
          <label className="label">Tipo de Cuenta</label>
          <div className="space-y-2">
            {ACCOUNT_TYPES.map(t => (
              <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                form.accountType === t.value
                  ? 'border-accent/50 bg-accent/10'
                  : 'border-[var(--border2)] bg-surface3 hover:border-[var(--border2)]'
              }`}>
                <input type="radio" name="accountType" value={t.value}
                  checked={form.accountType === t.value}
                  onChange={e => setForm(p => ({ ...p, accountType: e.target.value }))}
                  className="mt-0.5 accent-accent" />
                <div>
                  <div className="text-sm font-display font-semibold text-[var(--text)]">{t.label}</div>
                  <div className="text-xs text-[var(--subtle)]">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Balances */}
        <div className={`grid gap-3 ${showUSD ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="label">Saldo Inicial ARS</label>
            <input type="number" step="0.01" className="input" placeholder="0"
              value={form.initialBalance}
              onChange={e => setForm(p => ({ ...p, initialBalance: e.target.value }))} />
          </div>
          {showUSD && (
            <div>
              <label className="label">Saldo Inicial USD</label>
              <input type="number" step="0.01" className="input" placeholder="0"
                value={form.initialBalanceUSD}
                onChange={e => setForm(p => ({ ...p, initialBalanceUSD: e.target.value }))} />
            </div>
          )}
        </div>

        {/* Color */}
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : account ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Exchange Modal (personal + shared) ───────────────────────────────────────
function ExchangeModal({ open, onClose, onSaved, account, isShared }) {
  const df = { usdAmount:'', rate:'', date:localToday(), comment:'' };
  const [form, setForm]       = useState(df);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(() => { if (open) { setForm(df); setError(''); } }, [open]);

  const usd = parseFloat(form.usdAmount) || 0;
  const rate = parseFloat(form.rate) || 0;
  const arsTotal = usd * rate;

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!usd || !rate) return setError('Completá todos los campos');
    setLoading(true);
    try {
      const endpoint = isShared
        ? `/shared-accounts/${account.id}/exchange`
        : `/accounts/${account.id}/exchange`;
      await api.post(endpoint, { usdAmount: usd, rate, date: form.date, comment: form.comment || undefined });
      onSaved(); onClose();
    } catch(err) { setError(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };
  if (!account) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Comprar USD — ${account.name}`} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">USD a comprar</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="100"
              value={form.usdAmount} onChange={e => setForm(p => ({ ...p, usdAmount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Precio ARS/USD</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="1200"
              value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} required />
          </div>
        </div>
        {arsTotal > 0 && (
          <div className="bg-surface3 rounded-xl p-3 text-center">
            <div className="text-xs text-[var(--subtle)] mb-1">Total ARS a debitar</div>
            <div className="text-lg font-mono font-bold text-expense">{fmtARS(arsTotal)}</div>
          </div>
        )}
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Comentario (opcional)</label>
          <input type="text" className="input" value={form.comment}
            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Comprando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer Modal ─────────────────────────────────────────────────────────────
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts, partnerAccounts }) {
  const df = { amount:'', date:localToday(), comment:'', fromId:'', toId:'', currency:'ARS' };
  const [form, setForm]         = useState(df);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isBalErr, setIsBalErr] = useState(false);
  useEffect(() => { if (open) { setForm(df); setError(''); setIsBalErr(false); } }, [open]);
  const parse = (val, dir) => {
    if (!val) return {};
    const [kind, id] = val.split('::');
    if (kind === 'personal') return { [`${dir}AccountId`]: id };
    if (kind === 'shared')   return { [`${dir}SharedAccountId`]: id };
    return {};
  };

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

  // Build option groups
  // FROM: my personal + my shared
  // TO:   my personal + my shared + partner's personal accounts
  const fromOptions = [
    { group: 'Mis cuentas', items: accounts
        .filter(a => a.accountType !== 'CREDIT')  // crédito no puede enviar
        .map(a => ({
          val: `personal::${a.id}`,
          label: `${a.name}${a.accountType==='INVESTMENT'?' 📈':''}`,
        }))},
    { group: 'Compartidas', items: sharedAccounts
        .filter(a => a.accountType !== 'CREDIT')
        .map(a => ({
          val: `shared::${a.id}`,
          label: `${a.name} 💑 (con ${a.partner?.name})`,
        }))},
  ].filter(g => g.items.length > 0);

  const toOptions = [
    ...fromOptions,
    partnerAccounts.length > 0 ? { group: 'Cuentas del partner', items: partnerAccounts.map(a => ({
        val: `personal::${a.id}`,
        label: `${a.name} (${a.ownerName})${a.accountType==='INVESTMENT'?' 📈':a.accountType==='CREDIT'?' 💳':''}`,
    }))} : null,
  ].filter(Boolean);

  const renderGroups = (groups) => groups.map(g => (
    <optgroup key={g.group} label={g.group}>
      {g.items.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
    </optgroup>
  ));

  return (
    <Modal open={open} onClose={onClose} title="Nueva Transferencia">
      {error && (
        <div className={`rounded-xl px-4 py-2.5 text-sm mb-4 border ${isBalErr ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {isBalErr && <span className="mr-1.5">⚠️</span>}{error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Moneda</label>
            <select className="input" value={form.currency}
              onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D USD</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Monto</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00"
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
          </div>
        </div>
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Cuenta origen</label>
          <select className="input" value={form.fromId}
            onChange={e => setForm(p => ({ ...p, fromId: e.target.value }))} required>
            <option value="">Seleccionar...</option>
            {renderGroups(fromOptions)}
          </select>
        </div>
        <div className="flex items-center justify-center text-[var(--subtle)] text-2xl">↓</div>
        <div>
          <label className="label">Cuenta destino</label>
          <select className="input" value={form.toId}
            onChange={e => setForm(p => ({ ...p, toId: e.target.value }))} required>
            <option value="">Seleccionar...</option>
            {renderGroups(toOptions)}
          </select>
          {partnerAccounts.length > 0 && (
            <p className="text-xs text-[var(--subtle)] mt-1.5">Incluye cuentas personales de tu partner para enviarle fondos</p>
          )}
        </div>
        <div>
          <label className="label">Comentario (opcional)</label>
          <input type="text" className="input" value={form.comment}
            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Transfiriendo...' : 'Transferir'}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ── Pay Credit Card Modal ──────────────────────────────────────────────────────
function PayCreditModal({ open, onClose, onSaved, creditAccount, creditIsShared, myAccounts, sharedAccounts }) {
  const getDF = () => ({ amount:'', date: localToday(), comment:'', sourceId:'', currency:'ARS' });
  const [form, setForm]       = useState(getDF());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [isBalErr, setIsBalErr] = useState(false);

  useEffect(() => { if (open) { setForm(getDF()); setError(''); setIsBalErr(false); } }, [open]);

  const sourceAccounts = [
    ...myAccounts.filter(a => a.accountType !== 'CREDIT').map(a => ({
      val: `personal::${a.id}`,
      label: `${a.name}${a.accountType==='INVESTMENT'?' 📈':''} — ${fmtARS(a.currentBalance)}`,
    })),
    ...sharedAccounts.filter(a => a.accountType !== 'CREDIT').map(a => ({
      val: `shared::${a.id}`,
      label: `${a.name} 💑 — ${fmtARS(a.currentBalance)}`,
    })),
  ];

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setIsBalErr(false);
    if (!form.sourceId) return setError('Seleccioná una cuenta para débitar');
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return setError('Monto debe ser mayor a 0');
    setLoading(true);
    try {
      const [kind, id] = form.sourceId.split('::');
      await api.post('/transfers/pay-credit', {
        creditAccountId:       creditIsShared ? undefined : creditAccount.id,
        creditSharedAccountId: creditIsShared ? creditAccount.id : undefined,
        sourceAccountId: kind === 'personal' ? id : undefined,
        sourceSharedAccountId: kind === 'shared' ? id : undefined,
        amount: amt,
        date: form.date,
        currency: form.currency,
        comment: form.comment || undefined,
      });
      onSaved(); onClose();
    } catch(err) {
      setIsBalErr(err.response?.data?.code === 'INSUFFICIENT_BALANCE');
      setError(err.response?.data?.error || 'Error al procesar el pago');
    } finally { setLoading(false); }
  };

  if (!creditAccount) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Pagar — ${creditAccount.name}`} size="sm">
      {error && (
        <div className={`rounded-xl px-4 py-2.5 text-sm mb-4 border ${isBalErr ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {isBalErr && <span className="mr-1.5">⚠️</span>}{error}
        </div>
      )}
      {/* Current credit balance */}
      <div className="bg-surface3 rounded-xl p-3 mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--subtle)]">Saldo actual de la tarjeta</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">Monto adeudado</div>
        </div>
        <div className="text-right">
          <div className={`font-mono font-bold text-lg ${(creditAccount.currentBalance||0) < 0 ? 'text-expense' : 'text-income'}`}>
            {fmtARS(creditAccount.currentBalance)}
          </div>
          {(creditAccount.currentBalanceUSD||0) !== 0 && (
            <div className="font-mono text-sm text-yellow-400">{fmtUSD(creditAccount.currentBalanceUSD)}</div>
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Cuenta a débitar</label>
          <select className="input" value={form.sourceId}
            onChange={e => setForm(p => ({ ...p, sourceId: e.target.value }))} required>
            <option value="">Seleccioná una cuenta...</option>
            {sourceAccounts.map(a => <option key={a.val} value={a.val}>{a.label}</option>)}
          </select>
          <p className="text-xs text-[var(--subtle)] mt-1.5">El dinero saldrá de esta cuenta para pagar la tarjeta</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Moneda</label>
            <select className="input" value={form.currency}
              onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D USD</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Monto a pagar</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00"
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
          </div>
        </div>
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Comentario (opcional)</label>
          <input type="text" className="input" placeholder="Ej: Pago mínimo mayo..."
            value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Procesando...' : '💳 Confirmar Pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ── Account Detail Drawer ──────────────────────────────────────────────────────
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

  const typeBadge = { INVESTMENT:'📈 Inversión', CREDIT:'💳 Crédito', REGULAR:'' };
  const hasUSD = (account.currentBalanceUSD || 0) !== 0 || (account.initialBalanceUSD || 0) !== 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface2 border-l border-[var(--border)] flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
              style={{ backgroundColor: account.color + '33', border: `1px solid ${account.color}88`, color: account.color }}>
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[var(--text)] truncate">{account.name}</div>
              {account.accountType && account.accountType !== 'REGULAR' && (
                <div className="text-xs text-accent-light">{typeBadge[account.accountType]}</div>
              )}
              {isShared && account.partner && <div className="text-xs text-violet-400">con {account.partner.name}</div>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-surface3 text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center">✕</button>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-surface3 rounded-xl p-3">
              <div className="text-xs text-[var(--subtle)] mb-1">Saldo ARS</div>
              <div className={`font-mono font-bold text-sm ${(account.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(account.currentBalance)}</div>
            </div>
            <div className="bg-surface3 rounded-xl p-3">
              <div className="text-xs text-[var(--subtle)] mb-1">Saldo USD</div>
              <div className={`font-mono font-bold text-sm ${(account.currentBalanceUSD||0)>=0?'text-yellow-400':'text-expense'}`}>{fmtUSD(account.currentBalanceUSD || 0)}</div>
            </div>
          </div>
          <div className="bg-surface3 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--subtle)]">Transacciones</div>
              <div className="font-mono font-semibold text-[var(--text2)] text-sm">{total}</div>
            </div>
            {account.accountType !== 'CREDIT' && (
              <button onClick={onExchange}
                className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-lg hover:bg-yellow-500/30 transition-colors font-semibold">
                💱 Comprar USD
              </button>
            )}
            {account.accountType === 'CREDIT' && (
              <button onClick={onPayCredit}
                className="text-xs bg-accent/20 text-accent-light border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/30 transition-colors font-semibold">
                💳 Pagar Tarjeta
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[var(--subtle)] text-sm">Cargando...</div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-[var(--muted)] text-sm">Sin transacciones</div>
            </div>
          ) : (
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
                        {tx.comment && !isTransfer && <span className="text-xs text-[var(--subtle)] truncate">{tx.comment}</span>}
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
          )}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <span className="text-xs text-[var(--subtle)] font-mono">Pág {page}/{pages}</span>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>fetchTx(page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
              <button disabled={page>=pages} onClick={()=>fetchTx(page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
          <button onClick={onEdit} className="flex-1 btn-secondary text-xs py-2">✏️ Editar</button>
          <button onClick={onDelete} className="btn-danger text-xs py-2 px-4">🗑️ Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ account, isShared, onClick }) {
  const typeBadge = { INVESTMENT:'📈', CREDIT:'💳' };
  const hasUSD = (account.currentBalanceUSD || 0) !== 0 || (account.initialBalanceUSD || 0) !== 0;
  return (
    <div onClick={onClick} className="card p-4 border-[var(--border)] hover:border-accent/40 hover:bg-surface3/50 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: account.color+'33', border: `1px solid ${account.color}88`, color: account.color }}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold text-[var(--text)] group-hover:text-accent-light transition-colors truncate">{account.name}</div>
            {isShared && account.partner && <div className="text-xs text-violet-400 truncate">con {account.partner.name}</div>}
            <div className="text-xs text-[var(--subtle)] font-mono">{account.transactionCount} transacciones</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isShared && <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">💑</span>}
          {account.accountType && account.accountType !== 'REGULAR' && (
            <span className="text-xs bg-surface3 text-[var(--muted)] border border-[var(--border2)] px-2 py-0.5 rounded-full">{typeBadge[account.accountType]}</span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">ARS</span>
          <span className={`font-mono font-bold ${(account.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(account.currentBalance)}</span>
        </div>
        {hasUSD && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">USD</span>
            <span className={`font-mono font-bold ${(account.currentBalanceUSD||0)>=0?'text-yellow-400':'text-expense'}`}>{fmtUSD(account.currentBalanceUSD||0)}</span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-[var(--border)] text-xs text-[var(--subtle)] group-hover:text-[var(--muted)] transition-colors flex items-center gap-1">
        <span>Ver detalle</span><span>→</span>
      </div>
    </div>
  );
}

// ── Edit Transfer Date Modal ──────────────────────────────────────────────────
function EditTransferDateModal({ open, onClose, onSaved, transfer }) {
  const [date, setDate]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (open && transfer) {
      // Get local date from transfer date
      const d = new Date(transfer.date);
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      setDate(local);
      setError('');
    }
  }, [open, transfer]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!date) return setError('Seleccioná una fecha');
    setLoading(true);
    try {
      await api.put(`/transfers/${transfer.id}`, { date });
      onSaved(); onClose();
    } catch(err) {
      setError(err.response?.data?.error || 'Error al actualizar');
    } finally { setLoading(false); }
  };

  if (!transfer) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar fecha de transferencia" size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <div className="mb-4 text-sm text-[var(--muted)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[var(--subtle)]">Transferencia:</span>
          <span className="text-[var(--text)] font-semibold">{transfer.fromName} → {transfer.toName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--subtle)]">Monto:</span>
          <span className="font-mono">{transfer.currency === 'USD' ? fmtUSD(transfer.amount) : fmtARS(transfer.amount)}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nueva fecha</label>
          <input type="date" className="input" value={date}
            onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : '✓ Actualizar fecha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ── Transfers Tab ─────────────────────────────────────────────────────────────
function TransfersTab({ accounts, sharedAccounts, onNew }) {
  const [transfers, setTransfers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);
  const [total, setTotal]           = useState(0);
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [accountFilter, setAccFil]  = useState('');
  const [generating, setGenerating] = useState(false);
  const [editDate, setEditDate]     = useState(null); // transfer to edit date

  const fetchTransfers = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 20 });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      if (accountFilter) {
        const [kind, id] = accountFilter.split('::');
        if (kind === 'personal') params.set('accountId', id);
        else params.set('sharedAccountId', id);
      }
      const { data } = await api.get(`/transfers?${params}`);
      setTransfers(data.data); setPages(data.pagination.pages);
      setTotal(data.pagination.total); setPage(pg);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, accountFilter]);

  useEffect(() => { fetchTransfers(1); }, [dateFrom, dateTo, accountFilter]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar transferencia? Esto NO devuelve los fondos a la cuenta origen.')) return;
    try { await api.delete(`/transfers/${id}`); fetchTransfers(page); }
    catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar transferencia? Los fondos volverán automáticamente a la cuenta origen.')) return;
    try { await api.post(`/transfers/${id}/cancel`); fetchTransfers(page); }
    catch(e) { alert(e.response?.data?.error || 'Error al cancelar'); }
  };

  const getAllTransfers = async () => {
    const params = new URLSearchParams({ page: 1, limit: 5000 });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    if (accountFilter) {
      const [kind, id] = accountFilter.split('::');
      if (kind === 'personal') params.set('accountId', id);
      else params.set('sharedAccountId', id);
    }
    const { data } = await api.get(`/transfers?${params}`);
    return data.data;
  };

  const exportExcel = async () => {
    setGenerating('excel');
    try {
      const all = await getAllTransfers();
      const rows = all.map(t => ({ 'Fecha':formatDate(t.date), 'Desde':t.fromName, 'Hacia':t.toName, 'Monto':parseFloat(t.amount), 'Comentario':t.comment||'—' }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{wch:12},{wch:22},{wch:22},{wch:14},{wch:30}];
      XLSX.utils.book_append_sheet(wb, ws, 'Transferencias');
      XLSX.writeFile(wb, `transferencias-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const exportPDF = async () => {
    setGenerating('pdf');
    try {
      const all = await getAllTransfers();
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(10,12,20); doc.rect(0,0,W,297,'F');
      doc.setFillColor(26,127,212); doc.rect(0,0,8,297,'F');
      doc.setTextColor(26,127,212); doc.setFont('helvetica','bold'); doc.setFontSize(22);
      doc.text('FinancialTracker', 20, 30);
      doc.setTextColor(226,232,240); doc.setFontSize(14); doc.setFont('helvetica','normal');
      doc.text('Informe de Transferencias', 20, 42);
      doc.setTextColor(100,116,139); doc.setFontSize(9);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-AR',{dateStyle:'full'})}`, 20, 52);
      if (dateFrom||dateTo) doc.text(`Período: ${dateFrom||'—'} — ${dateTo||'—'}`, 20, 60);
      autoTable(doc, {
        startY: 70,
        head: [['Fecha','Desde','Hacia','Monto','Comentario']],
        body: all.map(t => [formatDate(t.date), t.fromName, t.toName, fmtARS(t.amount), t.comment||'—']),
        styles: { fontSize:8, cellPadding:2.5, textColor:[226,232,240], fillColor:[17,18,24], lineColor:[46,46,62], lineWidth:0.2 },
        headStyles: { fillColor:[26,127,212], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor:[10,12,20] },
        margin: { left:15, right:15 },
      });
      const totalPgs = doc.internal.getNumberOfPages();
      for (let i=1;i<=totalPgs;i++) {
        doc.setPage(i); doc.setTextColor(100,116,139); doc.setFontSize(8);
        doc.text(`Pág ${i}/${totalPgs}`, W-15, 289, {align:'right'});
        doc.text('FinancialTracker — Transferencias', 15, 289);
      }
      doc.save(`transferencias-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch(e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const allOptions = [
    ...accounts.map(a => ({ val:`personal::${a.id}`, label:a.name })),
    ...sharedAccounts.map(a => ({ val:`shared::${a.id}`, label:`${a.name} 💑` })),
  ];

  return (
    <div className="space-y-3">
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label text-xs">Desde</label>
          <input type="date" className="input text-xs py-2 w-36" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Hasta</label>
          <input type="date" className="input text-xs py-2 w-36" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Cuenta</label>
          <select className="input text-xs py-2 w-44" value={accountFilter} onChange={e=>setAccFil(e.target.value)}>
            <option value="">Todas</option>
            {allOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        </div>
        {(dateFrom||dateTo||accountFilter) && (
          <button onClick={()=>{setDateFrom('');setDateTo('');setAccFil('');}} className="btn-secondary text-xs py-2 px-3 self-end">✕ Limpiar</button>
        )}
        <div className="flex gap-2 ml-auto self-end">
          <button onClick={exportExcel} disabled={!!generating} className="btn-secondary text-xs py-2 px-3">{generating==='excel'?'...':'📊 Excel'}</button>
          <button onClick={exportPDF}   disabled={!!generating} className="btn-secondary text-xs py-2 px-3">{generating==='pdf'?'...':'📄 PDF'}</button>
          <button onClick={onNew} className="btn-primary text-xs py-2 px-3">+ Nueva</button>
        </div>
      </div>

      {loading ? <div className="text-center py-20 text-[var(--subtle)]">Cargando...</div>
      : transfers.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">↔️</div>
          <div className="text-[var(--text)] font-display font-bold mb-1">Sin transferencias</div>
          <div className="text-[var(--muted)] text-sm mb-4">{total===0?'Todavía no realizaste ninguna':'Sin resultados para los filtros aplicados'}</div>
          <button onClick={onNew} className="btn-primary text-sm">Nueva Transferencia</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--subtle)] font-mono">{total} transferencias</span>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Fecha','Desde','','Hacia','Monto','Comentario',''].map((h,i)=>(
                  <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase ${i===4?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transfers.map(t=>(
                  <tr key={t.id} className="hover:bg-surface3/50 group">
                    <td className="px-3 py-3 font-mono text-[var(--muted)] text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:t.fromColor}}/><span className="text-[var(--text2)] text-xs truncate max-w-28">{t.fromName}</span></div></td>
                    <td className="px-2 py-3 text-[var(--subtle)] text-base">→</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:t.toColor}}/><span className="text-[var(--text2)] text-xs truncate max-w-28">{t.toName}</span></div></td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-accent-light whitespace-nowrap">
                      {t.currency==='USD' ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">USD</span>
                          {fmtUSD(t.amount)}
                        </span>
                      ) : fmtARS(t.amount)}
                    </td>
                    <td className="px-3 py-3 text-[var(--subtle)] text-xs truncate max-w-32">{t.comment||'—'}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={()=>setEditDate(t)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs mx-auto" title="Editar fecha">✏️</button>
                      <button onClick={()=>handleCancel(t.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-surface3 hover:bg-yellow-500/20 text-[var(--muted)] hover:text-yellow-400 flex items-center justify-center text-xs mx-auto" title="Cancelar y devolver fondos">↩️</button>
                      <button onClick={()=>handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-surface3 hover:bg-rose-500/20 text-[var(--muted)] hover:text-rose-400 flex items-center justify-center text-xs mx-auto" title="Eliminar registro">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {transfers.map(t=>(
              <div key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:t.fromColor}}/><span className="text-[var(--text2)] text-xs truncate">{t.fromName}</span></div>
                    <span className="text-[var(--subtle)] text-xs">→</span>
                    <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:t.toColor}}/><span className="text-[var(--text2)] text-xs truncate">{t.toName}</span></div>
                  </div>
                  <span className="font-mono font-bold text-sm text-accent-light whitespace-nowrap">
                    {t.currency==='USD' ? fmtUSD(t.amount) : fmtARS(t.amount)}
                    {t.currency==='USD' && <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">USD</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[var(--subtle)] font-mono">{formatDate(t.date)}{t.comment&&<span className="ml-2 not-italic">{t.comment}</span>}</div>
                  <button onClick={()=>setEditDate(t)} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-accent/20 text-[var(--muted)] hover:text-accent-light flex items-center justify-center text-xs" title="Editar fecha">✏️</button>
                  <button onClick={()=>handleCancel(t.id)} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-yellow-500/20 text-[var(--muted)] hover:text-yellow-400 flex items-center justify-center text-xs" title="Cancelar y devolver fondos">↩️</button>
                  <button onClick={()=>handleDelete(t.id)} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-rose-500/20 text-[var(--muted)] hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] gap-2">
              <span className="text-xs text-[var(--subtle)] font-mono">Pág {page}/{pages}</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={()=>fetchTransfers(page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                <button disabled={page>=pages} onClick={()=>fetchTransfers(page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
              </div>
            </div>
          )}
        </div>
      )}
      <EditTransferDateModal
        open={!!editDate}
        transfer={editDate}
        onClose={() => setEditDate(null)}
        onSaved={() => { fetchTransfers(page); setEditDate(null); }}
      />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts]           = useState([]);
  const [sharedAccounts, setShared]       = useState([]);
  const [partners, setPartners]           = useState([]);
  const [partnerAccounts, setPartnerAccs] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState('accounts');
  const [modal, setModal]                 = useState({ open:false, account:null, isShared:false });
  const [transferModal, setTransferModal] = useState(false);
  const [detail, setDetail]               = useState(null);
  const [exchangeTarget, setExchangeTarget]     = useState(null);
  const [payCreditTarget, setPayCreditTarget]   = useState(null);
  const [deleteError, setDeleteError]     = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, p] = await Promise.all([
        api.get('/accounts'),
        api.get('/shared-accounts'),
        api.get('/partnerships'),
      ]);
      setAccounts(a.data);
      setShared(s.data);
      const accepted = p.data.filter(x => x.status === 'ACCEPTED');
      setPartners(accepted);
      // Fetch accounts of each partner
      const pAccs = await Promise.all(
        accepted.map(async pp => {
          try {
            const r = await api.get(`/partnerships/partner/${pp.partner.id}/accounts`);
            return (r.data || []).map(acc => ({ ...acc, ownerName: pp.partner.name }));
          } catch { return []; }
        })
      );
      setPartnerAccs(pAccs.flat());
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id, isShared) => {
    setDeleteError('');
    if (!confirm('¿Eliminar esta cuenta?')) return;
    try {
      await api.delete(`/${isShared?'shared-accounts':'accounts'}/${id}`);
      setDetail(null); fetchAll();
    } catch(e) { setDeleteError(e.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Cuentas</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Administrá tus cuentas y transferencias</p>
        </div>
        {activeTab === 'accounts' && (
          <button onClick={() => setModal({open:true, account:null, isShared:false})} className="btn-primary text-xs py-2 px-3">+ Nueva Cuenta</button>
        )}
      </div>

      <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)] max-w-xs">
        {[['accounts','🏦 Cuentas'],['transfers','↔️ Movimientos']].map(([v,l]) => (
          <button key={v} onClick={() => setActiveTab(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-semibold transition-all ${activeTab===v?'bg-accent text-[var(--text)]':'text-[var(--muted)] hover:text-[var(--text)]'}`}>{l}</button>
        ))}
      </div>

      {deleteError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{deleteError}</div>}

      {activeTab === 'accounts' && (
        loading ? <div className="text-center py-20 text-[var(--subtle)]">Cargando...</div> : (
          <div className="space-y-6">
            {[
              { title:'Mis Cuentas', list:accounts, isShared:false },
              { title:'Cuentas Compartidas', list:sharedAccounts, isShared:true },
            ].map(({ title, list, isShared }) => (
              <div key={title}>
                <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">{title}</h2>
                {list.length === 0 ? (
                  <div className="card p-8 text-center">
                    <div className="text-3xl mb-3">{isShared?'💑':'🏦'}</div>
                    <div className="text-[var(--muted)] text-sm mb-4">
                      {isShared && partners.length===0
                        ? 'Primero vinculá con alguien en Vínculos'
                        : `Sin ${isShared?'cuentas compartidas':'cuentas'} todavía`}
                    </div>
                    <button onClick={() => setModal({open:true, account:null, isShared:false})} className="btn-primary text-sm">Crear cuenta</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {list.map(a => (
                      <AccountCard key={a.id} account={a} isShared={isShared}
                        onClick={() => setDetail({ account:a, isShared })} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'transfers' && (
        <TransfersTab
          accounts={accounts}
          sharedAccounts={sharedAccounts}
          onNew={() => setTransferModal(true)}
        />
      )}

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

      {/* Modals */}
      <AccountModal
        open={modal.open}
        account={modal.account}
        isSharedAccount={modal.isShared}
        partners={partners}
        onClose={() => setModal({open:false, account:null, isShared:false})}
        onSaved={fetchAll}
      />
      <TransferModal
        open={transferModal}
        accounts={accounts}
        sharedAccounts={sharedAccounts}
        partnerAccounts={partnerAccounts}
        onClose={() => setTransferModal(false)}
        onSaved={fetchAll}
      />
      <ExchangeModal
        open={!!exchangeTarget}
        account={exchangeTarget?.account}
        isShared={exchangeTarget?.isShared}
        onClose={() => setExchangeTarget(null)}
        onSaved={() => { fetchAll(); setExchangeTarget(null); }}
      />
      <PayCreditModal
        open={!!payCreditTarget}
        creditAccount={payCreditTarget?.account}
        creditIsShared={payCreditTarget?.isShared}
        myAccounts={accounts}
        sharedAccounts={sharedAccounts}
        onClose={() => setPayCreditTarget(null)}
        onSaved={() => { fetchAll(); setPayCreditTarget(null); }}
      />
    </div>
  );
}

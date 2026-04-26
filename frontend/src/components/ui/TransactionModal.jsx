import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from './Modal';

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const getDefaultForm = () => ({
  type: 'EXPENSE', amount: '', comment: '',
  date: localToday(),
  categoryId: '', accountId: '', sharedAccountId: '',
  paymentType: '', currency: 'ARS', isReimbursement: false,
});

export default function TransactionModal({ open, onClose, onSaved, transaction }) {
  const [form, setForm]             = useState(getDefaultForm);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [sharedAccounts, setShared] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [isBalanceError, setIsBalanceError] = useState(false);
  const [showPass, setShowPass]     = useState(false); // unused here but pattern is set

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
    api.get('/shared-accounts').then(r => setShared(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: String(parseFloat(transaction.amount)),
        comment: transaction.comment || '',
        date: transaction.date?.slice(0, 10) || defaultForm.date,
        categoryId: transaction.categoryId || '',
        accountId: transaction.accountId || '',
        sharedAccountId: transaction.sharedAccountId || '',
        paymentType: transaction.paymentType || '',
        currency: transaction.currency || 'ARS',
        isReimbursement: transaction.isReimbursement || false,
      });
    } else {
      setForm(getDefaultForm());
    }
    setError('');
  }, [transaction, open]);

  const filteredCategories = categories.filter(c => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('Monto debe ser mayor a 0');
    if (!form.date) return setError('Fecha requerida');
    if (!form.categoryId) return setError('Categoría requerida');
    if (!form.accountId && !form.sharedAccountId) return setError('Seleccioná una cuenta');
    setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        accountId: form.accountId || null,
        sharedAccountId: form.sharedAccountId || null,
        paymentType: form.type === 'EXPENSE' ? (form.paymentType || null) : null,
      };
      if (transaction) await api.put(`/transactions/${transaction.id}`, payload);
      else             await api.post('/transactions', payload);
      onSaved(); onClose();
    } catch (err) {
      const code = err.response?.data?.code;
      setIsBalanceError(code === 'INSUFFICIENT_BALANCE');
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    } finally { setLoading(false); }
  };

  const set = (k, v) => setForm(p => {
    const u = { ...p, [k]: v };
    if (k === 'type') { u.categoryId = ''; u.paymentType = ''; u.isReimbursement = false; }
    if (k === 'accountId' && v) u.sharedAccountId = '';
    if (k === 'sharedAccountId' && v) u.accountId = '';
    return u;
  });

  const handleAccountSelect = (e) => {
    const val = e.target.value;
    if (!val) { setForm(p => ({ ...p, accountId: '', sharedAccountId: '' })); return; }
    const [type, id] = val.split('::');
    if (type === 'personal') setForm(p => ({ ...p, accountId: id, sharedAccountId: '' }));
    else setForm(p => ({ ...p, sharedAccountId: id, accountId: '' }));
  };

  const accountSelectValue = form.accountId
    ? `personal::${form.accountId}`
    : form.sharedAccountId ? `shared::${form.sharedAccountId}` : '';

  // Filter accounts based on type
  const availableAccounts = accounts.filter(a => {
    if (form.type === 'INCOME')  return a.accountType !== 'CREDIT'; // inversiones SÍ aceptan ingresos (intereses/ganancias)
    if (form.type === 'EXPENSE') return a.accountType !== 'INVESTMENT' && a.accountType !== 'CREDIT'; // inversiones no tienen gastos directos
    return true;
  });

  const formatBalance = (a) => {
    if (form.currency === 'USD') return `U$D ${parseFloat(a.currentBalanceUSD || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    return `$ ${parseFloat(a.currentBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const typeLabel = { REGULAR: '', INVESTMENT: ' 📈', CREDIT: ' 💳' };

  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'Editar Transacción' : 'Nueva Transacción'}>
      {error && (
        <div className={`rounded-xl px-4 py-2.5 text-sm mb-4 border ${
          isBalanceError
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {isBalanceError && <span className="mr-1.5">⚠️</span>}
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type toggle */}
        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {['INCOME','EXPENSE'].map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`py-2.5 rounded-xl text-sm font-display font-semibold border transition-all ${
                  form.type === t
                    ? t === 'INCOME' ? 'bg-income/20 border-income/40 text-income' : 'bg-expense/20 border-expense/40 text-expense'
                    : 'bg-surface3 border-[var(--border2)] text-[var(--muted)] hover:border-[var(--border2)]'
                }`}>{t === 'INCOME' ? '↑ Ingreso' : '↓ Gasto'}</button>
            ))}
          </div>
          {/* Reimbursement toggle — only for INCOME */}
          {form.type === 'INCOME' && (
            <button type="button" onClick={() => set('isReimbursement', !form.isReimbursement)}
              className={`mt-2 w-full py-2 rounded-xl text-xs font-display font-semibold border transition-all flex items-center justify-center gap-2 ${
                form.isReimbursement
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-surface3 border-[var(--border2)] text-[var(--muted)] hover:border-[var(--border)]'
              }`}>
              <span>{form.isReimbursement ? '✓' : '○'}</span>
              <span>↩ Es reembolso <span className="font-normal opacity-75">(no cuenta como ingreso)</span></span>
            </button>
          )}
        </div>

        {/* Amount + Currency + Date */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Moneda</label>
            <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D USD</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Monto</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>

        {/* Category + Payment type */}
        {form.type === 'EXPENSE' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                <option value="">Seleccionar...</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de Pago</label>
              <select className="input" value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="DEBITO">💳 Débito</option>
                <option value="CREDITO">💳 Crédito</option>
                <option value="TRANSFERENCIA">🏦 Transferencia</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.categoryId} onChange={e => set('categoryId', e.target.value)} required>
              <option value="">Seleccionar...</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* Account */}
        <div>
          <label className="label">Cuenta</label>
          <select className="input" value={accountSelectValue} onChange={handleAccountSelect} required>
            <option value="">Seleccionar cuenta...</option>
            {availableAccounts.length > 0 && (
              <optgroup label="Mis cuentas">
                {availableAccounts.map(a => (
                  <option key={a.id} value={`personal::${a.id}`}>
                    {a.name}{typeLabel[a.accountType] || ''} — {formatBalance(a)}
                  </option>
                ))}
              </optgroup>
            )}
            {sharedAccounts.length > 0 && (
              <optgroup label="Cuentas compartidas">
                {sharedAccounts.map(a => (
                  <option key={a.id} value={`shared::${a.id}`}>
                    {a.name} (con {a.partner?.name})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {availableAccounts.length === 0 && sharedAccounts.length === 0 && (
            <p className="text-xs text-[var(--subtle)] mt-1.5">No tenés cuentas. Creá una en <strong className="text-[var(--text2)]">Cuentas</strong>.</p>
          )}
        </div>

        {/* Comment */}
        <div>
          <label className="label">Comentario (opcional)</label>
          <input type="text" className="input" placeholder="Descripción..."
            value={form.comment} onChange={e => set('comment', e.target.value)} />
        </div>

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

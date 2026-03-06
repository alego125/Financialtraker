import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from './Modal';

const defaultForm = {
  type: 'EXPENSE', amount: '', comment: '',
  date: new Date().toISOString().slice(0, 10),
  categoryId: '', accountId: '', sharedAccountId: '',
  paymentType: '', currency: 'ARS',
};

export default function TransactionModal({ open, onClose, onSaved, transaction }) {
  const [form, setForm]             = useState(defaultForm);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [sharedAccounts, setShared] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
    api.get('/shared-accounts').then(r => setShared(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (transaction) {
      setForm({
        type:           transaction.type,
        amount:         String(parseFloat(transaction.amount) || ''),
        comment:        transaction.comment || '',
        date:           transaction.date?.slice(0, 10) || defaultForm.date,
        categoryId:     transaction.categoryId || '',
        accountId:      transaction.accountId || '',
        sharedAccountId: transaction.sharedAccountId || '',
        paymentType:    transaction.paymentType || '',
        currency:       transaction.currency || 'ARS',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [transaction, open]);

  const filteredCategories = categories.filter(c => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount) || 0;
    if (!form.date)       return setError('Fecha requerida');
    if (!form.categoryId) return setError('Categoría requerida');
    if (!form.accountId && !form.sharedAccountId) return setError('Seleccioná una cuenta');
    setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        amount,
        accountId:       form.accountId || null,
        sharedAccountId: form.sharedAccountId || null,
        paymentType:     form.type === 'EXPENSE' ? (form.paymentType || null) : null,
      };
      if (transaction) await api.put(`/transactions/${transaction.id}`, payload);
      else             await api.post('/transactions', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al guardar');
    } finally { setLoading(false); }
  };

  const set = (k, v) => setForm(p => {
    const u = { ...p, [k]: v };
    if (k === 'type') { u.categoryId = ''; u.paymentType = ''; }
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

  const availableAccounts = accounts.filter(a => a.accountType !== 'INVESTMENT');

  const formatBalance = (a) => {
    if (form.currency === 'USD')
      return `U$D ${parseFloat(a.currentBalanceUSD || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    return `$ ${parseFloat(a.currentBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const typeLabel = { INVESTMENT: ' 📈', CREDIT: ' 💳', REGULAR: '' };

  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'Editar Transacción' : 'Nueva Transacción'}>
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type toggle */}
        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {['INCOME', 'EXPENSE'].map(t => (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`py-2.5 rounded-xl text-sm font-display font-semibold border transition-all ${
                  form.type === t
                    ? t === 'INCOME'
                      ? 'bg-income/20 border-income/40 text-income'
                      : 'bg-expense/20 border-expense/40 text-expense'
                    : 'bg-dark-700 border-dark-400 text-slate-400 hover:border-dark-300'
                }`}>
                {t === 'INCOME' ? '↑ Ingreso' : '↓ Gasto'}
              </button>
            ))}
          </div>
        </div>

        {/* Currency + Amount */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Moneda</label>
            <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0.00"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => set('date', e.target.value)} required />
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
            <p className="text-xs text-slate-500 mt-1.5">
              No tenés cuentas. Creá una en <strong className="text-slate-300">Cuentas</strong>.
            </p>
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

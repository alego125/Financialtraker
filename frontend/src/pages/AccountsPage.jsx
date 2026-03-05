import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';

const PRESET_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16','#7c3aed','#6b7280'];

// ── Account Modal ─────────────────────────────────────────────────────────────
function AccountModal({ open, onClose, onSaved, account }) {
  const [form, setForm]       = useState({ name: '', initialBalance: '', color: '#3b82f6' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    setForm(account ? { name: account.name, initialBalance: account.initialBalance, color: account.color } : { name: '', initialBalance: '', color: '#3b82f6' });
    setError('');
  }, [account, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    setLoading(true); setError('');
    try {
      if (account) await api.put(`/accounts/${account.id}`, form);
      else         await api.post('/accounts', form);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Editar Cuenta' : 'Nueva Cuenta'} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" placeholder="Ej: Cuenta Bancaria..." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Saldo Inicial</label>
          <input type="number" step="0.01" min="0" className="input" placeholder="0.00" value={form.initialBalance} onChange={e => setForm(p => ({ ...p, initialBalance: e.target.value }))} />
          <p className="text-xs text-slate-500 mt-1">El saldo actual se calculará sumando todas las transacciones.</p>
        </div>
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
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : account ? 'Actualizar' : 'Crear'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Shared Account Modal ──────────────────────────────────────────────────────
function SharedAccountModal({ open, onClose, onSaved, account, partners }) {
  const [form, setForm]       = useState({ name: '', initialBalance: '', color: '#7c3aed', partnerId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    setForm(account
      ? { name: account.name, initialBalance: account.initialBalance, color: account.color, partnerId: account.partner?.id || '' }
      : { name: '', initialBalance: '', color: '#7c3aed', partnerId: partners[0]?.partner?.id || '' });
    setError('');
  }, [account, open, partners]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    if (!form.partnerId && !account) return setError('Seleccioná un partner');
    setLoading(true); setError('');
    try {
      if (account) await api.put(`/shared-accounts/${account.id}`, form);
      else         await api.post('/shared-accounts', form);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Editar Cuenta Compartida' : 'Nueva Cuenta Compartida'} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" placeholder="Ej: Cuenta Conjunta..." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        {!account && partners.length > 0 && (
          <div>
            <label className="label">Compartir con</label>
            <select className="input" value={form.partnerId} onChange={e => setForm(p => ({ ...p, partnerId: e.target.value }))}>
              {partners.map(p => <option key={p.partner.id} value={p.partner.id}>{p.partner.name} ({p.partner.email})</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Saldo Inicial</label>
          <input type="number" step="0.01" min="0" className="input" placeholder="0.00" value={form.initialBalance} onChange={e => setForm(p => ({ ...p, initialBalance: e.target.value }))} />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : account ? 'Actualizar' : 'Crear'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer Modal ────────────────────────────────────────────────────────────
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts }) {
  const defaultForm = { amount: '', date: new Date().toISOString().slice(0,10), comment: '', fromId: '', toId: '' };
  const [form, setForm]       = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { if (open) { setForm(defaultForm); setError(''); } }, [open]);

  // Build unified account list with type prefix
  const allAccounts = [
    ...accounts.map(a => ({ value: `personal::${a.id}`, label: a.name, color: a.color, kind: 'personal' })),
    ...sharedAccounts.map(a => ({ value: `shared::${a.id}`, label: `${a.name} 💑`, color: a.color, kind: 'shared' })),
  ];

  const parseAccount = (val) => {
    if (!val) return {};
    const [kind, id] = val.split('::');
    return kind === 'personal'
      ? { fromAccountId: id, fromSharedAccountId: undefined }
      : { fromSharedAccountId: id, fromAccountId: undefined };
  };

  const parseToAccount = (val) => {
    if (!val) return {};
    const [kind, id] = val.split('::');
    return kind === 'personal'
      ? { toAccountId: id, toSharedAccountId: undefined }
      : { toSharedAccountId: id, toAccountId: undefined };
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.fromId) return setError('Seleccioná la cuenta origen');
    if (!form.toId)   return setError('Seleccioná la cuenta destino');
    if (form.fromId === form.toId) return setError('La cuenta origen y destino no pueden ser la misma');
    setLoading(true);
    try {
      const payload = {
        amount:  form.amount,
        date:    form.date,
        comment: form.comment || undefined,
        ...parseAccount(form.fromId),
        ...parseToAccount(form.toId),
      };
      await api.post('/transfers', payload);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Error al crear transferencia'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Transferencia">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Monto</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="0.00"
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
          </div>
        </div>

        {/* From */}
        <div>
          <label className="label">Cuenta origen</label>
          <select className="input" value={form.fromId} onChange={e => setForm(p => ({ ...p, fromId: e.target.value }))} required>
            <option value="">Seleccionar...</option>
            {accounts.length > 0 && <optgroup label="Mis cuentas">{accounts.map(a => <option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}</optgroup>}
            {sharedAccounts.length > 0 && <optgroup label="Cuentas compartidas">{sharedAccounts.map(a => <option key={a.id} value={`shared::${a.id}`}>{a.name} 💑</option>)}</optgroup>}
          </select>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <div className="h-px w-16 bg-dark-500" />
            <span className="text-lg">↓</span>
            <div className="h-px w-16 bg-dark-500" />
          </div>
        </div>

        {/* To */}
        <div>
          <label className="label">Cuenta destino</label>
          <select className="input" value={form.toId} onChange={e => setForm(p => ({ ...p, toId: e.target.value }))} required>
            <option value="">Seleccionar...</option>
            {accounts.length > 0 && <optgroup label="Mis cuentas">{accounts.map(a => <option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}</optgroup>}
            {sharedAccounts.length > 0 && <optgroup label="Cuentas compartidas">{sharedAccounts.map(a => <option key={a.id} value={`shared::${a.id}`}>{a.name} 💑</option>)}</optgroup>}
          </select>
        </div>

        {/* Comment */}
        <div>
          <label className="label">Comentario (opcional)</label>
          <input type="text" className="input" placeholder="Ej: Paso a ahorro, inversión..." value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : 'Transferir'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ account, isShared, onEdit, onDelete }) {
  return (
    <div className="card p-4 border-dark-500 hover:border-dark-400 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: account.color + '33', border: `1px solid ${account.color}88`, color: account.color }}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold text-white truncate">{account.name}</div>
            {isShared && account.partner && <div className="text-xs text-violet-400 font-mono truncate">con {account.partner.name}</div>}
            <div className="text-xs text-slate-500 font-mono">{account.transactionCount} transacciones</div>
          </div>
        </div>
        {isShared && <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-mono flex-shrink-0">💑</span>}
      </div>
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Saldo inicial</span>
          <span className="text-slate-400 font-mono">{formatCurrency(account.initialBalance)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400 font-display font-medium">Saldo actual</span>
          <span className={`font-mono font-bold ${account.currentBalance >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(account.currentBalance)}
          </span>
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}   className="flex-1 btn-secondary text-xs py-1.5">Editar</button>
        <button onClick={onDelete} className="flex-1 btn-danger text-xs py-1.5">Eliminar</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts]             = useState([]);
  const [sharedAccounts, setSharedAccounts] = useState([]);
  const [partners, setPartners]             = useState([]);
  const [transfers, setTransfers]           = useState([]);
  const [transferPages, setTransferPages]   = useState(1);
  const [transferPage, setTransferPage]     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [loadingTx, setLoadingTx]           = useState(false);
  const [activeTab, setActiveTab]           = useState('accounts'); // 'accounts' | 'transfers'
  const [modal, setModal]                   = useState({ open: false, type: null, account: null });
  const [deleteError, setDeleteError]       = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, p] = await Promise.all([
        api.get('/accounts'),
        api.get('/shared-accounts'),
        api.get('/partnerships'),
      ]);
      setAccounts(a.data);
      setSharedAccounts(s.data);
      setPartners(p.data.filter(p => p.status === 'ACCEPTED'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchTransfers = useCallback(async (pg = 1) => {
    setLoadingTx(true);
    try {
      const { data } = await api.get(`/transfers?page=${pg}&limit=20`);
      setTransfers(data.data);
      setTransferPages(data.pagination.pages);
      setTransferPage(pg);
    } catch (err) { console.error(err); }
    finally { setLoadingTx(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (activeTab === 'transfers') fetchTransfers(1); }, [activeTab]);

  const handleDelete = async (id, isShared) => {
    setDeleteError('');
    if (!confirm('¿Eliminar esta cuenta?')) return;
    try {
      await api.delete(`/${isShared ? 'shared-accounts' : 'accounts'}/${id}`);
      fetchAll();
    } catch (err) { setDeleteError(err.response?.data?.error || 'Error al eliminar'); }
  };

  const handleDeleteTransfer = async (id) => {
    if (!confirm('¿Eliminar esta transferencia?')) return;
    try { await api.delete(`/transfers/${id}`); fetchTransfers(transferPage); }
    catch (err) { alert(err.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Cuentas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Administrá tus cuentas y transferencias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'accounts' ? (
            <>
              <button onClick={() => setModal({ open: true, type: 'personal', account: null })} className="btn-primary text-xs py-2 px-3">+ Nueva Cuenta</button>
              {partners.length > 0 && <button onClick={() => setModal({ open: true, type: 'shared', account: null })} className="btn-secondary text-xs py-2 px-3">+ Compartida</button>}
            </>
          ) : (
            <button onClick={() => setModal({ open: true, type: 'transfer', account: null })} className="btn-primary text-xs py-2 px-3">+ Nueva Transferencia</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500 max-w-xs">
        {[['accounts','🏦 Cuentas'], ['transfers','↔️ Transferencias']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-semibold transition-all ${activeTab === v ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {deleteError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{deleteError}</div>}

      {/* ── CUENTAS TAB ── */}
      {activeTab === 'accounts' && (
        loading ? <div className="text-center py-20 text-slate-500">Cargando...</div> : (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-display font-bold text-white mb-3">Mis Cuentas</h2>
              {accounts.length === 0 ? (
                <div className="card p-8 text-center">
                  <div className="text-3xl mb-3">🏦</div>
                  <div className="text-slate-400 text-sm">No tenés cuentas aún</div>
                  <button onClick={() => setModal({ open: true, type: 'personal', account: null })} className="btn-primary mt-4 text-sm">Crear primera cuenta</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {accounts.map(a => (
                    <AccountCard key={a.id} account={a} isShared={false}
                      onEdit={() => setModal({ open: true, type: 'personal', account: a })}
                      onDelete={() => handleDelete(a.id, false)} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-display font-bold text-white mb-3">Cuentas Compartidas</h2>
              {sharedAccounts.length === 0 ? (
                <div className="card p-8 text-center">
                  <div className="text-3xl mb-3">💑</div>
                  <div className="text-slate-400 text-sm">
                    {partners.length === 0 ? 'Primero vinculá con alguien en la sección Vínculos' : 'No tenés cuentas compartidas aún'}
                  </div>
                  {partners.length > 0 && <button onClick={() => setModal({ open: true, type: 'shared', account: null })} className="btn-primary mt-4 text-sm">Crear cuenta compartida</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sharedAccounts.map(a => (
                    <AccountCard key={a.id} account={a} isShared={true}
                      onEdit={() => setModal({ open: true, type: 'shared', account: a })}
                      onDelete={() => handleDelete(a.id, true)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── TRANSFERENCIAS TAB ── */}
      {activeTab === 'transfers' && (
        <div className="space-y-3">
          {loadingTx ? (
            <div className="text-center py-20 text-slate-500">Cargando...</div>
          ) : transfers.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">↔️</div>
              <div className="text-white font-display font-bold mb-1">Sin transferencias</div>
              <div className="text-slate-400 text-sm mb-5">Mové dinero entre tus cuentas sin afectar ingresos ni gastos</div>
              <button onClick={() => setModal({ open: true, type: 'transfer', account: null })} className="btn-primary text-sm">
                Nueva Transferencia
              </button>
            </div>
          ) : (
            <>
              <div className="card overflow-hidden">
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-500">
                        {['Fecha','Desde','','Hacia','Monto','Comentario',''].map((h, i) => (
                          <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-slate-500 uppercase ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-600">
                      {transfers.map(t => (
                        <tr key={t.id} className="hover:bg-dark-700/50 group">
                          <td className="px-3 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.fromColor }} />
                              <span className="text-slate-300 text-xs truncate max-w-28">{t.fromName}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-slate-600 text-base">→</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.toColor }} />
                              <span className="text-slate-300 text-xs truncate max-w-28">{t.toName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-accent-light whitespace-nowrap">{formatCurrency(t.amount)}</td>
                          <td className="px-3 py-3 text-slate-500 text-xs truncate max-w-32">{t.comment || '—'}</td>
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => handleDeleteTransfer(t.id)}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs transition-all mx-auto">
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-dark-600">
                  {transfers.map(t => (
                    <div key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.fromColor }} />
                            <span className="text-slate-300 text-xs truncate">{t.fromName}</span>
                          </div>
                          <span className="text-slate-600 text-xs flex-shrink-0">→</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.toColor }} />
                            <span className="text-slate-300 text-xs truncate">{t.toName}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-sm text-accent-light whitespace-nowrap">{formatCurrency(t.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div className="font-mono">{formatDate(t.date)}</div>
                          {t.comment && <div>{t.comment}</div>}
                        </div>
                        <button onClick={() => handleDeleteTransfer(t.id)}
                          className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {transferPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-mono">Página {transferPage} de {transferPages}</span>
                    <div className="flex gap-2">
                      <button disabled={transferPage <= 1} onClick={() => fetchTransfers(transferPage - 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                      <button disabled={transferPage >= transferPages} onClick={() => fetchTransfers(transferPage + 1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <AccountModal
        open={modal.open && modal.type === 'personal'} account={modal.account}
        onClose={() => setModal({ open: false, type: null, account: null })} onSaved={fetchAll} />
      <SharedAccountModal
        open={modal.open && modal.type === 'shared'} account={modal.account} partners={partners}
        onClose={() => setModal({ open: false, type: null, account: null })} onSaved={fetchAll} />
      <TransferModal
        open={modal.open && modal.type === 'transfer'}
        accounts={accounts} sharedAccounts={sharedAccounts}
        onClose={() => setModal({ open: false, type: null, account: null })}
        onSaved={() => { fetchAll(); fetchTransfers(1); }} />
    </div>
  );
}

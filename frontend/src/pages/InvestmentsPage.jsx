import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function OperationModal({ open, onClose, onSaved, assets, accounts, editing }) {
  const emptyForm = { assetMode: 'existing', assetId: '', assetName: '', currency: 'ARS', accountId: '', type: 'BUY', quantity: '', unitPrice: '', date: localToday(), notes: '' };
  const getDF = () => editing
    ? { assetMode: 'existing', assetId: editing.assetId, assetName: '', currency: editing.currency, accountId: editing.accountId || '', type: editing.type, quantity: String(editing.quantity), unitPrice: String(editing.unitPrice), date: editing.date?.slice(0, 10) || localToday(), notes: editing.notes || '' }
    : emptyForm;
  const [form, setForm]       = useState(getDF);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(() => { if (open) { setForm(getDF()); setError(''); } }, [open, editing]); // eslint-disable-line

  const total = (parseFloat(form.quantity) || 0) * (parseFloat(form.unitPrice) || 0);
  const editingAsset = editing && assets.find(a => a.id === editing.assetId);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!editing) {
      if (form.assetMode === 'existing' && !form.assetId) return setError('Elegí un activo');
      if (form.assetMode === 'new' && !form.assetName.trim()) return setError('Ingresá el nombre del nuevo activo');
    }
    const quantity = parseFloat(form.quantity), unitPrice = parseFloat(form.unitPrice);
    if (!quantity || quantity <= 0) return setError('La cantidad debe ser mayor a 0');
    if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) return setError('Precio unitario inválido');
    setLoading(true);
    try {
      if (editing) {
        await api.put(`/investments/operations/${editing.id}`, {
          type: form.type, quantity, unitPrice, date: form.date, notes: form.notes.trim() || null,
          accountId: form.accountId || null,
        });
      } else {
        const payload = {
          ...(form.assetMode === 'existing' ? { assetId: form.assetId } : { assetName: form.assetName.trim(), currency: form.currency }),
          accountId: form.accountId || null,
          type: form.type, quantity, unitPrice, date: form.date, notes: form.notes.trim() || null,
        };
        await api.post('/investments/operations', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la operación');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Operación' : 'Nueva Operación'}>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          {['BUY', 'SELL'].map(t => (
            <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold transition-all ${form.type === t ? 'bg-accent text-[var(--text)]' : 'bg-surface3 text-[var(--muted)] hover:text-[var(--text)]'}`}
              style={form.type === t ? { background: 'var(--gold)', color: '#1A1714' } : undefined}>
              {t === 'BUY' ? 'Compra' : 'Venta'}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Activo</label>
          {editing ? (
            <div className="input" style={{ background: 'var(--surface3)', color: 'var(--muted)', cursor: 'not-allowed' }}>
              {editingAsset?.name || editing.assetName}
            </div>
          ) : form.assetMode === 'existing' ? (
            <div className="flex gap-2">
              <select className="input flex-1" value={form.assetId} onChange={e => setForm(p => ({ ...p, assetId: e.target.value }))}>
                <option value="">Elegir activo...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </select>
              <button type="button" onClick={() => setForm(p => ({ ...p, assetMode: 'new', assetId: '' }))} className="btn-secondary text-xs px-3">+ Nuevo</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <input type="text" className="input col-span-2" placeholder="Nombre del activo" value={form.assetName} onChange={e => setForm(p => ({ ...p, assetName: e.target.value }))} />
              <select className="input" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                <option value="ARS">$ ARS</option>
                <option value="USD">U$D USD</option>
              </select>
              <button type="button" onClick={() => setForm(p => ({ ...p, assetMode: 'existing', assetName: '' }))} className="col-span-3 text-xs text-[var(--muted)] hover:text-accent-light text-left">← Elegir uno existente</button>
            </div>
          )}
          {editing && <p className="text-xs text-[var(--subtle)] mt-1">Para cambiar de activo, eliminá esta operación y cargá una nueva.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cantidad</label>
            <input type="number" step="0.000001" min="0.000001" className="input" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Precio unitario</label>
            <input type="number" step="0.01" min="0" className="input" value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} required />
          </div>
        </div>
        {total > 0 && <div className="text-xs text-[var(--subtle)]">Total: {formatCurrency(total, form.currency)}</div>}

        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
        </div>

        <div>
          <label className="label">Cuenta de inversión</label>
          <select className="input" value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))}>
            <option value="">Sin cuenta asociada</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {form.type === 'SELL' && (
            <p className="text-xs text-[var(--subtle)] mt-1">Si vendés en ganancia se acredita a esta cuenta; si vendés en pérdida se descuenta.</p>
          )}
          {editing && form.accountId !== (editing.accountId || '') && (
            <p className="text-xs text-[var(--subtle)] mt-1">Vas a mover esta operación de cuenta: se recalcula el costo promedio de ambas cuentas y, si hubo ganancia/pérdida realizada, la transacción acreditada se recrea en la cuenta nueva.</p>
          )}
        </div>

        <div>
          <label className="label">Notas (opcional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>

        {editing && (
          <p className="text-xs text-[var(--subtle)]">Editar esta operación recalcula el costo promedio y la ganancia/pérdida realizada de las operaciones posteriores de este activo/cuenta, y ajusta la transacción acreditada si corresponde.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssetsModal({ open, onClose, onChanged, assets }) {
  const [newAsset, setNewAsset] = useState({ name: '', currency: 'ARS', referencePrice: '' });
  const [editing, setEditing]   = useState({});
  const [error, setError]       = useState('');

  useEffect(() => { if (open) { setNewAsset({ name: '', currency: 'ARS', referencePrice: '' }); setError(''); } }, [open]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError('');
    if (!newAsset.name.trim()) return setError('Ingresá un nombre');
    try {
      await api.post('/investments/assets', { name: newAsset.name.trim(), currency: newAsset.currency, referencePrice: parseFloat(newAsset.referencePrice) || 0 });
      setNewAsset({ name: '', currency: 'ARS', referencePrice: '' });
      onChanged();
    } catch (err) { setError(err.response?.data?.error || 'Error al crear el activo'); }
  };

  const handleUpdatePrice = async (id) => {
    const value = editing[id];
    if (value === undefined) return;
    try {
      await api.put(`/investments/assets/${id}`, { referencePrice: parseFloat(value) || 0 });
      setEditing(p => { const n = { ...p }; delete n[id]; return n; });
      onChanged();
    } catch (err) { setError(err.response?.data?.error || 'Error al actualizar el precio'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este activo del catálogo?')) return;
    try {
      await api.delete(`/investments/assets/${id}`);
      onChanged();
    } catch (err) { setError(err.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Activos y Precio de Referencia" size="lg">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <p className="text-xs text-[var(--subtle)] mb-4">El precio de referencia es la cotización actual del activo. Actualizalo manualmente para que el valor de tu cartera refleje el mercado.</p>

      <form onSubmit={handleCreate} className="flex gap-2 mb-4">
        <input type="text" className="input flex-1" placeholder="Nuevo activo (ej. AL30)" value={newAsset.name} onChange={e => setNewAsset(p => ({ ...p, name: e.target.value }))} />
        <select className="input w-24" value={newAsset.currency} onChange={e => setNewAsset(p => ({ ...p, currency: e.target.value }))}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <input type="number" step="0.01" min="0" className="input w-32" placeholder="Precio ref." value={newAsset.referencePrice} onChange={e => setNewAsset(p => ({ ...p, referencePrice: e.target.value }))} />
        <button type="submit" className="btn-primary text-sm px-4">Agregar</button>
      </form>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {assets.length === 0 && <div className="text-sm text-[var(--subtle)] text-center py-6">Todavía no cargaste activos</div>}
        {assets.map(a => (
          <div key={a.id} className="flex items-center gap-2 p-3 rounded-xl border border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[var(--text2)] truncate">{a.name}</div>
              <div className="text-xs text-[var(--subtle)]">{a.currency}</div>
            </div>
            <input type="number" step="0.01" min="0" className="input w-32"
              value={editing[a.id] !== undefined ? editing[a.id] : a.referencePrice}
              onChange={e => setEditing(p => ({ ...p, [a.id]: e.target.value }))} />
            <button onClick={() => handleUpdatePrice(a.id)} disabled={editing[a.id] === undefined} className="text-xs text-accent-light disabled:opacity-30 disabled:cursor-not-allowed">Guardar</button>
            <button onClick={() => handleDelete(a.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function InvestmentsPage() {
  const [board, setBoard]         = useState([]);
  const [operations, setOperations] = useState([]);
  const [assets, setAssets]       = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [opModalOpen, setOpModalOpen]     = useState(false);
  const [editingOp, setEditingOp]         = useState(null);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/investments/board'),
      api.get('/investments/operations'),
      api.get('/investments/assets'),
      api.get('/accounts'),
    ]).then(([boardRes, opsRes, assetsRes, accRes]) => {
      setBoard(boardRes.data || []);
      setOperations((opsRes.data || []).slice().reverse());
      setAssets(assetsRes.data || []);
      setAccounts((accRes.data || []).filter(a => a.accountType === 'INVESTMENT'));
      setLoading(false);
    }).catch(() => { setError('Error al cargar las inversiones'); setLoading(false); });
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  const totalInvested     = board.reduce((s, g) => s + Number(g.invested || 0), 0);
  const totalCurrent      = board.reduce((s, g) => s + Number(g.currentValue || 0), 0);
  const totalUnrealized   = totalCurrent - totalInvested;
  const totalUnrealizedPct = totalInvested > 0 ? (totalUnrealized / totalInvested) * 100 : 0;
  const totalRealized     = board.reduce((s, g) => s + Number(g.realizedGain || 0), 0);

  const byAccount = (() => {
    const groups = new Map();
    for (const g of board) {
      const key = g.accountId || 'none';
      if (!groups.has(key)) groups.set(key, { accountId: g.accountId, accountName: g.accountName, invested: 0, currentValue: 0, realizedGain: 0, assetCount: 0 });
      const acc = groups.get(key);
      acc.invested += Number(g.invested || 0);
      acc.currentValue += Number(g.currentValue || 0);
      acc.realizedGain += Number(g.realizedGain || 0);
      if (g.quantity > 0) acc.assetCount += 1;
    }
    return [...groups.values()].map(a => {
      const unrealizedGain = a.currentValue - a.invested;
      return {
        ...a, unrealizedGain,
        unrealizedGainPct: a.invested > 0 ? (unrealizedGain / a.invested) * 100 : 0,
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  })();

  const handleDeleteOp = async (id) => {
    if (!window.confirm('¿Eliminar esta operación?')) return;
    try {
      await api.delete(`/investments/operations/${id}`);
      fetchAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--subtle)]">Cargando...</div>;

  return (
    <div style={{ padding: '24px' }} className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text)]">Inversiones</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Seguimiento de tus posiciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAssetsModalOpen(true)} className="btn-secondary text-sm py-2 px-4">Activos</button>
          <button onClick={() => { setEditingOp(null); setOpModalOpen(true); }} className="btn-primary text-sm py-2 px-4">+ Nueva operación</button>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--gold)', color: '#1A1714' }}>
        <div className="text-xs uppercase tracking-wide opacity-80 mb-1">Cartera Total</div>
        <div className="text-3xl font-display font-bold">{formatCurrency(totalCurrent)}</div>
        <div className="text-sm opacity-90 mt-1.5">
          Invertido: {formatCurrency(totalInvested)} · Ganancia no realizada:{' '}
          <span className="font-semibold">{totalUnrealized >= 0 ? '+' : ''}{formatCurrency(totalUnrealized)} ({totalUnrealized >= 0 ? '+' : ''}{totalUnrealizedPct.toFixed(1)}%)</span>
        </div>
        {totalRealized !== 0 && (
          <div className="text-sm opacity-90 mt-0.5">
            Ganancia realizada (vendida): <span className="font-semibold">{totalRealized >= 0 ? '+' : ''}{formatCurrency(totalRealized)}</span>
          </div>
        )}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {byAccount.length > 0 && (
        <div>
          <h2 className="text-sm font-display font-bold text-[var(--text)] mb-2">Resumen por cuenta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byAccount.map(a => (
              <div key={a.accountId || 'none'} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-semibold text-[var(--text)]">{a.accountName}</div>
                  <div className="text-xs text-[var(--subtle)]">{a.assetCount} {a.assetCount === 1 ? 'activo' : 'activos'}</div>
                </div>
                <div className="text-xl font-display font-bold text-[var(--text)]">{formatCurrency(a.currentValue)}</div>
                <div className="text-xs text-[var(--muted)] mt-1">Invertido: {formatCurrency(a.invested)}</div>
                <div className={`text-xs font-semibold mt-1 ${a.unrealizedGain >= 0 ? 'text-income' : 'text-expense'}`}>
                  {a.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(a.unrealizedGain)} ({a.unrealizedGain >= 0 ? '+' : ''}{a.unrealizedGainPct.toFixed(1)}%)
                </div>
                {a.realizedGain !== 0 && (
                  <div className="text-xs text-[var(--subtle)] mt-1">Realizada: {a.realizedGain >= 0 ? '+' : ''}{formatCurrency(a.realizedGain)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {board.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📈</div>
          <div className="text-[var(--text)] font-display font-bold mb-1">Sin posiciones</div>
          <div className="text-[var(--muted)] text-sm mb-4">Todavía no registraste ninguna operación</div>
          <button onClick={() => { setEditingOp(null); setOpModalOpen(true); }} className="btn-primary text-sm">Nueva operación</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Activo', 'Cuenta', 'Cantidad', 'Costo Prom.', 'Invertido', 'Valor Actual', 'Ganancia', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase whitespace-nowrap ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {board.map(g => (
                  <tr key={`${g.assetId}::${g.accountId}`} className="hover:bg-surface3/50">
                    <td className="px-3 py-3 text-[var(--text2)] font-semibold">{g.assetName}</td>
                    <td className="px-3 py-3 text-[var(--muted)] text-xs">{g.accountName}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatNumber(g.quantity)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(g.avgCost, g.currency)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(g.invested, g.currency)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatCurrency(g.currentValue, g.currency)}</td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${g.unrealizedGain >= 0 ? 'text-income' : 'text-expense'}`}>
                      {g.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(g.unrealizedGain, g.currency)} ({g.unrealizedGain >= 0 ? '+' : ''}{g.unrealizedGainPct.toFixed(1)}%)
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-[var(--subtle)] whitespace-nowrap">
                      {g.realizedGain !== 0 && <>realizada: {g.realizedGain >= 0 ? '+' : ''}{formatCurrency(g.realizedGain, g.currency)}</>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-display font-bold text-[var(--text)] mb-2">Historial de operaciones</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Fecha', 'Activo', 'Cuenta', 'Tipo', 'Cantidad', 'Precio', 'Total', 'Result.', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-2.5 text-xs font-display font-semibold text-[var(--subtle)] uppercase whitespace-nowrap ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {operations.map(o => (
                  <tr key={o.id} className="hover:bg-surface3/50">
                    <td className="px-3 py-2.5 text-[var(--muted)] text-xs whitespace-nowrap">{formatDate(o.date)}</td>
                    <td className="px-3 py-2.5 text-[var(--text2)]">{o.assetName}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)] text-xs">{o.accountName || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.type === 'BUY' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>{o.type === 'BUY' ? 'Compra' : 'Venta'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatNumber(o.quantity)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(o.unitPrice, o.currency)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(o.total, o.currency)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${o.realizedGain == null ? 'text-[var(--subtle)]' : o.realizedGain >= 0 ? 'text-income' : 'text-expense'}`}>
                      {o.realizedGain == null ? '—' : `${o.realizedGain >= 0 ? '+' : ''}${formatCurrency(o.realizedGain, o.currency)}`}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => { setEditingOp(o); setOpModalOpen(true); }} className="text-xs text-[var(--muted)] hover:text-accent-light mr-3">Editar</button>
                      <button onClick={() => handleDeleteOp(o.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
                    </td>
                  </tr>
                ))}
                {operations.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-[var(--subtle)] text-sm">Sin operaciones</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-[var(--subtle)] mt-2">Editar o eliminar una operación recalcula automáticamente el costo promedio, la ganancia/pérdida realizada y la transacción acreditada de todo lo posterior de ese activo/cuenta.</p>
      </div>

      <OperationModal open={opModalOpen} onClose={() => { setOpModalOpen(false); setEditingOp(null); }} onSaved={() => { setOpModalOpen(false); setEditingOp(null); fetchAll(); }} assets={assets} accounts={accounts} editing={editingOp} />
      <AssetsModal open={assetsModalOpen} onClose={() => setAssetsModalOpen(false)} onChanged={fetchAll} assets={assets} />
    </div>
  );
}

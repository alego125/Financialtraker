import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvestmentsPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [accounts, setAccounts]   = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/investments'),
      api.get('/accounts'),
    ]).then(([invRes, accRes]) => {
      setPositions(invRes.data || []);
      setAccounts((accRes.data || []).filter(a => a.accountType === 'INVESTMENT'));
      setLoading(false);
    }).catch(() => { setError('Error al cargar las posiciones'); setLoading(false); });
  }, []);

  const totalInvested = positions.reduce((s, p) => s + Number(p.investedAmount || 0), 0);
  const totalCurrent  = positions.reduce((s, p) => s + Number(p.currentValue || 0), 0);
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? ((totalGain / totalInvested) * 100) : 0;

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta posición?')) return;
    try {
      await api.delete(`/investments/${id}`);
      setPositions(prev => prev.filter(p => p.id !== id));
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
        <button className="btn-primary text-sm py-2 px-4">+ Nueva posición</button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--accent)', color: '#fff' }}>
        <div className="text-xs uppercase tracking-wide opacity-80 mb-1">Cartera Total</div>
        <div className="text-3xl font-display font-bold">{formatCurrency(totalCurrent)}</div>
        <div className="text-sm opacity-90 mt-1.5">
          Invertido: {formatCurrency(totalInvested)} · Ganancia:{' '}
          <span className="font-semibold">{totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} ({totalGain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)</span>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {positions.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📈</div>
          <div className="text-[var(--text)] font-display font-bold mb-1">Sin posiciones</div>
          <div className="text-[var(--muted)] text-sm mb-4">Todavía no registraste ninguna inversión</div>
          <button className="btn-primary text-sm">Nueva posición</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Nombre', 'Cuenta', 'Invertido', 'Valor Actual', 'Ganancia', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase ${i >= 2 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {positions.map(p => {
                  const gain = Number(p.gain || 0);
                  const isUSD = p.currency === 'USD';
                  return (
                    <tr key={p.id} className="hover:bg-surface3/50">
                      <td className="px-3 py-3 text-[var(--text2)]">{p.name}</td>
                      <td className="px-3 py-3 text-[var(--muted)] text-xs">{p.accountName || '—'}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.investedAmount, p.currency)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.currentValue, p.currency)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold ${gain >= 0 ? 'text-income' : 'text-expense'}`}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain, p.currency)} ({gain >= 0 ? '+' : ''}{Number(p.gainPct || 0).toFixed(1)}%)
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button className="text-xs text-[var(--muted)] hover:text-accent-light mr-3">Editar</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {positions.map(p => {
              const gain = Number(p.gain || 0);
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-[var(--text2)]">{p.name}</div>
                    <div className={`font-mono font-bold text-sm ${gain >= 0 ? 'text-income' : 'text-expense'}`}>
                      {gain >= 0 ? '+' : ''}{formatCurrency(gain, p.currency)}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--subtle)] mb-2">{p.accountName || 'Sin cuenta'} · {formatDate(p.date)}</div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>Invertido: {formatCurrency(p.investedAmount, p.currency)}</span>
                    <span>Actual: {formatCurrency(p.currentValue, p.currency)}</span>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button className="text-xs text-accent-light">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-400">Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

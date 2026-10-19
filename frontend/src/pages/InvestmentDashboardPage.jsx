import Icon from '../components/ui/Icon';
import useRequestScope from '../hooks/useRequestScope';
import { isCanceled } from '../utils/requestScope';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { portfolioInCurrency } from '../utils/portfolio';
import { formatCurrency, formatQuantity, formatMonth } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import { ExpensePieChart } from '../components/charts/Charts';

const round2 = (n) => Math.round(n * 100) / 100;
const monthKey = (d) => {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};

const tooltipStyle = {
  backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px',
  color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', padding: '10px 14px',
};

const ActivityTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="shadow-xl">
      <p style={{ color: 'var(--muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{formatMonth(label)}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{p.name}:</span>
          <span className="font-mono font-medium">{formatCurrency(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
};

export default function InvestmentDashboardPage() {
  const requestScope = useRequestScope();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [board, setBoard]         = useState([]);
  const [operations, setOperations] = useState([]);
  const [assets, setAssets]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [currency, setCurrency]   = useState('ARS');

  useEffect(() => {
    const request = requestScope.start();
    Promise.all([
      api.get('/investments/board', { signal: request.signal }),
      api.get('/investments/operations', { signal: request.signal }),
      api.get('/investments/assets', { signal: request.signal }),
    ]).then(([boardRes, opsRes, assetsRes]) => {
      request.check();
      const b = boardRes.data || [];
      const a = assetsRes.data || [];
      setBoard(b);
      setOperations(opsRes.data || []);
      setAssets(a);
      const currs = [...new Set(a.map(x => x.currency))];
      if (currs.length && !currs.includes('ARS')) setCurrency(currs[0]);
      setLoading(false);
    }).catch(err => { if (request.current() && !isCanceled(err)) setError('No se pudieron cargar las inversiones'); }).finally(() => { if (request.current()) setLoading(false); });
    return () => requestScope.cancel();
  }, []);

  const availableCurrencies = useMemo(() => [...new Set(assets.map(a => a.currency))], [assets]);

  const currencyBoard = useMemo(() => portfolioInCurrency(board, currency), [board, currency]);
  const totalInvested      = currencyBoard.reduce((s, g) => s + Number(g.invested || 0), 0);
  const totalCurrent       = currencyBoard.reduce((s, g) => s + Number(g.currentValue || 0), 0);
  const totalUnrealized    = totalCurrent - totalInvested;
  const totalUnrealizedPct = totalInvested > 0 ? (totalUnrealized / totalInvested) * 100 : 0;
  const totalRealized      = currencyBoard.reduce((s, g) => s + Number(g.realizedGain || 0), 0);
  const totalReturnPct     = totalInvested > 0 ? ((totalUnrealized + totalRealized) / totalInvested) * 100 : 0;
  const activePositions    = currencyBoard.filter(g => g.quantity > 0).length;

  // ── Posiciones agrupadas por activo (sumando todas las cuentas) ──
  const byAsset = useMemo(() => {
    const map = new Map();
    for (const g of currencyBoard) {
      if (!map.has(g.assetId)) map.set(g.assetId, { assetId: g.assetId, assetName: g.assetName, currency: g.currency, invested: 0, currentValue: 0, realizedGain: 0, quantity: 0 });
      const a = map.get(g.assetId);
      a.invested      += Number(g.invested || 0);
      a.currentValue  += Number(g.currentValue || 0);
      a.realizedGain  += Number(g.realizedGain || 0);
      a.quantity      += Number(g.quantity || 0);
    }
    return [...map.values()].map(a => {
      const unrealizedGain = a.currentValue - a.invested;
      return { ...a, unrealizedGain, unrealizedGainPct: a.invested > 0 ? (unrealizedGain / a.invested) * 100 : 0 };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [currencyBoard]);

  const ranking = useMemo(() => [...byAsset].filter(a => a.quantity > 0).sort((a, b) => b.unrealizedGainPct - a.unrealizedGainPct), [byAsset]);
  const bestId  = ranking[0]?.assetId;
  const worstId = ranking.length > 1 ? ranking[ranking.length - 1]?.assetId : null;

  // ── Distribución por cuenta ──
  const byAccount = useMemo(() => {
    const map = new Map();
    for (const g of currencyBoard) {
      const key = g.accountId || 'none';
      if (!map.has(key)) map.set(key, { accountId: g.accountId, accountName: g.accountName, invested: 0, currentValue: 0, realizedGain: 0, assetCount: 0 });
      const a = map.get(key);
      a.invested     += Number(g.invested || 0);
      a.currentValue += Number(g.currentValue || 0);
      a.realizedGain += Number(g.realizedGain || 0);
      if (g.quantity > 0) a.assetCount += 1;
    }
    return [...map.values()].sort((a, b) => b.currentValue - a.currentValue);
  }, [currencyBoard]);

  // ── Distribución por moneda ──
  const byCurrency = useMemo(() => {
    const map = new Map();
    for (const g of board) {
      if (!map.has(g.currency)) map.set(g.currency, { currency: g.currency, invested: 0, currentValue: 0 });
      const c = map.get(g.currency);
      c.invested     += Number(g.invested || 0);
      c.currentValue += Number(g.currentValue || 0);
    }
    return [...map.values()];
  }, [board]);

  const pieOf = (rows, nameKey) => {
    const total = rows.reduce((s, r) => s + r.currentValue, 0);
    return rows.filter(r => r.currentValue > 0).map(r => ({
      name: r[nameKey], value: r.currentValue,
      percentage: total > 0 ? round2((r.currentValue / total) * 100) : 0,
    }));
  };
  const assetPieData   = useMemo(() => pieOf(byAsset, 'assetName'), [byAsset]);
  const accountPieData = useMemo(() => pieOf(byAccount, 'accountName'), [byAccount]);
  const topHolding      = assetPieData[0];

  // ── Actividad mensual + capital neto y ganancia realizada acumulados (por moneda) ──
  const opsInCurrency = useMemo(
    () => operations.filter(o => o.currency === currency).slice().sort((a, b) => new Date(a.date) - new Date(b.date)),
    [operations, currency]
  );
  const sells   = opsInCurrency.filter(o => o.realizedGain != null);
  const wins    = sells.filter(o => o.realizedGain > 0).length;
  const winRate = sells.length > 0 ? round2((wins / sells.length) * 100) : null;

  const monthlySeries = useMemo(() => {
    const map = new Map();
    for (const o of opsInCurrency) {
      const key = monthKey(o.date);
      if (!map.has(key)) map.set(key, { month: key, buy: 0, sell: 0, realizedGain: 0 });
      const m = map.get(key);
      if (o.type === 'BUY') m.buy += o.total; else m.sell += o.total;
      if (o.realizedGain != null) m.realizedGain += o.realizedGain;
    }
    const sorted = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
    let cumNet = 0, cumRealized = 0;
    return sorted.map(m => {
      cumNet += m.buy - m.sell;
      cumRealized += m.realizedGain;
      return { ...m, netCapital: round2(cumNet), cumRealized: round2(cumRealized) };
    });
  }, [opsInCurrency]);

  if (loading) return <div className="p-8 text-center text-[var(--subtle)]">
      {error && <p role="alert" className="text-red-500">{error}</p>}Cargando...</div>;

  return (
    <div className="min-w-0 max-w-full [overflow-wrap:anywhere] p-4 sm:p-6 space-y-5">
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => navigate('/investments')} className="text-xs text-[var(--muted)] hover:text-accent-light mb-1">← Volver a Inversiones</button>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Dashboard de Inversiones</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Análisis completo de tu portfolio</p>
        </div>
        {availableCurrencies.length > 1 && (
          <select className="input text-xs w-auto" value={currency} onChange={e => setCurrency(e.target.value)}>
            {availableCurrencies.map(c => <option key={c} value={c}>{c === 'USD' ? 'U$D USD' : '$ ARS'}</option>)}
          </select>
        )}
      </div>

      {board.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="flex justify-center text-accent-light mb-3"><Icon name="chart" size={36} /></div>
          <div className="text-[var(--text)] font-display font-bold mb-1">Sin datos para analizar</div>
          <div className="text-[var(--muted)] text-sm">Cargá operaciones en Inversiones para ver el dashboard</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Valor Total Cartera" value={formatCurrency(totalCurrent, currency)} color="accent" icon="◈" />
            <KpiCard label="Invertido" value={formatCurrency(totalInvested, currency)} color="neutral" icon="↧" />
            <KpiCard label="Ganancia No Realizada" value={`${totalUnrealized >= 0 ? '+' : ''}${formatCurrency(totalUnrealized, currency)}`} sub={`${totalUnrealized >= 0 ? '+' : ''}${totalUnrealizedPct.toFixed(1)}%`} color={totalUnrealized >= 0 ? 'income' : 'expense'} icon={totalUnrealized >= 0 ? '↑' : '↓'} />
            <KpiCard label="Ganancia Realizada" value={`${totalRealized >= 0 ? '+' : ''}${formatCurrency(totalRealized, currency)}`} color={totalRealized >= 0 ? 'income' : 'expense'} icon="✓" />
            <KpiCard label="Retorno Total" value={`${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`} color={totalReturnPct >= 0 ? 'income' : 'expense'} icon="%" />
            <KpiCard label="Posiciones Activas" value={String(activePositions)} color="neutral" icon="◆" />
            <KpiCard label="Mayor Concentración" value={topHolding ? `${topHolding.percentage}%` : '—'} sub={topHolding?.name} color="neutral" icon="⚠" />
            <KpiCard label="Efectividad en Ventas" value={winRate == null ? '—' : `${winRate}%`} sub={sells.length ? `${wins}/${sells.length} ventas ganadoras` : 'Sin ventas'} color={winRate == null ? 'neutral' : winRate >= 50 ? 'income' : 'expense'} icon="🎯" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4 sm:p-5">
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Distribución por Activo</h2>
              {assetPieData.length > 0 ? <ExpensePieChart data={assetPieData} currency={currency} /> : <div className="text-center text-sm text-[var(--subtle)] py-10">Sin posiciones activas</div>}
            </div>
            <div className="card p-4 sm:p-5">
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Distribución por Cuenta</h2>
              {accountPieData.length > 0 ? <ExpensePieChart data={accountPieData} currency={currency} /> : <div className="text-center text-sm text-[var(--subtle)] py-10">Sin posiciones activas</div>}
            </div>
          </div>

          {byCurrency.length > 1 && (
            <div className="card p-4 sm:p-5">
              <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Distribución por Moneda</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {byCurrency.map(c => (
                  <div key={c.currency} className="p-4 rounded-xl border border-[var(--border)]">
                    <div className="text-xs text-[var(--subtle)] mb-1">{c.currency === 'USD' ? 'U$D USD' : '$ ARS'}</div>
                    <div className="text-xl font-display font-bold text-[var(--text)]">{formatCurrency(c.currentValue, c.currency)}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">Invertido: {formatCurrency(c.invested, c.currency)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-sm font-display font-bold text-[var(--text)]">Actividad Mensual y Capital Acumulado {currency === 'USD' ? '(USD)' : '(ARS)'}</h2>
            </div>
            {monthlySeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlySeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip content={<ActivityTooltip currency={currency} />} />
                  <Legend formatter={v => <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{v}</span>} />
                  <Bar dataKey="buy" fill="var(--income)" radius={[4, 4, 0, 0]} name="Compras" />
                  <Bar dataKey="sell" fill="var(--expense)" radius={[4, 4, 0, 0]} name="Ventas" />
                  <Line type="monotone" dataKey="netCapital" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} name="Capital neto acumulado" />
                  <Line type="monotone" dataKey="cumRealized" stroke="#4967A8" strokeWidth={2.5} dot={{ r: 3 }} name="Ganancia realizada acumulada" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-sm text-[var(--subtle)] py-10">Sin operaciones en {currency}</div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-2">Ranking de Rendimiento por Activo</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)]">
                    {['Activo', 'Cantidad', 'Invertido', 'Valor Actual', 'Ganancia No Real.', 'Ganancia Realizada', ''].map((h, i) => (
                      <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase whitespace-nowrap ${i >= 1 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {ranking.map(a => (
                      <tr key={a.assetId} className="hover:bg-surface3/50">
                        <td className="px-3 py-3 text-[var(--text2)] font-semibold">{a.assetName}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatQuantity(a.quantity)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatCurrency(a.invested, a.currency)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatCurrency(a.currentValue, a.currency)}</td>
                        <td className={`px-3 py-3 text-right font-mono font-semibold ${a.unrealizedGain >= 0 ? 'text-income' : 'text-expense'}`}>
                          {a.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(a.unrealizedGain, a.currency)} ({a.unrealizedGain >= 0 ? '+' : ''}{a.unrealizedGainPct.toFixed(1)}%)
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[var(--subtle)]">
                          {a.realizedGain !== 0 ? `${a.realizedGain >= 0 ? '+' : ''}${formatCurrency(a.realizedGain, a.currency)}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {a.assetId === bestId && <span className="text-xs bg-income/10 text-income px-2 py-0.5 rounded-full">Mejor</span>}
                          {a.assetId === worstId && <span className="text-xs bg-expense/10 text-expense px-2 py-0.5 rounded-full">Peor</span>}
                        </td>
                      </tr>
                    ))}
                    {ranking.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--subtle)] text-sm">Sin posiciones activas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-2">Resumen por Cuenta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byAccount.map(a => {
                const unrealizedGain = a.currentValue - a.invested;
                const unrealizedGainPct = a.invested > 0 ? (unrealizedGain / a.invested) * 100 : 0;
                return (
                  <div key={a.accountId || 'none'} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="font-display font-semibold text-[var(--text)]">{a.accountName}</div>
                      <div className="text-xs text-[var(--subtle)]">{a.assetCount} {a.assetCount === 1 ? 'activo' : 'activos'}</div>
                    </div>
                    <div className="text-xl font-display font-bold text-[var(--text)]">{formatCurrency(a.currentValue, currency)}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">Invertido: {formatCurrency(a.invested, currency)}</div>
                    <div className={`text-xs font-semibold mt-1 ${unrealizedGain >= 0 ? 'text-income' : 'text-expense'}`}>
                      {unrealizedGain >= 0 ? '+' : ''}{formatCurrency(unrealizedGain, currency)} ({unrealizedGain >= 0 ? '+' : ''}{unrealizedGainPct.toFixed(1)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

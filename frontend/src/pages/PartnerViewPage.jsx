import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import { MonthlyLineChart, CategoryBarChart, ExpensePieChart, StackedBarChart } from '../components/charts/Charts';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtMonthLabel = (val) => { const [y,m] = val.split('-'); return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}); };

export default function PartnerViewPage() {
  const { partnerId } = useParams();
  const [dashData, setDashData]         = useState(null);
  const [transactions, setTxs]          = useState([]);
  const [pagination, setPagination]     = useState({ page:1, limit:10, total:0, pages:0 });
  const [partnerAccounts, setPartnerAcc]= useState([]);
  const [loading, setLoading]           = useState(true);
  const [txLoading, setTxLoading]       = useState(false);
  const [error, setError]               = useState('');

  // Filter state
  const [filterMode, setFilterMode]     = useState('month');
  const [filters, setFilters]           = useState({ month: currentMonth() });
  const [showMore, setShowMore]         = useState(false);
  const [availMonths, setAvailMonths]   = useState([]);
  const [availYears, setAvailYears]     = useState([]);
  const [categories, setCategories]     = useState([]);

  // Load available months/years/categories from partner transactions (all time)
  useEffect(() => {
    api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=5000`)
      .then(r => {
        const txs = r.data.data || [];
        const months = new Set(), years = new Set();
        const cats = new Map();
        txs.forEach(tx => {
          const d = new Date(tx.date);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          months.add(key);
          years.add(String(d.getFullYear()));
          if (tx.category) cats.set(tx.category.id, tx.category);
        });
        setAvailMonths([...months].sort((a,b)=>b.localeCompare(a)));
        setAvailYears([...years].sort((a,b)=>b.localeCompare(a)));
        setCategories([...cats.values()]);
      }).catch(()=>{});
  }, [partnerId]);

  const buildTxParams = useCallback((page, f) => {
    const params = new URLSearchParams({ page, limit: 10 });
    if (f.month)      params.set('month', f.month);
    else if (f.year)  params.set('year', f.year);
    else {
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo)   params.set('dateTo', f.dateTo);
    }
    if (f.type)       params.set('type', f.type);
    if (f.categoryId) params.set('categoryId', f.categoryId);
    if (f.currency)   params.set('currency', f.currency);
    return params;
  }, []);

  const fetchTx = useCallback(async (page = 1, f = filters) => {
    setTxLoading(true);
    try {
      const { data } = await api.get(`/partnerships/partner/${partnerId}/transactions?${buildTxParams(page, f)}`);
      setTxs(data.data || []);
      setPagination(p => ({ ...p, ...(data.pagination || {}) }));
    } catch(e) { console.error(e); }
    finally { setTxLoading(false); }
  }, [partnerId, filters, buildTxParams]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [dashRes, txRes, accRes] = await Promise.all([
        api.get(`/partnerships/partner/${partnerId}/solo`),
        api.get(`/partnerships/partner/${partnerId}/transactions?${buildTxParams(1, filters)}`),
        api.get(`/partnerships/partner/${partnerId}/accounts`),
      ]);
      setDashData(dashRes.data);
      setTxs(txRes.data.data || []);
      setPagination(p => ({ ...p, ...(txRes.data.pagination || {}) }));
      setPartnerAcc(accRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar');
    } finally { setLoading(false); }
  }, [partnerId, filters, buildTxParams]);

  useEffect(() => { fetchAll(); }, [partnerId]);

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
    fetchTx(1, newFilters);
  };

  const clearFilters = () => {
    const reset = { month: currentMonth() };
    setFilterMode('month');
    setShowMore(false);
    setFilters(reset);
    fetchTx(1, reset);
  };

  const hasExtra = Object.entries(filters).some(([k,v]) => v && !['month','year','dateFrom','dateTo'].includes(k));

  if (loading) return <div className="flex items-center justify-center h-96 text-[var(--subtle)]">Cargando...</div>;
  if (error) return (
    <div className="p-4 sm:p-8">
      <div className="card p-8 text-center max-w-sm mx-auto">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-[var(--text)] font-display font-bold mb-1">Sin acceso</div>
        <div className="text-[var(--muted)] text-sm mb-5">{error}</div>
        <Link to="/partnerships" className="btn-primary text-sm">Ver vínculos</Link>
      </div>
    </div>
  );

  if (!dashData) return null;

  const partner   = dashData.partner || {};
  const kpis      = dashData.kpis    || { totalIncome:0, totalExpense:0, balance:0, savingsRate:0 };
  const chartsRaw = dashData.charts  || { monthly:[], categoryExpense:[], pie:[] };
  // Normalizar categoryExpense: backend devuelve { name, amount }, el chart espera { name, value }
  const charts = {
    ...chartsRaw,
    categoryExpense: (chartsRaw.categoryExpense||[]).map(c => ({
      ...c,
      value: c.value ?? c.amount ?? 0,
    })),
  };
  const PT        = { EFECTIVO:'💵 Ef.', DEBITO:'💳 Déb.', CREDITO:'💳 Cré.', TRANSFERENCIA:'🏦 Tr.' };
  const typeBadge = { INVESTMENT:'📈', CREDIT:'💳' };

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
            <Link to="/" className="text-[var(--subtle)] hover:text-[var(--text2)]">← Dashboard</Link>
            <span className="text-[var(--subtle)]">/</span>
            <span className="text-violet-400 font-display font-medium truncate">Solo sus finanzas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-display font-bold text-lg flex-shrink-0">
              {(partner.name||'?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--text)] truncate">Finanzas de {partner.name}</h1>
              <p className="text-[var(--muted)] text-xs font-mono truncate">{partner.email}</p>
            </div>
          </div>
        </div>
        <span className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5 text-xs text-violet-400 font-mono flex-shrink-0">👁️ Solo lectura</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos"    value={formatCurrency(kpis.totalIncome)}  color="income"  icon="↑" />
        <KpiCard label="Gastos"      value={formatCurrency(kpis.totalExpense)} color="expense" icon="↓" />
        <KpiCard label="Balance"     value={formatCurrency(kpis.balance)}      color={kpis.balance>=0?'income':'expense'} icon="⚖️" />
        <KpiCard label="Tasa Ahorro" value={`${kpis.savingsRate}%`}            color="accent"  icon="💰" />
      </div>

      {/* Cuentas del partner */}
      {partnerAccounts.length > 0 && (
        <div>
          <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">Cuentas de {partner.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {partnerAccounts.map(a => (
              <div key={a.id} className="card p-4 border-[var(--border)]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{backgroundColor:a.color+'33',border:`1px solid ${a.color}88`,color:a.color}}>
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-display font-semibold text-[var(--text)] truncate">{a.name}</div>
                      {a.accountType && a.accountType !== 'REGULAR' && (
                        <div className="text-xs text-[var(--subtle)]">{typeBadge[a.accountType]} {a.accountType==='INVESTMENT'?'Inversión':'Crédito'}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)] text-xs">ARS</span>
                    <span className={`font-mono font-bold text-sm ${(a.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(a.currentBalance)}</span>
                  </div>
                  {(a.currentBalanceUSD||0) !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)] text-xs">USD</span>
                      <span className={`font-mono font-bold text-sm ${(a.currentBalanceUSD||0)>=0?'text-yellow-400':'text-expense'}`}>{fmtUSD(a.currentBalanceUSD)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 card p-3 bg-surface3 border-[var(--border2)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-semibold text-[var(--muted)]">Total ARS</span>
              <span className="font-mono font-bold text-sm text-orange-400">{fmtARS(partnerAccounts.reduce((s,a)=>s+(a.currentBalance||0),0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {charts.monthly?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Evolución Mensual</h2><MonthlyLineChart data={charts.monthly} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Apilado</h2><StackedBarChart data={charts.monthly} /></div>
        </div>
      )}
      {charts.categoryExpense?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Por Categoría</h2><CategoryBarChart data={charts.categoryExpense} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Distribución</h2><ExpensePieChart data={charts.pie} /></div>
        </div>
      )}

      {/* Transactions con filtros completos */}
      <div>
        <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">Transacciones de {partner.name}</h2>

        {/* Filters */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode tabs */}
            <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)]">
              {[['month','📅 Mes'],['year','📆 Año'],['range','🗓️ Rango']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterMode(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${filterMode===v?'bg-accent text-[var(--text)]':'text-[var(--muted)] hover:text-[var(--text)]'}`}>{l}</button>
              ))}
            </div>

            {/* Month */}
            {filterMode === 'month' && (
              <select className="input text-xs py-2 max-w-[200px]" value={filters.month || currentMonth()}
                onChange={e => applyFilters({ month: e.target.value })}>
                {availMonths.length === 0 && <option value={currentMonth()}>{fmtMonthLabel(currentMonth())}</option>}
                {availMonths.map(m => <option key={m} value={m}>{fmtMonthLabel(m)}</option>)}
              </select>
            )}

            {/* Year */}
            {filterMode === 'year' && (
              <select className="input text-xs py-2 w-24" value={filters.year || String(new Date().getFullYear())}
                onChange={e => applyFilters({ year: e.target.value })}>
                {availYears.length === 0 && <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
                {availYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            {/* Range */}
            {filterMode === 'range' && (
              <div className="flex items-center gap-2">
                <input type="date" className="input text-xs py-2 w-36" value={filters.dateFrom||''}
                  onChange={e => applyFilters({...filters, dateFrom:e.target.value, month:undefined, year:undefined})} />
                <span className="text-[var(--subtle)] text-xs">—</span>
                <input type="date" className="input text-xs py-2 w-36" value={filters.dateTo||''}
                  onChange={e => applyFilters({...filters, dateTo:e.target.value, month:undefined, year:undefined})} />
              </div>
            )}

            <button onClick={() => setShowMore(o => !o)}
              className={`btn-secondary text-xs py-2 px-3 ${showMore||hasExtra ? 'border-accent/40 text-accent-light' : ''}`}>
              ⚙️ Más{hasExtra ? ` (${Object.entries(filters).filter(([k,v])=>v&&!['month','year','dateFrom','dateTo'].includes(k)).length})` : ''}
            </button>
            <button onClick={clearFilters} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] transition-colors">✕ Limpiar</button>
          </div>

          {/* Extra filters */}
          {showMore && (
            <div className="card p-3 border-accent/20 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input text-xs" value={filters.type||''}
                  onChange={e => applyFilters({...filters, type: e.target.value||undefined})}>
                  <option value="">Todos</option>
                  <option value="INCOME">Ingresos</option>
                  <option value="EXPENSE">Gastos</option>
                </select>
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input text-xs" value={filters.categoryId||''}
                  onChange={e => applyFilters({...filters, categoryId: e.target.value||undefined})}>
                  <option value="">Todas</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Moneda</label>
                <select className="input text-xs" value={filters.currency||''}
                  onChange={e => applyFilters({...filters, currency: e.target.value||undefined})}>
                  <option value="">Todas</option>
                  <option value="ARS">$ ARS</option>
                  <option value="USD">U$D USD</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {txLoading ? (
          <div className="text-center py-10 text-[var(--subtle)] text-sm">Cargando...</div>
        ) : transactions.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-[var(--muted)] text-sm">Sin transacciones para el período seleccionado</div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]">
                  {['Fecha','Tipo','Categoría','Cuenta','Pago','Comentario','Monto'].map((h,i)=>(
                    <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase ${i===6?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {transactions.map(tx=>(
                    <tr key={tx.id} className="hover:bg-surface3/50 transition-colors">
                      <td className="px-3 py-3 font-mono text-[var(--muted)] text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3"><span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ingreso':'↓ Gasto'}</span></td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1">
                          {tx.category?.color&&<span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:tx.category.color}}/>}
                          <span className="text-[var(--text2)] text-xs truncate max-w-24">{tx.category?.name||'—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {tx.sharedAccount ? <span className="text-violet-400 truncate max-w-20 block">{tx.sharedAccount.name} 💑</span>
                        : tx.account ? <span className="text-[var(--text2)] truncate max-w-20 block">{tx.account.name}</span>
                        : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">{tx.paymentType?PT[tx.paymentType]:'—'}</td>
                      <td className="px-3 py-3 text-[var(--muted)] text-xs truncate max-w-28">{tx.comment||'—'}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>
                        {tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {transactions.map(tx=>(
                <div key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ing':'↓ Gst'}</span>
                    <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>
                      {tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--subtle)] space-y-0.5">
                    <div className="font-mono">{formatDate(tx.date)}</div>
                    {tx.category&&<div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:tx.category.color}}/>{tx.category.name}</div>}
                    {(tx.account||tx.sharedAccount)&&<div>{(tx.account||tx.sharedAccount)?.name}{tx.sharedAccount&&' 💑'}</div>}
                    {tx.comment&&<div>{tx.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] gap-2">
                <span className="text-xs text-[var(--subtle)] font-mono">Pág {pagination.page}/{pagination.pages} — {pagination.total} total</span>
                <div className="flex gap-2">
                  <button disabled={pagination.page<=1} onClick={()=>fetchTx(pagination.page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                  <button disabled={pagination.page>=pagination.pages} onClick={()=>fetchTx(pagination.page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

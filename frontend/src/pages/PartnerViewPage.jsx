import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import { MonthlyLineChart, CategoryBarChart, ExpensePieChart, StackedBarChart } from '../components/charts/Charts';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);

export default function PartnerViewPage() {
  const { partnerId } = useParams();
  const [dashData, setDashData]         = useState(null);
  const [transactions, setTxs]          = useState([]);
  const [pagination, setPagination]     = useState({ page:1, limit:10, total:0, pages:0 });
  const [partnerAccounts, setPartnerAcc]= useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [monthFilter, setMonthFilter]   = useState('');
  const [availMonths, setAvailMonths]   = useState([]);

  // Load available months from partner transactions
  useEffect(() => {
    api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=5000`)
      .then(r => {
        const txs = r.data.data || [];
        const months = new Set();
        txs.forEach(tx => {
          const d = new Date(tx.date);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          months.add(key);
        });
        setAvailMonths([...months].sort((a,b) => b.localeCompare(a)));
      })
      .catch(() => {});
  }, [partnerId]);

  const fetchAll = useCallback(async (page = 1, month = monthFilter) => {
    setLoading(true); setError('');
    try {
      const txParams = new URLSearchParams({ page, limit: 10 });
      if (month) txParams.set('month', month);

      const [dashRes, txRes, accRes] = await Promise.all([
        api.get(`/partnerships/partner/${partnerId}/solo`),
        api.get(`/partnerships/partner/${partnerId}/transactions?${txParams}`),
        api.get(`/partnerships/partner/${partnerId}/accounts`),
      ]);
      setDashData(dashRes.data);
      setTxs(txRes.data.data || []);
      setPagination(p => ({ ...p, ...(txRes.data.pagination || {}) }));
      setPartnerAcc(accRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar');
    } finally { setLoading(false); }
  }, [partnerId, monthFilter]);

  useEffect(() => { fetchAll(1); }, [fetchAll]);

  const handleMonthChange = (val) => {
    setMonthFilter(val);
    fetchAll(1, val);
  };

  if (loading && !dashData) return <div className="flex items-center justify-center h-96 text-slate-500">Cargando...</div>;
  if (error) return (
    <div className="p-4 sm:p-8">
      <div className="card p-8 text-center max-w-sm mx-auto">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-white font-display font-bold mb-1">Sin acceso</div>
        <div className="text-slate-400 text-sm mb-5">{error}</div>
        <Link to="/partnerships" className="btn-primary text-sm">Ver vínculos</Link>
      </div>
    </div>
  );

  if (!dashData) return null;

  const partner  = dashData.partner || {};
  const kpis     = dashData.kpis    || { totalIncome:0, totalExpense:0, balance:0, savingsRate:0 };
  const charts   = dashData.charts  || { monthly:[], categoryExpense:[], pie:[] };
  const PT       = { EFECTIVO:'💵 Ef.', DEBITO:'💳 Déb.', CREDITO:'💳 Cré.', TRANSFERENCIA:'🏦 Tr.' };
  const typeBadge = { INVESTMENT:'📈', CREDIT:'💳' };

  const fmtMonthLabel = (val) => {
    const [y, m] = val.split('-');
    return new Date(parseInt(y), parseInt(m)-1, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
            <Link to="/" className="text-slate-500 hover:text-slate-300">← Dashboard</Link>
            <span className="text-slate-600">/</span>
            <span className="text-violet-400 font-display font-medium truncate">Solo sus finanzas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-display font-bold text-lg flex-shrink-0">
              {(partner.name||'?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">
                Finanzas de {partner.name}
              </h1>
              <p className="text-slate-400 text-xs font-mono truncate">{partner.email}</p>
            </div>
          </div>
        </div>
        <span className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5 text-xs text-violet-400 font-mono flex-shrink-0">
          👁️ Solo lectura
        </span>
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
          <h2 className="text-sm font-display font-bold text-white mb-3">
            Cuentas de {partner.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {partnerAccounts.map(a => {
              const hasUSD = (a.currentBalanceUSD||0) !== 0;
              return (
                <div key={a.id} className="card p-4 border-dark-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{backgroundColor:a.color+'33', border:`1px solid ${a.color}88`, color:a.color}}>
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-display font-semibold text-white truncate">{a.name}</div>
                        {a.accountType && a.accountType !== 'REGULAR' && (
                          <div className="text-xs text-slate-500">{typeBadge[a.accountType]} {a.accountType==='INVESTMENT'?'Inversión':'Crédito'}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 text-xs">ARS</span>
                      <span className={`font-mono font-bold text-sm ${(a.currentBalance||0)>=0?'text-income':'text-expense'}`}>
                        {fmtARS(a.currentBalance)}
                      </span>
                    </div>
                    {hasUSD && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400 text-xs">USD</span>
                        <span className={`font-mono font-bold text-sm ${(a.currentBalanceUSD||0)>=0?'text-yellow-400':'text-expense'}`}>
                          {fmtUSD(a.currentBalanceUSD)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 card p-3 bg-dark-700 border-dark-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-semibold text-slate-400">Total ARS</span>
              <span className="font-mono font-bold text-sm text-orange-400">
                {fmtARS(partnerAccounts.reduce((s,a)=>s+(a.currentBalance||0),0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {charts.monthly?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Evolución Mensual</h2>
            <MonthlyLineChart data={charts.monthly} />
          </div>
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Apilado</h2>
            <StackedBarChart data={charts.monthly} />
          </div>
        </div>
      )}
      {charts.categoryExpense?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Por Categoría</h2>
            <CategoryBarChart data={charts.categoryExpense} />
          </div>
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Distribución</h2>
            <ExpensePieChart data={charts.pie} />
          </div>
        </div>
      )}

      {/* Transactions with month filter */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-display font-bold text-white">
            Transacciones de {partner.name}
          </h2>
          <div className="flex items-center gap-2">
            <select
              className="input text-xs py-2 max-w-[200px]"
              value={monthFilter}
              onChange={e => handleMonthChange(e.target.value)}
            >
              <option value="">Todos los meses</option>
              {availMonths.map(m => (
                <option key={m} value={m}>{fmtMonthLabel(m)}</option>
              ))}
            </select>
            {monthFilter && (
              <button
                onClick={() => handleMonthChange('')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap"
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Active filter badge */}
        {monthFilter && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-full">
              📅 {fmtMonthLabel(monthFilter)}
            </span>
            <span className="text-xs text-slate-500">
              {pagination.total} transacciones
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-sm">Cargando...</div>
        ) : transactions.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-slate-400 text-sm">
              {monthFilter ? `Sin transacciones en ${fmtMonthLabel(monthFilter)}` : 'Sin transacciones'}
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-dark-500">
                  {['Fecha','Tipo','Categoría','Cuenta','Pago','Comentario','Monto'].map((h,i)=>(
                    <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-slate-500 uppercase ${i===6?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-dark-600">
                  {transactions.map(tx=>(
                    <tr key={tx.id} className="hover:bg-dark-700/50 transition-colors">
                      <td className="px-3 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3"><span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ingreso':'↓ Gasto'}</span></td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1">
                          {tx.category?.color&&<span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:tx.category.color}}/>}
                          <span className="text-slate-300 text-xs truncate max-w-24">{tx.category?.name||'—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {tx.sharedAccount
                          ? <span className="text-violet-400 truncate max-w-20 block">{tx.sharedAccount.name} 💑</span>
                          : tx.account
                          ? <span className="text-slate-300 truncate max-w-20 block">{tx.account.name}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{tx.paymentType?PT[tx.paymentType]:'—'}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs truncate max-w-28">{tx.comment||'—'}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>
                        {tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-dark-600">
              {transactions.map(tx=>(
                <div key={tx.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ing':'↓ Gst'}</span>
                    <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>
                      {tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 gap-2">
                <span className="text-xs text-slate-500 font-mono">Pág {pagination.page}/{pagination.pages} — {pagination.total} total</span>
                <div className="flex gap-2">
                  <button disabled={pagination.page<=1} onClick={()=>fetchAll(pagination.page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                  <button disabled={pagination.page>=pagination.pages} onClick={()=>fetchAll(pagination.page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import TransactionModal from '../components/ui/TransactionModal';
import { generatePDF } from '../utils/pdfExport';
import { generateExcel } from '../utils/excelExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmt = m => { if (!m) return ''; const [y,mo] = m.split('-'); return new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'}); };
const ttStyle = { backgroundColor:'#111118', border:'1px solid #2e2e3e', borderRadius:'12px', color:'#e2e8f0', fontSize:'12px' };
const PT = { EFECTIVO:'💵 Ef.', DEBITO:'💳 Déb.', CREDITO:'💳 Cré.', TRANSFERENCIA:'🏦 Tr.' };

export default function SharedDashboardPage() {
  const { partnerId } = useParams();
  const [data, setData]         = useState(null);
  const [transactions, setTx]   = useState([]);
  const [page, setPage]         = useState(1);
  const [totalPages, setTP]     = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [txModal, setTxModal]   = useState({ open:false, tx:null });
  const [viewMode, setView]     = useState('combined');
  const [filters, setFilters]   = useState({});
  const [showFilters, setShowF] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [categories, setCats]   = useState([]);
  const [accounts, setAccts]    = useState([]);
  const [sharedAccts, setSh]    = useState([]);

  useEffect(() => {
    api.get('/categories').then(r => setCats(r.data)).catch(() => {});
    api.get('/accounts').then(r => setAccts(r.data)).catch(() => {});
    api.get('/shared-accounts').then(r => setSh(r.data)).catch(() => {});
  }, []);

  const fetchAll = useCallback(async (pg = 1, f = filters) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams(f).toString();
      const [dashRes, txMine, txPartner] = await Promise.all([
        api.get(`/dashboard/shared/${partnerId}${q ? '?' + q : ''}`),
        api.get(`/transactions?page=${pg}&limit=15&sortBy=date&sortOrder=desc${q ? '&' + q : ''}`),
        api.get(`/partnerships/partner/${partnerId}/transactions?page=${pg}&limit=15${q ? '&' + q : ''}`),
      ]);
      setData(dashRes.data);
      const combined = [
        ...txMine.data.data.map(t => ({ ...t, _owner: 'me' })),
        ...txPartner.data.data.map(t => ({ ...t, _owner: 'partner' })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      setTx(combined);
      setTP(Math.max(txMine.data.pagination.pages, txPartner.data.pagination.pages));
    } catch (err) { setError(err.response?.data?.error || 'Error al cargar'); }
    finally { setLoading(false); }
  }, [partnerId, filters]);

  useEffect(() => { fetchAll(1); }, [partnerId]);

  const applyFilters = (f) => { setFilters(f); fetchAll(1, f); };

  if (loading && !data) return <div className="flex items-center justify-center h-96 text-slate-500">Cargando...</div>;
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

  const { me, partner, my: myData, partnerData, combined, combinedMonthly, sharedAccounts } = data;
  const displayed = viewMode === 'mine' ? transactions.filter(t => t._owner === 'me')
    : viewMode === 'partner' ? transactions.filter(t => t._owner === 'partner')
    : transactions;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2 text-xs flex-wrap">
            <Link to="/" className="text-slate-500 hover:text-slate-300">← Dashboard</Link>
            <span className="text-slate-600">/</span>
            <span className="text-violet-400 font-display font-medium">Compartido</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">{me.name} & {partner.name}</h1>
          <p className="text-slate-400 text-xs mt-0.5">Finanzas combinadas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowF(o => !o)} className={`btn-secondary text-xs py-2 px-3 ${showFilters ? 'border-accent/40 text-accent-light' : ''}`}>
            🔍 {showFilters ? 'Ocultar' : 'Filtros'}
          </button>
          <button onClick={async () => {
            setGenerating('pdf');
            try {
              const q = new URLSearchParams(filters).toString();
              const [r1,r2] = await Promise.all([
                api.get(`/transactions?page=1&limit=1000&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
                api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=1000${q?'&'+q:''}`),
              ]);
              const all = [...r1.data.data, ...r2.data.data].sort((a,b)=>new Date(b.date)-new Date(a.date));
              generatePDF({ kpis: data?.combined, charts: data?.my?.charts, transactions: all, filters });
            } catch(e){console.error(e);} finally{setGenerating(false);}
          }} disabled={!!generating} className="btn-secondary text-xs py-2 px-3">{generating==='pdf'?'...':'📄 PDF'}</button>
          <button onClick={async () => {
            setGenerating('excel');
            try {
              const q = new URLSearchParams(filters).toString();
              const [r1,r2] = await Promise.all([
                api.get(`/transactions?page=1&limit=5000&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
                api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=5000${q?'&'+q:''}`),
              ]);
              const all = [...r1.data.data, ...r2.data.data].sort((a,b)=>new Date(b.date)-new Date(a.date));
              generateExcel({ transactions: all, filters, kpis: data?.combined });
            } catch(e){console.error(e);} finally{setGenerating(false);}
          }} disabled={!!generating} className="btn-secondary text-xs py-2 px-3">{generating==='excel'?'...':'📊 Excel'}</button>
          <button onClick={() => setTxModal({ open:true, tx:null })} className="btn-primary text-xs py-2 px-3">+ Nueva</button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 border-accent/20">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label">Desde</label><input type="date" className="input" value={filters.dateFrom||''} onChange={e => applyFilters({...filters, dateFrom:e.target.value})} /></div>
            <div><label className="label">Hasta</label><input type="date" className="input" value={filters.dateTo||''} onChange={e => applyFilters({...filters, dateTo:e.target.value})} /></div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={filters.type||''} onChange={e => applyFilters({...filters, type:e.target.value})}>
                <option value="">Todos</option><option value="INCOME">Ingresos</option><option value="EXPENSE">Gastos</option>
              </select>
            </div>
            <div>
              <label className="label">Cuenta</label>
              <select className="input" value={filters.accountId||filters.sharedAccountId||''} onChange={e => {
                const val = e.target.value;
                if (!val) { applyFilters({...filters, accountId:undefined, sharedAccountId:undefined}); return; }
                const [type, id] = val.split('::');
                if (type==='personal') applyFilters({...filters, accountId:id, sharedAccountId:undefined});
                else applyFilters({...filters, sharedAccountId:id, accountId:undefined});
              }}>
                <option value="">Todas</option>
                {accounts.length>0&&<optgroup label="Personales">{accounts.map(a=><option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}</optgroup>}
                {sharedAccts.length>0&&<optgroup label="Compartidas">{sharedAccts.map(a=><option key={a.id} value={`shared::${a.id}`}>{a.name}</option>)}</optgroup>}
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={filters.categoryId||''} onChange={e => applyFilters({...filters, categoryId:e.target.value})}>
                <option value="">Todas</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => applyFilters({})} className="btn-secondary text-xs w-full">✕ Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Combined totals */}
      <div className="card p-4 border-violet-500/20 bg-violet-500/5">
        <h2 className="text-xs font-display font-semibold text-violet-400 uppercase tracking-widest mb-3">Totales Combinados</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-around gap-2 sm:gap-0">
          <div className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center sm:px-4">
            <span className="text-xs text-slate-500">Ingresos totales</span>
            <span className="text-sm sm:text-lg font-display font-bold text-income font-mono">{formatCurrency(combined.totalIncome)}</span>
          </div>
          <div className="hidden sm:block w-px self-stretch bg-dark-500" />
          <div className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center sm:px-4">
            <span className="text-xs text-slate-500">Gastos totales</span>
            <span className="text-sm sm:text-lg font-display font-bold text-expense font-mono">{formatCurrency(combined.totalExpense)}</span>
          </div>
          <div className="hidden sm:block w-px self-stretch bg-dark-500" />
          <div className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center sm:px-4">
            <span className="text-xs text-slate-500">Balance neto</span>
            <span className={`text-sm sm:text-xl font-display font-bold font-mono ${combined.balance >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(combined.balance)}</span>
          </div>
        </div>
      </div>

      {/* Side-by-side KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/><h2 className="text-sm font-display font-bold text-white">{me.name} (yo)</h2></div>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Ingresos"  value={formatCurrency(myData.kpis.totalIncome)}  color="income" />
            <KpiCard label="Gastos"    value={formatCurrency(myData.kpis.totalExpense)} color="expense" />
            <KpiCard label="Balance"   value={formatCurrency(myData.kpis.balance)}      color={myData.kpis.balance >= 0 ? 'income' : 'expense'} />
            <KpiCard label="Ahorro"    value={`${myData.kpis.savingsRate}%`}            color="accent" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-400"/><h2 className="text-sm font-display font-bold text-white">{partner.name}</h2></div>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Ingresos"  value={formatCurrency(partnerData.kpis.totalIncome)}  color="income" />
            <KpiCard label="Gastos"    value={formatCurrency(partnerData.kpis.totalExpense)} color="expense" />
            <KpiCard label="Balance"   value={formatCurrency(partnerData.kpis.balance)}      color={partnerData.kpis.balance >= 0 ? 'income' : 'expense'} />
            <KpiCard label="Ahorro"    value={`${partnerData.kpis.savingsRate}%`}            color="accent" />
          </div>
        </div>
      </div>

      {/* Chart */}
      {combinedMonthly?.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-display font-bold text-white mb-4">Comparación Mensual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={combinedMonthly} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
              <XAxis dataKey="month" tickFormatter={fmt} tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'#64748b', fontSize:10 }} width={40} />
              <Tooltip contentStyle={ttStyle} formatter={v => formatCurrency(v)} />
              <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'11px' }}>{v}</span>} />
              <Bar dataKey="myExpense"      name={`${me.name} gst`}      fill="#f43f5e" radius={[3,3,0,0]} />
              <Bar dataKey="partnerExpense" name={`${partner.name} gst`} fill="#f97316" radius={[3,3,0,0]} />
              <Bar dataKey="myIncome"       name={`${me.name} ing`}      fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="partnerIncome"  name={`${partner.name} ing`} fill="#06b6d4" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Shared accounts */}
      {sharedAccounts?.length > 0 && (
        <div>
          <h2 className="text-sm font-display font-bold text-white mb-3">Cuentas Compartidas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sharedAccounts.map(a => {
              let bal = parseFloat(a.initialBalance || 0);
              for (const tx of (a.transactions || [])) bal += tx.type === 'INCOME' ? parseFloat(tx.amount) : -parseFloat(tx.amount);
              return (
                <div key={a.id} className="card p-3 border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-xs font-display font-semibold text-white truncate">{a.name}</span>
                  </div>
                  <div className={`text-base sm:text-lg font-display font-bold font-mono ${bal >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(bal)}</div>
                  <div className="text-xs text-slate-500">saldo actual</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-display font-bold text-white">Transacciones</h2>
          <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500">
            {[['combined','Ambos'], ['mine','Yo'], ['partner', partner.name.split(' ')[0]]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${viewMode === v ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-500">
                  {['Fecha','Usuario','Tipo','Categoría','Cuenta','Pago','Comentario','Monto',''].map((h, i) => (
                    <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-slate-500 uppercase ${i === 7 ? 'text-right' : i === 8 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {displayed.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-500 text-sm">Sin transacciones</td></tr>}
                {displayed.map(tx => {
                  const isMe = tx._owner === 'me';
                  return (
                    <tr key={tx.id + tx._owner} className="hover:bg-dark-700/50 transition-colors group">
                      <td className="px-3 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full ${isMe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {isMe ? me.name : partner.name}
                        </span>
                      </td>
                      <td className="px-3 py-3"><span className={tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}>{tx.type === 'INCOME' ? '↑' : '↓'} {tx.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</span></td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1">
                          {tx.category?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: tx.category.color}}/>}
                          <span className="text-slate-300 text-xs truncate max-w-20">{tx.category?.name || '—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {tx.sharedAccount ? <span className="text-violet-400 truncate max-w-20 block">{tx.sharedAccount.name} 💑</span>
                          : tx.account ? <span className="text-slate-300 truncate max-w-20 block">{tx.account.name}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{tx.paymentType ? PT[tx.paymentType] : '—'}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs truncate max-w-24">{tx.comment || '—'}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isMe ? (
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setTxModal({ open:true, tx })} className="w-7 h-7 rounded-lg bg-dark-600 hover:bg-accent/20 text-slate-400 hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                            <button onClick={async () => { if (confirm('¿Eliminar?')) { await api.delete(`/transactions/${tx.id}`); fetchAll(page); } }} className="w-7 h-7 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                          </div>
                        ) : <span className="text-xs text-slate-600">👁️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-dark-600">
            {displayed.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">Sin transacciones</div>}
            {displayed.map(tx => {
              const isMe = tx._owner === 'me';
              return (
                <div key={tx.id + tx._owner} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full ${isMe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {isMe ? me.name : partner.name}
                      </span>
                      <span className={tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}>{tx.type === 'INCOME' ? '↑ Ing' : '↓ Gst'}</span>
                    </div>
                    <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div className="font-mono">{formatDate(tx.date)}</div>
                      {tx.category && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: tx.category.color}}/>{tx.category.name}</div>}
                      {(tx.account || tx.sharedAccount) && <div>{(tx.account || tx.sharedAccount)?.name}{tx.sharedAccount && ' 💑'}</div>}
                      {tx.paymentType && <div>{PT[tx.paymentType]}</div>}
                    </div>
                    {isMe && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => setTxModal({ open:true, tx })} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-accent/20 text-slate-400 hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                        <button onClick={async () => { if (confirm('¿Eliminar?')) { await api.delete(`/transactions/${tx.id}`); fetchAll(page); } }} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-mono">Página {page} de {totalPages}</span>
              <div className="flex gap-2 items-center">
                <button disabled={page <= 1} onClick={() => { setPage(p => p-1); fetchAll(page-1); }} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                <button disabled={page >= totalPages} onClick={() => { setPage(p => p+1); fetchAll(page+1); }} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TransactionModal open={txModal.open} transaction={txModal.tx}
        onClose={() => setTxModal({ open:false, tx:null })} onSaved={() => fetchAll(page)} />
    </div>
  );
}
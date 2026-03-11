import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import TransactionModal from '../components/ui/TransactionModal';
import { generatePDF } from '../utils/pdfExport';
import { generateExcel } from '../utils/excelExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmtMonth = m => { if(!m)return''; const [y,mo]=m.split('-'); return new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'}); };
const ttStyle  = { backgroundColor:'#111118', border:'1px solid #2e2e3e', borderRadius:'12px', color:'#e2e8f0', fontSize:'12px' };
const PT       = { EFECTIVO:'💵 Ef.', DEBITO:'💳 Déb.', CREDITO:'💳 Cré.', TRANSFERENCIA:'🏦 Tr.' };
const fmtARS   = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD   = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);
const currentMonth = () => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };

export default function SharedDashboardPage() {
  const { partnerId } = useParams();

  const [data, setData]             = useState(null);
  const [partnerAccounts, setPartnerAccounts] = useState([]);
  const [transactions, setTx]       = useState([]);
  const [page, setPage]             = useState(1);
  const [totalPages, setTP]         = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [txModal, setTxModal]       = useState({ open:false, tx:null });
  const [viewMode, setView]         = useState('combined');
  const [filterMode, setFilterMode] = useState('month');
  const [filters, setFilters]       = useState({ month: currentMonth() });
  const [showMore, setShowMore]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [categories, setCats]       = useState([]);
  const [myAccounts, setMyAccounts] = useState([]);
  const [sharedAccts, setSharedAccts] = useState([]);
  const [availMonths, setAvailMonths] = useState([]);
  const [availYears, setAvailYears]   = useState([]);

  useEffect(() => {
    api.get('/categories').then(r=>setCats(r.data)).catch(()=>{});
    api.get('/accounts').then(r=>setMyAccounts(r.data)).catch(()=>{});
    api.get('/shared-accounts').then(r=>setSharedAccts(r.data)).catch(()=>{});
    api.get(`/partnerships/partner/${partnerId}/accounts`).then(r=>setPartnerAccounts(r.data||[])).catch(()=>{});
    api.get('/transactions?page=1&limit=5000').then(r=>{
      const txs = r.data.data||[];
      const ms=new Set(), ys=new Set();
      txs.forEach(tx=>{ const d=new Date(tx.date); const y=d.getUTCFullYear(); const m=String(d.getUTCMonth()+1).padStart(2,'0'); ms.add(`${y}-${m}`); ys.add(String(y)); });
      setAvailMonths([...ms].sort((a,b)=>b.localeCompare(a)).map(v=>{ const [y,m]=v.split('-'); return { val:v, label:new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}) }; }));
      setAvailYears([...ys].sort((a,b)=>b.localeCompare(a)));
    }).catch(()=>{});
  }, [partnerId]);

  const fetchAll = useCallback(async (pg=1, f=filters) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams(
        Object.fromEntries(Object.entries(f).filter(([,v])=>v))
      ).toString();
      const [dashRes, txMine, txPartner] = await Promise.all([
        api.get(`/dashboard/shared/${partnerId}${q?'?'+q:''}`),
        api.get(`/transactions?page=${pg}&limit=15&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
        api.get(`/partnerships/partner/${partnerId}/transactions?page=${pg}&limit=15${q?'&'+q:''}`),
      ]);
      setData(dashRes.data);
      const combined = [
        ...( txMine.data.data    || []).map(t=>({...t,_owner:'me'})),
        ...( txPartner.data.data || []).map(t=>({...t,_owner:'partner'})),
      ].sort((a,b)=>new Date(b.date)-new Date(a.date));
      setTx(combined);
      setTP(Math.max(txMine.data.pagination?.pages||1, txPartner.data.pagination?.pages||1));
    } catch(err) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
    } finally { setLoading(false); }
  }, [partnerId, filters]);

  useEffect(() => { fetchAll(1); }, [partnerId]);

  const applyFilters = (f) => { setFilters(f); fetchAll(1, f); };
  const clearAll = () => { setFilterMode('month'); applyFilters({ month: currentMonth() }); };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && !data) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-slate-500 text-sm">Cargando...</div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && !data) return (
    <div className="p-4 sm:p-8">
      <div className="card p-8 text-center max-w-sm mx-auto">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-white font-display font-bold mb-1">Sin acceso</div>
        <div className="text-slate-400 text-sm mb-5">{error}</div>
        <Link to="/partnerships" className="btn-primary text-sm">Ver vínculos</Link>
      </div>
    </div>
  );

  if (!data) return null;

  // ── Safe destructure with defaults ────────────────────────────────────────
  const me               = data.me            || {};
  const partner          = data.partner        || {};
  const myData           = data.my             || { kpis:{ totalIncome:0, totalExpense:0, balance:0, savingsRate:0 } };
  const partnerData      = data.partnerData    || { kpis:{ totalIncome:0, totalExpense:0, balance:0, savingsRate:0 } };
  const combined         = data.combined       || { totalIncome:0, totalExpense:0, balance:0 };
  const combinedMonthly  = data.combinedMonthly|| [];
  const sharedAccounts   = data.sharedAccounts || [];

  const displayed = viewMode==='mine'    ? transactions.filter(t=>t._owner==='me')
                  : viewMode==='partner' ? transactions.filter(t=>t._owner==='partner')
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
          <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">
            {me.name} & {partner.name}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">Finanzas combinadas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={async()=>{
            setGenerating('pdf');
            try {
              const q=new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v))).toString();
              const [r1,r2]=await Promise.all([
                api.get(`/transactions?page=1&limit=1000&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
                api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=1000${q?'&'+q:''}`),
              ]);
              const all=[...(r1.data.data||[]),...(r2.data.data||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
              generatePDF({ kpis:combined, transactions:all, filters });
            } catch(e){console.error(e);} finally{setGenerating(false);}
          }} disabled={!!generating} className="btn-secondary text-xs py-2 px-3">
            {generating==='pdf'?'...':'📄 PDF'}
          </button>
          <button onClick={async()=>{
            setGenerating('excel');
            try {
              const q=new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v))).toString();
              const [r1,r2]=await Promise.all([
                api.get(`/transactions?page=1&limit=5000&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
                api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=5000${q?'&'+q:''}`),
              ]);
              const all=[...(r1.data.data||[]),...(r2.data.data||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
              generateExcel({ transactions:all, filters, kpis:combined });
            } catch(e){console.error(e);} finally{setGenerating(false);}
          }} disabled={!!generating} className="btn-secondary text-xs py-2 px-3">
            {generating==='excel'?'...':'📊 Excel'}
          </button>
          <button onClick={()=>setTxModal({open:true,tx:null})} className="btn-primary text-xs py-2 px-3">+ Nueva</button>
        </div>
      </div>

      {/* Period filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500">
            {[['month','📅 Mes'],['year','📆 Año'],['range','🗓️ Rango']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilterMode(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${filterMode===v?'bg-accent text-white':'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>

          {filterMode==='month' && (
            <select className="input text-xs py-2 max-w-[200px]"
              value={filters.month||currentMonth()}
              onChange={e=>applyFilters({ month:e.target.value })}>
              {availMonths.length===0 && <option value={currentMonth()}>{new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'})}</option>}
              {availMonths.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          )}
          {filterMode==='year' && (
            <select className="input text-xs py-2 w-24"
              value={filters.year||String(new Date().getFullYear())}
              onChange={e=>applyFilters({ year:e.target.value })}>
              {availYears.length===0 && <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
              {availYears.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {filterMode==='range' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input text-xs py-2 w-36" value={filters.dateFrom||''}
                onChange={e=>applyFilters({...filters, dateFrom:e.target.value, month:undefined, year:undefined})} />
              <span className="text-slate-500 text-xs">—</span>
              <input type="date" className="input text-xs py-2 w-36" value={filters.dateTo||''}
                onChange={e=>applyFilters({...filters, dateTo:e.target.value, month:undefined, year:undefined})} />
            </div>
          )}

          <button onClick={()=>setShowMore(o=>!o)}
            className={`btn-secondary text-xs py-2 px-3 ${showMore?'border-accent/40 text-accent-light':''}`}>
            ⚙️ Más filtros
          </button>
          <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">✕ Limpiar</button>
        </div>

        {showMore && (
          <div className="card p-3 border-accent/20 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input text-xs" value={filters.type||''} onChange={e=>applyFilters({...filters,type:e.target.value||undefined})}>
                <option value="">Todos</option><option value="INCOME">Ingresos</option><option value="EXPENSE">Gastos</option>
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input text-xs" value={filters.categoryId||''} onChange={e=>applyFilters({...filters,categoryId:e.target.value||undefined})}>
                <option value="">Todas</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cuenta</label>
              <select className="input text-xs"
                value={filters.accountId?`personal::${filters.accountId}`:filters.sharedAccountId?`shared::${filters.sharedAccountId}`:''}
                onChange={e=>{
                  const v=e.target.value;
                  if(!v){applyFilters({...filters,accountId:undefined,sharedAccountId:undefined});return;}
                  const [t,id]=v.split('::');
                  t==='personal'
                    ?applyFilters({...filters,accountId:id,sharedAccountId:undefined})
                    :applyFilters({...filters,sharedAccountId:id,accountId:undefined});
                }}>
                <option value="">Todas</option>
                {myAccounts.length>0&&<optgroup label="Mis cuentas">{myAccounts.map(a=><option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}</optgroup>}
                {sharedAccts.length>0&&<optgroup label="Compartidas">{sharedAccts.map(a=><option key={a.id} value={`shared::${a.id}`}>{a.name}</option>)}</optgroup>}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Combined totals */}
      <div className="card p-4 border-violet-500/20 bg-violet-500/5">
        <h2 className="text-xs font-display font-semibold text-violet-400 uppercase tracking-widest mb-3">Totales Combinados</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-around gap-2 sm:gap-0">
          {[
            ['Ingresos totales', formatCurrency(combined.totalIncome),  'text-income'],
            ['Gastos totales',   formatCurrency(combined.totalExpense), 'text-expense'],
            ['Balance neto',     formatCurrency(combined.balance),      combined.balance>=0?'text-income':'text-expense'],
          ].map(([label,value,cls])=>(
            <div key={label} className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center sm:px-4">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-sm sm:text-lg font-display font-bold font-mono ${cls}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-side KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          [me.name+' (yo)',  myData.kpis,      'bg-emerald-400'],
          [partner.name,     partnerData.kpis, 'bg-orange-400'],
        ].map(([name, kpis, dot])=>(
          <div key={name} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${dot}`}/>
              <h2 className="text-sm font-display font-bold text-white">{name}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="Ingresos" value={formatCurrency(kpis.totalIncome)}  color="income" />
              <KpiCard label="Gastos"   value={formatCurrency(kpis.totalExpense)} color="expense" />
              <KpiCard label="Balance"  value={formatCurrency(kpis.balance)}      color={kpis.balance>=0?'income':'expense'} />
              <KpiCard label="Ahorro"   value={`${kpis.savingsRate}%`}            color="accent" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {combinedMonthly.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-display font-bold text-white mb-4">Comparación Mensual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={combinedMonthly} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{fill:'#64748b',fontSize:10}} />
              <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} tick={{fill:'#64748b',fontSize:10}} width={40} />
              <Tooltip contentStyle={ttStyle} formatter={v=>formatCurrency(v)} />
              <Legend formatter={v=><span style={{color:'#94a3b8',fontSize:'11px'}}>{v}</span>} />
              <Bar dataKey="myExpense"      name={`${me.name} gst`}      fill="#f43f5e" radius={[3,3,0,0]} />
              <Bar dataKey="partnerExpense" name={`${partner.name} gst`} fill="#f97316" radius={[3,3,0,0]} />
              <Bar dataKey="myIncome"       name={`${me.name} ing`}      fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="partnerIncome"  name={`${partner.name} ing`} fill="#06b6d4" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Cuentas ── */}
      <div>
        <h2 className="text-sm font-display font-bold text-white mb-3">Sus Finanzas — Cuentas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Mis cuentas */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"/>
              <span className="text-xs font-display font-semibold text-slate-300">{me.name} (mis cuentas)</span>
            </div>
            {myAccounts.length === 0
              ? <div className="card p-4 text-center text-slate-500 text-xs">Sin cuentas personales</div>
              : (
                <div className="space-y-2">
                  {myAccounts.map(a => (
                    <div key={a.id} className="card p-3 border-dark-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:a.color}}/>
                          <span className="text-xs font-semibold text-white truncate">{a.name}</span>
                          {a.accountType==='INVESTMENT'&&<span className="text-xs text-slate-500">📈</span>}
                          {a.accountType==='CREDIT'&&<span className="text-xs text-slate-500">💳</span>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className={`text-sm font-mono font-bold ${(a.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(a.currentBalance)}</div>
                          {(a.currentBalanceUSD||0)!==0&&<div className="text-xs font-mono text-yellow-400">{fmtUSD(a.currentBalanceUSD)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="card p-2 bg-dark-700 border-dark-400 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Total ARS</span>
                      <span className="font-mono font-bold text-income">{fmtARS(myAccounts.reduce((s,a)=>s+(a.currentBalance||0),0))}</span>
                    </div>
                    {myAccounts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0) !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Total USD</span>
                        <span className="font-mono font-bold text-yellow-400">{fmtUSD(myAccounts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          </div>

          {/* Cuentas del partner */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400"/>
              <span className="text-xs font-display font-semibold text-slate-300">{partner.name} (sus cuentas)</span>
            </div>
            {partnerAccounts.length === 0
              ? <div className="card p-4 text-center text-slate-500 text-xs">Sin cuentas visibles</div>
              : (
                <div className="space-y-2">
                  {partnerAccounts.map(a => (
                    <div key={a.id} className="card p-3 border-dark-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:a.color}}/>
                          <span className="text-xs font-semibold text-white truncate">{a.name}</span>
                          {a.accountType==='INVESTMENT'&&<span className="text-xs text-slate-500">📈</span>}
                          {a.accountType==='CREDIT'&&<span className="text-xs text-slate-500">💳</span>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className={`text-sm font-mono font-bold ${(a.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(a.currentBalance)}</div>
                          {(a.currentBalanceUSD||0)!==0&&<div className="text-xs font-mono text-yellow-400">{fmtUSD(a.currentBalanceUSD)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="card p-2 bg-dark-700 border-dark-400 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Total ARS</span>
                      <span className="font-mono font-bold text-orange-400">{fmtARS(partnerAccounts.reduce((s,a)=>s+(a.currentBalance||0),0))}</span>
                    </div>
                    {partnerAccounts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0) !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Total USD</span>
                        <span className="font-mono font-bold text-yellow-400">{fmtUSD(partnerAccounts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          </div>

          {/* Cuentas compartidas */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-violet-400"/>
              <span className="text-xs font-display font-semibold text-slate-300">Cuentas compartidas</span>
            </div>
            {sharedAccts.length === 0
              ? <div className="card p-4 text-center text-slate-500 text-xs">Sin cuentas compartidas</div>
              : (
                <div className="space-y-2">
                  {sharedAccts.map(a => (
                    <div key={a.id} className="card p-3 border-violet-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:a.color}}/>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{a.name}</div>
                            <div className="text-xs text-violet-400">con {a.partner?.name}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className={`text-sm font-mono font-bold ${(a.currentBalance||0)>=0?'text-income':'text-expense'}`}>{fmtARS(a.currentBalance)}</div>
                          {(a.currentBalanceUSD||0)!==0&&<div className="text-xs font-mono text-yellow-400">{fmtUSD(a.currentBalanceUSD)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="card p-2 bg-dark-700 border-dark-400 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Total ARS</span>
                      <span className="font-mono font-bold text-violet-400">{fmtARS(sharedAccts.reduce((s,a)=>s+(a.currentBalance||0),0))}</span>
                    </div>
                    {sharedAccts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0) !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Total USD</span>
                        <span className="font-mono font-bold text-yellow-400">{fmtUSD(sharedAccts.reduce((s,a)=>s+(a.currentBalanceUSD||0),0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          </div>

          {/* Gran total combinado */}
          {(() => {
            const totalARS = [
              ...myAccounts,
              ...partnerAccounts,
              ...sharedAccts,
            ].reduce((s,a) => s + (a.currentBalance||0), 0);

            const totalUSD = [
              ...myAccounts,
              ...partnerAccounts,
              ...sharedAccts,
            ].reduce((s,a) => s + (a.currentBalanceUSD||0), 0);

            return (
              <div className="card p-4 border-accent/30 bg-accent/5 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-accent"/>
                  <span className="text-xs font-display font-bold text-accent-light uppercase tracking-widest">Patrimonio Total Combinado</span>
                </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-dark-700 rounded-xl p-3 min-w-0">
                    <div className="text-xs text-slate-500 mb-1">Total ARS</div>
                    <div className={`font-mono font-bold leading-tight ${totalARS >= 0 ? 'text-income' : 'text-expense'}`}
                      style={{fontSize:'clamp(11px, 3vw, 18px)'}}>
                      {fmtARS(totalARS)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">mis cuentas + {partner.name} + compartidas</div>
                  </div>
                  {totalUSD !== 0 && (
                    <div className="bg-dark-700 rounded-xl p-3 min-w-0">
                      <div className="text-xs text-slate-500 mb-1">Total USD</div>
                      <div className={`font-mono font-bold leading-tight ${totalUSD >= 0 ? 'text-yellow-400' : 'text-expense'}`}
                        style={{fontSize:'clamp(11px, 3vw, 18px)'}}>
                        {fmtUSD(totalUSD)}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">mis cuentas + {partner.name} + compartidas</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-display font-bold text-white">Transacciones</h2>
          <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500">
            {[['combined','Ambos'],['mine','Yo'],['partner',partner.name?.split(' ')[0]||'Partner']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${viewMode===v?'bg-accent text-white':'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-dark-500">
                {['Fecha','Usuario','Tipo','Categoría','Cuenta','Pago','Comentario','Monto',''].map((h,i)=>(
                  <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-slate-500 uppercase ${i===7?'text-right':i===8?'text-center':'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-dark-600">
                {displayed.length===0 && <tr><td colSpan={9} className="text-center py-10 text-slate-500 text-sm">Sin transacciones</td></tr>}
                {displayed.map(tx=>{
                  const isMe=tx._owner==='me';
                  return (
                    <tr key={tx.id+tx._owner} className="hover:bg-dark-700/50 transition-colors group">
                      <td className="px-3 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full ${isMe?'bg-emerald-500/20 text-emerald-400':'bg-orange-500/20 text-orange-400'}`}>
                          {isMe?me.name:partner.name}
                        </span>
                      </td>
                      <td className="px-3 py-3"><span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ingreso':'↓ Gasto'}</span></td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1">
                          {tx.category?.color&&<span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:tx.category.color}}/>}
                          <span className="text-slate-300 text-xs truncate max-w-20">{tx.category?.name||'—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {tx.sharedAccount?<span className="text-violet-400 truncate max-w-20 block">{tx.sharedAccount.name} 💑</span>
                        :tx.account?<span className="text-slate-300 truncate max-w-20 block">{tx.account.name}</span>
                        :<span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{tx.paymentType?PT[tx.paymentType]:'—'}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs truncate max-w-24">{tx.comment||'—'}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>
                        {tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isMe?(
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>setTxModal({open:true,tx})} className="w-7 h-7 rounded-lg bg-dark-600 hover:bg-accent/20 text-slate-400 hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                            <button onClick={async()=>{if(confirm('¿Eliminar?')){await api.delete(`/transactions/${tx.id}`);fetchAll(page);}}} className="w-7 h-7 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                          </div>
                        ):<span className="text-xs text-slate-600">👁️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-dark-600">
            {displayed.length===0&&<div className="text-center py-10 text-slate-500 text-sm">Sin transacciones</div>}
            {displayed.map(tx=>{
              const isMe=tx._owner==='me';
              return (
                <div key={tx.id+tx._owner} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full ${isMe?'bg-emerald-500/20 text-emerald-400':'bg-orange-500/20 text-orange-400'}`}>{isMe?me.name:partner.name}</span>
                      <span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑ Ing':'↓ Gst'}</span>
                    </div>
                    <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>{tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div className="font-mono">{formatDate(tx.date)}</div>
                      {tx.category&&<div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:tx.category.color}}/>{tx.category.name}</div>}
                      {(tx.account||tx.sharedAccount)&&<div>{(tx.account||tx.sharedAccount)?.name}{tx.sharedAccount&&' 💑'}</div>}
                    </div>
                    {isMe&&(
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={()=>setTxModal({open:true,tx})} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-accent/20 text-slate-400 hover:text-accent-light flex items-center justify-center text-xs">✏️</button>
                        <button onClick={async()=>{if(confirm('¿Eliminar?')){await api.delete(`/transactions/${tx.id}`);fetchAll(page);}}} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages>1&&(
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-mono">Pág {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={()=>{setPage(p=>p-1);fetchAll(page-1);}} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                <button disabled={page>=totalPages} onClick={()=>{setPage(p=>p+1);fetchAll(page+1);}} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TransactionModal open={txModal.open} transaction={txModal.tx}
        onClose={()=>setTxModal({open:false,tx:null})} onSaved={()=>fetchAll(page)} />
    </div>
  );
}

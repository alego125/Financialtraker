import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';

const PRESET_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16','#7c3aed','#6b7280'];
const ACCOUNT_TYPES = [
  { value:'REGULAR',    label:'🏦 Cuenta Bancaria', desc:'Ingresos, gastos y transferencias' },
  { value:'INVESTMENT', label:'📈 Inversión',        desc:'Solo transferencias (ej: plazo fijo)' },
  { value:'CREDIT',     label:'💳 Tarjeta Crédito',  desc:'Solo gastos, se paga con transferencia' },
];

function AmountInput({ value, onChange, placeholder='0,00' }) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    if (value === '' || value == null) { setDisplay(''); return; }
    const n = parseFloat(value);
    if (!isNaN(n)) setDisplay(new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n));
  }, [value]);
  const handleChange = (e) => {
    const raw = e.target.value; setDisplay(raw);
    const cleaned = raw.replace(/\./g,'').replace(',','.');
    const n = parseFloat(cleaned);
    onChange(isNaN(n) ? '' : String(n));
  };
  return <input type="text" inputMode="decimal" className="input" placeholder={placeholder} value={display} onChange={handleChange} />;
}

// ── Account Modal ──────────────────────────────────────────────────────────────
function AccountModal({ open, onClose, onSaved, account }) {
  const [form, setForm]       = useState({ name:'', initialBalance:'', initialBalanceUSD:'', color:'#3b82f6', accountType:'REGULAR' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    setForm(account ? {
      name: account.name, color: account.color, accountType: account.accountType || 'REGULAR',
      initialBalance: String(account.initialBalance || 0),
      initialBalanceUSD: String(account.initialBalanceUSD || 0),
    } : { name:'', initialBalance:'', initialBalanceUSD:'', color:'#3b82f6', accountType:'REGULAR' });
    setError('');
  }, [account, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    setLoading(true); setError('');
    try {
      const payload = { ...form, initialBalance: parseFloat(form.initialBalance||0), initialBalanceUSD: parseFloat(form.initialBalanceUSD||0) };
      if (account) await api.put(`/accounts/${account.id}`, payload);
      else         await api.post('/accounts', payload);
      onSaved(); onClose();
    } catch(err) { setError(err.response?.data?.error || 'Error al guardar'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Editar Cuenta' : 'Nueva Cuenta'} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" placeholder="Ej: Santander..." value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required />
        </div>
        <div>
          <label className="label">Tipo de Cuenta</label>
          <div className="space-y-2">
            {ACCOUNT_TYPES.map(t => (
              <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.accountType===t.value ? 'border-accent/50 bg-accent/10' : 'border-dark-400 bg-dark-700 hover:border-dark-300'}`}>
                <input type="radio" name="accountType" value={t.value} checked={form.accountType===t.value} onChange={e=>setForm(p=>({...p,accountType:e.target.value}))} className="mt-0.5 accent-accent" />
                <div>
                  <div className="text-sm font-display font-semibold text-white">{t.label}</div>
                  <div className="text-xs text-slate-500">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Saldo Inicial ARS</label>
            <AmountInput value={form.initialBalance} onChange={v=>setForm(p=>({...p,initialBalance:v}))} />
          </div>
          <div>
            <label className="label">Saldo Inicial USD</label>
            <AmountInput value={form.initialBalanceUSD} onChange={v=>setForm(p=>({...p,initialBalanceUSD:v}))} />
          </div>
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={()=>setForm(p=>({...p,color:c}))}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color===c?'border-white scale-110':'border-transparent hover:scale-105'}`}
                style={{backgroundColor:c}} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading?'Guardando...':account?'Actualizar':'Crear'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Shared Account Modal ───────────────────────────────────────────────────────
function SharedAccountModal({ open, onClose, onSaved, account, partners }) {
  const [form, setForm]       = useState({ name:'', initialBalance:'', color:'#7c3aed', partnerId:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(() => {
    setForm(account
      ? { name:account.name, initialBalance:String(account.initialBalance||0), color:account.color, partnerId:account.partner?.id||'' }
      : { name:'', initialBalance:'', color:'#7c3aed', partnerId:partners[0]?.partner?.id||'' });
    setError('');
  }, [account, open, partners]);
  const handleSubmit = async(e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    if (!form.partnerId && !account) return setError('Seleccioná un partner');
    setLoading(true); setError('');
    try {
      const payload = { ...form, initialBalance: parseFloat(form.initialBalance||0) };
      if (account) await api.put(`/shared-accounts/${account.id}`, payload);
      else         await api.post('/shared-accounts', payload);
      onSaved(); onClose();
    } catch(err) { setError(err.response?.data?.error||'Error al guardar'); }
    finally { setLoading(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={account?'Editar Cuenta Compartida':'Nueva Cuenta Compartida'} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label">Nombre</label><input type="text" className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required /></div>
        {!account && partners.length>0 && (
          <div><label className="label">Compartir con</label>
            <select className="input" value={form.partnerId} onChange={e=>setForm(p=>({...p,partnerId:e.target.value}))}>
              {partners.map(p=><option key={p.partner.id} value={p.partner.id}>{p.partner.name} ({p.partner.email})</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Saldo Inicial</label><AmountInput value={form.initialBalance} onChange={v=>setForm(p=>({...p,initialBalance:v}))} /></div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">{PRESET_COLORS.map(c=>(
            <button key={c} type="button" onClick={()=>setForm(p=>({...p,color:c}))}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color===c?'border-white scale-110':'border-transparent'}`}
              style={{backgroundColor:c}} />
          ))}</div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading?'Guardando...':account?'Actualizar':'Crear'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer Modal ─────────────────────────────────────────────────────────────
function TransferModal({ open, onClose, onSaved, accounts, sharedAccounts }) {
  const df = { amount:'', date:new Date().toISOString().slice(0,10), comment:'', fromId:'', toId:'' };
  const [form, setForm]       = useState(df);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(() => { if(open){setForm(df);setError('');} }, [open]);
  const parse = (val,dir) => {
    if(!val) return {};
    const [kind,id] = val.split('::');
    return kind==='personal' ? {[`${dir}AccountId`]:id} : {[`${dir}SharedAccountId`]:id};
  };
  const handleSubmit = async(e) => {
    e.preventDefault(); setError('');
    if(!form.fromId) return setError('Seleccioná cuenta origen');
    if(!form.toId)   return setError('Seleccioná cuenta destino');
    if(form.fromId===form.toId) return setError('Origen y destino no pueden ser iguales');
    setLoading(true);
    try {
      await api.post('/transfers',{amount:parseFloat(form.amount),date:form.date,comment:form.comment||undefined,...parse(form.fromId,'from'),...parse(form.toId,'to')});
      onSaved(); onClose();
    } catch(err){ setError(err.response?.data?.error||'Error'); }
    finally{setLoading(false);}
  };
  return (
    <Modal open={open} onClose={onClose} title="Nueva Transferencia">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Monto</label><AmountInput value={form.amount} onChange={v=>setForm(p=>({...p,amount:v}))} /></div>
          <div><label className="label">Fecha</label><input type="date" className="input" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} required /></div>
        </div>
        <div>
          <label className="label">Cuenta origen</label>
          <select className="input" value={form.fromId} onChange={e=>setForm(p=>({...p,fromId:e.target.value}))} required>
            <option value="">Seleccionar...</option>
            {accounts.length>0&&<optgroup label="Mis cuentas">{accounts.map(a=><option key={a.id} value={`personal::${a.id}`}>{a.name}{a.accountType==='INVESTMENT'?' 📈':a.accountType==='CREDIT'?' 💳':''}</option>)}</optgroup>}
            {sharedAccounts.length>0&&<optgroup label="Compartidas">{sharedAccounts.map(a=><option key={a.id} value={`shared::${a.id}`}>{a.name} 💑</option>)}</optgroup>}
          </select>
        </div>
        <div className="flex items-center justify-center"><div className="text-slate-600 text-2xl">↓</div></div>
        <div>
          <label className="label">Cuenta destino</label>
          <select className="input" value={form.toId} onChange={e=>setForm(p=>({...p,toId:e.target.value}))} required>
            <option value="">Seleccionar...</option>
            {accounts.length>0&&<optgroup label="Mis cuentas">{accounts.map(a=><option key={a.id} value={`personal::${a.id}`}>{a.name}{a.accountType==='INVESTMENT'?' 📈':a.accountType==='CREDIT'?' 💳':''}</option>)}</optgroup>}
            {sharedAccounts.length>0&&<optgroup label="Compartidas">{sharedAccounts.map(a=><option key={a.id} value={`shared::${a.id}`}>{a.name} 💑</option>)}</optgroup>}
          </select>
        </div>
        <div><label className="label">Comentario (opcional)</label><input type="text" className="input" value={form.comment} onChange={e=>setForm(p=>({...p,comment:e.target.value}))} /></div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading?'Transfiriendo...':'Transferir'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Currency Exchange Modal ────────────────────────────────────────────────────
function ExchangeModal({ open, onClose, onSaved, account }) {
  const df = { usdAmount:'', rate:'', date:new Date().toISOString().slice(0,10), comment:'' };
  const [form, setForm]       = useState(df);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(()=>{if(open){setForm(df);setError('');}}, [open]);
  const arsTotal = form.usdAmount && form.rate ? (parseFloat(form.usdAmount||0) * parseFloat(form.rate||0)) : 0;
  const handleSubmit = async(e) => {
    e.preventDefault(); setError('');
    if(!form.usdAmount||!form.rate) return setError('Completá todos los campos');
    setLoading(true);
    try {
      await api.post(`/accounts/${account.id}/exchange`,{ usdAmount:parseFloat(form.usdAmount), rate:parseFloat(form.rate), date:form.date, comment:form.comment||undefined });
      onSaved(); onClose();
    } catch(err){ setError(err.response?.data?.error||'Error'); }
    finally{setLoading(false);}
  };
  if(!account) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Comprar USD — ${account.name}`} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">USD a comprar</label>
            <AmountInput value={form.usdAmount} onChange={v=>setForm(p=>({...p,usdAmount:v}))} placeholder="100,00" />
          </div>
          <div>
            <label className="label">Precio de compra (ARS/USD)</label>
            <AmountInput value={form.rate} onChange={v=>setForm(p=>({...p,rate:v}))} placeholder="1.200,00" />
          </div>
        </div>
        {arsTotal>0 && (
          <div className="bg-dark-700 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-500 mb-1">Total a debitar en ARS</div>
            <div className="text-lg font-mono font-bold text-expense">
              {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(arsTotal)}
            </div>
          </div>
        )}
        <div><label className="label">Fecha</label><input type="date" className="input" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} required /></div>
        <div><label className="label">Comentario (opcional)</label><input type="text" className="input" placeholder="Ej: Compra dólar blue..." value={form.comment} onChange={e=>setForm(p=>({...p,comment:e.target.value}))} /></div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading?'Comprando...':'Confirmar Compra'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Account Detail Drawer ──────────────────────────────────────────────────────
function AccountDetail({ account, isShared, onClose, onEdit, onDelete, onExchange }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [total, setTotal]               = useState(0);

  const fetchTx = useCallback(async(pg=1) => {
    setLoading(true);
    try {
      const param = isShared ? `sharedAccountId=${account.id}` : `accountId=${account.id}`;
      const { data } = await api.get(`/transactions?${param}&page=${pg}&limit=15&sortBy=date&sortOrder=desc`);
      setTransactions(data.data); setPages(data.pagination.pages); setTotal(data.pagination.total); setPage(pg);
    } catch(err){ console.error(err); }
    finally { setLoading(false); }
  }, [account.id, isShared]);

  useEffect(()=>{ fetchTx(1); }, [fetchTx]);

  const typeBadge = { INVESTMENT:'📈 Inversión', CREDIT:'💳 Crédito', REGULAR:'' };
  const PT = { EFECTIVO:'💵', DEBITO:'💳', CREDITO:'💳', TRANSFERENCIA:'🏦' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-dark-800 border-l border-dark-500 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
              style={{backgroundColor:account.color+'33', border:`1px solid ${account.color}88`, color:account.color}}>
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-white truncate">{account.name}</div>
              {account.accountType && account.accountType !== 'REGULAR' && (
                <div className="text-xs text-accent-light">{typeBadge[account.accountType]}</div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 text-slate-400 hover:text-white flex items-center justify-center flex-shrink-0">✕</button>
        </div>

        {/* Balances */}
        <div className="px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-dark-700 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Saldo ARS</div>
              <div className={`font-mono font-bold text-sm ${account.currentBalance>=0?'text-income':'text-expense'}`}>
                {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(account.currentBalance)}
              </div>
            </div>
            <div className="bg-dark-700 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Saldo USD</div>
              <div className={`font-mono font-bold text-sm ${(account.currentBalanceUSD||0)>=0?'text-income':'text-expense'}`}>
                {new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(account.currentBalanceUSD||0)}
              </div>
            </div>
          </div>
          <div className="bg-dark-700 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Transacciones</div>
              <div className="font-mono font-semibold text-slate-300 text-sm">{total}</div>
            </div>
            {!isShared && (
              <button onClick={onExchange} className="text-xs bg-gold/20 text-gold-light border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/30 transition-colors font-display font-semibold">
                💱 Comprar USD
              </button>
            )}
          </div>
        </div>

        {/* Transactions */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Cargando...</div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-slate-400 text-sm">Sin transacciones en esta cuenta</div>
            </div>
          ) : (
            <div className="divide-y divide-dark-600">
              {transactions.map(tx => {
                const isTransfer = tx.comment?.startsWith('[Transferencia');
                const isUSD = tx.currency === 'USD';
                return (
                  <div key={tx.id} className="px-5 py-3 flex items-center gap-3 hover:bg-dark-700/40 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                      isTransfer ? 'bg-accent/20 text-accent-light' :
                      tx.type==='INCOME' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense'}`}>
                      {isTransfer ? '↔' : tx.type==='INCOME' ? '↑' : '↓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-display font-semibold text-slate-300 truncate">
                          {isTransfer ? 'Transferencia' : tx.category?.name || '—'}
                        </span>
                        {isTransfer && <span className="text-xs bg-accent/20 text-accent-light border border-accent/30 px-1.5 py-0.5 rounded-full flex-shrink-0">transf.</span>}
                        {isUSD && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">USD</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">{formatDate(tx.date)}</span>
                        {tx.paymentType && <span className="text-xs text-slate-600">{PT[tx.paymentType]}</span>}
                        {tx.comment && !isTransfer && <span className="text-xs text-slate-600 truncate">{tx.comment}</span>}
                      </div>
                    </div>
                    <div className={`font-mono font-bold text-sm flex-shrink-0 ${
                      isTransfer ? 'text-accent-light' :
                      tx.type==='INCOME' ? 'text-income' : 'text-expense'}`}>
                      {tx.type==='INCOME'?'+':'-'}{isUSD
                        ? new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(tx.amount)
                        : new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pages>1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-dark-500 flex-shrink-0">
            <span className="text-xs text-slate-500 font-mono">Página {page} de {pages}</span>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>fetchTx(page-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
              <button disabled={page>=pages} onClick={()=>fetchTx(page+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-dark-500 flex gap-2 flex-shrink-0">
          <button onClick={onEdit}   className="flex-1 btn-secondary text-xs py-2">✏️ Editar</button>
          <button onClick={onDelete} className="btn-danger text-xs py-2 px-4">🗑️ Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ account, isShared, onClick }) {
  const typeBadge = { INVESTMENT:'📈', CREDIT:'💳' };
  const hasUSD = (account.currentBalanceUSD || 0) !== 0 || (account.initialBalanceUSD || 0) !== 0;
  return (
    <div onClick={onClick} className="card p-4 border-dark-500 hover:border-accent/40 hover:bg-dark-700/50 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{backgroundColor:account.color+'33', border:`1px solid ${account.color}88`, color:account.color}}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold text-white group-hover:text-accent-light transition-colors truncate">{account.name}</div>
            {isShared && account.partner && <div className="text-xs text-violet-400 font-mono truncate">con {account.partner.name}</div>}
            <div className="text-xs text-slate-500 font-mono">{account.transactionCount} transacciones</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isShared && <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-mono">💑</span>}
          {account.accountType && account.accountType !== 'REGULAR' && (
            <span className="text-xs bg-dark-600 text-slate-400 border border-dark-400 px-2 py-0.5 rounded-full">{typeBadge[account.accountType]}</span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Saldo ARS</span>
          <span className={`font-mono font-bold ${account.currentBalance>=0?'text-income':'text-expense'}`}>
            {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(account.currentBalance)}
          </span>
        </div>
        {hasUSD && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Saldo USD</span>
            <span className={`font-mono font-bold text-sm ${(account.currentBalanceUSD||0)>=0?'text-yellow-400':'text-expense'}`}>
              {new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(account.currentBalanceUSD||0)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 pt-2 border-t border-dark-600 text-xs text-slate-600 group-hover:text-slate-400 transition-colors flex items-center gap-1">
        <span>Ver detalle</span><span>→</span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts]             = useState([]);
  const [sharedAccounts, setSharedAccounts] = useState([]);
  const [partners, setPartners]             = useState([]);
  const [transfers, setTransfers]           = useState([]);
  const [transferPages, setTransferPages]   = useState(1);
  const [transferPage, setTransferPage]     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [loadingTx, setLoadingTx]           = useState(false);
  const [activeTab, setActiveTab]           = useState('accounts');
  const [modal, setModal]                   = useState({ open:false, type:null, account:null });
  const [detail, setDetail]                 = useState(null);
  const [exchangeTarget, setExchangeTarget] = useState(null);
  const [deleteError, setDeleteError]       = useState('');

  const fetchAll = useCallback(async() => {
    setLoading(true);
    try {
      const [a,s,p] = await Promise.all([api.get('/accounts'),api.get('/shared-accounts'),api.get('/partnerships')]);
      setAccounts(a.data); setSharedAccounts(s.data); setPartners(p.data.filter(x=>x.status==='ACCEPTED'));
    } catch(err){ console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchTransfers = useCallback(async(pg=1) => {
    setLoadingTx(true);
    try {
      const { data } = await api.get(`/transfers?page=${pg}&limit=20`);
      setTransfers(data.data); setTransferPages(data.pagination.pages); setTransferPage(pg);
    } catch(err){ console.error(err); }
    finally { setLoadingTx(false); }
  }, []);

  useEffect(()=>{ fetchAll(); }, [fetchAll]);
  useEffect(()=>{ if(activeTab==='transfers') fetchTransfers(1); }, [activeTab]);

  const handleDelete = async(id, isShared) => {
    setDeleteError('');
    if(!confirm('¿Eliminar esta cuenta?')) return;
    try { await api.delete(`/${isShared?'shared-accounts':'accounts'}/${id}`); setDetail(null); fetchAll(); }
    catch(err){ setDeleteError(err.response?.data?.error||'Error al eliminar'); }
  };

  const handleDeleteTransfer = async(id) => {
    if(!confirm('¿Eliminar transferencia?')) return;
    try { await api.delete(`/transfers/${id}`); fetchAll(); fetchTransfers(transferPage); }
    catch(err){ alert(err.response?.data?.error||'Error'); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Cuentas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Administrá tus cuentas y transferencias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab==='accounts' ? (
            <>
              <button onClick={()=>setModal({open:true,type:'personal',account:null})} className="btn-primary text-xs py-2 px-3">+ Nueva Cuenta</button>
              {partners.length>0 && <button onClick={()=>setModal({open:true,type:'shared',account:null})} className="btn-secondary text-xs py-2 px-3">+ Compartida</button>}
            </>
          ) : (
            <button onClick={()=>setModal({open:true,type:'transfer',account:null})} className="btn-primary text-xs py-2 px-3">+ Nueva Transferencia</button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500 max-w-xs">
        {[['accounts','🏦 Cuentas'],['transfers','↔️ Movimientos']].map(([v,l]) => (
          <button key={v} onClick={()=>setActiveTab(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-display font-semibold transition-all ${activeTab===v?'bg-accent text-white':'text-slate-400 hover:text-slate-200'}`}>{l}</button>
        ))}
      </div>

      {deleteError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{deleteError}</div>}

      {activeTab==='accounts' && (
        loading ? <div className="text-center py-20 text-slate-500">Cargando...</div> : (
          <div className="space-y-6">
            {[{title:'Mis Cuentas',list:accounts,isShared:false},{title:'Cuentas Compartidas',list:sharedAccounts,isShared:true}].map(({title,list,isShared})=>(
              <div key={title}>
                <h2 className="text-sm font-display font-bold text-white mb-3">{title}</h2>
                {list.length===0 ? (
                  <div className="card p-8 text-center">
                    <div className="text-3xl mb-3">{isShared?'💑':'🏦'}</div>
                    <div className="text-slate-400 text-sm">{isShared && partners.length===0 ? 'Primero vinculá con alguien en la sección Vínculos' : `No tenés ${isShared?'cuentas compartidas':'cuentas'} aún`}</div>
                    {!isShared && <button onClick={()=>setModal({open:true,type:'personal',account:null})} className="btn-primary mt-4 text-sm">Crear primera cuenta</button>}
                    {isShared && partners.length>0 && <button onClick={()=>setModal({open:true,type:'shared',account:null})} className="btn-primary mt-4 text-sm">Crear cuenta compartida</button>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {list.map(a=><AccountCard key={a.id} account={a} isShared={isShared} onClick={()=>setDetail({account:a,isShared})} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab==='transfers' && (
        <div className="space-y-3">
          {loadingTx ? <div className="text-center py-20 text-slate-500">Cargando...</div> :
          transfers.length===0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">↔️</div>
              <div className="text-white font-display font-bold mb-1">Sin transferencias</div>
              <button onClick={()=>setModal({open:true,type:'transfer',account:null})} className="btn-primary text-sm mt-4">Nueva Transferencia</button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-dark-500">
                    {['Fecha','Desde','','Hacia','Monto','Comentario',''].map((h,i)=>(
                      <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-slate-500 uppercase ${i===4?'text-right':'text-left'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-dark-600">
                    {transfers.map(t=>(
                      <tr key={t.id} className="hover:bg-dark-700/50 group">
                        <td className="px-3 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-3 py-3"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:t.fromColor}}/><span className="text-slate-300 text-xs truncate max-w-28">{t.fromName}</span></div></td>
                        <td className="px-2 py-3 text-slate-600 text-base">→</td>
                        <td className="px-3 py-3"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:t.toColor}}/><span className="text-slate-300 text-xs truncate max-w-28">{t.toName}</span></div></td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-accent-light whitespace-nowrap">
                          {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(t.amount)}
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs truncate max-w-32">{t.comment||'—'}</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={()=>handleDeleteTransfer(t.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs mx-auto">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-dark-600">
                {transfers.map(t=>(
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-full" style={{backgroundColor:t.fromColor}}/><span className="text-slate-300 text-xs truncate">{t.fromName}</span></div>
                        <span className="text-slate-600 text-xs">→</span>
                        <div className="flex items-center gap-1.5 min-w-0"><div className="w-2 h-2 rounded-full" style={{backgroundColor:t.toColor}}/><span className="text-slate-300 text-xs truncate">{t.toName}</span></div>
                      </div>
                      <span className="font-mono font-bold text-sm text-accent-light whitespace-nowrap">
                        {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(t.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500"><div className="font-mono">{formatDate(t.date)}</div>{t.comment&&<div>{t.comment}</div>}</div>
                      <button onClick={()=>handleDeleteTransfer(t.id)} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              {transferPages>1&&(
                <div className="flex items-center justify-between px-4 py-3 border-t border-dark-500 gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-mono">Página {transferPage} de {transferPages}</span>
                  <div className="flex gap-2">
                    <button disabled={transferPage<=1} onClick={()=>fetchTransfers(transferPage-1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">← Ant</button>
                    <button disabled={transferPage>=transferPages} onClick={()=>fetchTransfers(transferPage+1)} className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40">Sig →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {detail && (
        <AccountDetail account={detail.account} isShared={detail.isShared}
          onClose={()=>setDetail(null)}
          onEdit={()=>{ setDetail(null); setModal({open:true,type:detail.isShared?'shared':'personal',account:detail.account}); }}
          onDelete={()=>handleDelete(detail.account.id,detail.isShared)}
          onExchange={()=>{ setDetail(null); setExchangeTarget(detail.account); }} />
      )}

      <AccountModal open={modal.open&&modal.type==='personal'} account={modal.account}
        onClose={()=>setModal({open:false,type:null,account:null})} onSaved={fetchAll} />
      <SharedAccountModal open={modal.open&&modal.type==='shared'} account={modal.account} partners={partners}
        onClose={()=>setModal({open:false,type:null,account:null})} onSaved={fetchAll} />
      <TransferModal open={modal.open&&modal.type==='transfer'} accounts={accounts} sharedAccounts={sharedAccounts}
        onClose={()=>setModal({open:false,type:null,account:null})} onSaved={()=>{fetchAll();fetchTransfers(1);}} />
      <ExchangeModal open={!!exchangeTarget} account={exchangeTarget}
        onClose={()=>setExchangeTarget(null)} onSaved={()=>{fetchAll();setExchangeTarget(null);}} />
    </div>
  );
}

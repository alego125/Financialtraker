import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';

const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16','#7c3aed','#6b7280'];
const PT = { EFECTIVO:'💵 Efectivo', DEBITO:'💳 Débito', CREDITO:'💳 Crédito', TRANSFERENCIA:'🏦 Transferencia' };

function AccountFormModal({ open, onClose, onSaved, account, isShared, partners }) {
  const [form, setForm]     = useState({ name:'', initialBalance:'', color:'#3b82f6', partnerId:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (account) setForm({ name:account.name, initialBalance:account.initialBalance, color:account.color, partnerId:account.partner?.id||'' });
    else setForm({ name:'', initialBalance:'', color: isShared?'#7c3aed':'#3b82f6', partnerId: partners[0]?.partner?.id||'' });
    setError('');
  }, [account, open, isShared, partners]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Nombre requerido');
    setLoading(true); setError('');
    try {
      const url = account ? `/${isShared?'shared-accounts':'accounts'}/${account.id}` : `/${isShared?'shared-accounts':'accounts'}`;
      await api[account?'put':'post'](url, form);
      onSaved(); onClose();
    } catch(err) { setError(err.response?.data?.error||'Error al guardar'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={account?`Editar ${isShared?'Cuenta Compartida':'Cuenta'}`:`Nueva ${isShared?'Cuenta Compartida':'Cuenta'}`} size="sm">
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required />
        </div>
        {isShared && !account && partners.length > 0 && (
          <div>
            <label className="label">Compartir con</label>
            <select className="input" value={form.partnerId} onChange={e=>setForm(p=>({...p,partnerId:e.target.value}))}>
              {partners.map(p=><option key={p.partner.id} value={p.partner.id}>{p.partner.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Saldo Inicial</label>
          <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
            value={form.initialBalance} onChange={e=>setForm(p=>({...p,initialBalance:e.target.value}))} />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>setForm(p=>({...p,color:c}))}
                className={`w-7 h-7 rounded-lg border-2 transition-all ${form.color===c?'border-white scale-110':'border-transparent'}`}
                style={{backgroundColor:c}} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading?'...':account?'Actualizar':'Crear'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AccountDetailPanel({ account, isShared, onClose }) {
  const [transactions, setTxs]  = useState([]);
  const [pagination, setPag]    = useState({ page:1, limit:15, total:0, pages:0 });
  const [categories, setCats]   = useState([]);
  const [filters, setFilters]   = useState({});
  const [loading, setLoading]   = useState(true);

  const fetchTx = useCallback(async (pg=1, f=filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page:pg, limit:15, sortBy:'date', sortOrder:'desc', ...f });
      const { data } = await api.get(`/transactions/account/${account.id}?${params}`);
      setTxs(data.data); setPag(data.pagination);
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, [account.id, filters]);

  useEffect(() => {
    api.get('/categories').then(r=>setCats(r.data)).catch(()=>{});
    fetchTx(1, {});
  }, [account.id]);

  const applyFilters = (f) => { setFilters(f); fetchTx(1, f); };
  const balance = parseFloat(account.currentBalance ?? account.initialBalance ?? 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl bg-dark-800 border-l border-dark-500 flex flex-col h-full shadow-2xl" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-dark-500 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
              style={{backgroundColor:account.color+'22', border:`1px solid ${account.color}66`, color:account.color}}>
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-display font-bold text-white truncate">{account.name}</h2>
              {isShared && account.partner && <div className="text-xs text-violet-400 font-mono">con {account.partner.name}</div>}
              <div className={`text-base font-mono font-bold ${balance>=0?'text-income':'text-expense'}`}>{formatCurrency(balance)}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 text-slate-400 flex items-center justify-center flex-shrink-0">✕</button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-dark-500 bg-dark-900/40">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label text-xs">Desde</label><input type="date" className="input text-xs py-1.5" value={filters.dateFrom||''} onChange={e=>applyFilters({...filters,dateFrom:e.target.value})} /></div>
            <div><label className="label text-xs">Hasta</label><input type="date" className="input text-xs py-1.5" value={filters.dateTo||''} onChange={e=>applyFilters({...filters,dateTo:e.target.value})} /></div>
            <div>
              <label className="label text-xs">Tipo</label>
              <select className="input text-xs py-1.5" value={filters.type||''} onChange={e=>applyFilters({...filters,type:e.target.value})}>
                <option value="">Todos</option><option value="INCOME">Ingresos</option><option value="EXPENSE">Gastos</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Tipo de Pago</label>
              <select className="input text-xs py-1.5" value={filters.paymentType||''} onChange={e=>applyFilters({...filters,paymentType:e.target.value})}>
                <option value="">Todos</option><option value="EFECTIVO">Efectivo</option><option value="DEBITO">Débito</option><option value="CREDITO">Crédito</option><option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Categoría</label>
              <select className="input text-xs py-1.5" value={filters.categoryId||''} onChange={e=>applyFilters({...filters,categoryId:e.target.value})}>
                <option value="">Todas</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><label className="label text-xs">Comentario</label><input type="text" className="input text-xs py-1.5" placeholder="Buscar..." value={filters.comment||''} onChange={e=>applyFilters({...filters,comment:e.target.value})} /></div>
              <button onClick={()=>applyFilters({})} className="btn-secondary py-1.5 px-2 text-xs mb-0.5">✕</button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="text-center py-10 text-slate-500 text-sm">Cargando...</div>
          : transactions.length === 0 ? <div className="text-center py-10 text-slate-500 text-sm">Sin transacciones</div>
          : (
            <div className="divide-y divide-dark-600">
              {transactions.map(tx => (
                <div key={tx.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={tx.type==='INCOME'?'badge-income':'badge-expense'}>{tx.type==='INCOME'?'↑':'↓'} {tx.type==='INCOME'?'Ingreso':'Gasto'}</span>
                      {tx.category && <span className="flex items-center gap-1 text-xs text-slate-400"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:tx.category.color}}/>{tx.category.name}</span>}
                    </div>
                    <span className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type==='INCOME'?'text-income':'text-expense'}`}>{tx.type==='INCOME'?'+':'-'}{formatCurrency(tx.amount)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="font-mono">{formatDate(tx.date)}</span>
                    {tx.paymentType && <span>{PT[tx.paymentType]}</span>}
                    {isShared && tx.user && <span className="text-violet-400">{tx.user.name}</span>}
                    {tx.comment && <span className="text-slate-600 truncate">{tx.comment}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-3 border-t border-dark-500 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 font-mono">{pagination.total} tx</span>
            <div className="flex gap-2 items-center">
              <button disabled={pagination.page<=1} onClick={()=>fetchTx(pagination.page-1)} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">← Ant</button>
              <span className="text-xs text-slate-400 font-mono">{pagination.page}/{pagination.pages}</span>
              <button disabled={pagination.page>=pagination.pages} onClick={()=>fetchTx(pagination.page+1)} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">Sig →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts]     = useState([]);
  const [shared, setShared]         = useState([]);
  const [partners, setPartners]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState({ open:false, type:null, account:null });
  const [detail, setDetail]         = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a,s,p] = await Promise.all([api.get('/accounts'), api.get('/shared-accounts'), api.get('/partnerships')]);
      setAccounts(a.data); setShared(s.data); setPartners(p.data.filter(p=>p.status==='ACCEPTED'));
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id, isShared) => {
    setDeleteError('');
    if (!confirm('¿Eliminar esta cuenta?')) return;
    try {
      await api.delete(`/${isShared?'shared-accounts':'accounts'}/${id}`);
      if (detail?.account?.id === id) setDetail(null);
      fetchAll();
    } catch(err) { setDeleteError(err.response?.data?.error||'Error al eliminar'); }
  };

  const Card = ({ account, isShared }) => (
    <div className="card p-4 border-dark-500 hover:border-dark-300 transition-all group cursor-pointer" onClick={()=>setDetail({account,isShared})}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{backgroundColor:account.color+'22', border:`1px solid ${account.color}55`, color:account.color}}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold text-white truncate">{account.name}</div>
            {isShared && account.partner && <div className="text-xs text-violet-400 font-mono truncate">con {account.partner.name}</div>}
            <div className="text-xs text-slate-500 font-mono">{account.transactionCount} tx</div>
          </div>
        </div>
        {isShared && <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-mono flex-shrink-0">💑</span>}
      </div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-slate-500">Saldo actual</span>
        <span className={`font-mono font-bold text-sm ${account.currentBalance>=0?'text-income':'text-expense'}`}>{formatCurrency(account.currentBalance)}</span>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
        <button onClick={()=>setModal({open:true,type:isShared?'shared':'personal',account})} className="flex-1 btn-secondary text-xs py-1.5">Editar</button>
        <button onClick={()=>handleDelete(account.id,isShared)} className="flex-1 btn-danger text-xs py-1.5">Eliminar</button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Cuentas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tocá una cuenta para ver el detalle</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>setModal({open:true,type:'personal',account:null})} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
          {partners.length>0 && <button onClick={()=>setModal({open:true,type:'shared',account:null})} className="btn-secondary text-sm py-2 px-3">+ Compartida</button>}
        </div>
      </div>

      {deleteError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{deleteError}</div>}

      {loading ? <div className="text-center py-20 text-slate-500">Cargando...</div> : (
        <>
          <div>
            <h2 className="text-sm font-display font-bold text-white mb-3">Mis Cuentas</h2>
            {accounts.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-2">🏦</div>
                <div className="text-slate-400 text-sm mb-4">No tenés cuentas</div>
                <button onClick={()=>setModal({open:true,type:'personal',account:null})} className="btn-primary text-sm">Crear cuenta</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {accounts.map(a=><Card key={a.id} account={a} isShared={false}/>)}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-white mb-3">Cuentas Compartidas</h2>
            {shared.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-2">💑</div>
                <div className="text-slate-400 text-sm">{partners.length===0?'Vinculá con alguien primero':'No tenés cuentas compartidas'}</div>
                {partners.length>0 && <button onClick={()=>setModal({open:true,type:'shared',account:null})} className="btn-primary text-sm mt-4">Crear compartida</button>}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {shared.map(a=><Card key={a.id} account={a} isShared={true}/>)}
              </div>
            )}
          </div>
        </>
      )}

      <AccountFormModal open={modal.open} isShared={modal.type==='shared'} account={modal.account}
        partners={partners} onClose={()=>setModal({open:false,type:null,account:null})} onSaved={fetchAll} />
      {detail && <AccountDetailPanel account={detail.account} isShared={detail.isShared} onClose={()=>setDetail(null)} />}
    </div>
  );
}
import useRequestScope from '../hooks/useRequestScope';
import { isCanceled } from '../utils/requestScope';
import { getCompleteResponse } from '../utils/pagination';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import TransactionTable from '../components/ui/TransactionTable';
import TransactionModal from '../components/ui/TransactionModal';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);
const LIMIT = 20;

export default function TransactionsPage() {
  const [transactions, setTxs]      = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy]         = useState('date');
  const [sortOrder, setSortOrder]   = useState('desc');
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentFilter, setPayFil]  = useState('');
  const [accountFilter, setAccFil]  = useState('');
  const [categoryFilter, setCatFil] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [modal, setModal]           = useState({ open:false, tx:null });
  const [loading, setLoading]       = useState(true);
  const [accounts, setAccounts]     = useState([]);
  const [sharedAccounts, setShared] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totals, setTotals]         = useState(null);
  const requestScope = useRequestScope();
  const requestRef = useRef(null);
  const [error, setError] = useState('');
  const loaderRef = useRef(null);

  useEffect(() => {
    api.get('/accounts').then(r => setAccounts(r.data)).catch(err => { if (!isCanceled(err)) setError('No se pudieron cargar los filtros'); });
    api.get('/shared-accounts').then(r => setShared(r.data)).catch(err => { if (!isCanceled(err)) setError('No se pudieron cargar los filtros'); });
    api.get('/categories').then(r => setCategories(r.data)).catch(err => { if (!isCanceled(err)) setError('No se pudieron cargar los filtros'); });
  }, []);

  const hasFilters = !!(search || typeFilter || paymentFilter || accountFilter || categoryFilter || dateFrom || dateTo);

  const buildParams = useCallback((pg) => {
    const params = new URLSearchParams({ page: pg, limit: LIMIT, sortBy, sortOrder });
    if (search)         params.set('comment', search);
    if (typeFilter)     params.set('type', typeFilter);
    if (paymentFilter)  params.set('paymentType', paymentFilter);
    if (categoryFilter) params.set('categoryId', categoryFilter);
    if (dateFrom)       params.set('dateFrom', dateFrom);
    if (dateTo)         params.set('dateTo', dateTo);
    if (accountFilter) {
      const [kind, id] = accountFilter.split('::');
      if (kind === 'personal') params.set('accountId', id);
      else params.set('sharedAccountId', id);
    }
    return params;
  }, [search, typeFilter, paymentFilter, categoryFilter, dateFrom, dateTo, accountFilter, sortBy, sortOrder]);

  const fetchTxPage = useCallback(async (pg, reset = false, request = requestRef.current) => {
    try {
      const params = buildParams(pg);
      const { data } = await api.get(`/transactions?${params}`, { signal: request?.signal });
      request?.check();
      const incoming = data.data || [];
      setTxs(prev => reset ? incoming : [...prev, ...incoming]);
      setHasMore(pg < data.pagination.pages);
      setPage(pg);

      if (hasFilters && reset) {
        const allParams = buildParams(1);
        allParams.set('limit', 500);
        const { data: all } = await getCompleteResponse(api, `/transactions?${allParams}`, { signal: request?.signal });
        request?.check();
        let incARS=0, expARS=0, incUSD=0, expUSD=0;
        for (const tx of (all.data||[])) {
          const amt = parseFloat(tx.amount||0);
          const isUSD = tx.currency === 'USD';
          if (tx.type==='INCOME') { isUSD ? (incUSD+=amt) : (incARS+=amt); }
          else                    { isUSD ? (expUSD+=amt) : (expARS+=amt); }
        }
        setTotals({ incARS, expARS, incUSD, expUSD, count: all.pagination?.total||0 });
      } else if (reset) {
        setTotals(null);
      }
    } catch(err) { if ((!request || request.current()) && !isCanceled(err)) setError(err.response?.data?.error || err.message || 'Error al cargar'); }
  }, [buildParams, hasFilters]);

  // Reset al cambiar filtros/sort
  useEffect(() => {
    const request = requestScope.start();
    requestRef.current = request;
    setError('');
    setLoading(true);
    setLoadingMore(false);
    setPage(1);
    setHasMore(false);
    fetchTxPage(1, true, request).finally(() => { if (request.current()) setLoading(false); });
    return () => requestScope.cancel();
  }, [search, typeFilter, paymentFilter, accountFilter, categoryFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // IntersectionObserver scroll infinito
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setLoadingMore(true);
        const request = requestRef.current;
        fetchTxPage(page + 1, false, request).finally(() => { if (request?.current()) setLoadingMore(false); });
      }
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchTxPage]);

  const clearAll = () => {
    setSearch(''); setTypeFilter(''); setPayFil('');
    setAccFil(''); setCatFil(''); setDateFrom(''); setDateTo('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {error && <div role="alert" className="text-red-500">{error}</div>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Transacciones</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Historial completo de movimientos</p>
        </div>
        <button onClick={() => setModal({ open:true, tx:null })} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
      </div>

      {/* Filters */}
      <div className="card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" className="input flex-1" placeholder="🔍 Buscar por comentario..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input sm:w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Todo tipo</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Gastos</option>
          </select>
          <select className="input sm:w-44" value={paymentFilter} onChange={e => setPayFil(e.target.value)}>
            <option value="">Todo medio pago</option>
            <option value="EFECTIVO"> Efectivo</option>
            <option value="DEBITO"> Débito</option>
            <option value="CREDITO"> Crédito</option>
            <option value="TRANSFERENCIA"> Transferencia</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select className="input sm:w-52" value={categoryFilter} onChange={e => setCatFil(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input flex-1" value={accountFilter} onChange={e => setAccFil(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {accounts.length > 0 && (
              <optgroup label="Mis cuentas">
                {accounts.map(a => <option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}
              </optgroup>
            )}
            {sharedAccounts.length > 0 && (
              <optgroup label="Compartidas">
                {sharedAccounts.map(a => <option key={a.id} value={`shared::${a.id}`}>{a.name} </option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex gap-2 items-center flex-1 min-w-0 w-full">
            <input type="date" className="input flex-1 text-xs" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
            <span className="hidden" aria-hidden="true">—</span>
            <input type="date" className="input flex-1 text-xs" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          {hasFilters && (
            <button className="btn-secondary text-sm whitespace-nowrap" onClick={clearAll}>
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Totales */}
      {totals && (
        <div className="card p-3 border-accent/20 bg-accent/5">
          <div className="text-xs font-display font-bold text-accent-light uppercase tracking-widest mb-2">
            Totales — {totals.count} transacciones
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="bg-surface3 rounded-xl p-2.5 text-center">
              <div className="text-xs text-[var(--subtle)] mb-0.5">Ingresos ARS</div>
              <div className="font-mono font-bold text-income text-sm">{fmtARS(totals.incARS)}</div>
            </div>
            <div className="bg-surface3 rounded-xl p-2.5 text-center">
              <div className="text-xs text-[var(--subtle)] mb-0.5">Gastos ARS</div>
              <div className="font-mono font-bold text-expense text-sm">{fmtARS(totals.expARS)}</div>
            </div>
            <div className="bg-surface3 rounded-xl p-2.5 text-center">
              <div className="text-xs text-[var(--subtle)] mb-0.5">Balance ARS</div>
              <div className={`font-mono font-bold text-sm ${(totals.incARS-totals.expARS)>=0?'text-income':'text-expense'}`}>
                {fmtARS(totals.incARS - totals.expARS)}
              </div>
            </div>
            {(totals.incUSD > 0 || totals.expUSD > 0) && (
              <div className="bg-surface3 rounded-xl p-2.5 text-center">
                <div className="text-xs text-[var(--subtle)] mb-0.5">Gastos USD</div>
                <div className="font-mono font-bold text-accent-light text-sm">{fmtUSD(totals.expUSD)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[var(--subtle)]">Cargando...</div>
      ) : (
        <>
          <TransactionTable
            data={transactions}
            onSort={(f,o) => { setSortBy(f); setSortOrder(o); }}
            sortBy={sortBy} sortOrder={sortOrder}
            onEdit={tx => setModal({ open:true, tx })}
            onDelete={async tx => {
              if (confirm('¿Eliminar?')) {
                await api.delete(`/transactions/${tx.id}`);
                setTxs([]);
                fetchTxPage(1, true);
              }
            }}
          />
          {/* Sentinel scroll infinito */}
          <div ref={loaderRef} className="py-4 text-center text-xs text-[var(--subtle)]">
            {loadingMore && 'Cargando más...'}
            {!hasMore && transactions.length > 0 && 'No hay más transacciones'}
          </div>
        </>
      )}

      <TransactionModal open={modal.open} transaction={modal.tx}
        onClose={() => setModal({ open:false, tx:null })}
        onSaved={() => { setTxs([]); fetchTxPage(1, true); }} />
    </div>
  );
}

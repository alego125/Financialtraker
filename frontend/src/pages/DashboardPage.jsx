import Icon from '../components/ui/Icon';
import useRequestScope from '../hooks/useRequestScope';
import { isCanceled } from '../utils/requestScope';
import { getCompleteResponse } from '../utils/pagination';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import { generatePDF } from '../utils/pdfExport';
import { generateExcel } from '../utils/excelExport';
import KpiCard from '../components/ui/KpiCard';
import DashboardFilters from '../components/ui/DashboardFilters';
import TransactionTable from '../components/ui/TransactionTable';
import TransactionModal from '../components/ui/TransactionModal';
import FinanceExportPanel from '../components/ui/FinanceExportPanel';
import { CategoryChartSelector } from '../components/charts/Charts';

const defaultFilters = () => {
  const now = new Date();
  const m = String(now.getMonth()+1).padStart(2,'0');
  return { month: `${now.getFullYear()}-${m}` };
};

const INFINITE_LIMIT = 20;

export default function DashboardPage() {
  const [dashData, setDashData]     = useState(null);
  const [transactions, setTxs]      = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters]       = useState(defaultFilters());
  const [sortBy, setSortBy]         = useState('date');
  const [sortOrder, setSortOrder]   = useState('desc');
  const [loading, setLoading]       = useState(true);
  const [txModal, setTxModal]       = useState({ open:false, tx:null });
  const [exportPanel, setExportPanel] = useState(false);
  const [generating, setGenerating] = useState(false);
  const requestScope = useRequestScope();
  const requestRef = useRef(null);
  const [error, setError] = useState('');
  const loaderRef = useRef(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if(v) params.set(k,v); });
    return params;
  }, [filters]);

  const fetchDashboard = useCallback(async(request = requestRef.current) => {
    try {
      const { data } = await api.get(`/dashboard?${buildParams()}`, { signal: request?.signal });
      request?.check();
      setDashData(data);
    } catch(err){ if ((!request || request.current()) && !isCanceled(err)) setError(err.response?.data?.error || err.message || 'Error al cargar'); }
  }, [buildParams]);

  const fetchTxPage = useCallback(async(pg, reset = false, request = requestRef.current) => {
    try {
      const params = buildParams();
      params.set('page', pg);
      params.set('limit', INFINITE_LIMIT);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const { data } = await api.get(`/transactions?${params}`, { signal: request?.signal });
      request?.check();
      const incoming = data.data || [];
      setTxs(prev => reset ? incoming : [...prev, ...incoming]);
      setHasMore(pg < data.pagination.pages);
      setPage(pg);
    } catch(err){ if ((!request || request.current()) && !isCanceled(err)) setError(err.response?.data?.error || err.message || 'Error al cargar'); }
  }, [buildParams, sortBy, sortOrder]);

  // Reset al cambiar filtros o sort
  useEffect(() => {
    const request = requestScope.start();
    requestRef.current = request;
    setError('');
    setGenerating(false);
    setLoading(true);
    setLoadingMore(false);
    setPage(1);
    setHasMore(false);
    Promise.all([fetchDashboard(request), fetchTxPage(1, true, request)]).finally(() => { if (request.current()) setLoading(false); });
    return () => requestScope.cancel();
  }, [filters, sortBy, sortOrder]);

  // IntersectionObserver para scroll infinito
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

  const handleGeneratePDF = async() => {
    const request = requestRef.current;
    if (!request?.current() || loading) return;
    setGenerating('pdf');
    try {
      const params = buildParams();
      params.set('page',1); params.set('limit',500); params.set('sortBy',sortBy); params.set('sortOrder',sortOrder);
      const { data } = await getCompleteResponse(api, `/transactions?${params}`, { signal: request.signal });
      request.check();
      generatePDF({ kpis:dashData?.kpis, charts:dashData?.charts, transactions:data.data, filters });
    } catch(err){ if (!isCanceled(err)) setError(err.response?.data?.error || err.message || 'Error al cargar'); }
    finally { if (request.current()) setGenerating(false); }
  };

  const handleGenerateExcel = async() => {
    const request = requestRef.current;
    if (!request?.current() || loading) return;
    setGenerating('excel');
    try {
      const params = buildParams();
      params.set('page',1); params.set('limit',500); params.set('sortBy',sortBy); params.set('sortOrder',sortOrder);
      const { data } = await getCompleteResponse(api, `/transactions?${params}`, { signal: request.signal });
      request.check();
      generateExcel({ transactions:data.data, filters, kpis:dashData?.kpis });
    } catch(err){ if (!isCanceled(err)) setError(err.response?.data?.error || err.message || 'Error al cargar'); }
    finally { if (request.current()) setGenerating(false); }
  };

  if(loading && !dashData) return <div className="flex items-center justify-center h-96 text-[var(--subtle)]">Cargando...</div>;
  const kpis = dashData?.kpis;
  const charts = dashData?.charts;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {error && <div role="alert" className="text-red-500">{error}</div>}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Tu dinero, en perspectiva.</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Un resumen claro de tus ingresos, gastos y balance.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleGeneratePDF} disabled={!!generating || loading} className="btn-secondary text-sm py-2 px-3">
            <Icon name="file" size={16} />{generating==='pdf'?'Generando...':'PDF'}
          </button>
          <button onClick={handleGenerateExcel} disabled={!!generating || loading} className="btn-secondary text-sm py-2 px-3">
            <Icon name="file" size={16} />{generating==='excel'?'Generando...':'CSV'}
          </button>
          <button onClick={()=>setExportPanel(true)} className="btn-secondary text-sm py-2 px-3 border-accent/40 text-accent-light hover:bg-accent/10"><Icon name="arrow" size={16} />Exportar datos</button>
          <button onClick={()=>setTxModal({open:true,tx:null})} className="btn-primary text-sm py-2 px-4"><Icon name="plus" size={16} />Nuevo movimiento</button>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="dashboard-balance col-span-2 lg:col-span-2"><KpiCard label="Balance del período ARS" sub={formatCurrency(kpis.balanceUSD, 'USD')} value={formatCurrency(kpis.balance)}           color="accent" icon="" /></div>
          <KpiCard label="Ingresos ARS" sub={formatCurrency(kpis.totalIncomeUSD, 'USD')} value={formatCurrency(kpis.totalIncome)}      color="income"  icon="↑" trend={kpis.incomeVariation} />
          <KpiCard label="Gastos ARS" sub={formatCurrency(kpis.totalExpenseUSD, 'USD')} value={formatCurrency(kpis.totalExpense)}      color="expense" icon="↓" trend={kpis.expenseVariation} />
          <KpiCard label="Tasa Ahorro ARS" sub={`USD: ${kpis.savingsRateUSD ?? 0}%`} value={`${kpis.savingsRate}%`}                 color="neutral"  icon="" />
          <KpiCard label="Ingr. ARS/mes" sub={formatCurrency(kpis.avgMonthlyIncomeUSD, 'USD')} value={formatCurrency(kpis.avgMonthlyIncome)}  color="income" />
          <KpiCard label="Gast. ARS/mes" sub={formatCurrency(kpis.avgMonthlyExpenseUSD, 'USD')} value={formatCurrency(kpis.avgMonthlyExpense)} color="expense" />
          {kpis.topExpenseCategory && (
            <KpiCard label="Mayor gasto" value={kpis.topExpenseCategory.name} sub={formatCurrency(kpis.topExpenseCategory.amount)} color="neutral" icon="" />
          )}
        </div>
      )}

      <DashboardFilters filters={filters} onChange={setFilters} showAccountFilter={true} />

      {charts?.categoryExpense?.length > 0 && (
        <CategoryChartSelector
          data={charts.categoryExpense}
          dataPie={charts.pie}
          currency="ARS"
        />
      )}

      {charts?.pieUSD?.length > 0 && (
        <CategoryChartSelector
          data={charts.categoryExpenseUSD}
          dataPie={charts.pieUSD}
          currency="USD"
        />
      )}

      <div>
        <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3">Transacciones</h2>
        <TransactionTable
          data={transactions}
          pagination={null}
          onSort={(f,o) => { setSortBy(f); setSortOrder(o); }}
          sortBy={sortBy} sortOrder={sortOrder}
          onEdit={tx => setTxModal({open:true,tx})}
          onDelete={async tx => {
            if(confirm('¿Eliminar?')) {
              await api.delete(`/transactions/${tx.id}`);
              fetchDashboard();
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
      </div>

      <TransactionModal open={txModal.open} transaction={txModal.tx}
        onClose={()=>setTxModal({open:false,tx:null})} onSaved={()=>{ fetchDashboard(); setTxs([]); fetchTxPage(1, true); }} />
      <FinanceExportPanel
        open={exportPanel}
        onClose={()=>setExportPanel(false)}
        dashData={dashData}
        filters={filters}
      />
    </div>
  );
}

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
  const loaderRef = useRef(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if(v) params.set(k,v); });
    return params;
  }, [filters]);

  const fetchDashboard = useCallback(async() => {
    try {
      const { data } = await api.get(`/dashboard?${buildParams()}`);
      setDashData(data);
    } catch(err){ console.error(err); }
  }, [buildParams]);

  const fetchTxPage = useCallback(async(pg, reset = false) => {
    try {
      const params = buildParams();
      params.set('page', pg);
      params.set('limit', INFINITE_LIMIT);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const { data } = await api.get(`/transactions?${params}`);
      const incoming = data.data || [];
      setTxs(prev => reset ? incoming : [...prev, ...incoming]);
      setHasMore(pg < data.pagination.pages);
      setPage(pg);
    } catch(err){ console.error(err); }
  }, [buildParams, sortBy, sortOrder]);

  // Reset al cambiar filtros o sort
  useEffect(() => {
    setLoading(true);
    setTxs([]);
    setPage(1);
    setHasMore(true);
    Promise.all([fetchDashboard(), fetchTxPage(1, true)]).finally(() => setLoading(false));
  }, [filters, sortBy, sortOrder]);

  // IntersectionObserver para scroll infinito
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setLoadingMore(true);
        fetchTxPage(page + 1).finally(() => setLoadingMore(false));
      }
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchTxPage]);

  const handleGeneratePDF = async() => {
    setGenerating('pdf');
    try {
      const params = buildParams();
      params.set('page',1); params.set('limit',1000); params.set('sortBy',sortBy); params.set('sortOrder',sortOrder);
      const { data } = await api.get(`/transactions?${params}`);
      generatePDF({ kpis:dashData?.kpis, charts:dashData?.charts, transactions:data.data, filters });
    } catch(err){ console.error(err); }
    finally { setGenerating(false); }
  };

  const handleGenerateExcel = async() => {
    setGenerating('excel');
    try {
      const params = buildParams();
      params.set('page',1); params.set('limit',5000); params.set('sortBy',sortBy); params.set('sortOrder',sortOrder);
      const { data } = await api.get(`/transactions?${params}`);
      generateExcel({ transactions:data.data, filters, kpis:dashData?.kpis });
    } catch(err){ console.error(err); }
    finally { setGenerating(false); }
  };

  if(loading && !dashData) return <div className="flex items-center justify-center h-96 text-[var(--subtle)]">Cargando...</div>;
  const kpis = dashData?.kpis;
  const charts = dashData?.charts;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Mi Dashboard</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Resumen de tus finanzas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleGeneratePDF} disabled={!!generating} className="btn-secondary text-sm py-2 px-3">
            {generating==='pdf'?'Generando...':'📄 PDF'}
          </button>
          <button onClick={handleGenerateExcel} disabled={!!generating} className="btn-secondary text-sm py-2 px-3">
            {generating==='excel'?'Generando...':'📊 Excel'}
          </button>
          <button onClick={()=>setExportPanel(true)} className="btn-secondary text-sm py-2 px-3 border-accent/40 text-accent-light hover:bg-accent/10">📤 Exportar IA</button>
          <button onClick={()=>setTxModal({open:true,tx:null})} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Ingresos"       value={formatCurrency(kpis.totalIncome)}      color="income"  icon="↑" trend={kpis.incomeVariation} />
          <KpiCard label="Gastos"         value={formatCurrency(kpis.totalExpense)}      color="expense" icon="↓" trend={kpis.expenseVariation} />
          <KpiCard label="Balance"        value={formatCurrency(kpis.balance)}           color={kpis.balance>=0?'income':'expense'} icon="⚖️" />
          <KpiCard label="Tasa Ahorro"    value={`${kpis.savingsRate}%`}                 color="accent"  icon="💰" />
          <KpiCard label="Ingr. Prom/mes" value={formatCurrency(kpis.avgMonthlyIncome)}  color="income" />
          <KpiCard label="Gast. Prom/mes" value={formatCurrency(kpis.avgMonthlyExpense)} color="expense" />
          {kpis.topExpenseCategory && (
            <KpiCard label="Mayor gasto" value={kpis.topExpenseCategory.name} sub={formatCurrency(kpis.topExpenseCategory.amount)} color="neutral" icon="📌" />
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

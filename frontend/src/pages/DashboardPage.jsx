import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import { generatePDF } from '../utils/pdfExport';
import { generateExcel } from '../utils/excelExport';
import KpiCard from '../components/ui/KpiCard';
import DashboardFilters from '../components/ui/DashboardFilters';
import TransactionTable from '../components/ui/TransactionTable';
import TransactionModal from '../components/ui/TransactionModal';
import FinanceExportPanel from '../components/ui/FinanceExportPanel';
import { MonthlyLineChart, CategoryBarChart, ExpensePieChart, StackedBarChart, USDPieChart } from '../components/charts/Charts';

const defaultFilters = () => {
  const now = new Date();
  const m = String(now.getMonth()+1).padStart(2,'0');
  return { month: `${now.getFullYear()}-${m}` };
};

export default function DashboardPage() {
  const [dashData, setDashData]     = useState(null);
  const [transactions, setTxs]      = useState([]);
  const [pagination, setPagination] = useState({ page:1, limit:10, total:0, pages:0 });
  const [filters, setFilters]       = useState(defaultFilters());
  const [sortBy, setSortBy]         = useState('date');
  const [sortOrder, setSortOrder]   = useState('desc');
  const [loading, setLoading]       = useState(true);
  const [txModal, setTxModal]       = useState({ open:false, tx:null });
  const [exportPanel, setExportPanel] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const fetchTx = useCallback(async(page=1) => {
    try {
      const params = buildParams();
      params.set('page', page); params.set('limit', pagination.limit);
      params.set('sortBy', sortBy); params.set('sortOrder', sortOrder);
      const { data } = await api.get(`/transactions?${params}`);
      setTxs(data.data); setPagination(p=>({...p,...data.pagination}));
    } catch(err){ console.error(err); }
  }, [buildParams, sortBy, sortOrder, pagination.limit]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchTx(1)]).finally(()=>setLoading(false));
  }, [filters, sortBy, sortOrder]);


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

  if(loading && !dashData) return <div className="flex items-center justify-center h-96 text-slate-500">Cargando...</div>;
  const kpis = dashData?.kpis;
  const charts = dashData?.charts;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Mi Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Resumen de tus finanzas</p>
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

      {charts?.monthly?.length>0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Evolución Mensual</h2><MonthlyLineChart data={charts.monthly} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Barras Apiladas</h2><StackedBarChart data={charts.monthly} /></div>
        </div>
      )}
      {charts?.categoryExpense?.length>0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Gastos por Categoría (ARS)</h2><CategoryBarChart data={charts.categoryExpense} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Distribución ARS</h2><ExpensePieChart data={charts.pie} /></div>
        </div>
      )}
      {charts?.pieUSD?.length>0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-display font-bold text-white">Gastos por Categoría (USD)</h2>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">USD</span>
            </div>
            <CategoryBarChart data={charts.categoryExpenseUSD} />
          </div>
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-display font-bold text-white">Distribución USD</h2>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">USD</span>
            </div>
            <USDPieChart data={charts.pieUSD} />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-display font-bold text-white mb-3">Transacciones</h2>
        <TransactionTable data={transactions} pagination={pagination}
          onPageChange={pg=>fetchTx(pg)} onSort={(f,o)=>{setSortBy(f);setSortOrder(o);}}
          sortBy={sortBy} sortOrder={sortOrder}
          onEdit={tx=>setTxModal({open:true,tx})}
          onDelete={async tx=>{ if(confirm('¿Eliminar?')){ await api.delete(`/transactions/${tx.id}`); fetchDashboard(); fetchTx(pagination.page); }}} />
      </div>

      <TransactionModal open={txModal.open} transaction={txModal.tx}
        onClose={()=>setTxModal({open:false,tx:null})} onSaved={()=>{fetchDashboard();fetchTx(1);}} />
      <FinanceExportPanel
        open={exportPanel}
        onClose={()=>setExportPanel(false)}
        dashData={dashData}
        filters={filters}
      />
    </div>
  );
}

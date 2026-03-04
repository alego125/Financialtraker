import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import { generatePDF } from '../utils/pdfExport';
import KpiCard from '../components/ui/KpiCard';
import DashboardFilters from '../components/ui/DashboardFilters';
import TransactionTable from '../components/ui/TransactionTable';
import TransactionModal from '../components/ui/TransactionModal';
import { MonthlyLineChart, CategoryBarChart, ExpensePieChart, StackedBarChart } from '../components/charts/Charts';

export default function DashboardPage() {
  const [dashData, setDashData]     = useState(null);
  const [transactions, setTxs]      = useState([]);
  const [pagination, setPagination] = useState({ page:1, limit:10, total:0, pages:0 });
  const [filters, setFilters]       = useState({});
  const [sortBy, setSortBy]         = useState('date');
  const [sortOrder, setSortOrder]   = useState('desc');
  const [loading, setLoading]       = useState(true);
  const [txModal, setTxModal]       = useState({ open:false, tx:null });
  const [generating, setGenerating] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k,v); });
      const { data } = await api.get(`/dashboard?${params}`);
      setDashData(data);
    } catch(err) { console.error(err); }
  }, [filters]);

  const fetchTx = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit, sortBy, sortOrder });
      Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k,v); });
      const { data } = await api.get(`/transactions?${params}`);
      setTxs(data.data);
      setPagination(p => ({ ...p, ...data.pagination }));
    } catch(err) { console.error(err); }
  }, [filters, sortBy, sortOrder, pagination.limit]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchTx(1)]).finally(() => setLoading(false));
  }, [filters, sortBy, sortOrder]);

  const handleSort = (field, order) => { setSortBy(field); setSortOrder(order); };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({ page:1, limit:1000, sortBy, sortOrder });
      Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k,v); });
      const { data } = await api.get(`/transactions?${params}`);
      generatePDF({ kpis: dashData?.kpis, charts: dashData?.charts, transactions: data.data });
    } catch(err) { console.error(err); }
    finally { setGenerating(false); }
  };

  if (loading && !dashData) return <div className="flex items-center justify-center h-96 text-slate-500">Cargando...</div>;

  const kpis = dashData?.kpis;
  const charts = dashData?.charts;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Mi Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Resumen de tus finanzas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleGeneratePDF} disabled={generating} className="btn-secondary text-sm py-2 px-3">
            {generating ? '...' : '📄 PDF'}
          </button>
          <button onClick={() => setTxModal({ open:true, tx:null })} className="btn-primary text-sm py-2 px-4">+ Nueva</button>
        </div>
      </div>

      {/* KPI grid */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Ingresos"      value={formatCurrency(kpis.totalIncome)}      color="income"  icon="↑" trend={kpis.incomeVariation} />
          <KpiCard label="Gastos"        value={formatCurrency(kpis.totalExpense)}      color="expense" icon="↓" trend={kpis.expenseVariation} />
          <KpiCard label="Balance"       value={formatCurrency(kpis.balance)}           color={kpis.balance >= 0 ? 'income' : 'expense'} icon="⚖️" />
          <KpiCard label="Tasa Ahorro"   value={`${kpis.savingsRate}%`}                color="accent"  icon="💰" />
          <KpiCard label="Ingr. Prom/mes" value={formatCurrency(kpis.avgMonthlyIncome)}  color="income" />
          <KpiCard label="Gast. Prom/mes" value={formatCurrency(kpis.avgMonthlyExpense)} color="expense" />
          {kpis.topExpenseCategory && (
            <KpiCard label="Mayor gasto" value={kpis.topExpenseCategory.name}
              sub={formatCurrency(kpis.topExpenseCategory.amount)} color="neutral" icon="📌" />
          )}
        </div>
      )}

      {/* Filters */}
      <DashboardFilters filters={filters} onChange={setFilters} />

      {/* Charts */}
      {charts?.monthly?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Evolución Mensual</h2>
            <MonthlyLineChart data={charts.monthly} />
          </div>
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Barras Apiladas</h2>
            <StackedBarChart data={charts.monthly} />
          </div>
        </div>
      )}
      {charts?.categoryExpense?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Gastos por Categoría</h2>
            <CategoryBarChart data={charts.categoryExpense} />
          </div>
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-white mb-4">Distribución</h2>
            <ExpensePieChart data={charts.pie} />
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-display font-bold text-white mb-3">Transacciones Recientes</h2>
        <TransactionTable
          data={transactions} pagination={pagination}
          onPageChange={pg => fetchTx(pg)}
          onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder}
          onEdit={tx => setTxModal({ open:true, tx })}
          onDelete={async tx => { if (confirm('¿Eliminar?')) { await api.delete(`/transactions/${tx.id}`); fetchDashboard(); fetchTx(pagination.page); } }}
        />
      </div>

      <TransactionModal open={txModal.open} transaction={txModal.tx}
        onClose={() => setTxModal({ open:false, tx:null })}
        onSaved={() => { fetchDashboard(); fetchTx(1); }} />
    </div>
  );
}
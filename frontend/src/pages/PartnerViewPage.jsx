import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import TransactionTable from '../components/ui/TransactionTable';
import { MonthlyLineChart, CategoryBarChart, ExpensePieChart, StackedBarChart } from '../components/charts/Charts';

export default function PartnerViewPage() {
  const { partnerId } = useParams();
  const [dashData, setDashData]     = useState(null);
  const [transactions, setTxs]      = useState([]);
  const [pagination, setPagination] = useState({ page:1, limit:10, total:0, pages:0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fetchAll = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const [dashRes, txRes] = await Promise.all([
        api.get(`/partnerships/partner/${partnerId}/dashboard`),
        api.get(`/partnerships/partner/${partnerId}/transactions?page=${page}&limit=10`),
      ]);
      setDashData(dashRes.data);
      setTxs(txRes.data.data);
      setPagination(p => ({ ...p, ...txRes.data.pagination }));
    } catch (err) { setError(err.response?.data?.error || 'No se pudo cargar'); }
    finally { setLoading(false); }
  }, [partnerId]);

  useEffect(() => { fetchAll(1); }, [fetchAll]);

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-500">Cargando...</div>;
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

  const { partner, kpis, charts } = dashData;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
            <Link to="/" className="text-slate-500 hover:text-slate-300">← Dashboard</Link>
            <span className="text-slate-600">/</span>
            <span className="text-violet-400 font-display font-medium truncate">Vista de {partner.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-display font-bold text-lg flex-shrink-0">
              {partner.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white truncate">Finanzas de {partner.name}</h1>
              <p className="text-slate-400 text-xs font-mono truncate">{partner.email}</p>
            </div>
          </div>
        </div>
        <span className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5 text-xs text-violet-400 font-mono flex-shrink-0">👁️ Solo lectura</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos"    value={formatCurrency(kpis.totalIncome)}  color="income"  icon="↑" />
        <KpiCard label="Gastos"      value={formatCurrency(kpis.totalExpense)} color="expense" icon="↓" />
        <KpiCard label="Balance"     value={formatCurrency(kpis.balance)}      color={kpis.balance >= 0 ? 'income' : 'expense'} icon="⚖️" />
        <KpiCard label="Tasa Ahorro" value={`${kpis.savingsRate}%`}            color="accent"  icon="💰" />
      </div>

      {/* Charts */}
      {charts.monthly?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Evolución Mensual</h2><MonthlyLineChart data={charts.monthly} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Apilado</h2><StackedBarChart data={charts.monthly} /></div>
        </div>
      )}
      {charts.categoryExpense?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Por Categoría</h2><CategoryBarChart data={charts.categoryExpense} /></div>
          <div className="card p-4 sm:p-5"><h2 className="text-sm font-display font-bold text-white mb-4">Distribución</h2><ExpensePieChart data={charts.pie} /></div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-display font-bold text-white mb-3">Transacciones de {partner.name}</h2>
        <TransactionTable data={transactions} pagination={pagination}
          onPageChange={pg => fetchAll(pg)}
          onSort={() => {}} sortBy="date" sortOrder="desc" readOnly />
      </div>
    </div>
  );
}
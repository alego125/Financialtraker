import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import AccountMultiSelect from '../components/ui/AccountMultiSelect';
import CategoryMultiSelect from '../components/ui/CategoryMultiSelect';
import { MonthlyChartSelector, CategoryChartSelector, AccountBalanceLineChart, CurrencyComparisonChart } from '../components/charts/Charts';

const sourceType = src => src.includes(':') ? src.split(':')[0] : src;
const getPartnerId = src => src.includes(':') ? src.split(':')[1] : null;

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const currentYear = () => String(new Date().getFullYear());

const defaultFilters = () => ({ month: currentMonth() });

export default function AnalysisPage() {
  const [partnerships, setPartnerships] = useState([]);
  const [source, setSource] = useState('mine'); // 'mine' | 'partner:<id>' | 'both:<id>'
  const [filters, setFilters] = useState(defaultFilters());
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  const [currency, setCurrency] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('month'); // 'month' | 'year' | 'range'
  const [partnerAccounts, setPartnerAccounts] = useState([]);
  const [partnerCats, setPartnerCats] = useState([]);

  useEffect(() => {
    api.get('/partnerships').then(r => setPartnerships((r.data || []).filter(p => p.status === 'ACCEPTED'))).catch(() => {});
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const stype = sourceType(source);
  const pid = getPartnerId(source);

  // Al cambiar de fuente (Mío/Partner/Ambos), las cuentas/categorías seleccionadas
  // podrían pertenecer al dueño equivocado — se resetean para no filtrar con IDs ajenos.
  const changeSource = (newSource) => {
    setSource(newSource);
    setSelectedAccounts([]);
    setSelectedCats([]);
  };

  // Cuando se mira partner/both, las cuentas y categorías propias no alcanzan:
  // hay que traer también las del partner para no mandar IDs que solo matchean las propias.
  useEffect(() => {
    if (stype === 'mine' || !pid) { setPartnerAccounts([]); setPartnerCats([]); return; }
    api.get(`/partnerships/partner/${pid}/accounts`)
      .then(r => setPartnerAccounts((r.data || []).map(a => ({ id: a.id, name: a.name, color: a.color }))))
      .catch(() => {});
    api.get(`/partnerships/partner/${pid}/transactions?page=1&limit=1000`)
      .then(r => {
        const txs = r.data.data || [];
        const cats = new Map();
        txs.forEach(tx => { if (tx.category) cats.set(tx.category.id, tx.category); });
        setPartnerCats([...cats.values()]);
      })
      .catch(() => {});
  }, [pid, stype]);

  const accountOptions = stype === 'mine' ? accounts : [...accounts, ...partnerAccounts];
  const categoryOptions = stype === 'mine'
    ? categories.map(c => ({ ...c, owner: 'mine' }))
    : [...categories.map(c => ({ ...c, owner: 'mine' })), ...partnerCats.map(c => ({ ...c, owner: 'partner' }))];
  const activePartnerName = pid ? partnerships.find(p => p.partner?.id === pid)?.partner?.name : null;

  const monthOptions = [];
  {
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      monthOptions.push({ val, label });
    }
  }
  const yearOptions = [2023, 2024, 2025, 2026].map(y => String(y));

  const setMonthFilter = (m) => {
    setFilters(f => ({ ...f, month: m, year: undefined, dateFrom: undefined, dateTo: undefined }));
    setMode('month');
  };
  const setYearFilter = (y) => {
    setFilters(f => ({ ...f, year: y, month: undefined, dateFrom: undefined, dateTo: undefined }));
    setMode('year');
  };
  const setRangeFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val, month: undefined, year: undefined }));
    setMode('range');
  };
  const handleModeChange = (v) => {
    setMode(v);
    if (v === 'year') {
      const y = filters.year || currentYear();
      setFilters(f => ({ ...f, year: y, month: undefined, dateFrom: undefined, dateTo: undefined }));
    } else if (v === 'month') {
      const m = filters.month || currentMonth();
      setFilters(f => ({ ...f, month: m, year: undefined, dateFrom: undefined, dateTo: undefined }));
    } else if (v === 'range') {
      setFilters(f => ({ ...f, month: undefined, year: undefined }));
    }
  };

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('source', stype);
    if (pid) params.set('partnerId', pid);
    if (selectedAccounts.length) params.set('accountIds', selectedAccounts.join(','));
    if (selectedCats.length) params.set('categoryIds', selectedCats.join(','));
    if (currency) params.set('currency', currency);
    return params;
  }, [filters, stype, pid, selectedAccounts, selectedCats, currency]);

  useEffect(() => {
    setLoading(true);
    api.get(`/analysis?${buildParams()}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [buildParams]);

  const view = stype === 'both' ? data?.combined : stype === 'partner' ? data?.partner : data?.mine;

  const addAccountFilter = (id) => setSelectedAccounts(prev => prev.includes(id) ? prev : [...prev, id]);
  const addCategoryFilter = (id) => setSelectedCats(prev => prev.includes(id) ? prev : [...prev, id]);

  if (loading && !data) return <div className="flex items-center justify-center h-96 text-[var(--subtle)]">Cargando...</div>;
  const kpis = view?.kpis;
  // Cuando se filtra solo por USD, la serie ARS queda vacía por diseño (el backend la filtra) —
  // mostramos el breakdown en USD en ese caso si está disponible (no aplica en modo 'both', que no lo trae combinado).
  const catData = (currency === 'USD' && view?.categoryBreakdownUSD) ? view.categoryBreakdownUSD : view?.categoryBreakdown;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Análisis</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Patrimonio, saldos por cuenta y deuda a través del tiempo</p>
      </div>

      {partnerships.length > 0 && (
        <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)] w-fit">
          <button onClick={() => changeSource('mine')} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${stype === 'mine' ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>Mío</button>
          {partnerships.map(p => (
            <div key={p.partner.id} className="flex gap-1">
              <button onClick={() => changeSource(`partner:${p.partner.id}`)} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${source === `partner:${p.partner.id}` ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>{p.partner.name}</button>
              <button onClick={() => changeSource(`both:${p.partner.id}`)} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${source === `both:${p.partner.id}` ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>Ambos</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)]">
          {[['month', 'Mes'], ['year', 'Año'], ['range', 'Rango']].map(([v, l]) => (
            <button key={v} onClick={() => handleModeChange(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${mode === v ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
              {l}
            </button>
          ))}
        </div>

        {mode === 'month' && (
          <select className="input max-w-xs text-xs py-2"
            value={filters.month || currentMonth()}
            onChange={e => setMonthFilter(e.target.value)}>
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        )}

        {mode === 'year' && (
          <select className="input w-28 text-xs py-2"
            value={filters.year || currentYear()}
            onChange={e => setYearFilter(e.target.value)}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        {mode === 'range' && (
          <div className="flex gap-2 items-center">
            <input type="date" className="input text-xs py-2 w-36"
              value={filters.dateFrom || ''}
              onChange={e => setRangeFilter('dateFrom', e.target.value)} />
            <span className="text-[var(--subtle)] text-xs">—</span>
            <input type="date" className="input text-xs py-2 w-36"
              value={filters.dateTo || ''}
              onChange={e => setRangeFilter('dateTo', e.target.value)} />
          </div>
        )}

        <div className="w-48"><AccountMultiSelect accounts={accountOptions} selected={selectedAccounts} onChange={setSelectedAccounts} /></div>
        <div className="w-56"><CategoryMultiSelect categories={categoryOptions} selected={selectedCats} onChange={setSelectedCats} showOwner={stype === 'both'} partnerName={activePartnerName} /></div>
        <select className="input text-xs w-auto" value={currency} onChange={e => setCurrency(e.target.value)}>
          <option value="">Todas las monedas</option>
          <option value="ARS">$ ARS</option>
          <option value="USD">U$D USD</option>
        </select>
        {(selectedAccounts.length > 0 || selectedCats.length > 0) && (
          <div className="flex gap-2 flex-wrap">
            {selectedAccounts.map(id => {
              const acc = accountOptions.find(a => a.id === id);
              return <span key={id} className="text-xs bg-surface3 border border-[var(--border)] rounded-full px-2.5 py-1 flex items-center gap-1.5">{acc?.name || id}<button onClick={() => setSelectedAccounts(p => p.filter(x => x !== id))} className="text-[var(--subtle)] hover:text-[var(--text)]">✕</button></span>;
            })}
            {selectedCats.map(id => {
              const cat = categoryOptions.find(c => c.id === id);
              return <span key={id} className="text-xs bg-surface3 border border-[var(--border)] rounded-full px-2.5 py-1 flex items-center gap-1.5">{cat?.name || id}<button onClick={() => setSelectedCats(p => p.filter(x => x !== id))} className="text-[var(--subtle)] hover:text-[var(--text)]">✕</button></span>;
            })}
          </div>
        )}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Balance Total ARS" value={formatCurrency(kpis.balance)} color={kpis.balance >= 0 ? 'income' : 'expense'} icon="◈" />
          <KpiCard label="Balance Total USD" value={formatCurrency(kpis.balanceUSD, 'USD')} color={kpis.balanceUSD >= 0 ? 'income' : 'expense'} icon="◈" />
          <KpiCard label="Ingresos" value={formatCurrency(kpis.income)} color="income" icon="↑" trend={kpis.variation?.income} />
          <KpiCard label="Ingresos USD" value={formatCurrency(kpis.incomeUSD, 'USD')} color="income" icon="↑" trend={kpis.variation?.incomeUSD} />
          <KpiCard label="Gastos ARS" value={formatCurrency(kpis.expense)} color="expense" icon="↓" trend={kpis.variation?.expense} />
          <KpiCard label="Gastos USD" value={formatCurrency(kpis.expenseUSD, 'USD')} color="expense" icon="↓" trend={kpis.variation?.expenseUSD} />
          <KpiCard label="Neto" value={formatCurrency(kpis.net)} color={kpis.net >= 0 ? 'income' : 'expense'} icon="⚖️" />
          <KpiCard label="Deuda Tarjetas" value={formatCurrency(kpis.creditDebt)} color={kpis.creditDebt > 0 ? 'expense' : 'neutral'} icon="💳" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {view?.monthlySeries?.length > 0 && (
          <MonthlyChartSelector data={view.monthlySeries} />
        )}
        {catData?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos por Categoría</h2>
            <div className="flex flex-col gap-1">
              {catData.slice(0, 8).map(c => (
                <button key={c.categoryId} onClick={() => addCategoryFilter(c.categoryId)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface3 text-left text-xs">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                  <span className="font-mono">{formatCurrency(c.amount, currency === 'USD' ? 'USD' : 'ARS')} · {c.percentage}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {view?.accountBalanceSeries?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Saldo por Cuenta</h2>
            <AccountBalanceLineChart data={view.accountBalanceSeries} />
          </div>
        )}
        {view?.currencyComparison?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos ARS vs USD</h2>
            <CurrencyComparisonChart data={view.currencyComparison} />
          </div>
        )}
      </div>
    </div>
  );
}

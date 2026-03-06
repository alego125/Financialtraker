import { useState, useEffect } from 'react';
import api from '../../services/api';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
};

export default function DashboardFilters({ filters, onChange, showAccountFilter = false }) {
  const [categories, setCategories]   = useState([]);
  const [accounts, setAccounts]       = useState([]);
  const [sharedAccounts, setShared]   = useState([]);
  const [availableMonths, setMonths]  = useState([]);
  const [availableYears, setYears]    = useState([]);
  const [open, setOpen]               = useState(false);
  const [mode, setMode]               = useState('month');

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    if (showAccountFilter) {
      api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
      api.get('/shared-accounts').then(r => setShared(r.data)).catch(() => {});
    }
    // Load available months/years from actual transactions
    api.get('/transactions?page=1&limit=5000&sortBy=date&sortOrder=asc').then(r => {
      const txs = r.data.data || [];
      const monthSet = new Set();
      const yearSet  = new Set();
      txs.forEach(tx => {
        const d = new Date(tx.date);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        monthSet.add(`${y}-${m}`);
        yearSet.add(String(y));
      });
      // Sort descending
      const months = [...monthSet].sort((a, b) => b.localeCompare(a)).map(val => {
        const [y, m] = val.split('-');
        const label = new Date(parseInt(y), parseInt(m) - 1, 1)
          .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        return { val, label };
      });
      const years = [...yearSet].sort((a, b) => b.localeCompare(a));
      setMonths(months);
      setYears(years);
    }).catch(() => {});
  }, [showAccountFilter]);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const setMonthFilter = (m) => {
    onChange({ month: m });
    setMode('month');
  };
  const setYearFilter = (y) => {
    onChange({ year: y });
    setMode('year');
  };
  const clearFilters = () => {
    onChange({ month: currentMonth() });
    setMode('month');
    setOpen(false);
  };

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'month');
  const hasExtra = activeFilters.length > 0;

  // Current selected month/year for display
  const selectedMonth = filters.month || currentMonth();
  const selectedYear  = filters.year  || String(new Date().getFullYear());

  return (
    <div className="space-y-2">
      {/* Mode tabs + period selector */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500">
          {[['month','📅 Mes'], ['year','📆 Año'], ['range','🗓️ Rango']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${
                mode === v ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Month selector */}
        {mode === 'month' && (
          <select
            className="input text-xs py-2 max-w-[200px]"
            value={selectedMonth}
            onChange={e => setMonthFilter(e.target.value)}
          >
            {availableMonths.length === 0 && (
              <option value={currentMonth()}>
                {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
              </option>
            )}
            {availableMonths.map(o => (
              <option key={o.val} value={o.val}>{o.label}</option>
            ))}
          </select>
        )}

        {/* Year selector */}
        {mode === 'year' && (
          <select
            className="input text-xs py-2 w-24"
            value={selectedYear}
            onChange={e => setYearFilter(e.target.value)}
          >
            {availableYears.length === 0 && (
              <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>
            )}
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {/* Range selector */}
        {mode === 'range' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="input text-xs py-2 w-36"
              value={filters.dateFrom || ''}
              onChange={e => onChange({ ...filters, dateFrom: e.target.value, month: undefined, year: undefined })} />
            <span className="text-slate-500 text-xs">—</span>
            <input type="date" className="input text-xs py-2 w-36"
              value={filters.dateTo || ''}
              onChange={e => onChange({ ...filters, dateTo: e.target.value, month: undefined, year: undefined })} />
          </div>
        )}

        {/* More filters button */}
        <button onClick={() => setOpen(o => !o)}
          className={`btn-secondary text-xs py-2 px-3 ${open || hasExtra ? 'border-accent/40 text-accent-light' : ''}`}>
          ⚙️ Más {hasExtra ? `(${activeFilters.length})` : ''}
        </button>

        {/* Clear */}
        <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ✕ Limpiar
        </button>
      </div>

      {/* Extended filters panel */}
      {open && (
        <div className="card p-4 border-accent/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input text-xs" value={filters.type || ''} onChange={e => set('type', e.target.value)}>
              <option value="">Todos</option>
              <option value="INCOME">Ingresos</option>
              <option value="EXPENSE">Gastos</option>
            </select>
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input text-xs" value={filters.categoryId || ''} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Todas</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Moneda</label>
            <select className="input text-xs" value={filters.currency || ''} onChange={e => set('currency', e.target.value)}>
              <option value="">Todas</option>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D USD</option>
            </select>
          </div>
          {showAccountFilter && (
            <div>
              <label className="label">Cuenta</label>
              <select className="input text-xs"
                value={filters.accountId ? `personal::${filters.accountId}` : filters.sharedAccountId ? `shared::${filters.sharedAccountId}` : ''}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) { onChange({ ...filters, accountId: undefined, sharedAccountId: undefined }); return; }
                  const [type, id] = val.split('::');
                  if (type === 'personal') onChange({ ...filters, accountId: id, sharedAccountId: undefined });
                  else onChange({ ...filters, sharedAccountId: id, accountId: undefined });
                }}>
                <option value="">Todas</option>
                {accounts.length > 0 && <optgroup label="Personales">{accounts.map(a => <option key={a.id} value={`personal::${a.id}`}>{a.name}</option>)}</optgroup>}
                {sharedAccounts.length > 0 && <optgroup label="Compartidas">{sharedAccounts.map(a => <option key={a.id} value={`shared::${a.id}`}>{a.name}</option>)}</optgroup>}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

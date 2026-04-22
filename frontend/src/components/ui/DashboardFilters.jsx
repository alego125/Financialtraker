import { useState, useEffect } from 'react';
import api from '../../services/api';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
};
const currentYear = () => String(new Date().getFullYear());

export default function DashboardFilters({ filters, onChange, showAccountFilter = false }) {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [sharedAccounts, setShared] = useState([]);
  const [open, setOpen]             = useState(false);
  const [mode, setMode]             = useState('month'); // 'month' | 'year' | 'range'

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    if (showAccountFilter) {
      api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
      api.get('/shared-accounts').then(r => setShared(r.data)).catch(() => {});
    }
  }, [showAccountFilter]);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const setMonthFilter = (m) => {
    onChange({ ...filters, month: m, year: undefined, dateFrom: undefined, dateTo: undefined });
    setMode('month');
  };
  const setYearFilter = (y) => {
    onChange({ ...filters, year: y, month: undefined, dateFrom: undefined, dateTo: undefined });
    setMode('year');
  };
  const setRangeFilter = (key, val) => {
    onChange({ ...filters, [key]: val, month: undefined, year: undefined });
    setMode('range');
  };

  // Al cambiar de tab a 'year', aplicar filtro anual de inmediato
  const handleModeChange = (v) => {
    setMode(v);
    if (v === 'year') {
      const y = filters.year || currentYear();
      onChange({ ...filters, year: y, month: undefined, dateFrom: undefined, dateTo: undefined });
    } else if (v === 'month') {
      const m = filters.month || currentMonth();
      onChange({ ...filters, month: m, year: undefined, dateFrom: undefined, dateTo: undefined });
    } else if (v === 'range') {
      onChange({ ...filters, month: undefined, year: undefined });
    }
  };

  const clearFilters = () => {
    onChange({ month: currentMonth() });
    setMode('month');
    setOpen(false);
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    monthOptions.push({ val, label });
  }
  const yearOptions = [2023,2024,2025,2026].map(y => String(y));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)]">
          {[['month','Mes'],['year','Año'],['range','Rango']].map(([v,l]) => (
            <button key={v} onClick={() => handleModeChange(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${mode===v ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
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

        <button onClick={() => setOpen(o => !o)}
          className={`btn-secondary text-xs py-2 px-3 ${open ? 'border-accent/40 text-accent-light' : ''}`}>
          ⚙️ {open ? 'Ocultar' : 'Más filtros'} {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
        {activeCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] transition-colors">
            ✕ Limpiar
          </button>
        )}
      </div>

      {open && (
        <div className="card p-4 border-accent/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input text-xs" value={filters.type||''} onChange={e => set('type', e.target.value)}>
              <option value="">Todos</option>
              <option value="INCOME">Ingresos</option>
              <option value="EXPENSE">Gastos</option>
            </select>
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input text-xs" value={filters.categoryId||''} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Todas</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Moneda</label>
            <select className="input text-xs" value={filters.currency||''} onChange={e => set('currency', e.target.value)}>
              <option value="">Todas</option>
              <option value="ARS">ARS $</option>
              <option value="USD">USD $</option>
            </select>
          </div>
          {showAccountFilter && (
            <div>
              <label className="label">Cuenta</label>
              <select className="input text-xs" value={filters.accountId||filters.sharedAccountId||''} onChange={e => {
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
          <div>
            <label className="label">Monto mín.</label>
            <input type="number" className="input text-xs" placeholder="0" value={filters.amountMin||''} onChange={e => set('amountMin', e.target.value)} />
          </div>
          <div>
            <label className="label">Monto máx.</label>
            <input type="number" className="input text-xs" placeholder="∞" value={filters.amountMax||''} onChange={e => set('amountMax', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

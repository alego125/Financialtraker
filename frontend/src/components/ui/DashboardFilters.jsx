import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function DashboardFilters({ filters, onChange }) {
  const [categories, setCategories] = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [open, setOpen]             = useState(false);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
  }, []);

  const set = (key, val) => onChange({ ...filters, [key]: val });
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="card">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm"
      >
        <span className="font-display font-semibold text-slate-300 flex items-center gap-2">
          🔍 Filtros
          {activeCount > 0 && (
            <span className="bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>
          )}
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲ Ocultar' : '▼ Mostrar'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-dark-500">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={filters.type || ''} onChange={e => set('type', e.target.value)}>
                <option value="">Todos</option>
                <option value="INCOME">Ingresos</option>
                <option value="EXPENSE">Gastos</option>
              </select>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={filters.categoryId || ''} onChange={e => set('categoryId', e.target.value)}>
                <option value="">Todas</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cuenta</label>
              <select className="input" value={filters.accountId || ''} onChange={e => set('accountId', e.target.value)}>
                <option value="">Todas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Monto mín</label>
              <input type="number" className="input" placeholder="0" value={filters.amountMin || ''} onChange={e => set('amountMin', e.target.value)} />
            </div>
            <div>
              <label className="label">Monto máx</label>
              <input type="number" className="input" placeholder="∞" value={filters.amountMax || ''} onChange={e => set('amountMax', e.target.value)} />
            </div>
            <div>
              <label className="label">Comentario</label>
              <input type="text" className="input" placeholder="Buscar..." value={filters.comment || ''} onChange={e => set('comment', e.target.value)} />
            </div>
          </div>
          {activeCount > 0 && (
            <button className="btn-secondary text-xs mt-3" onClick={() => onChange({})}>✕ Limpiar filtros</button>
          )}
        </div>
      )}
    </div>
  );
}
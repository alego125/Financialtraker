import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);

const MONTH_OPTIONS = () => {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    opts.push({ val, label });
  }
  return opts;
};
const YEAR_OPTIONS = ['2023','2024','2025','2026'];

export default function CalculatorPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  const [dateMode, setDateMode]     = useState('month'); // month | year | range
  const [month, setMonth]           = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [year, setYear]             = useState(String(new Date().getFullYear()));
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [keyword, setKeyword]       = useState('');
  const [typeFilter, setTypeFilter] = useState('EXPENSE');
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const monthOptions = MONTH_OPTIONS();

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const toggleCat = (id) => {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const calculate = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ page: 1, limit: 5000, sortBy: 'date', sortOrder: 'desc' });
      if (dateMode === 'month' && month)       params.set('month', month);
      else if (dateMode === 'year' && year)    params.set('year', year);
      else {
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo)   params.set('dateTo', dateTo);
      }
      if (keyword) params.set('comment', keyword);
      if (typeFilter) params.set('type', typeFilter);

      // Si hay categorías seleccionadas, hacemos un request por cada una y mergeamos
      let allTxs = [];
      if (selectedCats.length > 0) {
        const fetches = selectedCats.map(catId => {
          const p = new URLSearchParams(params);
          p.set('categoryId', catId);
          return api.get(`/transactions?${p}`).then(r => r.data.data || []);
        });
        const results = await Promise.all(fetches);
        // deduplicar por id
        const seen = new Set();
        for (const batch of results) {
          for (const tx of batch) {
            if (!seen.has(tx.id)) { seen.add(tx.id); allTxs.push(tx); }
          }
        }
      } else {
        const { data } = await api.get(`/transactions?${params}`);
        allTxs = data.data || [];
      }

      // Calcular
      let sumARS = 0, sumUSD = 0, count = 0;
      for (const tx of allTxs) {
        const amt = parseFloat(tx.amount || 0);
        if (tx.currency === 'USD') sumUSD += amt;
        else sumARS += amt;
        count++;
      }

      // Breakdown por categoría
      const byCategory = {};
      for (const tx of allTxs) {
        const name = tx.category?.name || 'Sin categoría';
        const color = tx.category?.color || '#8A8478';
        if (!byCategory[name]) byCategory[name] = { name, color, ARS: 0, USD: 0, count: 0 };
        const amt = parseFloat(tx.amount || 0);
        if (tx.currency === 'USD') byCategory[name].USD += amt;
        else byCategory[name].ARS += amt;
        byCategory[name].count++;
      }

      setResult({
        sumARS, sumUSD, count,
        byCategory: Object.values(byCategory).sort((a,b) => (b.ARS+b.USD)-(a.ARS+a.USD)),
      });
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateMode, month, year, dateFrom, dateTo, keyword, typeFilter, selectedCats]);

  const canCalculate = dateMode === 'range' ? (dateFrom || dateTo) : true;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Calculadora</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Sumá gastos con filtros combinados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel filtros */}
        <div className="card p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-display font-bold text-[var(--text)] uppercase tracking-widest">🎛 Filtros</h2>

          {/* Tipo */}
          <div>
            <label className="label">Tipo de transacción</label>
            <div className="flex gap-2 mt-1">
              {[['','Todos'],['EXPENSE','Gastos'],['INCOME','Ingresos']].map(([v,l]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    typeFilter === v
                      ? 'bg-accent border-accent text-[var(--bg,#1A1714)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-accent/50'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de fechas */}
          <div>
            <label className="label">Período</label>
            <div className="flex gap-1 mt-1 bg-surface3 p-1 rounded-xl border border-[var(--border)] w-fit">
              {[['month','Mes'],['year','Año'],['range','Rango']].map(([v,l]) => (
                <button key={v} onClick={() => setDateMode(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${dateMode===v ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-2">
              {dateMode === 'month' && (
                <select className="input text-xs" value={month} onChange={e => setMonth(e.target.value)}>
                  {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              )}
              {dateMode === 'year' && (
                <select className="input w-28 text-xs" value={year} onChange={e => setYear(e.target.value)}>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {dateMode === 'range' && (
                <div className="flex gap-2 items-center">
                  <input type="date" className="input text-xs flex-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  <span className="text-[var(--subtle)] text-xs">—</span>
                  <input type="date" className="input text-xs flex-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Categorías (multi-select) */}
          <div>
            <label className="label">
              Categorías
              {selectedCats.length > 0 && (
                <span className="ml-2 text-accent-light text-xs">({selectedCats.length} seleccionadas)</span>
              )}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    selectedCats.includes(c.id)
                      ? 'border-accent bg-accent/15 text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-accent/40'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#8A8478' }} />
                  {c.name}
                  {selectedCats.includes(c.id) && <span className="text-accent-light ml-0.5">✓</span>}
                </button>
              ))}
              {selectedCats.length > 0 && (
                <button onClick={() => setSelectedCats([])} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] px-2">
                  ✕ limpiar
                </button>
              )}
            </div>
            {selectedCats.length === 0 && (
              <p className="text-xs text-[var(--subtle)] mt-1">Sin selección = todas las categorías</p>
            )}
          </div>

          {/* Keyword */}
          <div>
            <label className="label">Buscar en comentarios</label>
            <input
              type="text"
              className="input text-xs mt-1"
              placeholder="Ej: vacaciones, supermercado..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>

          <button
            onClick={calculate}
            disabled={loading || !canCalculate}
            className="btn-primary w-full justify-center"
          >
            {loading ? 'Calculando...' : '🧮 Calcular'}
          </button>
        </div>

        {/* Panel resultado */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="card p-8 flex flex-col items-center justify-center text-center gap-3 h-full min-h-48">
              <span className="text-4xl">🧮</span>
              <p className="text-[var(--subtle)] text-sm">Configurá los filtros y presioná Calcular</p>
            </div>
          )}
          {loading && (
            <div className="card p-8 flex items-center justify-center h-full min-h-48">
              <span className="text-[var(--subtle)] text-sm">Calculando...</span>
            </div>
          )}
          {result && (
            <>
              {/* Totales */}
              <div className="card p-4 sm:p-5">
                <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3 uppercase tracking-widest">
                  📊 Resultado — {result.count} transacciones
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface3 rounded-xl p-3 text-center">
                    <div className="text-xs text-[var(--subtle)] mb-1">Total ARS</div>
                    <div className={`font-mono font-bold text-lg ${typeFilter === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                      {fmtARS(result.sumARS)}
                    </div>
                  </div>
                  {result.sumUSD > 0 && (
                    <div className="bg-surface3 rounded-xl p-3 text-center">
                      <div className="text-xs text-[var(--subtle)] mb-1">Total USD</div>
                      <div className="font-mono font-bold text-lg text-yellow-400">
                        {fmtUSD(result.sumUSD)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Breakdown por categoría */}
              {result.byCategory.length > 0 && (
                <div className="card p-4 sm:p-5">
                  <h2 className="text-sm font-display font-bold text-[var(--text)] mb-3 uppercase tracking-widest">
                    Desglose por categoría
                  </h2>
                  <div className="space-y-2">
                    {result.byCategory.map(cat => (
                      <div key={cat.name} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 text-sm text-[var(--text2)] truncate">{cat.name}</span>
                        <span className="text-xs text-[var(--subtle)] font-mono mr-2">{cat.count} tx</span>
                        <div className="text-right">
                          {cat.ARS > 0 && (
                            <div className={`font-mono font-semibold text-sm ${typeFilter === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                              {fmtARS(cat.ARS)}
                            </div>
                          )}
                          {cat.USD > 0 && (
                            <div className="font-mono font-semibold text-sm text-yellow-400">
                              {fmtUSD(cat.USD)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const fmtARS  = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD  = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);
const fmtDate = d => { if(!d)return'—'; const dt=new Date(d); return dt.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}); };

const sourceType  = src => src.includes(':') ? src.split(':')[0] : src;
const getPartnerId = src => src.includes(':') ? src.split(':')[1] : null;

export default function CalculatorPage() {
  const [categories, setCategories]             = useState([]);       // categorías del usuario
  const [partnerships, setPartnerships]         = useState([]);       // partnerships activos
  const [partnerCatsByPid, setPartnerCatsByPid] = useState({});       // { [partnerId]: [...cats] }
  const [loadingPartnerCats, setLoadingPartnerCats] = useState(false);
  const [selectedCats, setSelectedCats]         = useState([]);
  const [source, setSource]                     = useState('mine');   // 'mine' | 'partner:<id>' | 'both:<id>'
  const [dateFrom, setDateFrom]                 = useState('');
  const [dateTo, setDateTo]                     = useState('');
  const [keyword, setKeyword]                   = useState('');
  const [typeFilter, setTypeFilter]             = useState('EXPENSE');
  const [result, setResult]                     = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [expandedCat, setExpandedCat]           = useState(null);

  // Cargar categorías del usuario y partnerships al montar
  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/partnerships').then(r => {
      const active = (r.data || []).filter(p => p.status === 'ACCEPTED');
      setPartnerships(active);
    }).catch(() => {});
  }, []);

  // Cargar categorías del partner al cambiar de fuente
  useEffect(() => {
    const pid   = getPartnerId(source);
    const stype = sourceType(source);
    if ((stype === 'partner' || stype === 'both') && pid && !partnerCatsByPid[pid]) {
      setLoadingPartnerCats(true);
      api.get(`/partnerships/partner/${pid}/transactions?page=1&limit=1000`)
        .then(r => {
          const txs = r.data.data || [];
          const cats = new Map();
          txs.forEach(tx => { if (tx.category) cats.set(tx.category.id, tx.category); });
          setPartnerCatsByPid(prev => ({ ...prev, [pid]: [...cats.values()] }));
        })
        .catch(() => {})
        .finally(() => setLoadingPartnerCats(false));
    }
  }, [source]);  // eslint-disable-line

  const toggleCat = id =>
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const changeSource = (newSource) => {
    setSource(newSource);
    setSelectedCats([]);
    setResult(null);
  };

  // Categorías del partner activo
  const pid          = getPartnerId(source);
  const stype        = sourceType(source);
  const partnerCats  = pid ? (partnerCatsByPid[pid] || []) : [];
  const activePartner = partnerships.find(p => p.partner?.id === pid);

  // Conjuntos de IDs por dueño (para enrutar categorías en modo 'both')
  const myCatIdSet       = new Set(categories.map(c => c.id));
  const partnerCatIdSet  = new Set(partnerCats.map(c => c.id));

  // Lista de chips a mostrar según fuente
  const displayCats = stype === 'mine'
    ? categories.map(c => ({ ...c, owner: 'mine' }))
    : stype === 'partner'
    ? partnerCats.map(c => ({ ...c, owner: 'partner' }))
    : [
        ...categories.map(c => ({ ...c, owner: 'mine' })),
        ...partnerCats.filter(c => !myCatIdSet.has(c.id)).map(c => ({ ...c, owner: 'partner' })),
      ];

  const calculate = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setResult(null);
    setExpandedCat(null);

    const includesMine    = stype === 'mine'    || stype === 'both';
    const includesPartner = (stype === 'partner' || stype === 'both') && pid;

    // Qué IDs de categoría van a cada endpoint
    const mineCatFilter    = stype === 'mine'    ? selectedCats
                           : stype === 'both'    ? selectedCats.filter(id => myCatIdSet.has(id))
                           : [];
    const partnerCatFilter = stype === 'partner' ? selectedCats
                           : stype === 'both'    ? selectedCats.filter(id => partnerCatIdSet.has(id))
                           : [];

    try {
      const baseParams = new URLSearchParams({ page: 1, limit: 5000, sortBy: 'date', sortOrder: 'desc' });
      baseParams.set('dateFrom', dateFrom);
      baseParams.set('dateTo', dateTo);
      if (keyword)    baseParams.set('comment', keyword);
      if (typeFilter) baseParams.set('type', typeFilter);

      /* ── Fetch mis transacciones ── */
      const fetchMine = async () => {
        if (!includesMine) return [];
        if (mineCatFilter.length > 0) {
          const batches = await Promise.all(mineCatFilter.map(catId => {
            const p = new URLSearchParams(baseParams); p.set('categoryId', catId);
            return api.get(`/transactions?${p}`).then(r => r.data.data || []);
          }));
          const seen = new Set(); const out = [];
          for (const batch of batches) for (const tx of batch)
            if (!seen.has(tx.id)) { seen.add(tx.id); out.push(tx); }
          return out;
        }
        const { data } = await api.get(`/transactions?${baseParams}`);
        return data.data || [];
      };

      /* ── Fetch transacciones del partner ── */
      const fetchPartner = async () => {
        if (!includesPartner) return [];
        const base = `/partnerships/partner/${pid}/transactions`;
        if (partnerCatFilter.length > 0) {
          const batches = await Promise.all(partnerCatFilter.map(catId => {
            const p = new URLSearchParams(baseParams); p.set('categoryId', catId);
            return api.get(`${base}?${p}`).then(r => r.data.data || []);
          }));
          const seen = new Set(); const out = [];
          for (const batch of batches) for (const tx of batch)
            if (!seen.has(tx.id)) { seen.add(tx.id); out.push({ ...tx, _fromPartner: true }); }
          return out;
        }
        const { data } = await api.get(`${base}?${baseParams}`);
        return (data.data || []).map(tx => ({ ...tx, _fromPartner: true }));
      };

      const [myTxs, partnerTxs] = await Promise.all([fetchMine(), fetchPartner()]);
      const allTxs = [...myTxs, ...partnerTxs];

      /* ── Totales y breakdown ── */
      let sumARS = 0, sumUSD = 0;
      const byCategory = {};
      for (const tx of allTxs) {
        const amt   = parseFloat(tx.amount || 0);
        const name  = tx.category?.name  || 'Sin categoría';
        const color = tx.category?.color || '#8A8478';
        if (tx.currency === 'USD') sumUSD += amt; else sumARS += amt;
        if (!byCategory[name]) byCategory[name] = { name, color, ARS: 0, USD: 0, count: 0, transactions: [] };
        if (tx.currency === 'USD') byCategory[name].USD += amt; else byCategory[name].ARS += amt;
        byCategory[name].count++;
        byCategory[name].transactions.push(tx);
      }

      setResult({
        sumARS, sumUSD,
        count: allTxs.length,
        byCategory: Object.values(byCategory).sort((a,b) => (b.ARS+b.USD)-(a.ARS+a.USD)),
      });
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, keyword, typeFilter, selectedCats, source, pid, stype, myCatIdSet, partnerCatIdSet]);

  const canCalculate = !!(dateFrom && dateTo);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Calculadora</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Sumá gastos con filtros combinados</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Panel filtros ── */}
        <div className="card p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-display font-bold text-[var(--text)] uppercase tracking-widest">🎛 Filtros</h2>

          {/* Fuente de datos */}
          {partnerships.length > 0 && (
            <div>
              <label className="label">Fuente de transacciones</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => changeSource('mine')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    source === 'mine'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-emerald-500/30'}`}>
                  👤 Mis transacciones
                </button>
                {partnerships.map(p => (
                  <button key={p.partner.id} onClick={() => changeSource(`partner:${p.partner.id}`)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      source === `partner:${p.partner.id}`
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-orange-500/30'}`}>
                    👤 {p.partner.name}
                  </button>
                ))}
                {partnerships.map(p => (
                  <button key={`both-${p.partner.id}`} onClick={() => changeSource(`both:${p.partner.id}`)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      source === `both:${p.partner.id}`
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-violet-500/30'}`}>
                    👥 Ambos con {p.partner.name}
                  </button>
                ))}
              </div>
              {stype !== 'mine' && (
                <p className="text-xs text-[var(--subtle)] mt-2">
                  {stype === 'partner'
                    ? `Calculando sobre transacciones de ${activePartner?.partner?.name || 'tu partner'}`
                    : `Calculando sobre tus transacciones + las de ${activePartner?.partner?.name || 'tu partner'} en conjunto`}
                </p>
              )}
            </div>
          )}

          {/* Tipo */}
          <div>
            <label className="label">Tipo de transacción</label>
            <div className="flex gap-2 mt-1">
              {[['','Todos'],['EXPENSE','Gastos'],['INCOME','Ingresos']].map(([v,l]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    typeFilter === v
                      ? 'bg-accent border-accent text-[var(--bg,#1A1714)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-accent/50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de fechas */}
          <div>
            <label className="label">
              Período
              <span className="ml-2 text-[var(--subtle)] text-xs font-normal">Rango de fechas</span>
              <span className="ml-1 text-expense text-xs">*</span>
            </label>
            <div className="flex gap-2 items-center mt-2">
              <div className="flex-1">
                <span className="text-xs text-[var(--subtle)] mb-1 block">Desde</span>
                <input type="date" className="input text-xs w-full" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <span className="text-[var(--subtle)] text-xs mt-4">—</span>
              <div className="flex-1">
                <span className="text-xs text-[var(--subtle)] mb-1 block">Hasta</span>
                <input type="date" className="input text-xs w-full" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {!canCalculate && (
              <p className="text-xs text-[var(--subtle)] mt-2 flex items-center gap-1">
                <span className="text-expense">*</span> Seleccioná fecha inicio y fin para calcular
              </p>
            )}
          </div>

          {/* Categorías */}
          <div>
            <label className="label">
              Categorías
              {selectedCats.length > 0 && (
                <span className="ml-2 text-accent-light text-xs">({selectedCats.length} seleccionadas)</span>
              )}
            </label>

            {/* Spinner mientras carga categorías del partner */}
            {loadingPartnerCats && stype !== 'mine' && (
              <p className="text-xs text-[var(--subtle)] mt-2">Cargando categorías...</p>
            )}

            {!loadingPartnerCats && (
              <>
                {/* Leyenda de colores en modo 'both' */}
                {stype === 'both' && displayCats.length > 0 && (
                  <div className="flex gap-3 mt-1 mb-2">
                    <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Mis categorías
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Categorías de {activePartner?.partner?.name}
                    </span>
                  </div>
                )}

                <div className="mt-1 flex flex-wrap gap-2">
                  {displayCats.map(c => {
                    const isSelected = selectedCats.includes(c.id);
                    const isMine     = c.owner === 'mine';
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCat(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? isMine
                              ? 'border-emerald-500 bg-emerald-500/15 text-[var(--text)]'
                              : 'border-orange-400 bg-orange-400/15 text-[var(--text)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:border-accent/40'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#8A8478' }} />
                        {c.name}
                        {/* En modo 'both' indicamos el dueño en el chip */}
                        {stype === 'both' && (
                          <span className={`text-xs ml-0.5 ${isMine ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {isMine ? '(yo)' : `(${activePartner?.partner?.name?.split(' ')[0]})`}
                          </span>
                        )}
                        {isSelected && <span className="text-accent-light ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                  {selectedCats.length > 0 && (
                    <button onClick={() => setSelectedCats([])} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] px-2">
                      ✕ limpiar
                    </button>
                  )}
                </div>

                {displayCats.length === 0 && !loadingPartnerCats && (
                  <p className="text-xs text-[var(--subtle)] mt-1">
                    {stype !== 'mine' ? 'Sin categorías disponibles para este período' : 'Sin selección = todas las categorías'}
                  </p>
                )}
                {displayCats.length > 0 && selectedCats.length === 0 && (
                  <p className="text-xs text-[var(--subtle)] mt-1">Sin selección = todas las categorías</p>
                )}
              </>
            )}
          </div>

          {/* Keyword */}
          <div>
            <label className="label">Buscar en comentarios</label>
            <input type="text" className="input text-xs mt-1"
              placeholder="Ej: vacaciones, supermercado..."
              value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>

          <button onClick={calculate} disabled={loading || !canCalculate}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Calculando...' : '🧮 Calcular'}
          </button>
        </div>

        {/* ── Panel resultado ── */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="card p-8 flex flex-col items-center justify-center text-center gap-3 h-full min-h-48">
              <span className="text-4xl">🧮</span>
              <p className="text-[var(--subtle)] text-sm">Seleccioná un rango de fechas y presioná Calcular</p>
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
                    <div className={`font-mono font-bold text-lg ${typeFilter === 'INCOME' ? 'text-income' : typeFilter === '' ? 'text-[var(--text)]' : 'text-expense'}`}>
                      {fmtARS(result.sumARS)}
                    </div>
                  </div>
                  {result.sumUSD > 0 && (
                    <div className="bg-surface3 rounded-xl p-3 text-center">
                      <div className="text-xs text-[var(--subtle)] mb-1">Total USD</div>
                      <div className="font-mono font-bold text-lg text-yellow-400">{fmtUSD(result.sumUSD)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Breakdown por categoría — clickeable */}
              {result.byCategory.length > 0 && (
                <div className="card p-4 sm:p-5">
                  <h2 className="text-sm font-display font-bold text-[var(--text)] mb-1 uppercase tracking-widest">
                    Desglose por categoría
                  </h2>
                  <p className="text-xs text-[var(--subtle)] mb-3">Hacé clic en una categoría para ver el detalle de transacciones</p>
                  <div className="space-y-1">
                    {result.byCategory.map(cat => (
                      <div key={cat.name}>
                        <button
                          onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
                          className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-surface3 transition-colors border border-transparent hover:border-[var(--border)] text-left cursor-pointer"
                        >
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="flex-1 text-sm text-[var(--text2)] truncate">{cat.name}</span>
                          <span className="text-xs text-[var(--subtle)] font-mono">{cat.count} tx</span>
                          <div className="text-right min-w-24">
                            {cat.ARS > 0 && (
                              <div className={`font-mono font-semibold text-sm ${typeFilter === 'INCOME' ? 'text-income' : typeFilter === '' ? 'text-[var(--text)]' : 'text-expense'}`}>
                                {fmtARS(cat.ARS)}
                              </div>
                            )}
                            {cat.USD > 0 && (
                              <div className="font-mono font-semibold text-sm text-yellow-400">{fmtUSD(cat.USD)}</div>
                            )}
                          </div>
                          <span className="text-[var(--subtle)] text-xs flex-shrink-0 w-4 text-center">
                            {expandedCat === cat.name ? '▲' : '▼'}
                          </span>
                        </button>

                        {expandedCat === cat.name && (
                          <div className="ml-4 mb-2 mt-1 rounded-lg border border-[var(--border)] overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-surface3 border-b border-[var(--border)]">
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Fecha</th>
                                  {stype === 'both' && (
                                    <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">De</th>
                                  )}
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Categoría</th>
                                  <th className="text-right px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Monto</th>
                                  <th className="text-left px-3 py-2 text-[var(--subtle)] font-semibold uppercase tracking-wide">Comentario</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {cat.transactions.map(tx => (
                                  <tr key={tx.id + (tx._fromPartner ? '-p' : '-m')} className="hover:bg-surface3/50 transition-colors">
                                    <td className="px-3 py-2 font-mono text-[var(--muted)] whitespace-nowrap">{fmtDate(tx.date)}</td>
                                    {stype === 'both' && (
                                      <td className="px-3 py-2">
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${tx._fromPartner ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                          {tx._fromPartner ? (activePartner?.partner?.name?.split(' ')[0] || 'Partner') : 'Yo'}
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-[var(--text2)]">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                        {cat.name}
                                      </span>
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                                      {tx.currency === 'USD' ? fmtUSD(tx.amount) : fmtARS(tx.amount)}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--muted)] break-words min-w-0">
                                      {tx.comment || <span className="text-[var(--subtle)] italic">sin comentario</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
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

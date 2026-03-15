import { useState, useCallback } from 'react';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);
const fmtPct = v => `${v > 0 ? '+' : ''}${v}%`;

// Sections del análisis con iconos
const SECTION_ICONS = {
  'resumen':     '📊',
  'ingresos':    '💰',
  'gastos':      '💸',
  'ahorro':      '🏦',
  'categorías':  '📂',
  'deudas':      '💳',
  'inversiones': '📈',
  'consejos':    '💡',
  'riesgos':     '⚠️',
  'metas':       '🎯',
};

const getSectionIcon = (title) => {
  const t = title.toLowerCase();
  for (const [key, icon] of Object.entries(SECTION_ICONS)) {
    if (t.includes(key)) return icon;
  }
  return '📌';
};

// Parse Claude response into sections
const parseAnalysis = (text) => {
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  let executive = [];
  let executiveDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect headers (## or ** wrapped or ALL CAPS short lines)
    const isHeader = /^#{1,3}\s/.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed);

    if (isHeader) {
      executiveDone = true;
      if (current) sections.push(current);
      const title = trimmed.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '').trim();
      current = { title, icon: getSectionIcon(title), items: [] };
    } else if (!executiveDone) {
      executive.push(trimmed);
    } else if (current) {
      // Bullet points or plain lines
      const clean = trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim();
      if (clean) current.items.push(clean);
    }
  }
  if (current) sections.push(current);

  // If no sections parsed, put everything as executive
  if (sections.length === 0) {
    executive = lines.filter(l => l.trim()).map(l => l.replace(/\*\*/g, '').trim());
  }

  return { executive, sections };
};

export default function AIAnalysisPanel({ open, onClose, dashboardData, partnerData, sharedAccounts, filters }) {
  const [loading, setLoading]   = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState({});

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const buildPrompt = useCallback(() => {
    const kpis    = dashboardData?.kpis    || {};
    const charts  = dashboardData?.charts  || {};
    const pKpis   = partnerData?.kpis      || {};
    const pCharts = partnerData?.charts    || {};

    const period = filters?.month
      ? `el mes ${filters.month}`
      : filters?.year
      ? `el año ${filters.year}`
      : filters?.dateFrom
      ? `el período ${filters.dateFrom} — ${filters.dateTo || 'hoy'}`
      : 'el período actual';

    // Top categories
    const topCats = (charts.categoryExpense || []).slice(0,5)
      .map(c => `${c.name}: ${fmtARS(c.value)}`).join(', ');
    const topCatsUSD = (charts.categoryExpenseUSD || []).slice(0,5)
      .map(c => `${c.name}: ${fmtUSD(c.value)}`).join(', ');
    const pTopCats = (pCharts.categoryExpense || []).slice(0,5)
      .map(c => `${c.name}: ${fmtARS(c.value)}`).join(', ');

    // Shared accounts
    const sharedSummary = (sharedAccounts || [])
      .map(a => `${a.name}: ${fmtARS(a.currentBalance)}${(a.currentBalanceUSD||0)!==0?' / '+fmtUSD(a.currentBalanceUSD):''}`)
      .join(', ') || 'No hay cuentas compartidas';

    return `Sos un asesor financiero personal experto. Analizá las finanzas combinadas de esta pareja y dales un análisis detallado, práctico y personalizado en español argentino.

PERÍODO ANALIZADO: ${period}

═══ MIS FINANZAS (Usuario 1) ═══
• Ingresos: ${fmtARS(kpis.totalIncome)}
• Gastos ARS: ${fmtARS(kpis.totalExpense)}
• Gastos USD: ${fmtUSD(kpis.totalExpenseUSD || 0)}
• Balance: ${fmtARS(kpis.balance)}
• Tasa de ahorro: ${kpis.savingsRate}%
• Categorías top (ARS): ${topCats || 'sin datos'}
• Categorías top (USD): ${topCatsUSD || 'sin gastos en USD'}
• Promedio mensual ingresos: ${fmtARS(kpis.avgMonthlyIncome)}
• Promedio mensual gastos: ${fmtARS(kpis.avgMonthlyExpense)}

═══ FINANZAS DEL PARTNER (Usuario 2) ═══
• Ingresos: ${fmtARS(pKpis.totalIncome)}
• Gastos ARS: ${fmtARS(pKpis.totalExpense)}
• Balance: ${fmtARS(pKpis.balance)}
• Tasa de ahorro: ${pKpis.savingsRate}%
• Categorías top: ${pTopCats || 'sin datos'}

═══ CUENTAS COMPARTIDAS ═══
${sharedSummary}

═══ TOTALES COMBINADOS ═══
• Ingresos totales: ${fmtARS((kpis.totalIncome||0) + (pKpis.totalIncome||0))}
• Gastos totales ARS: ${fmtARS((kpis.totalExpense||0) + (pKpis.totalExpense||0))}
• Balance combinado: ${fmtARS((kpis.balance||0) + (pKpis.balance||0))}

Estructurá el análisis así:
1. Empezá con 2-3 oraciones de resumen ejecutivo (sin título, directo al punto)
2. Luego usá estas secciones con formato ## Título:

## 💰 Estado de Ingresos
## 💸 Análisis de Gastos
## 🏦 Capacidad de Ahorro
## 💡 Consejos Prioritarios
## 🎯 Metas Recomendadas

En cada sección usá puntos concretos con números reales. Sé directo, específico y accionable. Máximo 600 palabras total.`;
  }, [dashboardData, partnerData, sharedAccounts, filters]);

  const runAnalysis = async () => {
    setLoading(true); setError(''); setAnalysis(null); setExpanded({});
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${baseURL}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: buildPrompt() }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error del servidor');
      }
      const data = await response.json();
      setAnalysis(parseAnalysis(data.text || ''));
    } catch(err) {
      setError(`No se pudo generar el análisis: ${err.message}`);
      console.error(err);
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-dark-800 border-l border-dark-500 flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-lg">🤖</div>
            <div>
              <div className="font-display font-bold text-white text-sm">Análisis Financiero IA</div>
              <div className="text-xs text-slate-500">Powered by Claude</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 text-slate-400 hover:text-white flex items-center justify-center text-sm">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Initial state */}
          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-5">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-4xl">🧠</div>
              <div>
                <div className="text-white font-display font-bold text-lg mb-2">Analizá tus finanzas con IA</div>
                <div className="text-slate-400 text-sm leading-relaxed max-w-xs">
                  Claude va a analizar tus ingresos, gastos, ahorro y cuentas compartidas para darte consejos personalizados.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs text-xs">
                {['📊 KPIs personales','💑 Finanzas compartidas','💸 Gastos por categoría','🎯 Metas y consejos'].map(t => (
                  <div key={t} className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-slate-400">{t}</div>
                ))}
              </div>
              <button onClick={runAnalysis}
                className="btn-primary px-8 py-3 text-sm font-display font-semibold">
                🚀 Generar Análisis
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center animate-pulse text-3xl">🤖</div>
              <div className="text-white font-display font-semibold">Analizando tus finanzas...</div>
              <div className="text-slate-500 text-sm text-center max-w-xs">Claude está procesando tus datos y generando recomendaciones personalizadas.</div>
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{animationDelay:`${i*0.15}s`}} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="text-4xl">⚠️</div>
              <div className="text-rose-400 text-sm text-center">{error}</div>
              <button onClick={runAnalysis} className="btn-secondary text-sm px-6">Reintentar</button>
            </div>
          )}

          {/* Analysis result */}
          {analysis && !loading && (
            <div className="space-y-4">
              {/* Executive summary */}
              <div className="card p-4 border-accent/30 bg-accent/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📋</span>
                  <span className="text-xs font-display font-bold text-accent-light uppercase tracking-widest">Resumen Ejecutivo</span>
                </div>
                <div className="space-y-2">
                  {analysis.executive.map((line, i) => (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>

              {/* Expandable sections */}
              {analysis.sections.map((sec, i) => (
                <div key={i} className="card border-dark-500 overflow-hidden">
                  <button
                    onClick={() => toggle(i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sec.icon}</span>
                      <span className="font-display font-semibold text-white text-sm">{sec.title}</span>
                      <span className="text-xs text-slate-600 font-mono">{sec.items.length} puntos</span>
                    </div>
                    <span className={`text-slate-500 text-xs transition-transform duration-200 ${expanded[i] ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {expanded[i] && (
                    <div className="px-4 pb-4 space-y-2 border-t border-dark-600">
                      {sec.items.map((item, j) => (
                        <div key={j} className="flex gap-2 pt-2">
                          <span className="text-accent-light text-xs mt-0.5 flex-shrink-0">→</span>
                          <p className="text-slate-300 text-sm leading-relaxed">{item}</p>
                        </div>
                      ))}
                      {sec.items.length === 0 && (
                        <p className="text-slate-500 text-sm pt-2">Sin detalles adicionales.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Regenerate */}
              <button onClick={runAnalysis}
                className="w-full btn-secondary text-xs py-2.5 flex items-center justify-center gap-2">
                🔄 Regenerar análisis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

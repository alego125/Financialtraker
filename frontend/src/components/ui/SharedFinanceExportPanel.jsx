import { useState, useCallback } from 'react';
import api from '../../services/api';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);

const GENERAL_CATS = ['auto','automovil','automóvil','vehículo','vehiculo','servicios','servicio','salidas','entretenimiento','otros','gastos varios','comida','alimentacion','alimentación','ropa','indumentaria','salud','médico','medico','transporte'];
const isGeneral = (name) => GENERAL_CATS.some(g => name.toLowerCase().includes(g));

const buildCategoryMap = (transactions) => {
  const map = {};
  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE') continue;
    const isUSD = tx.currency === 'USD';
    const cat   = tx.category?.name || 'Sin categoría';
    const key   = isUSD ? `${cat}__USD` : cat;
    if (!map[key]) map[key] = { name:cat, isUSD, total:0, items:[] };
    map[key].total += parseFloat(tx.amount||0);
    if (tx.comment && !tx.comment.startsWith('[Transferencia')) {
      map[key].items.push({ comment:tx.comment, amount:parseFloat(tx.amount||0) });
    }
  }
  return map;
};

const formatCatBlock = (map, currency='ARS') => {
  const fmt = currency==='USD' ? fmtUSD : fmtARS;
  return Object.values(map)
    .filter(c => c.isUSD === (currency==='USD'))
    .sort((a,b) => b.total - a.total)
    .slice(0,10)
    .map((c,i) => {
      let line = `  ${i+1}. ${c.name}: ${fmt(c.total)}`;
      if (isGeneral(c.name) && c.items.length > 0) {
        const detail = c.items
          .sort((a,b) => b.amount-a.amount).slice(0,5)
          .map(it => `       - ${it.comment}: ${fmt(it.amount)}`).join('\n');
        line += `\n${detail}`;
      }
      return line;
    }).join('\n');
};

export default function SharedFinanceExportPanel({ open, onClose, me, partner, myKpis, partnerKpis, combined, filters, partnerId }) {
  const [copied, setCopied]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [report, setReport]     = useState('');

  const buildReport = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(
        Object.fromEntries(Object.entries(filters||{}).filter(([,v])=>v))
      ).toString();

      // Fetch all transactions + transfers
      const [r1, r2, rt] = await Promise.all([
        api.get(`/transactions?page=1&limit=5000&sortBy=date&sortOrder=desc${q?'&'+q:''}`),
        api.get(`/partnerships/partner/${partnerId}/transactions?page=1&limit=5000${q?'&'+q:''}`),
        api.get(`/transfers?page=1&limit=500`),
      ]);

      const myTx      = r1.data.data || [];
      const partnerTx = r2.data.data || [];
      const transfers = rt.data.data || [];

      // Category maps per person
      const myCatMap      = buildCategoryMap(myTx);
      const partnerCatMap = buildCategoryMap(partnerTx);

      // Transfers between us (both directions)
      const relevantTransfers = transfers.filter(t =>
        t.fromName && t.toName
      ).slice(0,10).map(t =>
        `  • ${fmtARS(t.amount)}: ${t.fromName} → ${t.toName}${t.comment ? ` (${t.comment})` : ''}`
      ).join('\n');

      // Combined income/expense
      const totalIncome  = (myKpis?.totalIncome||0)  + (partnerKpis?.totalIncome||0);
      const totalExpense = (myKpis?.totalExpense||0) + (partnerKpis?.totalExpense||0);
      const totalBalance = (myKpis?.balance||0)      + (partnerKpis?.balance||0);

      const period = filters?.month
        ? `Mes: ${filters.month}`
        : filters?.year ? `Año: ${filters.year}`
        : filters?.dateFrom ? `Período: ${filters.dateFrom} al ${filters.dateTo||'hoy'}`
        : 'Período: mes actual';

      const txt = `════════════════════════════════════════
REPORTE FINANCIERO CONJUNTO
${me?.name} & ${partner?.name}
${period}
════════════════════════════════════════

📊 RESUMEN COMBINADO
─────────────────────
• Ingresos totales:   ${fmtARS(totalIncome)}
• Gastos totales ARS: ${fmtARS(totalExpense)}
• Balance combinado:  ${fmtARS(totalBalance)}
• Ahorro ${me?.name}:  ${myKpis?.savingsRate||0}%
• Ahorro ${partner?.name}: ${partnerKpis?.savingsRate||0}%

👤 ${me?.name?.toUpperCase()}
─────────────────────
• Ingresos:   ${fmtARS(myKpis?.totalIncome)}
• Gastos ARS: ${fmtARS(myKpis?.totalExpense)}
• Gastos USD: ${fmtUSD(myKpis?.totalExpenseUSD||0)}
• Balance:    ${fmtARS(myKpis?.balance)}
• Tasa ahorro: ${myKpis?.savingsRate||0}%

💸 Gastos por categoría (ARS):
${formatCatBlock(myCatMap,'ARS') || '  Sin datos'}
${Object.values(myCatMap).some(c=>c.isUSD) ? `\n💵 Gastos por categoría (USD):\n${formatCatBlock(myCatMap,'USD')}` : ''}

👤 ${partner?.name?.toUpperCase()}
─────────────────────
• Ingresos:   ${fmtARS(partnerKpis?.totalIncome)}
• Gastos ARS: ${fmtARS(partnerKpis?.totalExpense)}
• Balance:    ${fmtARS(partnerKpis?.balance)}
• Tasa ahorro: ${partnerKpis?.savingsRate||0}%

💸 Gastos por categoría (ARS):
${formatCatBlock(partnerCatMap,'ARS') || '  Sin datos'}
${Object.values(partnerCatMap).some(c=>c.isUSD) ? `\n💵 Gastos por categoría (USD):\n${formatCatBlock(partnerCatMap,'USD')}` : ''}
${relevantTransfers ? `\n🔄 TRANSFERENCIAS ENTRE CUENTAS\n─────────────────────\n${relevantTransfers}` : ''}

════════════════════════════════════════
INSTRUCCIÓN PARA LA IA:
Analizá las finanzas combinadas de esta pareja y proporcioná:
1. Resumen ejecutivo del estado financiero conjunto
2. Comparación de hábitos de gasto entre ${me?.name} y ${partner?.name}
3. Análisis de las transferencias entre cuentas
4. Identificación de gastos excesivos o áreas de mejora en cada uno
5. Consejos para optimizar el presupuesto familiar conjunto
6. Metas financieras recomendadas para los próximos 3-6 meses
Respondé en español, sé específico con los números y directo en los consejos.
════════════════════════════════════════`;

      setReport(txt);
    } catch(e) {
      console.error(e);
      setReport('Error al generar el reporte. Intentá de nuevo.');
    } finally { setLoading(false); }
  }, [me, partner, myKpis, partnerKpis, filters, partnerId]);

  // Auto-generate when panel opens
  const [generated, setGenerated] = useState(false);
  if (open && !generated && !loading) {
    setGenerated(true);
    buildReport();
  }
  if (!open && generated) setGenerated(false);

  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type:'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reporte-conjunto-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-dark-800 border-l border-dark-500 flex flex-col h-full shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-lg">📤</div>
            <div>
              <div className="font-display font-bold text-white text-sm">Exportar reporte conjunto</div>
              <div className="text-xs text-slate-500">{me?.name} & {partner?.name} — para analizar con IA</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 text-slate-400 hover:text-white flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="px-5 py-3 border-b border-dark-500 flex-shrink-0">
          <p className="text-xs text-slate-400 leading-relaxed">
            Incluye gastos e ingresos de ambos, transferencias entre cuentas y desglose por concepto en categorías generales. Pegalo en{' '}
            <a href="https://chat.openai.com" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">ChatGPT</a>,{' '}
            <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">Gemini</a> o{' '}
            <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">Claude</a>.
          </p>
        </div>

        <div className="px-5 py-3 border-b border-dark-500 flex gap-2 flex-shrink-0">
          <button onClick={handleCopy} disabled={loading || !report}
            className={`flex-1 py-2.5 rounded-xl text-sm font-display font-semibold border transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${
              copied ? 'bg-income/20 border-income/40 text-income'
                     : 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
            }`}>
            {copied ? '✓ ¡Copiado!' : '📋 Copiar al portapapeles'}
          </button>
          <button onClick={handleDownload} disabled={loading || !report}
            className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2 disabled:opacity-40">
            💾 Descargar .txt
          </button>
          <button onClick={() => { setReport(''); buildReport(); }}
            disabled={loading}
            className="btn-secondary text-sm py-2.5 px-3 disabled:opacity-40">
            🔄
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <div className="text-3xl animate-pulse">📊</div>
              <div className="text-sm">Generando reporte...</div>
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 mb-2 font-display font-semibold uppercase tracking-widest">Vista previa</div>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-dark-700 rounded-xl p-4 border border-dark-500">
                {report}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

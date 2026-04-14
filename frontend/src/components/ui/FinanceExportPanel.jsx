import { useState, useCallback } from 'react';

const fmtARS = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v||0);
const fmtUSD = v => new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(v||0);

// Categorías generales que vale la pena desglosar con sus comentarios
const GENERAL_CATS = ['auto','automovil','automóvil','vehículo','vehiculo','servicios','servicio','salidas','entretenimiento','otros','gastos varios','comida','alimentacion','alimentación','ropa','indumentaria','salud','médico','medico','transporte'];
const isGeneral = (name) => GENERAL_CATS.some(g => name.toLowerCase().includes(g));

export default function FinanceExportPanel({ open, onClose, dashData, filters }) {
  const [copied, setCopied] = useState(false);

  const buildReport = useCallback(() => {
    if (!dashData?.kpis) return '';
    const { kpis, charts } = dashData;

    const period = filters?.month
      ? `Mes: ${filters.month}`
      : filters?.year ? `Año: ${filters.year}`
      : filters?.dateFrom ? `Período: ${filters.dateFrom} al ${filters.dateTo || 'hoy'}`
      : 'Período: mes actual';

    // ARS categories — desglosar con comentarios solo las generales
    const topCatsARS = (charts?.categoryExpense || []).slice(0,10).map((c,i) => {
      let line = `  ${i+1}. ${c.name}: ${fmtARS(c.value)}`;
      if (isGeneral(c.name) && c.items?.length > 0) {
        const detail = c.items.map(it => `       - ${it.comment}: ${fmtARS(it.amount)}`).join('\n');
        line += `\n${detail}`;
      }
      return line;
    }).join('\n');

    // USD categories — mismo criterio
    const topCatsUSD = (charts?.categoryExpenseUSD || []).slice(0,8).map((c,i) => {
      let line = `  ${i+1}. ${c.name}: ${fmtUSD(c.value)}`;
      if (isGeneral(c.name) && c.items?.length > 0) {
        const detail = c.items.map(it => `       - ${it.comment}: ${fmtUSD(it.amount)}`).join('\n');
        line += `\n${detail}`;
      }
      return line;
    }).join('\n');

    const monthly = (charts?.monthly || []).slice(-6)
      .map(m => `  ${m.month}: ingresos ${fmtARS(m.income)} | gastos ${fmtARS(m.expense)}${m.expenseUSD > 0 ? ` | gastos USD ${fmtUSD(m.expenseUSD)}` : ''}`).join('\n');

    return `════════════════════════════════════════
REPORTE FINANCIERO PERSONAL
${period}
════════════════════════════════════════

📊 RESUMEN GENERAL
──────────────────
• Ingresos totales:      ${fmtARS(kpis.totalIncome)}
• Gastos totales (ARS):  ${fmtARS(kpis.totalExpense)}
• Gastos totales (USD):  ${fmtUSD(kpis.totalExpenseUSD || 0)}
• Balance neto:          ${fmtARS(kpis.balance)}
• Tasa de ahorro:        ${kpis.savingsRate}%
• Promedio ing. mensual: ${fmtARS(kpis.avgMonthlyIncome)}
• Promedio gst. mensual: ${fmtARS(kpis.avgMonthlyExpense)}
${kpis.topExpenseCategory ? `• Mayor gasto en:        ${kpis.topExpenseCategory.name} (${fmtARS(kpis.topExpenseCategory.amount)})` : ''}

💸 GASTOS POR CATEGORÍA (ARS)
──────────────────────────────
${topCatsARS || '  Sin datos'}

${topCatsUSD ? `💵 GASTOS POR CATEGORÍA (USD)\n──────────────────────────────\n${topCatsUSD}\n\n` : ''}📈 EVOLUCIÓN MENSUAL (últimos 6 meses)
───────────────────────────────────────
${monthly || '  Sin datos'}

════════════════════════════════════════
INSTRUCCIÓN PARA LA IA:
Analizá estos datos financieros personales y proporcioná:
1. Un resumen ejecutivo del estado financiero actual
2. Análisis detallado de ingresos y gastos
3. Evaluación de la tasa de ahorro (${kpis.savingsRate}%)
4. Identificación de gastos excesivos o áreas de mejora
5. Consejos concretos y accionables para mejorar las finanzas
6. Metas financieras recomendadas para los próximos 3-6 meses
Respondé en español, sé específico con los números y directo en los consejos.
════════════════════════════════════════`;
  }, [dashData, filters]);

  const handleCopy = async () => {
    const text = buildReport();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const text = buildReport();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reporte-financiero-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;
  const report = buildReport();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-surface2 border-l border-[var(--border)] flex flex-col h-full shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-lg">📤</div>
            <div>
              <div className="font-display font-bold text-[var(--text)] text-sm">Exportar para IA</div>
              <div className="text-xs text-[var(--subtle)]">Copiá y pegá en ChatGPT, Gemini o Claude</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface3 hover:bg-surface3 text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Reporte listo para pegar en{' '}
            <a href="https://chat.openai.com" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">ChatGPT</a>,{' '}
            <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">Gemini</a> o{' '}
            <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-accent-light hover:underline">Claude</a>.
            Las categorías generales (auto, servicios, etc.) incluyen el desglose por concepto.
          </p>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] flex gap-2 flex-shrink-0">
          <button onClick={handleCopy}
            className={`flex-1 py-2.5 rounded-xl text-sm font-display font-semibold border transition-all flex items-center justify-center gap-2 ${
              copied
                ? 'bg-income/20 border-income/40 text-income'
                : 'bg-accent/20 border-accent/40 text-accent-light hover:bg-accent/30'
            }`}>
            {copied ? '✓ ¡Copiado!' : '📋 Copiar al portapapeles'}
          </button>
          <button onClick={handleDownload} className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2">
            💾 Descargar .txt
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-xs text-[var(--subtle)] mb-2 font-display font-semibold uppercase tracking-widest">Vista previa</div>
          <pre className="text-xs text-[var(--text2)] font-mono leading-relaxed whitespace-pre-wrap bg-surface3 rounded-xl p-4 border border-[var(--border)]">
            {report}
          </pre>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import jsPDF from 'jspdf';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// ── Helpers de formato para el PDF (independientes de utils/format.js: acá
// necesitamos strings simples para dibujar texto con doc.text(), no Intl) ──
const fmtARS = v => '$' + Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = v => 'U$D ' + Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => { const dt = new Date(d); return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`; };
const fmtPct = v => v == null ? 'n/d' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`;

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`; };

// ── Paleta del informe (RGB arrays para jsPDF) ───────────────────────────────
const GREEN     = [26, 74, 53];
const GREEN_MID = [45, 106, 79];
const CREAM     = [245, 240, 232];
const CREAM2    = [237, 229, 212];
const AMBER     = [212, 168, 48];
const L_GREEN   = [116, 199, 160];
const BORDER    = [196, 168, 130];
const TEXT_DARK = [44, 31, 14];
const MUTED     = [139, 115, 85];
const EXPENSE   = [185, 58, 16];
const INCOME    = [26, 92, 58];

const W = 210, H = 297, MARGIN = 14;

// ── Header, repetido en cada página ──────────────────────────────────────────
function drawHeader(doc, y, userName, range, generated) {
  doc.setFillColor(...GREEN);
  doc.rect(0, y, W, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14); doc.setTextColor(...CREAM);
  doc.text('Informe financiero', MARGIN, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9); doc.setTextColor(...L_GREEN);
  doc.text(userName, MARGIN, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9); doc.setTextColor(...AMBER);
  doc.text(range, W - MARGIN, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8); doc.setTextColor(...CREAM);
  doc.text(`Generado ${generated}`, W - MARGIN, y + 14, { align: 'right' });
  doc.setFillColor(...AMBER);
  doc.rect(0, y + 24, W / 2, 2, 'F');
  doc.setFillColor(...L_GREEN);
  doc.rect(W / 2, y + 24, W / 2, 2, 'F');
  return y + 26;
}

// ── Footer, dibujado al final sobre todas las páginas ya generadas ─────────
function drawFooter(doc, range) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...CREAM2);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`FinancialTracker · Informe Financiero · ${range}`, MARGIN, H - 4);
    doc.text(`${i} / ${pageCount}`, W - MARGIN, H - 4, { align: 'right' });
  }
}

// ── Orquestador: construye el documento completo y lo devuelve sin guardar ──
function buildPdf({ kpis, totalUSD, catBreak, monthly, topExp, accounts, exchanges, investments, dateFrom, dateTo, userName }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const range = `${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`;
  const generated = fmtDate(new Date());

  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  drawFooter(doc, range);
  return doc;
}

const applyPreset = (idx, setPreset, setDateFrom, setDateTo) => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  setPreset(idx);
  switch (idx) {
    case 0: // Este mes
      setDateFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      setDateTo(todayStr()); break;
    case 1: { // Mes anterior
      const prev = new Date(y, m, 0);
      setDateFrom(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`);
      setDateTo(new Date(y, m, 0).toISOString().slice(0, 10)); break;
    }
    case 2: // Últimos 3 meses
      setDateFrom(new Date(y, m - 2, 1).toISOString().slice(0, 10));
      setDateTo(todayStr()); break;
    case 3: // Este año
      setDateFrom(`${y}-01-01`);
      setDateTo(todayStr()); break;
  }
};

const PRESET_LABELS = ['Este mes', 'Mes anterior', 'Últ. 3m', 'Este año', 'Personalizado'];

export default function ReportPage() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo]     = useState(todayStr());
  const [preset, setPreset]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [generated, setGenerated] = useState(false);
  const [pdfDoc, setPdfDoc]     = useState(null);

  const generatePdf = async () => {
    setLoading(true); setError(''); setGenerated(false);
    try {
      const [analysisRes, investRes] = await Promise.all([
        api.get('/analysis', { params: { dateFrom, dateTo } }),
        api.get('/investments').catch(() => ({ data: [] })),
      ]);

      const analysis = analysisRes.data;
      const mine   = analysis.mine;
      const shared = analysis.shared || {};
      const kpis   = mine.kpis || {};
      const totalUSD = (kpis.balanceUSD || 0) + (shared.totalBalanceUSD || 0);

      const catBreak  = mine.categoryBreakdown || [];
      const monthly   = mine.monthlySeries || [];
      const topExp    = mine.topExpenses || [];
      const accounts  = mine.accounts || [];
      const exchanges = mine.usdExchanges || [];
      const investments = investRes.data || [];

      const doc = buildPdf({
        kpis, totalUSD, catBreak, monthly, topExp, accounts, exchanges, investments,
        dateFrom, dateTo, userName: user?.name || '',
      });

      setPdfDoc(doc);
      setGenerated(true);
    } catch (e) {
      setError('Error al generar el informe: ' + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfDoc) return;
    pdfDoc.save(`informe_financiero_${todayStr()}.pdf`);
  };

  const handleShare = async () => {
    if (!pdfDoc) return;
    const blob = pdfDoc.output('blob');
    const file = new File([blob], `informe_financiero_${todayStr()}.pdf`, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Informe Financiero' }); }
      catch { /* usuario canceló el share sheet — no es un error */ }
    } else {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ padding: '24px' }} className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--text)]">Generar Informe PDF</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Reporte financiero completo del período seleccionado</p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Período</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {PRESET_LABELS.map((label, idx) => (
              <button key={idx} type="button"
                onClick={() => applyPreset(idx, setPreset, setDateFrom, setDateTo)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-all ${
                  preset === idx ? 'bg-accent text-[var(--text)] border-accent' : 'bg-surface3 border-[var(--border2)] text-[var(--muted)] hover:text-[var(--text)]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {preset === 4 && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Desde</label>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label">Hasta</label>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="bg-surface3 rounded-xl p-4 text-sm text-[var(--muted)] space-y-1.5">
          <div className="font-display font-semibold text-[var(--text2)] mb-1">El informe incluye:</div>
          <div>📊 Resumen de ingresos, gastos y balance (ARS y USD)</div>
          <div>🥧 Gastos por categoría</div>
          <div>📈 Evolución mensual de ingresos vs. gastos</div>
          <div>🧾 Top 10 mayores gastos del período</div>
          <div>🏦 Estado de todas tus cuentas</div>
          <div>💵 Compras de dólares en el período</div>
          <div>📈 Posiciones de inversión y ganancia</div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {!generated ? (
          <button onClick={generatePdf} disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Generando...' : '📄 Generar PDF'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm font-semibold">
              ✅ Informe generado correctamente
            </div>
            <div className="flex gap-3">
              <button onClick={handleDownload} className="btn-primary flex-1 py-2.5">⬇️ Descargar</button>
              <button onClick={handleShare} className="btn-secondary flex-1 py-2.5">🔗 Compartir</button>
            </div>
            <button onClick={() => setGenerated(false)} className="text-xs text-[var(--subtle)] hover:text-[var(--text2)] w-full text-center py-1">
              ↻ Regenerar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

# Informe PDF + Página de Inversiones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar dos páginas nuevas al frontend: (A) `/reports` — genera un informe financiero en PDF (jsPDF + jspdf-autotable) con KPIs, gráfico de torta y de línea (dibujados a mano, sin recharts), tablas y resumen patrimonial; (B) `/investments` — CRUD de posiciones de inversión sobre el endpoint `/api/investments` ya existente.

**Architecture:** Dos páginas nuevas y autocontenidas en `frontend/src/pages/`, siguiendo el patrón ya establecido (fetch con `api`, `useState`/`useEffect`, reuso de `Modal`/`TransactionModal`-style forms). El informe PDF vive enteramente en `ReportPage.jsx` (helpers de dibujo a nivel de módulo + función `buildPdf`) — es una función separada de `frontend/src/utils/pdfExport.js`, que ya existe pero genera un informe distinto (tema oscuro, export del Dashboard) y no se toca. Todos los endpoints backend consumidos (`GET /api/analysis`, `GET/POST/PUT/DELETE /api/investments`, `GET /api/accounts`) ya existen y fueron verificados contra el código real antes de escribir este plan.

**Tech Stack:** React 18 + Vite + React Router DOM v6, Tailwind + CSS variables, axios (`services/api.js`), jsPDF 2.5.1 + jspdf-autotable 3.8.2 (ya instalados). Sin dependencias nuevas.

**Testing note:** Sin framework de tests automatizados en este proyecto (confirmado, convención ya establecida en planes anteriores). Cada tarea se verifica con `npm run build` durante la construcción; la verificación real (generar un PDF, confirmar que se ve bien, hacer CRUD de una inversión) ocurre en el navegador en la última tarea, una vez que ambas páginas están ruteadas.

---

## Task 1: `ReportPage.jsx` — esqueleto completo (estado, UI, PDF mínimo)

**Files:**
- Create: `frontend/src/pages/ReportPage.jsx`

- [ ] **Step 1: Crear el archivo con helpers, estado, presets, acciones y UI completa, más una `buildPdf` mínima (header + footer, sin gráficos ni tablas todavía)**

```jsx
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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso. (La página no está ruteada todavía, así que solo confirma sintaxis — se conecta en la Task 7.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReportPage.jsx
git commit -m "feat: esqueleto de ReportPage con estado, presets de fecha y PDF minimo"
```

---

## Task 2: `buildPdf` — KPI grid, gráfico de torta y de línea (página 1, parte 1)

**Files:**
- Modify: `frontend/src/pages/ReportPage.jsx`

- [ ] **Step 1: Agregar `drawKpiGrid`, `drawPieChart` (canvas → imagen) y `drawLineChart` como funciones a nivel de módulo, antes de `buildPdf`**

Insertar, justo antes de la función `buildPdf`:

```jsx
// ── Grilla de 6 tarjetas KPI (2 filas de 3) ─────────────────────────────────
function drawKpiGrid(doc, y, kpis, totalUSD) {
  const cardW = (W - 2 * MARGIN - 8) / 3;
  const cardH = 20;
  const drawCard = (x, cy, label, value, sub, color) => {
    doc.setFillColor(...CREAM2); doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(label, x + 3, cy + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color);
    doc.text(value, x + 3, cy + 11);
    if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(sub, x + 3, cy + 17); }
  };

  const net = kpis.net || 0;
  const savePct = (kpis.income || 0) > 0 ? (((net / (kpis.income || 1)) * 100).toFixed(1) + '%') : '0.0%';
  drawCard(MARGIN, y, 'INGRESOS ARS', fmtARS(kpis.income), fmtPct(kpis.variation?.income), INCOME);
  drawCard(MARGIN + cardW + 4, y, 'GASTOS ARS', fmtARS(kpis.expense), fmtPct(kpis.variation?.expense), EXPENSE);
  drawCard(MARGIN + 2 * (cardW + 4), y, 'AHORRO NETO', fmtARS(net), 'Tasa: ' + savePct, net >= 0 ? INCOME : EXPENSE);

  drawCard(MARGIN, y + cardH + 3, 'INGRESOS USD', fmtUSD(kpis.incomeUSD), 'en el periodo', INCOME);
  drawCard(MARGIN + cardW + 4, y + cardH + 3, 'GASTOS USD', fmtUSD(kpis.expenseUSD), 'en el periodo', EXPENSE);
  drawCard(MARGIN + 2 * (cardW + 4), y + cardH + 3, 'USD DISPONIBLES', fmtUSD(totalUSD), 'saldo actual', [180, 130, 0]);

  return y + 2 * cardH + 3;
}

// ── Torta de categorías (top 5), dibujada en un canvas oculto y embebida como PNG ──
const PIE_HEX_COLORS = ['#2D6A4F', '#D4A830', '#74C7A0', '#9B7346', '#D4C4A8'];
function drawPieChart(doc, cx, cy, catBreak) {
  const top5 = (catBreak || []).slice(0, 5);
  if (top5.length === 0) return [];
  const total = top5.reduce((s, c) => s + (c.amount || 0), 0);

  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  let startAngle = -Math.PI / 2;
  top5.forEach((cat, i) => {
    const sweep = total > 0 ? (2 * Math.PI * (cat.amount / total)) : (2 * Math.PI / top5.length);
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.arc(100, 100, 90, startAngle, startAngle + sweep);
    ctx.closePath();
    ctx.fillStyle = PIE_HEX_COLORS[i % PIE_HEX_COLORS.length];
    ctx.fill();
    startAngle += sweep;
  });
  // Hole (donut)
  ctx.beginPath();
  ctx.arc(100, 100, 38, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#F5F0E8';
  ctx.fill();

  const pieImg = canvas.toDataURL('image/png');
  doc.addImage(pieImg, 'PNG', cx - 30, cy - 30, 60, 60);

  // Devuelve los datos que necesita la leyenda (dibujada por separado, debajo)
  return top5.map((cat, i) => ({
    name: cat.name,
    percentage: total > 0 ? parseFloat(((cat.amount / total) * 100).toFixed(1)) : 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
}
const PIE_COLORS = [[45, 106, 79], [212, 168, 48], [116, 199, 160], [155, 115, 70], [212, 196, 168]];

// ── Leyenda del gráfico de torta, debajo del chart ──────────────────────────
function drawPieLegend(doc, x, y, legendItems) {
  legendItems.forEach((item, i) => {
    const iy = y + i * 5;
    doc.setFillColor(...item.color);
    doc.rect(x, iy, 3, 3, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...TEXT_DARK);
    doc.text(`${item.name} ${fmtPct(item.percentage)}`, x + 5, iy + 2.5);
  });
  return y + legendItems.length * 5 + 3;
}

// ── Línea de ingresos vs. gastos (últimos meses disponibles) ────────────────
function drawLineChart(doc, x, y, w, h, monthly) {
  const n = (monthly || []).length;
  if (n < 2) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('Datos insuficientes para graficar la evolución.', x, y + h / 2);
    return;
  }
  const maxVal = Math.max(...monthly.map(m => Math.max(m.income || 0, m.expense || 0)), 1);

  doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (i / 4) * h;
    doc.line(x, gy, x + w, gy);
  }

  doc.setDrawColor(...EXPENSE); doc.setLineWidth(0.7);
  for (let i = 1; i < n; i++) {
    const x1 = x + (i - 1) * (w / (n - 1)), y1 = y + h - ((monthly[i - 1].expense || 0) / maxVal) * h;
    const x2 = x + i * (w / (n - 1)), y2 = y + h - ((monthly[i].expense || 0) / maxVal) * h;
    doc.line(x1, y1, x2, y2);
  }

  doc.setDrawColor(...INCOME); doc.setLineWidth(0.7);
  for (let i = 1; i < n; i++) {
    const x1 = x + (i - 1) * (w / (n - 1)), y1 = y + h - ((monthly[i - 1].income || 0) / maxVal) * h;
    const x2 = x + i * (w / (n - 1)), y2 = y + h - ((monthly[i].income || 0) / maxVal) * h;
    doc.line(x1, y1, x2, y2);
  }

  // Leyenda
  doc.setFillColor(...INCOME); doc.rect(x, y + h + 4, 3, 3, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...TEXT_DARK);
  doc.text('Ingresos', x + 5, y + h + 6.5);
  doc.setFillColor(...EXPENSE); doc.rect(x + 28, y + h + 4, 3, 3, 'F');
  doc.text('Gastos', x + 33, y + h + 6.5);

  // Labels de meses (solo 4, repartidos)
  const step = Math.max(1, Math.floor((n - 1) / 3));
  doc.setFontSize(6); doc.setTextColor(...MUTED);
  for (let i = 0; i < n; i += step) {
    const lx = x + i * (w / (n - 1));
    doc.text(monthly[i].month.slice(2), lx, y + h + 10, { align: 'center' });
  }
}

// ── Sección "GASTOS POR CATEGORIA · EVOLUCION MENSUAL": torta + línea lado a lado ──
function drawCategoryAndTrendSection(doc, y, catBreak, monthly) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN_MID);
  doc.text('GASTOS POR CATEGORIA · EVOLUCION MENSUAL', MARGIN, y);
  y += 6;

  const pieCx = MARGIN + 32, pieCy = y + 26;
  const legendItems = drawPieChart(doc, pieCx, pieCy, catBreak);
  const legendBottomY = drawPieLegend(doc, MARGIN + 4, pieCy + 34, legendItems);

  const lineX = MARGIN + 74, lineW = W - 2 * MARGIN - 74, lineH = 48;
  drawLineChart(doc, lineX, y, lineW, lineH, monthly);

  return Math.max(legendBottomY, y + lineH + 12) + 4;
}
```

- [ ] **Step 2: Conectar la sección en `buildPdf`**

Reemplazar:
```jsx
  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  drawFooter(doc, range);
  return doc;
```
con:
```jsx
  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN_MID);
  doc.text('RESUMEN DEL PERIODO', MARGIN, y);
  y += 6;
  y = drawKpiGrid(doc, y, kpis, totalUSD);
  y += 6;

  y = drawCategoryAndTrendSection(doc, y, catBreak, monthly);

  drawFooter(doc, range);
  return doc;
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReportPage.jsx
git commit -m "feat: KPI grid, torta de categorias y linea de evolucion en el informe PDF"
```

---

## Task 3: `buildPdf` — tablas, página 2 y resumen patrimonial

**Files:**
- Modify: `frontend/src/pages/ReportPage.jsx`

- [ ] **Step 1: Importar `autoTable`**

Reemplazar:
```jsx
import { useState } from 'react';
import jsPDF from 'jspdf';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
```
con:
```jsx
import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
```

- [ ] **Step 2: Agregar las funciones de tabla y el resumen patrimonial, antes de `buildPdf`**

Insertar, justo antes de la función `buildPdf`:

```jsx
const TABLE_HEAD_STYLE = { fillColor: CREAM2, textColor: MUTED, fontStyle: 'bold', fontSize: 8 };
const TABLE_BODY_STYLE = { fontSize: 8, textColor: TEXT_DARK };
const TABLE_ALT_STYLE  = { fillColor: CREAM };

// ── Si y + alturaNecesaria no entra en la página actual, agrega una nueva y dibuja el header ──
function ensureSpace(doc, y, neededHeight, userName, range, generated) {
  if (y + neededHeight > H - 20) {
    doc.addPage();
    let ny = drawHeader(doc, 0, userName, range, generated);
    return ny + 4;
  }
  return y;
}

function drawSectionLabel(doc, y, text) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN_MID);
  doc.text(text, MARGIN, y);
  return y + 6;
}

function drawTopExpensesTable(doc, y, topExp) {
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Categoria', 'Descripcion', 'Monto']],
    body: topExp.map(t => [fmtDate(t.date), t.categoryName || '-', t.comment || '-', t.currency === 'USD' ? fmtUSD(t.amount) : fmtARS(t.amount)]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 3: { halign: 'right' } },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawAccountsTable(doc, y, accounts) {
  autoTable(doc, {
    startY: y,
    head: [['Cuenta', 'Tipo', 'Saldo ARS', 'Saldo USD']],
    body: accounts.map(a => [a.name, a.accountType, fmtARS(a.balance), fmtUSD(a.balanceUSD || 0)]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawExchangeStatsRow(doc, y, exchanges) {
  const totalUsdBought = exchanges.reduce((s, e) => s + (e.usdAmount || 0), 0);
  const totalArsSpent  = exchanges.reduce((s, e) => s + (e.arsAmount || 0), 0);
  const avgRate = totalUsdBought > 0 ? totalArsSpent / totalUsdBought : 0;

  const cardW = (W - 2 * MARGIN - 8) / 3;
  const cardH = 16;
  const drawCard = (x, label, value) => {
    doc.setFillColor(...CREAM2); doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(label, x + 3, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXT_DARK);
    doc.text(value, x + 3, y + 11);
  };
  drawCard(MARGIN, 'USD COMPRADOS', fmtUSD(totalUsdBought));
  drawCard(MARGIN + cardW + 4, 'ARS GASTADOS', fmtARS(totalArsSpent));
  drawCard(MARGIN + 2 * (cardW + 4), 'PRECIO PROMEDIO', `$${avgRate.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
  return y + cardH + 6;
}

function drawExchangesTable(doc, y, exchanges) {
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Cuenta', 'USD Comprados', 'ARS Gastados', 'Cotizacion']],
    body: exchanges.map(e => [fmtDate(e.date), e.accountName || '-', fmtUSD(e.usdAmount), fmtARS(e.arsAmount), `$${Number(e.rate).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { left: MARGIN, right: MARGIN },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawInvestmentsTable(doc, y, investments) {
  autoTable(doc, {
    startY: y,
    head: [['Posicion', 'Cuenta', 'Invertido', 'Valor Actual', 'Ganancia']],
    body: investments.map(inv => {
      const isUSD = inv.currency === 'USD';
      const fmt = isUSD ? fmtUSD : fmtARS;
      const gain = Number(inv.gain || 0);
      const gainPct = Number(inv.gainPct || 0);
      return [inv.name, inv.accountName || '-', fmt(inv.investedAmount), fmt(inv.currentValue), `${fmt(gain)} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`];
    }),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const val = Number(investments[data.row.index]?.gain || 0);
        data.cell.styles.textColor = val >= 0 ? INCOME : EXPENSE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawPatrimonialSummary(doc, y, accounts, totalUSD, investments) {
  const totalInvested = investments.reduce((s, i) => s + Number(i.investedAmount || 0), 0);
  const totalCurrent  = investments.reduce((s, i) => s + Number(i.currentValue || 0), 0);
  const totalGain     = totalCurrent - totalInvested;
  const totalARS      = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  doc.setFillColor(...GREEN); doc.roundedRect(MARGIN, y, W - 2 * MARGIN, 20, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AMBER);
  doc.text('RESUMEN PATRIMONIAL', MARGIN + 4, y + 6);

  const cols = [
    ['Total Cuentas ARS', fmtARS(totalARS)],
    ['USD Disponibles', fmtUSD(totalUSD)],
    ...(investments.length > 0 ? [['Ganancia Inversiones', `${totalGain >= 0 ? '+' : ''}${fmtARS(totalGain)}`]] : []),
  ];
  const colW = (W - 2 * MARGIN) / cols.length;
  cols.forEach(([label, val], i) => {
    const cx = MARGIN + i * colW + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CREAM);
    doc.text(label, cx, y + 12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(...(i === 2 ? (totalGain >= 0 ? L_GREEN : EXPENSE) : CREAM));
    doc.text(val, cx, y + 18);
  });
  return y + 24;
}
```

- [ ] **Step 3: Completar `buildPdf` con las tablas, la página 2 y el resumen patrimonial**

Reemplazar:
```jsx
  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GREEN_MID);
  doc.text('RESUMEN DEL PERIODO', MARGIN, y);
  y += 6;
  y = drawKpiGrid(doc, y, kpis, totalUSD);
  y += 6;

  y = drawCategoryAndTrendSection(doc, y, catBreak, monthly);

  drawFooter(doc, range);
  return doc;
```
con:
```jsx
  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  y = drawSectionLabel(doc, y, 'RESUMEN DEL PERIODO');
  y = drawKpiGrid(doc, y, kpis, totalUSD);
  y += 6;

  y = drawCategoryAndTrendSection(doc, y, catBreak, monthly);

  if (topExp.length > 0) {
    y = ensureSpace(doc, y, 30, userName, range, generated);
    y = drawSectionLabel(doc, y, 'TOP 10 MAYORES GASTOS');
    y = drawTopExpensesTable(doc, y, topExp);
  }

  // ── Página 2 ──
  doc.addPage();
  y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  y = drawSectionLabel(doc, y, 'ESTADO DE CUENTAS');
  y = drawAccountsTable(doc, y, accounts);

  y = drawSectionLabel(doc, y, 'DOLARES EN EL PERIODO');
  if (exchanges.length > 0) {
    y = drawExchangeStatsRow(doc, y, exchanges);
    y = drawExchangesTable(doc, y, exchanges);
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Sin operaciones en dolares en el periodo seleccionado.', MARGIN, y);
    y += 8;
  }

  y = drawSectionLabel(doc, y, 'POSICIONES DE INVERSION');
  if (investments.length > 0) {
    y = drawInvestmentsTable(doc, y, investments);
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Sin posiciones de inversion registradas.', MARGIN, y);
    y += 8;
  }

  y = ensureSpace(doc, y, 26, userName, range, generated);
  drawPatrimonialSummary(doc, y, accounts, totalUSD, investments);

  drawFooter(doc, range);
  return doc;
```

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReportPage.jsx
git commit -m "feat: tablas, pagina 2 y resumen patrimonial en el informe PDF"
```

---

## Task 4: `InvestmentsPage.jsx` — listado y tarjeta resumen

**Files:**
- Create: `frontend/src/pages/InvestmentsPage.jsx`

- [ ] **Step 1: Crear el archivo con fetch, métricas de cartera y la UI de listado (sin el modal todavía)**

```jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvestmentsPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [accounts, setAccounts]   = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/investments'),
      api.get('/accounts'),
    ]).then(([invRes, accRes]) => {
      setPositions(invRes.data || []);
      setAccounts((accRes.data || []).filter(a => a.accountType === 'INVESTMENT'));
      setLoading(false);
    }).catch(() => { setError('Error al cargar las posiciones'); setLoading(false); });
  }, []);

  const totalInvested = positions.reduce((s, p) => s + Number(p.investedAmount || 0), 0);
  const totalCurrent  = positions.reduce((s, p) => s + Number(p.currentValue || 0), 0);
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? ((totalGain / totalInvested) * 100) : 0;

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta posición?')) return;
    try {
      await api.delete(`/investments/${id}`);
      setPositions(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--subtle)]">Cargando...</div>;

  return (
    <div style={{ padding: '24px' }} className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text)]">Inversiones</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Seguimiento de tus posiciones</p>
        </div>
        <button className="btn-primary text-sm py-2 px-4">+ Nueva posición</button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--accent)', color: '#fff' }}>
        <div className="text-xs uppercase tracking-wide opacity-80 mb-1">Cartera Total</div>
        <div className="text-3xl font-display font-bold">{formatCurrency(totalCurrent)}</div>
        <div className="text-sm opacity-90 mt-1.5">
          Invertido: {formatCurrency(totalInvested)} · Ganancia:{' '}
          <span className="font-semibold">{totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} ({totalGain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)</span>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {positions.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📈</div>
          <div className="text-[var(--text)] font-display font-bold mb-1">Sin posiciones</div>
          <div className="text-[var(--muted)] text-sm mb-4">Todavía no registraste ninguna inversión</div>
          <button className="btn-primary text-sm">Nueva posición</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)]">
                {['Nombre', 'Cuenta', 'Invertido', 'Valor Actual', 'Ganancia', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-3 text-xs font-display font-semibold text-[var(--subtle)] uppercase ${i >= 2 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {positions.map(p => {
                  const gain = Number(p.gain || 0);
                  const isUSD = p.currency === 'USD';
                  return (
                    <tr key={p.id} className="hover:bg-surface3/50">
                      <td className="px-3 py-3 text-[var(--text2)]">{p.name}</td>
                      <td className="px-3 py-3 text-[var(--muted)] text-xs">{p.accountName || '—'}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.investedAmount, p.currency)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatCurrency(p.currentValue, p.currency)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-semibold ${gain >= 0 ? 'text-income' : 'text-expense'}`}>
                        {gain >= 0 ? '+' : ''}{formatCurrency(gain, p.currency)} ({gain >= 0 ? '+' : ''}{Number(p.gainPct || 0).toFixed(1)}%)
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button className="text-xs text-[var(--muted)] hover:text-accent-light mr-3">Editar</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {positions.map(p => {
              const gain = Number(p.gain || 0);
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-[var(--text2)]">{p.name}</div>
                    <div className={`font-mono font-bold text-sm ${gain >= 0 ? 'text-income' : 'text-expense'}`}>
                      {gain >= 0 ? '+' : ''}{formatCurrency(gain, p.currency)}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--subtle)] mb-2">{p.accountName || 'Sin cuenta'} · {formatDate(p.date)}</div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>Invertido: {formatCurrency(p.investedAmount, p.currency)}</span>
                    <span>Actual: {formatCurrency(p.currentValue, p.currency)}</span>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button className="text-xs text-accent-light">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-400">Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso. (Los botones "Nueva posición"/"Editar" todavía no hacen nada — se conectan en la Task 5.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/InvestmentsPage.jsx
git commit -m "feat: listado de inversiones con tarjeta resumen de cartera"
```

---

## Task 5: `InvestmentsPage.jsx` — modal de crear/editar/eliminar posición

**Files:**
- Modify: `frontend/src/pages/InvestmentsPage.jsx`

- [ ] **Step 1: Importar `Modal` y agregar el estado del modal**

Reemplazar:
```jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvestmentsPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [accounts, setAccounts]   = useState([]);
```
con:
```jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function PositionModal({ open, onClose, onSaved, editing, accounts }) {
  const getDF = () => editing
    ? { name: editing.name, currency: editing.currency, investedAmount: String(editing.investedAmount), currentValue: String(editing.currentValue), date: editing.date?.slice(0, 10) || localToday(), notes: editing.notes || '', accountName: editing.accountName || '' }
    : { name: '', currency: 'ARS', investedAmount: '', currentValue: '', date: localToday(), notes: '', accountName: '' };
  const [form, setForm]       = useState(getDF);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  useEffect(() => { if (open) { setForm(getDF()); setError(''); } }, [open, editing]); // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name.trim()) return setError('Ingresá un nombre para el activo');
    const invested = parseFloat(form.investedAmount), current = parseFloat(form.currentValue);
    if (!invested || invested <= 0) return setError('Monto invertido debe ser mayor a 0');
    if (current == null || isNaN(current) || current < 0) return setError('Valor actual inválido');
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(), currency: form.currency,
        investedAmount: invested, currentValue: current,
        date: form.date, notes: form.notes || undefined, accountName: form.accountName || undefined,
      };
      if (editing) await api.put(`/investments/${editing.id}`, payload);
      else await api.post('/investments', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setLoading(false); }
  };

  const handleDeleteInModal = async () => {
    if (!editing) return;
    if (!window.confirm('¿Eliminar esta posición?')) return;
    setLoading(true);
    try {
      await api.delete(`/investments/${editing.id}`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Posición' : 'Nueva Posición'}>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-2.5 text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre del activo</label>
          <input type="text" className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Moneda</label>
            <select className="input" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
              <option value="ARS">$ ARS</option>
              <option value="USD">U$D USD</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="label">Invertido</label>
            <input type="number" step="0.01" min="0.01" className="input" value={form.investedAmount} onChange={e => setForm(p => ({ ...p, investedAmount: e.target.value }))} required />
          </div>
          <div className="col-span-1">
            <label className="label">Valor actual</label>
            <input type="number" step="0.01" min="0" className="input" value={form.currentValue} onChange={e => setForm(p => ({ ...p, currentValue: e.target.value }))} required />
          </div>
        </div>
        <div>
          <label className="label">Fecha de compra</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Cuenta de inversión (opcional)</label>
          <select className="input" value={form.accountName} onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))}>
            <option value="">Sin cuenta asociada</option>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notas (opcional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
        {editing && (
          <button type="button" onClick={handleDeleteInModal} disabled={loading} className="btn-danger w-full py-2 text-sm">
            🗑️ Eliminar posición
          </button>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function InvestmentsPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [accounts, setAccounts]   = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
```

- [ ] **Step 2: Agregar el fetch de refresco tras guardar y conectar los botones**

Reemplazar:
```jsx
  useEffect(() => {
    Promise.all([
      api.get('/investments'),
      api.get('/accounts'),
    ]).then(([invRes, accRes]) => {
      setPositions(invRes.data || []);
      setAccounts((accRes.data || []).filter(a => a.accountType === 'INVESTMENT'));
      setLoading(false);
    }).catch(() => { setError('Error al cargar las posiciones'); setLoading(false); });
  }, []);
```
con:
```jsx
  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/investments'),
      api.get('/accounts'),
    ]).then(([invRes, accRes]) => {
      setPositions(invRes.data || []);
      setAccounts((accRes.data || []).filter(a => a.accountType === 'INVESTMENT'));
      setLoading(false);
    }).catch(() => { setError('Error al cargar las posiciones'); setLoading(false); });
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line
```

Reemplazar:
```jsx
        <button className="btn-primary text-sm py-2 px-4">+ Nueva posición</button>
```
con:
```jsx
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary text-sm py-2 px-4">+ Nueva posición</button>
```

Reemplazar (dentro del estado vacío):
```jsx
          <button className="btn-primary text-sm">Nueva posición</button>
```
con:
```jsx
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary text-sm">Nueva posición</button>
```

Reemplazar (fila de tabla desktop):
```jsx
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button className="text-xs text-[var(--muted)] hover:text-accent-light mr-3">Editar</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
                      </td>
```
con:
```jsx
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button onClick={() => { setEditing(p); setModalOpen(true); }} className="text-xs text-[var(--muted)] hover:text-accent-light mr-3">Editar</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-[var(--muted)] hover:text-rose-400">Eliminar</button>
                      </td>
```

Reemplazar (card mobile):
```jsx
                  <div className="flex gap-3 mt-2">
                    <button className="text-xs text-accent-light">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-400">Eliminar</button>
                  </div>
```
con:
```jsx
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => { setEditing(p); setModalOpen(true); }} className="text-xs text-accent-light">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-400">Eliminar</button>
                  </div>
```

- [ ] **Step 3: Renderizar el modal al final del componente**

Reemplazar el cierre del componente:
```jsx
        </div>
      )}
    </div>
  );
}
```
con:
```jsx
        </div>
      )}

      <PositionModal
        open={modalOpen}
        editing={editing}
        accounts={accounts}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={() => { setModalOpen(false); setEditing(null); fetchAll(); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/InvestmentsPage.jsx
git commit -m "feat: modal de crear/editar/eliminar posicion de inversion"
```

---

## Task 6: Integración — rutas, menú y verificación completa en el navegador

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Layout.jsx`

- [ ] **Step 1: Agregar las rutas en `App.jsx`**

Agregar los imports de las dos páginas nuevas junto a los imports de página existentes (p. ej. cerca de `import AnalysisPage from './pages/AnalysisPage';`):
```jsx
import InvestmentsPage from './pages/InvestmentsPage';
import ReportPage      from './pages/ReportPage';
```

Agregar las dos rutas dentro del bloque de rutas privadas (`<Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>`), junto a las demás rutas anidadas (p. ej. cerca de `<Route path="analysis" element={<AnalysisPage />} />`):
```jsx
            <Route path="investments" element={<InvestmentsPage />} />
            <Route path="reports"     element={<ReportPage />} />
```

- [ ] **Step 2: Agregar las entradas de menú en `Layout.jsx`**

En el array `NAV_ITEMS`, agregar dos entradas nuevas (posición sugerida: después de `/analysis`, antes de `/categories` — mismo criterio ya usado para features anteriores):
```jsx
  { to: '/investments', icon: '◈', label: 'Inversiones' },
  { to: '/reports',     icon: '↓', label: 'Informe PDF' },
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npm run build` — esperado: build exitoso.

- [ ] **Step 4: Verificar en el navegador**

Levantar backend (`cd backend && npm run dev`) y frontend (`cd frontend && npm run dev`), loguearse:

1. **Inversiones**: ir a `/investments` desde el menú. Si no hay posiciones, crear una ("Nueva posición": nombre, moneda, invertido, valor actual, fecha — guardar). Confirmar que aparece en la lista con la ganancia calculada y coloreada (verde si positiva). Editar esa posición (cambiar el valor actual) y confirmar que la tarjeta resumen de cartera y la fila se actualizan. Eliminarla y confirmar que desaparece de la lista y del resumen.
2. **Informe PDF**: ir a `/reports`. Confirmar que el preset "Este mes" está seleccionado por defecto. Click en "Generar PDF" — debe mostrar "Generando..." y luego el panel verde de éxito con los botones Descargar/Compartir/Regenerar. Click en "Descargar" y abrir el PDF resultante: confirmar que tiene 2 páginas, que la página 1 muestra el header verde, la grilla de 6 KPIs, el gráfico de torta con leyenda, el gráfico de línea de ingresos/gastos, y la tabla de top gastos (si hay transacciones en el período); que la página 2 muestra la tabla de cuentas, la sección de dólares (o el mensaje de "sin operaciones" si no hay ninguna), la tabla de inversiones (con la posición creada en el paso 1) y el resumen patrimonial en la caja verde al final. Confirmar que el pie de página aparece en ambas páginas con el número de página correcto.
3. Probar con período "Personalizado" y fechas sin transacciones — confirmar que no rompe (el line chart debe mostrar el mensaje de "datos insuficientes" si aplica, las tablas vacías no deben crashear).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/layout/Layout.jsx
git commit -m "feat: rutas y entradas de menu para Inversiones e Informe PDF"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Helpers de formato, presets de fecha, `generatePdf`/`handleDownload`/`handleShare`, UI completa → Task 1. KPI grid, torta (canvas→imagen), línea, leyenda → Task 2. Tablas (top gastos, cuentas, exchanges, inversiones), salto de página, resumen patrimonial, footer multi-página → Task 3. Listado + resumen de cartera → Task 4. Modal crear/editar/eliminar → Task 5. Rutas + menú + verificación end-to-end → Task 6. Todos los "gotchas" de la consigna original están reflejados: canvas para el donut (Task 2), `doc.lastAutoTable.finalY` para encadenar tablas (Task 3, vía `TABLE_*` helpers que retornan `finalY + 6`), salto de página manual (`ensureSpace`, Task 3), footer dibujado una sola vez al final iterando `getNumberOfPages()` (Task 1, `drawFooter`), `totalUSD = kpis.balanceUSD + shared.totalBalanceUSD` (Task 1, `generatePdf` — verificado contra el `analysis.controller.js` real), `.catch(() => ({ data: [] }))` en el fetch de inversiones (Task 1), fallback de `navigator.share` (Task 1), `Number()`/`parseFloat()` en todos los montos que vienen de la API (Task 1, 3, 4, 5).
- **Correcciones aplicadas sobre la consigna original** (verificadas contra el código real antes de escribir este plan): el shape de `GET /api/analysis` es `{ mine, shared }` (no `{ mine, partner, shared }` salvo que se pase `source=partner|both`, que este plan no usa) — coincide con la consigna. `accountType` es `REGULAR | INVESTMENT | CREDIT` (la consigna mencionaba también `SAVINGS`/`CHECKING`, que no existen en el schema real) — el filtro `accountType === 'INVESTMENT'` que pide la consigna ya es el correcto, así que no cambia ningún comportamiento. `ctx.arc(100,100,38,'0',2*Math.PI)` de la consigna original tenía un bug (ángulo inicial como string `'0'` en vez de número `0`) — corregido en la Task 2.
- **Type/prop consistency:** `PositionModal`'s props (`open, onClose, onSaved, editing, accounts`) se definen una sola vez (Task 5) y se usan de forma idéntica en su único call site. `buildPdf`'s parámetros y todas las funciones de dibujo (`drawHeader`, `drawFooter`, `drawKpiGrid`, `drawPieChart`, `drawPieLegend`, `drawLineChart`, `drawCategoryAndTrendSection`, `drawSectionLabel`, `drawTopExpensesTable`, `drawAccountsTable`, `drawExchangeStatsRow`, `drawExchangesTable`, `drawInvestmentsTable`, `drawPatrimonialSummary`, `ensureSpace`) se definen una vez cada una, a nivel de módulo en `ReportPage.jsx`, y se usan con los mismos nombres/firmas en `buildPdf`.
- **No se toca** `frontend/src/utils/pdfExport.js` (export existente del Dashboard, tema oscuro, contenido distinto) ni ningún endpoint backend — todos ya existen y fueron verificados contra el código real (`backend/src/controllers/analysis.controller.js`, `backend/src/controllers/investment.controller.js`, `backend/src/routes/investment.js`) antes de escribir este plan.

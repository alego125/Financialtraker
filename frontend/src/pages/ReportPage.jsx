import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
const AMBER_DARK = [180, 130, 0];

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
  drawCard(MARGIN + 2 * (cardW + 4), y + cardH + 3, 'USD DISPONIBLES', fmtUSD(totalUSD), 'saldo actual', AMBER_DARK);

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
const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const PIE_COLORS = PIE_HEX_COLORS.map(hexToRgb);

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

function drawTopExpensesTable(doc, y, topExp, userName, range, generated) {
  const startPageCount = doc.internal.getNumberOfPages();
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Categoria', 'Descripcion', 'Monto']],
    body: topExp.map(t => [fmtDate(t.date), t.categoryName || '-', t.comment || '-', t.currency === 'USD' ? fmtUSD(t.amount) : fmtARS(t.amount)]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { top: 30, left: MARGIN, right: MARGIN },
    columnStyles: { 3: { halign: 'right' } },
    didDrawPage: () => {
      if (doc.internal.getNumberOfPages() > startPageCount) drawHeader(doc, 0, userName, range, generated);
    },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawAccountsTable(doc, y, accounts, userName, range, generated) {
  const startPageCount = doc.internal.getNumberOfPages();
  autoTable(doc, {
    startY: y,
    head: [['Cuenta', 'Tipo', 'Saldo ARS', 'Saldo USD']],
    body: accounts.map(a => [a.name, a.accountType, fmtARS(a.balance), fmtUSD(a.balanceUSD || 0)]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { top: 30, left: MARGIN, right: MARGIN },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    didDrawPage: () => {
      if (doc.internal.getNumberOfPages() > startPageCount) drawHeader(doc, 0, userName, range, generated);
    },
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

function drawExchangesTable(doc, y, exchanges, userName, range, generated) {
  const startPageCount = doc.internal.getNumberOfPages();
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Cuenta', 'USD Comprados', 'ARS Gastados', 'Cotizacion']],
    body: exchanges.map(e => [fmtDate(e.date), e.accountName || '-', fmtUSD(e.usdAmount), fmtARS(e.arsAmount), `$${Number(e.rate).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`]),
    headStyles: TABLE_HEAD_STYLE,
    bodyStyles: TABLE_BODY_STYLE,
    alternateRowStyles: TABLE_ALT_STYLE,
    theme: 'plain',
    margin: { top: 30, left: MARGIN, right: MARGIN },
    didDrawPage: () => {
      if (doc.internal.getNumberOfPages() > startPageCount) drawHeader(doc, 0, userName, range, generated);
    },
  });
  return doc.lastAutoTable.finalY + 6;
}

function drawInvestmentsTable(doc, y, investments, userName, range, generated) {
  const startPageCount = doc.internal.getNumberOfPages();
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
    margin: { top: 30, left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const val = Number(investments[data.row.index]?.gain || 0);
        data.cell.styles.textColor = val >= 0 ? INCOME : EXPENSE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      if (doc.internal.getNumberOfPages() > startPageCount) drawHeader(doc, 0, userName, range, generated);
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

// ── Orquestador: construye el documento completo y lo devuelve sin guardar ──
function buildPdf({ kpis, totalUSD, catBreak, monthly, topExp, accounts, exchanges, investments, dateFrom, dateTo, userName }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const range = `${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`;
  const generated = fmtDate(new Date());

  let y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  y = drawSectionLabel(doc, y, 'RESUMEN DEL PERIODO');
  y = drawKpiGrid(doc, y, kpis, totalUSD);
  y += 6;

  y = drawCategoryAndTrendSection(doc, y, catBreak, monthly);

  if (topExp.length > 0) {
    y = ensureSpace(doc, y, 30, userName, range, generated);
    y = drawSectionLabel(doc, y, 'TOP 10 MAYORES GASTOS');
    y = drawTopExpensesTable(doc, y, topExp, userName, range, generated);
  }

  // ── Página 2 ──
  doc.addPage();
  y = drawHeader(doc, 0, userName, range, generated);
  y += 4;

  y = drawSectionLabel(doc, y, 'ESTADO DE CUENTAS');
  y = drawAccountsTable(doc, y, accounts, userName, range, generated);

  y = drawSectionLabel(doc, y, 'DOLARES EN EL PERIODO');
  if (exchanges.length > 0) {
    y = drawExchangeStatsRow(doc, y, exchanges);
    y = drawExchangesTable(doc, y, exchanges, userName, range, generated);
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Sin operaciones en dolares en el periodo seleccionado.', MARGIN, y);
    y += 8;
  }

  y = drawSectionLabel(doc, y, 'POSICIONES DE INVERSION');
  if (investments.length > 0) {
    y = drawInvestmentsTable(doc, y, investments, userName, range, generated);
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Sin posiciones de inversion registradas.', MARGIN, y);
    y += 8;
  }

  y = ensureSpace(doc, y, 26, userName, range, generated);
  drawPatrimonialSummary(doc, y, accounts, totalUSD, investments);

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

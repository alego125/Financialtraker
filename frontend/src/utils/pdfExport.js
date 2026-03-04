import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatMonth } from './format';

const COLORS = {
  dark: [10, 10, 15],
  card: [17, 17, 24],
  accent: [124, 58, 237],
  income: [16, 185, 129],
  expense: [244, 63, 94],
  text: [226, 232, 240],
  muted: [100, 116, 139],
  border: [46, 46, 62],
};

const setFill = (doc, color) => doc.setFillColor(...color);
const setDraw = (doc, color) => doc.setDrawColor(...color);
const setTextColor = (doc, color) => doc.setTextColor(...color);

export const generatePDF = ({ kpis, charts, transactions, filters }) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = 15;
    // Page background
    setFill(doc, COLORS.dark);
    doc.rect(0, 0, W, H, 'F');
    addPageNumber();
  };

  const addPageNumber = () => {
    const pageCount = doc.internal.getNumberOfPages();
    const current = doc.internal.getCurrentPageInfo().pageNumber;
    setTextColor(doc, COLORS.muted);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${current} / ${pageCount}`, W - 15, H - 8, { align: 'right' });
  };

  // === COVER PAGE ===
  setFill(doc, COLORS.dark);
  doc.rect(0, 0, W, H, 'F');

  // Accent bar
  setFill(doc, COLORS.accent);
  doc.rect(0, 0, 8, H, 'F');

  // Title
  setTextColor(doc, COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.text('FinTrack', 20, 50);

  setTextColor(doc, COLORS.text);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe Financiero', 20, 62);

  // Divider
  setFill(doc, COLORS.accent);
  doc.rect(20, 68, 80, 1, 'F');

  // Date info
  setTextColor(doc, COLORS.muted);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR', { dateStyle: 'full' })}`, 20, 80);

  if (filters?.dateFrom || filters?.dateTo) {
    const from = filters.dateFrom ? formatDate(filters.dateFrom) : '—';
    const to = filters.dateTo ? formatDate(filters.dateTo) : '—';
    doc.text(`Período: ${from} — ${to}`, 20, 88);
  }

  // KPI highlights on cover
  const kpiY = 110;
  const kpiW = (W - 40 - 10) / 3;

  const coverKpis = [
    { label: 'Ingresos', value: formatCurrency(kpis.totalIncome), color: COLORS.income },
    { label: 'Gastos', value: formatCurrency(kpis.totalExpense), color: COLORS.expense },
    { label: 'Balance', value: formatCurrency(kpis.balance), color: kpis.balance >= 0 ? COLORS.income : COLORS.expense },
  ];

  coverKpis.forEach((kpi, i) => {
    const x = 20 + i * (kpiW + 5);
    setFill(doc, COLORS.card);
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, kpiY, kpiW, 30, 3, 3, 'FD');

    setTextColor(doc, kpi.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(kpi.value, x + kpiW / 2, kpiY + 13, { align: 'center' });

    setTextColor(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(kpi.label, x + kpiW / 2, kpiY + 22, { align: 'center' });
  });

  addPageNumber();

  // === PAGE 2: KPIs ===
  addPage();

  setTextColor(doc, COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Indicadores Clave (KPIs)', 15, y);
  y += 10;

  const allKpis = [
    { label: 'Total Ingresos', value: formatCurrency(kpis.totalIncome), color: COLORS.income },
    { label: 'Total Gastos', value: formatCurrency(kpis.totalExpense), color: COLORS.expense },
    { label: 'Balance Neto', value: formatCurrency(kpis.balance), color: kpis.balance >= 0 ? COLORS.income : COLORS.expense },
    { label: 'Promedio Mensual (Ingresos)', value: formatCurrency(kpis.avgMonthlyIncome), color: COLORS.text },
    { label: 'Promedio Mensual (Gastos)', value: formatCurrency(kpis.avgMonthlyExpense), color: COLORS.text },
    { label: 'Tasa de Ahorro', value: `${kpis.savingsRate}%`, color: kpis.savingsRate >= 0 ? COLORS.income : COLORS.expense },
    { label: 'Mayor Categoría de Gasto', value: kpis.topExpenseCategory ? `${kpis.topExpenseCategory.name} (${formatCurrency(kpis.topExpenseCategory.amount)})` : '—', color: COLORS.text },
  ];

  const kpiBW = (W - 30 - 5) / 2;
  allKpis.forEach((k, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const kx = 15 + col * (kpiBW + 5);
    const ky = y + row * 22;

    setFill(doc, COLORS.card);
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(kx, ky, kpiBW, 18, 2, 2, 'FD');

    setTextColor(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(k.label.toUpperCase(), kx + 5, ky + 6);

    setTextColor(doc, k.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(k.value, kx + 5, ky + 13);
  });

  y += Math.ceil(allKpis.length / 2) * 22 + 15;

  // === MONTHLY TABLE ===
  if (charts.monthly?.length > 0) {
    setTextColor(doc, COLORS.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Evolución Mensual', 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Mes', 'Ingresos', 'Gastos', 'Balance']],
      body: charts.monthly.map(m => [
        formatMonth(m.month),
        formatCurrency(m.income),
        formatCurrency(m.expense),
        formatCurrency(m.income - m.expense),
      ]),
      styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.text, fillColor: COLORS.card, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.accent, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLORS.dark },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 15;
  }

  // === PAGE 3: CATEGORY TABLE ===
  if (y > H - 60) addPage();

  if (charts.pie?.length > 0) {
    setTextColor(doc, COLORS.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Gastos por Categoría', 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Categoría', 'Monto', '% del Total']],
      body: charts.pie.map(c => [c.name, formatCurrency(c.value), `${c.percentage}%`]),
      styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.text, fillColor: COLORS.card, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.accent, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLORS.dark },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 15;
  }

  // === TRANSACTIONS ===
  if (transactions?.length > 0) {
    if (y > H - 60) addPage();

    setTextColor(doc, COLORS.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Detalle de Transacciones', 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Categoría', 'Comentario', 'Método', 'Monto']],
      body: transactions.map(tx => [
        formatDate(tx.date),
        tx.type === 'INCOME' ? 'Ingreso' : 'Gasto',
        tx.category?.name || '—',
        tx.comment || '—',
        tx.paymentMethod || '—',
        formatCurrency(tx.amount),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLORS.text, fillColor: COLORS.card, lineColor: COLORS.border, lineWidth: 0.2 },
      headStyles: { fillColor: COLORS.accent, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.dark },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 30 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25 },
        5: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const isIncome = data.cell.raw === 'Ingreso';
          data.cell.styles.textColor = isIncome ? COLORS.income : COLORS.expense;
        }
        if (data.column.index === 5 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Final totals
  if (y > H - 40) addPage();

  setFill(doc, COLORS.card);
  setDraw(doc, COLORS.accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, y, W - 30, 25, 3, 3, 'FD');

  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RESUMEN FINAL', 20, y + 7);

  const summaryItems = [
    { label: 'Ingresos', value: formatCurrency(kpis.totalIncome), x: 20 },
    { label: 'Gastos', value: formatCurrency(kpis.totalExpense), x: W / 3 },
    { label: 'Balance', value: formatCurrency(kpis.balance), x: (W * 2) / 3 },
  ];

  summaryItems.forEach(item => {
    setTextColor(doc, COLORS.muted);
    doc.setFontSize(7);
    doc.text(item.label, item.x, y + 13);
    setTextColor(doc, COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(item.value, item.x, y + 21);
  });

  // Update all page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setTextColor(doc, COLORS.muted);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} / ${totalPages}`, W - 15, H - 8, { align: 'right' });
    doc.text('FinTrack — Informe Financiero', 15, H - 8);
  }

  const fileName = `fintrack-informe-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

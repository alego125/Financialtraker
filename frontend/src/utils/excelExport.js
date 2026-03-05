import * as XLSX from 'xlsx';
import { formatDate } from './format';

const PT = { EFECTIVO:'Efectivo', DEBITO:'Débito', CREDITO:'Crédito', TRANSFERENCIA:'Transferencia' };

export const generateExcel = ({ transactions, filters, kpis }) => {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Transactions ──
  const txRows = transactions.map(tx => ({
    'Fecha':           formatDate(tx.date),
    'Tipo':            tx.type === 'INCOME' ? 'Ingreso' : 'Gasto',
    'Moneda':          tx.currency || 'ARS',
    'Monto':           parseFloat(tx.amount),
    'Categoría':       tx.category?.name || '—',
    'Cuenta':          tx.account?.name || tx.sharedAccount?.name || '—',
    'Tipo de Pago':    tx.paymentType ? PT[tx.paymentType] : '—',
    'Comentario':      tx.comment || '—',
  }));

  const wsTx = XLSX.utils.json_to_sheet(txRows);

  // Column widths
  wsTx['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones');

  // ── Sheet 2: KPI Summary ──
  if (kpis) {
    const kpiRows = [
      { 'Indicador': 'Total Ingresos',        'Valor': parseFloat(kpis.totalIncome) },
      { 'Indicador': 'Total Gastos',           'Valor': parseFloat(kpis.totalExpense) },
      { 'Indicador': 'Balance Neto',           'Valor': parseFloat(kpis.balance) },
      { 'Indicador': 'Promedio Mensual (Ing)', 'Valor': parseFloat(kpis.avgMonthlyIncome) },
      { 'Indicador': 'Promedio Mensual (Gst)', 'Valor': parseFloat(kpis.avgMonthlyExpense) },
      { 'Indicador': 'Tasa de Ahorro (%)',     'Valor': parseFloat(kpis.savingsRate) },
    ];
    if (kpis.topExpenseCategory) {
      kpiRows.push({ 'Indicador': `Mayor Cat. Gasto: ${kpis.topExpenseCategory.name}`, 'Valor': parseFloat(kpis.topExpenseCategory.amount) });
    }
    const wsKpi = XLSX.utils.json_to_sheet(kpiRows);
    wsKpi['!cols'] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, 'Resumen KPIs');
  }

  // Filename with filter info
  let suffix = new Date().toISOString().slice(0, 10);
  if (filters?.month) suffix = filters.month;
  else if (filters?.year) suffix = filters.year;
  else if (filters?.dateFrom) suffix = `${filters.dateFrom}_${filters.dateTo || 'hoy'}`;

  XLSX.writeFile(wb, `financialtracker-movimientos-${suffix}.xlsx`);
};

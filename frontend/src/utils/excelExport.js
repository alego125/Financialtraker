import { currencyKpiRows } from './exportSummary';
import { downloadCsv } from './csv';
import { formatDate } from './format';

const PT = { EFECTIVO:'Efectivo', DEBITO:'Débito', CREDITO:'Crédito', TRANSFERENCIA:'Transferencia' };

export const generateExcel = ({ transactions, filters, kpis }) => {


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

  const summaryRows = kpis ? currencyKpiRows(kpis).map(row => ({ Indicador: row.label, Moneda: row.currency, Valor: row.value })) : [];

  // Filename with filter info
  let suffix = new Date().toISOString().slice(0, 10);
  if (filters?.month) suffix = filters.month;
  else if (filters?.year) suffix = filters.year;
  else if (filters?.dateFrom) suffix = `${filters.dateFrom}_${filters.dateTo || 'hoy'}`;

  downloadCsv([...txRows, ...summaryRows], `financialtracker-movimientos-${suffix}.csv`);
};

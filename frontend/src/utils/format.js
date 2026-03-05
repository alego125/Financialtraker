// Argentine format: 1.234.567,89
export const formatCurrency = (amount, currency = 'ARS') => {
  const num = parseFloat(amount) || 0;
  if (currency === 'USD') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(num);
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
};

export const formatNumber = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(parseFloat(amount) || 0);
};

// Fix date display — stored as noon UTC, display in local
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  // Parse as UTC then show date parts directly to avoid timezone shift
  const d = new Date(dateStr);
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export const formatMonth = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' }).format(date);
};

export const formatVariation = (pct) => {
  if (pct === null || pct === undefined) return null;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
};

// For number inputs: parse Argentine format to float
export const parseLocalNumber = (str) => {
  if (!str) return '';
  // Remove thousands dots, replace comma with dot
  return str.replace(/\./g, '').replace(',', '.');
};

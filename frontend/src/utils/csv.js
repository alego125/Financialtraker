export function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(text) && typeof value !== 'number' ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return [headers, ...rows.map(row => headers.map(key => row[key] ?? ''))].map(row => row.map(csvCell).join(';')).join('\r\n');
}
export function downloadCsv(rows, filename) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename.replace(/\.xlsx$/i, '.csv'); anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

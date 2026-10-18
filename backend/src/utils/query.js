const invalid = message => Object.assign(new Error(message), { status: 400 });
function parsePagination(query = {}) {
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw invalid('Paginación inválida');
    return Number(value);
  };
  const page = parse(query.page, 1, 1000000), limit = parse(query.limit, 20, 500);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
function normalizeQuery(req, res, next) {
  try {
    const q = req.query;
    if (q.page !== undefined || q.limit !== undefined) parsePagination(q);
    for (const [key, choices] of Object.entries({ type: ['INCOME', 'EXPENSE'], currency: ['ARS', 'USD'], paymentType: ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'], sortOrder: ['asc', 'desc'], sortBy: ['date', 'amount', 'type', 'createdAt'], source: ['mine', 'partner', 'both'], includeTransfers: ['true', 'false'] })) {
      if (q[key] && !choices.includes(q[key])) throw invalid(`${key} inválido`);
    }
    if (q.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)) throw invalid('Mes inválido');
    if (q.year && !/^\d{4}$/.test(q.year)) throw invalid('Año inválido');
    for (const key of ['dateFrom', 'dateTo']) if (q[key]) {
      if (typeof q[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(q[key]) || !Number.isFinite(new Date(q[key]).getTime()) || new Date(q[key]).toISOString().slice(0, 10) !== q[key].slice(0, 10)) throw invalid('Fecha inválida');
    }
    if (q.dateFrom && q.dateTo && new Date(q.dateFrom) > new Date(q.dateTo)) throw invalid('Rango de fechas inválido');
    for (const key of ['amountMin', 'amountMax']) if (q[key] !== undefined && (!/^\d+(\.\d{1,2})?$/.test(q[key]) || Number(q[key]) >= 1e10)) throw invalid('Monto de filtro inválido');
    if (q.amountMin && q.amountMax && Number(q.amountMin) > Number(q.amountMax)) throw invalid('Rango de montos inválido');
    for (const key of ['accountIds', 'categoryIds']) if (q[key] && (Array.isArray(q[key]) ? q[key] : String(q[key]).split(',')).length > 100) throw invalid('Demasiados filtros');
    next();
  } catch (error) { next(error); }
}
module.exports = { parsePagination, normalizeQuery };

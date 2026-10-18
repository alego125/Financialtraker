const badQuery = message => Object.assign(new Error(message), { status: 400 });
const parseListParam = value => value == null || value === '' ? [] : [...new Set((Array.isArray(value) ? value : String(value).split(',')).flatMap(v => String(v).split(',')).map(v => v.trim()).filter(Boolean))];
const buildAccountFilter = ids => ids.length ? { OR: [{ accountId: { in: ids } }, { sharedAccountId: { in: ids } }] } : {};
function dateBound(value, end = false) {
  const text = String(value);
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = new Date(dayOnly ? `${text}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : text);
  if (!Number.isFinite(date.getTime()) || (dayOnly && date.toISOString().slice(0, 10) !== text)) throw badQuery('Fecha inválida');
  return date;
}
// Calendar selectors have the same precedence in every report: month, year, explicit range.
function resolveDateRange(query, { defaultMonth = true, now = new Date() } = {}) {
  let from, to;
  if (query.month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) throw badQuery('Mes inválido');
    from = dateBound(`${query.month}-01`);
    to = new Date(from); to.setUTCMonth(to.getUTCMonth() + 1); to = new Date(to.getTime() - 1);
  } else if (query.year) {
    if (!/^\d{4}$/.test(String(query.year))) throw badQuery('Año inválido');
    from = dateBound(`${query.year}-01-01`); to = dateBound(`${query.year}-12-31`, true);
  } else if (query.dateFrom || query.dateTo) {
    from = query.dateFrom ? dateBound(query.dateFrom) : undefined;
    to = query.dateTo ? dateBound(query.dateTo, true) : undefined;
  } else if (defaultMonth) {
    return resolveDateRange({month: now.toISOString().slice(0,7)});
  }
  if (from && to && from > to) throw badQuery('Rango de fechas inválido');
  return { from, to };
}
function resolvePriorRange({ from, to }, query = {}) {
  if (query.month) {
    const start = new Date(from); start.setUTCMonth(start.getUTCMonth() - 1);
    return {from: start, to: new Date(from.getTime() - 1)};
  }
  if (query.year) return resolveDateRange({year: String(from.getUTCFullYear() - 1)});
  const duration = to.getTime() - from.getTime() + 1;
  return {from: new Date(from.getTime() - duration), to: new Date(from.getTime() - 1)};
}
function buildTransactionWhere(userId, query = {}, { defaultMonth = false, excludeTransfers = true } = {}) {
  const where = { userId, ...(excludeTransfers && {transferId: null}) };
  const ids = parseListParam(query.accountIds), categories = parseListParam(query.categoryIds);
  Object.assign(where, buildAccountFilter(ids));
  if (!ids.length && query.accountId) where.accountId = query.accountId;
  if (query.sharedAccountId) where.sharedAccountId = query.sharedAccountId;
  if (categories.length) where.categoryId = {in: categories}; else if (query.categoryId) where.categoryId = query.categoryId;
  for (const key of ['type', 'currency', 'paymentType']) if (query[key]) where[key] = query[key];
  if (query.comment) where.comment = { contains: query.comment, mode: 'insensitive' };
  const {from, to} = resolveDateRange(query, {defaultMonth});
  if (from || to) where.date = {...(from && {gte:from}), ...(to && {lte:to})};
  if (query.amountMin !== undefined || query.amountMax !== undefined) {
    where.amount = {};
    for (const [key, op] of [['amountMin','gte'],['amountMax','lte']]) if (query[key] !== undefined && query[key] !== '') {
      const value = Number(query[key]); if (!Number.isFinite(value)) throw badQuery('Monto inválido'); where.amount[op] = value;
    }
    if (where.amount.gte !== undefined && where.amount.lte !== undefined && where.amount.gte > where.amount.lte) throw badQuery('Rango de montos inválido');
  }
  return where;
}
module.exports = {dateBound, parseListParam, buildAccountFilter, resolveDateRange, resolvePriorRange, buildTransactionWhere};

const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const { calcBalances } = require('./accounts.controller');

const toNum = d => parseFloat(d?.toString() || '0');
const pctChange = (curr, prev) => prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(1)) : null;

// ── Date range helpers (mirrors dashboard.controller.js's month/year/range modes) ──
const resolveDateRange = (query) => {
  const now = new Date();
  if (query.month) {
    const [y, m] = query.month.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    return { from: new Date(`${y}-${m}-01T00:00:00.000Z`), to: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`) };
  }
  if (query.year) {
    return { from: new Date(`${query.year}-01-01T00:00:00.000Z`), to: new Date(`${query.year}-12-31T23:59:59.999Z`) };
  }
  if (query.dateFrom || query.dateTo) {
    return {
      from: query.dateFrom ? new Date(query.dateFrom + 'T00:00:00.000Z') : new Date('1970-01-01'),
      to:   query.dateTo   ? new Date(query.dateTo   + 'T23:59:59.999Z') : now,
    };
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: new Date(`${y}-${m}-01T00:00:00.000Z`), to: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`) };
};

const resolvePriorRange = ({ from, to }, query) => {
  if (query.month) {
    const d = new Date(from); d.setUTCMonth(d.getUTCMonth() - 1);
    const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getUTCMonth() + 1, 0).getDate();
    return { from: new Date(`${y}-${m}-01T00:00:00.000Z`), to: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`) };
  }
  if (query.year) {
    const y = parseInt(query.year) - 1;
    return { from: new Date(`${y}-01-01T00:00:00.000Z`), to: new Date(`${y}-12-31T23:59:59.999Z`) };
  }
  const diff = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - diff), to: new Date(from.getTime()) };
};

// Últimos N meses como 'YYYY-MM', ascendente
const rollingMonths = (n = 12) => {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

const buildAccountFilter = (accountIds) => {
  if (!accountIds?.length) return {};
  return { OR: [{ accountId: { in: accountIds } }, { sharedAccountId: { in: accountIds } }] };
};

const parseListParam = (v) => !v ? [] : Array.isArray(v) ? v : String(v).split(',').filter(Boolean);

// ── KPIs (Prisma aggregate — DB-level sums) ──────────────────────────────────
async function computeKpis(userId, query, from, to, prior) {
  const accountIds = parseListParam(query.accountIds);
  const categoryIds = parseListParam(query.categoryIds);
  const baseWhere = {
    userId, transferId: null,
    ...(categoryIds.length && { categoryId: { in: categoryIds } }),
    ...buildAccountFilter(accountIds),
  };
  const periodWhere = { ...baseWhere, date: { gte: from, lte: to } };
  const priorWhere = { ...baseWhere, date: { gte: prior.from, lte: prior.to } };

  const [incomeAgg, expenseAgg, expenseUSDAgg, prevIncomeAgg, prevExpenseAgg, prevExpenseUSDAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...periodWhere, type: 'INCOME', isReimbursement: false }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...priorWhere, type: 'INCOME', isReimbursement: false }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
  ]);

  const income = toNum(incomeAgg._sum.amount);
  const expense = toNum(expenseAgg._sum.amount);
  const expenseUSD = toNum(expenseUSDAgg._sum.amount);
  const prevIncome = toNum(prevIncomeAgg._sum.amount);
  const prevExpense = toNum(prevExpenseAgg._sum.amount);
  const prevExpenseUSD = toNum(prevExpenseUSDAgg._sum.amount);

  return {
    income: parseFloat(income.toFixed(2)),
    expense: parseFloat(expense.toFixed(2)),
    expenseUSD: parseFloat(expenseUSD.toFixed(2)),
    net: parseFloat((income - expense).toFixed(2)),
    variation: {
      income: pctChange(income, prevIncome),
      expense: pctChange(expense, prevExpense),
      expenseUSD: pctChange(expenseUSD, prevExpenseUSD),
    },
  };
}

// ── Category breakdown (Prisma groupBy — DB-level grouping) ──────────────────
async function categoryBreakdown(userId, query, from, to) {
  const accountIds = parseListParam(query.accountIds);
  const categoryIds = parseListParam(query.categoryIds);
  const where = {
    userId, transferId: null, type: 'EXPENSE',
    date: { gte: from, lte: to },
    ...(categoryIds.length && { categoryId: { in: categoryIds } }),
    ...buildAccountFilter(accountIds),
  };
  const grouped = await prisma.transaction.groupBy({ by: ['categoryId', 'currency'], where, _sum: { amount: true } });
  const categories = await prisma.category.findMany({ where: { id: { in: [...new Set(grouped.map(g => g.categoryId))] } } });
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const byCurrency = { ARS: {}, USD: {} };
  for (const g of grouped) {
    const amt = toNum(g._sum.amount);
    byCurrency[g.currency][g.categoryId] = (byCurrency[g.currency][g.categoryId] || 0) + amt;
  }
  const build = (map) => {
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([categoryId, amount]) => {
      const cat = catMap[categoryId];
      return {
        categoryId, name: cat?.name || 'Sin categoría', color: cat?.color || '#8A8478',
        amount: parseFloat(amount.toFixed(2)),
        percentage: total > 0 ? parseFloat(((amount / total) * 100).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
  };
  return { ARS: build(byCurrency.ARS), USD: build(byCurrency.USD) };
}

// ── Monthly income/expense series (raw SQL group-by-month — rolling 12mo, ignores point filter) ──
async function monthlySeries(userId, query) {
  const months = rollingMonths(12);
  const windowStart = new Date(`${months[0]}-01T00:00:00.000Z`);
  const accountIds = parseListParam(query.accountIds);
  const categoryIds = parseListParam(query.categoryIds);

  const accountFilterSql = accountIds.length
    ? Prisma.sql`AND ("accountId" = ANY(${accountIds}) OR "sharedAccountId" = ANY(${accountIds}))`
    : Prisma.empty;
  const categoryFilterSql = categoryIds.length
    ? Prisma.sql`AND "categoryId" = ANY(${categoryIds})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month,
           type, currency, SUM(amount)::float as total
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "transferId" IS NULL AND "isReimbursement" = false
      AND date >= ${windowStart}
      ${accountFilterSql} ${categoryFilterSql}
    GROUP BY month, type, currency
  `;

  const map = Object.fromEntries(months.map(m => [m, { month: m, income: 0, expense: 0, expenseUSD: 0 }]));
  for (const r of rows) {
    if (!map[r.month]) continue;
    if (r.type === 'INCOME') map[r.month].income += r.total;
    else if (r.currency === 'ARS') map[r.month].expense += r.total;
    else map[r.month].expenseUSD += r.total;
  }
  return months.map(m => ({
    month: m,
    income: parseFloat(map[m].income.toFixed(2)),
    expense: parseFloat(map[m].expense.toFixed(2)),
    expenseUSD: parseFloat(map[m].expenseUSD.toFixed(2)),
  }));
}

async function computeUserAnalysis(userId, query, owner) {
  const { from, to } = resolveDateRange(query);
  const prior = resolvePriorRange({ from, to }, query);
  const [kpis, catBreakdown, monthly] = await Promise.all([
    computeKpis(userId, query, from, to, prior),
    categoryBreakdown(userId, query, from, to),
    monthlySeries(userId, query),
  ]);
  const currencyComparison = monthly.map(m => ({ month: m.month, expenseARS: m.expense, expenseUSD: m.expenseUSD }));
  return {
    owner, range: { from, to }, kpis,
    categoryBreakdown: catBreakdown.ARS, categoryBreakdownUSD: catBreakdown.USD,
    topCategories: catBreakdown.ARS.slice(0, 5),
    monthlySeries: monthly, currencyComparison,
  };
}

const getAnalysis = async (req, res, next) => {
  try {
    const result = await computeUserAnalysis(req.userId, req.query, 'mine');
    res.json({ mine: result });
  } catch (err) { next(err); }
};

module.exports = { getAnalysis, computeUserAnalysis, resolveDateRange, resolvePriorRange, rollingMonths, buildAccountFilter, parseListParam };

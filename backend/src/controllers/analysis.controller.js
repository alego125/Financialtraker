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

  const zeroAgg = Promise.resolve({ _sum: { amount: 0 } });
  const skipARS = query.currency === 'USD';
  const skipUSD = query.currency === 'ARS';

  const [incomeAgg, incomeUSDAgg, expenseAgg, expenseUSDAgg, prevIncomeAgg, prevIncomeUSDAgg, prevExpenseAgg, prevExpenseUSDAgg] = await Promise.all([
    skipARS ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'INCOME', currency: 'ARS', isReimbursement: false }, _sum: { amount: true } }),
    skipUSD ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'INCOME', currency: 'USD', isReimbursement: false }, _sum: { amount: true } }),
    skipARS ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    skipUSD ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
    skipARS ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'INCOME', currency: 'ARS', isReimbursement: false }, _sum: { amount: true } }),
    skipUSD ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'INCOME', currency: 'USD', isReimbursement: false }, _sum: { amount: true } }),
    skipARS ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    skipUSD ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
  ]);

  const income = toNum(incomeAgg._sum.amount);
  const incomeUSD = toNum(incomeUSDAgg._sum.amount);
  const expense = toNum(expenseAgg._sum.amount);
  const expenseUSD = toNum(expenseUSDAgg._sum.amount);
  const prevIncome = toNum(prevIncomeAgg._sum.amount);
  const prevIncomeUSD = toNum(prevIncomeUSDAgg._sum.amount);
  const prevExpense = toNum(prevExpenseAgg._sum.amount);
  const prevExpenseUSD = toNum(prevExpenseUSDAgg._sum.amount);

  return {
    income: parseFloat(income.toFixed(2)),
    incomeUSD: parseFloat(incomeUSD.toFixed(2)),
    expense: parseFloat(expense.toFixed(2)),
    expenseUSD: parseFloat(expenseUSD.toFixed(2)),
    net: parseFloat((income - expense).toFixed(2)),
    variation: {
      income: pctChange(income, prevIncome),
      incomeUSD: pctChange(incomeUSD, prevIncomeUSD),
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
    ...(query.currency && { currency: query.currency }),
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
  const currencyFilterSql = (query.currency === 'ARS' || query.currency === 'USD')
    ? Prisma.sql`AND currency = ${query.currency}::"Currency"`
    : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month,
           type, currency, SUM(amount)::float as total
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "transferId" IS NULL AND "isReimbursement" = false
      AND date >= ${windowStart}
      ${accountFilterSql} ${categoryFilterSql} ${currencyFilterSql}
    GROUP BY month, type, currency
  `;

  const map = Object.fromEntries(months.map(m => [m, { month: m, income: 0, incomeUSD: 0, expense: 0, expenseUSD: 0 }]));
  for (const r of rows) {
    if (!map[r.month]) continue;
    if (r.type === 'INCOME') {
      if (r.currency === 'ARS') map[r.month].income += r.total;
      else map[r.month].incomeUSD += r.total;
    } else if (r.currency === 'ARS') map[r.month].expense += r.total;
    else map[r.month].expenseUSD += r.total;
  }
  return months.map(m => ({
    month: m,
    income: parseFloat(map[m].income.toFixed(2)),
    incomeUSD: parseFloat(map[m].incomeUSD.toFixed(2)),
    expense: parseFloat(map[m].expense.toFixed(2)),
    expenseUSD: parseFloat(map[m].expenseUSD.toFixed(2)),
  }));
}

// ── Balance at an arbitrary cutoff date, computed from an already-fetched account ──
// (mirrors accounts.controller.js's calcBalances, but stops accumulating at cutoffDate)
function balanceAtDate(account, cutoffDate) {
  let ars = toNum(account.initialBalance);
  let usd = toNum(account.initialBalanceUSD || 0);
  for (const tx of account.transactions || []) {
    if (new Date(tx.date) >= cutoffDate) continue;
    const amt = toNum(tx.amount);
    const isUSD = tx.currency === 'USD';
    if (tx.type === 'INCOME') { isUSD ? (usd += amt) : (ars += amt); }
    else { isUSD ? (usd -= amt) : (ars -= amt); }
  }
  for (const ex of account.exchangesFrom || []) {
    if (new Date(ex.date) >= cutoffDate) continue;
    usd += toNum(ex.usdAmount); ars -= toNum(ex.arsAmount);
  }
  return { ars: parseFloat(ars.toFixed(2)), usd: parseFloat(usd.toFixed(2)) };
}

// ── Accounts: current balance, variation vs period start, monthly balance series, credit debt ──
async function accountsAnalysis(userId, query, from) {
  const accountIds = parseListParam(query.accountIds);
  const accounts = await prisma.account.findMany({
    where: { userId, ...(accountIds.length && { id: { in: accountIds } }) },
    include: {
      transactions: { select: { amount: true, type: true, currency: true, date: true } },
      exchangesFrom: { select: { usdAmount: true, arsAmount: true, date: true } },
    },
  });

  const months = rollingMonths(12);
  let creditDebtARS = 0, creditDebtUSD = 0;
  const accountsDetail = [];
  const balanceSeries = [];

  for (const acc of accounts) {
    const current = calcBalances(acc);
    const atStart = balanceAtDate(acc, from);
    accountsDetail.push({
      id: acc.id, name: acc.name, accountType: acc.accountType, color: acc.color,
      balance: current.currentBalance, balanceUSD: current.currentBalanceUSD,
      variationPct: pctChange(current.currentBalance, atStart.ars),
    });
    if (acc.accountType === 'CREDIT') {
      if (current.currentBalance < 0) creditDebtARS += -current.currentBalance;
      if (current.currentBalanceUSD < 0) creditDebtUSD += -current.currentBalanceUSD;
    }
    for (const m of months) {
      const monthEnd = new Date(`${m}-01T00:00:00.000Z`);
      monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
      const createdMonth = `${acc.createdAt.getUTCFullYear()}-${String(acc.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
      if (m < createdMonth) continue; // account didn't exist yet
      const atMonthEnd = balanceAtDate(acc, monthEnd);
      balanceSeries.push({ accountId: acc.id, accountName: acc.name, accountType: acc.accountType, month: m, balance: atMonthEnd.ars });
    }
  }

  const totalBalance = accountsDetail.reduce((s, a) => s + a.balance, 0);
  const totalBalanceUSD = accountsDetail.reduce((s, a) => s + a.balanceUSD, 0);

  return {
    accountsDetail,
    balanceSeries,
    creditDebt: parseFloat(creditDebtARS.toFixed(2)),
    creditDebtUSD: parseFloat(creditDebtUSD.toFixed(2)),
    totalBalance: parseFloat(totalBalance.toFixed(2)),
    totalBalanceUSD: parseFloat(totalBalanceUSD.toFixed(2)),
  };
}

// ── Recent activity: last 10 transactions + transfers, merged and sorted ────
async function recentActivity(userId, query) {
  const accountIds = parseListParam(query.accountIds);
  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, transferId: null, ...buildAccountFilter(accountIds) },
      include: { category: true },
      orderBy: { date: 'desc' }, take: 10,
    }),
    prisma.transfer.findMany({
      where: { initiatorId: userId },
      orderBy: { date: 'desc' }, take: 10,
      include: { fromAccount: true, toAccount: true, fromSharedAccount: true, toSharedAccount: true },
    }),
  ]);
  const merged = [
    ...transactions.map(tx => ({
      id: tx.id, kind: 'transaction', date: tx.date, amount: toNum(tx.amount), currency: tx.currency,
      type: tx.type, comment: tx.comment, categoryName: tx.category?.name || null,
    })),
    ...transfers.map(t => ({
      id: t.id, kind: 'transfer', date: t.date, amount: toNum(t.amount), currency: t.currency,
      comment: t.comment,
      fromName: t.fromAccount?.name || t.fromSharedAccount?.name || null,
      toName: t.toAccount?.name || t.toSharedAccount?.name || null,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  return merged;
}

async function computeUserAnalysis(userId, query, owner) {
  const { from, to } = resolveDateRange(query);
  const prior = resolvePriorRange({ from, to }, query);
  const [kpis, catBreakdown, monthly, accountsInfo, activity] = await Promise.all([
    computeKpis(userId, query, from, to, prior),
    categoryBreakdown(userId, query, from, to),
    monthlySeries(userId, query),
    accountsAnalysis(userId, query, from),
    recentActivity(userId, query),
  ]);
  const currencyComparison = monthly.map(m => ({ month: m.month, expenseARS: m.expense, expenseUSD: m.expenseUSD }));
  return {
    owner, range: { from, to },
    kpis: {
      ...kpis,
      creditDebt: accountsInfo.creditDebt, creditDebtUSD: accountsInfo.creditDebtUSD,
      balance: accountsInfo.totalBalance, balanceUSD: accountsInfo.totalBalanceUSD,
    },
    categoryBreakdown: catBreakdown.ARS, categoryBreakdownUSD: catBreakdown.USD,
    topCategories: catBreakdown.ARS.slice(0, 5),
    monthlySeries: monthly, currencyComparison,
    accounts: accountsInfo.accountsDetail, accountBalanceSeries: accountsInfo.balanceSeries,
    recentActivity: activity,
  };
}

function mergeCombinedKpis(mine, partner) {
  const sum = (a, b) => parseFloat(((a || 0) + (b || 0)).toFixed(2));
  return {
    income: sum(mine.kpis.income, partner.kpis.income),
    incomeUSD: sum(mine.kpis.incomeUSD, partner.kpis.incomeUSD),
    expense: sum(mine.kpis.expense, partner.kpis.expense),
    expenseUSD: sum(mine.kpis.expenseUSD, partner.kpis.expenseUSD),
    net: sum(mine.kpis.net, partner.kpis.net),
    creditDebt: sum(mine.kpis.creditDebt, partner.kpis.creditDebt),
    creditDebtUSD: sum(mine.kpis.creditDebtUSD, partner.kpis.creditDebtUSD),
    balance: sum(mine.kpis.balance, partner.kpis.balance),
    balanceUSD: sum(mine.kpis.balanceUSD, partner.kpis.balanceUSD),
  };
}

function mergeMonthly(mine, partner) {
  const map = {};
  for (const m of mine.monthlySeries) map[m.month] = { month: m.month, income: m.income, incomeUSD: m.incomeUSD, expense: m.expense, expenseUSD: m.expenseUSD, partnerIncome: 0, partnerIncomeUSD: 0, partnerExpense: 0, partnerExpenseUSD: 0 };
  for (const m of partner.monthlySeries) {
    if (!map[m.month]) map[m.month] = { month: m.month, income: 0, incomeUSD: 0, expense: 0, expenseUSD: 0, partnerIncome: 0, partnerIncomeUSD: 0, partnerExpense: 0, partnerExpenseUSD: 0 };
    map[m.month].partnerIncome = m.income; map[m.month].partnerIncomeUSD = m.incomeUSD; map[m.month].partnerExpense = m.expense; map[m.month].partnerExpenseUSD = m.expenseUSD;
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

const getAnalysis = async (req, res, next) => {
  try {
    const source = req.query.source || 'mine';
    const partnerId = req.query.partnerId;

    if (source === 'mine') {
      const mine = await computeUserAnalysis(req.userId, req.query, 'mine');
      return res.json({ mine });
    }

    if (!partnerId) return res.status(400).json({ error: 'partnerId es requerido para source=partner|both' });
    const partnership = await prisma.partnership.findFirst({
      where: { status: 'ACCEPTED', OR: [
        { senderId: req.userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: req.userId },
      ]},
    });
    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    if (source === 'partner') {
      const partner = await computeUserAnalysis(partnerId, req.query, 'partner');
      return res.json({ partner });
    }

    // source === 'both'
    const [mine, partner] = await Promise.all([
      computeUserAnalysis(req.userId, req.query, 'mine'),
      computeUserAnalysis(partnerId, req.query, 'partner'),
    ]);
    res.json({
      mine, partner,
      combined: {
        kpis: mergeCombinedKpis(mine, partner),
        monthlySeries: mergeMonthly(mine, partner),
        categoryBreakdown: [
          ...mine.categoryBreakdown.map(c => ({ ...c, owner: 'mine' })),
          ...partner.categoryBreakdown.map(c => ({ ...c, owner: 'partner' })),
        ],
        accounts: [
          ...mine.accounts.map(a => ({ ...a, owner: 'mine' })),
          ...partner.accounts.map(a => ({ ...a, owner: 'partner' })),
        ],
        accountBalanceSeries: [
          ...mine.accountBalanceSeries.map(s => ({ ...s, owner: 'mine' })),
          ...partner.accountBalanceSeries.map(s => ({ ...s, owner: 'partner' })),
        ],
        recentActivity: [
          ...mine.recentActivity.map(a => ({ ...a, owner: 'mine' })),
          ...partner.recentActivity.map(a => ({ ...a, owner: 'partner' })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getAnalysis, computeUserAnalysis, resolveDateRange, resolvePriorRange, rollingMonths, buildAccountFilter, parseListParam };

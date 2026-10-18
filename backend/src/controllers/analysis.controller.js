const { Prisma } = require('@prisma/client');
const { decimal, money } = require('../utils/decimal');
const prisma = require('../utils/prisma');
const { getAccountBalances } = require('../utils/accountBalances');
const { accountBalanceSeries } = require('../utils/accountHistory');

const toNum = d => parseFloat(d?.toString() || '0');
const pctChange = (curr, prev) => prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(1)) : null;

const { resolveDateRange: resolveRange, resolvePriorRange, parseListParam, buildAccountFilter, buildTransactionWhere } = require('../utils/reportFilters');
const resolveDateRange = query => {
  const range = resolveRange(query);
  return {from: range.from || new Date('1970-01-01T00:00:00Z'), to: range.to || new Date()};
};
const rollingMonths = (n = 12) => {
  const now = new Date(), months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
};

// ── KPIs (Prisma aggregate — DB-level sums) ──────────────────────────────────
async function computeKpis(userId, query, from, to, prior) {
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const categoryIds = parseListParam(query.categoryIds || query.categoryId);
  const baseWhere = buildTransactionWhere(userId, query);
  const periodWhere = { ...baseWhere, date: { gte: from, lte: to } };
  const priorWhere = { ...baseWhere, date: { gte: prior.from, lte: prior.to } };

  const zeroAgg = Promise.resolve({ _sum: { amount: 0 } });
  const skipARS = query.currency === 'USD';
  const skipUSD = query.currency === 'ARS';

  const [incomeAgg, incomeUSDAgg, expenseAgg, expenseUSDAgg, prevIncomeAgg, prevIncomeUSDAgg, prevExpenseAgg, prevExpenseUSDAgg] = await Promise.all([
    skipARS || query.type === 'EXPENSE' ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'INCOME', currency: 'ARS', isReimbursement: false }, _sum: { amount: true } }),
    skipUSD || query.type === 'EXPENSE' ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'INCOME', currency: 'USD', isReimbursement: false }, _sum: { amount: true } }),
    skipARS || query.type === 'INCOME' ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    skipUSD || query.type === 'INCOME' ? zeroAgg : prisma.transaction.aggregate({ where: { ...periodWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
    skipARS || query.type === 'EXPENSE' ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'INCOME', currency: 'ARS', isReimbursement: false }, _sum: { amount: true } }),
    skipUSD || query.type === 'EXPENSE' ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'INCOME', currency: 'USD', isReimbursement: false }, _sum: { amount: true } }),
    skipARS || query.type === 'INCOME' ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'ARS' }, _sum: { amount: true } }),
    skipUSD || query.type === 'INCOME' ? zeroAgg : prisma.transaction.aggregate({ where: { ...priorWhere, type: 'EXPENSE', currency: 'USD' }, _sum: { amount: true } }),
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
    net: money(decimal(incomeAgg._sum.amount).minus(expenseAgg._sum.amount || 0)),
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
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const categoryIds = parseListParam(query.categoryIds || query.categoryId);
  if (query.type === 'INCOME') return {ARS: [], USD: []};
  const where = {...buildTransactionWhere(userId, query), type: 'EXPENSE', date: {gte: from, lte: to}};
  const grouped = await prisma.transaction.groupBy({ by: ['categoryId', 'currency'], where, _sum: { amount: true } });
  const categories = await prisma.category.findMany({ where: { id: { in: [...new Set(grouped.map(g => g.categoryId))] } } });
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const byCurrency = { ARS: {}, USD: {} };
  for (const g of grouped) {
    const amt = toNum(g._sum.amount);
    byCurrency[g.currency][g.categoryId] = decimal(byCurrency[g.currency][g.categoryId] || 0).plus(g._sum.amount || 0);
  }
  const build = (map) => {
    const total = Object.values(map).reduce((sum, value) => sum.plus(value), decimal(0));
    return Object.entries(map).map(([categoryId, amount]) => {
      const cat = catMap[categoryId];
      return {
        categoryId, name: cat?.name || 'Sin categoría', color: cat?.color || '#8A8478',
        amount: money(amount),
        percentage: total.gt(0) ? amount.div(total).mul(100).toDecimalPlaces(1).toNumber() : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
  };
  return { ARS: build(byCurrency.ARS), USD: build(byCurrency.USD) };
}

// ── Monthly income/expense series (raw SQL group-by-month — rolling 12mo, ignores point filter) ──
async function monthlySeries(userId, query) {
  const months = rollingMonths(12);
  const windowStart = new Date(`${months[0]}-01T00:00:00.000Z`);
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const categoryIds = parseListParam(query.categoryIds || query.categoryId);

  const accountFilterSql = accountIds.length
    ? Prisma.sql`AND ("accountId" = ANY(${accountIds}) OR "sharedAccountId" = ANY(${accountIds}))`
    : Prisma.empty;
  const categoryFilterSql = categoryIds.length
    ? Prisma.sql`AND "categoryId" = ANY(${categoryIds})`
    : Prisma.empty;
  const currencyFilterSql = (query.currency === 'ARS' || query.currency === 'USD')
    ? Prisma.sql`AND currency = ${query.currency}::"Currency"`
    : Prisma.empty;

  const typeSql = query.type ? Prisma.sql`AND type = ${query.type}::"TransactionType"` : Prisma.empty;
  const paymentSql = query.paymentType ? Prisma.sql`AND "paymentType" = ${query.paymentType}::"PaymentType"` : Prisma.empty;
  const commentSql = query.comment ? Prisma.sql`AND comment ILIKE ${'%' + query.comment.replace(/[\\%_]/g, '\\$&') + '%'}` : Prisma.empty;
  const minSql = query.amountMin !== undefined && query.amountMin !== '' ? Prisma.sql`AND amount >= ${Number(query.amountMin)}` : Prisma.empty;
  const maxSql = query.amountMax !== undefined && query.amountMax !== '' ? Prisma.sql`AND amount <= ${Number(query.amountMax)}` : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month,
           type, currency, SUM(amount) as total
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "transferId" IS NULL AND (type = 'EXPENSE' OR "isReimbursement" = false)
      AND date >= ${windowStart} AND date < ${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))}
      ${accountFilterSql} ${categoryFilterSql} ${currencyFilterSql} ${typeSql} ${paymentSql} ${commentSql} ${minSql} ${maxSql}
    GROUP BY month, type, currency
  `;

  const map = Object.fromEntries(months.map(m => [m, { month: m, income: 0, incomeUSD: 0, expense: 0, expenseUSD: 0 }]));
  for (const r of rows) {
    if (!map[r.month]) continue;
    if (r.type === 'INCOME') {
      if (r.currency === 'ARS') map[r.month].income += toNum(r.total);
      else map[r.month].incomeUSD += toNum(r.total);
    } else if (r.currency === 'ARS') map[r.month].expense += toNum(r.total);
    else map[r.month].expenseUSD += toNum(r.total);
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
async function accountsAnalysis(userId, query, from) {
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const accounts = await prisma.account.findMany({where: {userId, ...(accountIds.length && {id: {in: accountIds}})}});
  const ids = accounts.map(account => account.id);
  const [current, atStart, balanceSeries] = await Promise.all([
    getAccountBalances(prisma, ids), getAccountBalances(prisma, ids, false, {at: from}),
    accountBalanceSeries(prisma, accounts, rollingMonths(12)),
  ]);
  let creditDebt = 0, creditDebtUSD = 0;
  const accountsDetail = accounts.map(account => {
    const balance = current.get(account.id), opening = atStart.get(account.id);
    if (account.accountType === 'CREDIT') {
      creditDebt += Math.max(0, -balance.currentBalance); creditDebtUSD += Math.max(0, -balance.currentBalanceUSD);
    }
    return {id: account.id, name: account.name, accountType: account.accountType, color: account.color,
      balance: balance.currentBalance, balanceUSD: balance.currentBalanceUSD,
      variationPct: pctChange(balance.currentBalance, opening.currentBalance)};
  });
  return {accountsDetail, balanceSeries, creditDebt, creditDebtUSD,
    totalBalance: money(accountsDetail.reduce((sum, account) => sum.plus(account.balance), decimal(0))),
    totalBalanceUSD: money(accountsDetail.reduce((sum, account) => sum.plus(account.balanceUSD), decimal(0)))};
}

async function sharedAccountsAnalysis(userId, from, to, query = {}) {
  const ids = parseListParam(query.accountIds || query.sharedAccountId || query.accountId);
  const sharedAccounts = await prisma.sharedAccount.findMany({
    where: {OR: [{userAId: userId}, {userBId: userId}], ...(ids.length && {id: {in: ids}})},
  });
  const sharedIds = sharedAccounts.map(account => account.id);
  const sharedExpenseWhere = buildTransactionWhere(userId, query);
  delete sharedExpenseWhere.userId;
  const [balances, expenses] = await Promise.all([
    getAccountBalances(prisma, sharedIds, true),
    sharedIds.length && query.type !== 'INCOME' ? prisma.transaction.groupBy({by: ['currency'], where: {
      ...sharedExpenseWhere,
      sharedAccountId: {in: sharedIds}, transferId: null, type: 'EXPENSE', date: {gte: from, lte: to},
      ...(parseListParam(query.categoryIds || query.categoryId).length && {categoryId: {in: parseListParam(query.categoryIds || query.categoryId)}}),
      ...(query.currency && {currency: query.currency}),
    }, _sum: {amount: true}}) : [],
  ]);
  const accounts = sharedAccounts.map(account => ({id: account.id, name: account.name, color: account.color,
    balance: balances.get(account.id).currentBalance, balanceUSD: balances.get(account.id).currentBalanceUSD}));
  return {accounts,
    totalBalance: money(accounts.reduce((sum, account) => sum.plus(account.balance), decimal(0))),
    totalBalanceUSD: money(accounts.reduce((sum, account) => sum.plus(account.balanceUSD), decimal(0))),
    monthlyExpense: toNum(expenses.find(row => row.currency === 'ARS')?._sum.amount),
    monthlyExpenseUSD: toNum(expenses.find(row => row.currency === 'USD')?._sum.amount)};
}

async function recentActivity(userId, query, from, to) {
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const categoryIds = parseListParam(query.categoryIds || query.categoryId);
  const commonWhere = buildTransactionWhere(userId, query);
  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: {...buildTransactionWhere(userId, query), date: {gte: from, lte: to}},
      include: { category: true },
      orderBy: { date: 'desc' }, take: 10,
    }),
    categoryIds.length || query.type || query.paymentType ? Promise.resolve([]) : prisma.transfer.findMany({
      where: {
        ...(commonWhere.amount && {amount: commonWhere.amount}),
        ...(commonWhere.comment && {comment: commonWhere.comment}),
        initiatorId: userId, date: {gte: from, lte: to},
        ...(accountIds.length && {OR: ['fromAccountId','toAccountId','fromSharedAccountId','toSharedAccountId'].map(key => ({[key]: {in: accountIds}}))}),
        ...(query.currency && { currency: query.currency }),
      },
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

// ── Compras/ventas de USD en el período ─────────────────────────────────────
async function usdExchangesList(userId, from, to, query) {
  const exchanges = await prisma.currencyExchange.findMany({
    where: { userId, date: { gte: from, lte: to }, ...(parseListParam(query.accountIds || query.accountId || query.sharedAccountId).length && {accountId: {in: parseListParam(query.accountIds || query.accountId || query.sharedAccountId)}}) },
    include: { account: { select: { name: true } } },
    orderBy: { date: 'desc' },
  });
  return exchanges.map(e => ({
    id: e.id, date: e.date,
    usdAmount: toNum(e.usdAmount), arsAmount: toNum(e.arsAmount),
    rate: toNum(e.rate), comment: e.comment,
    accountName: e.account?.name || null,
  }));
}

// ── Transacciones en USD del período (ingresos y gastos en moneda USD) ──────
async function usdTransactionsList(userId, from, to, query) {
  const txs = await prisma.transaction.findMany({
    where: {
      ...buildTransactionWhere(userId, query), currency: 'USD',
      date: { gte: from, lte: to },
    },
    include: { category: true },
    orderBy: [{ date: 'desc' }],
  });
  return txs.map(tx => ({
    id: tx.id, date: tx.date, amount: toNum(tx.amount), type: tx.type,
    comment: tx.comment, categoryName: tx.category?.name || null,
  }));
}

// ── Top 10 gastos individuales del período, ordenados por monto ─────────────
async function topExpenses(userId, query, from, to) {
  const accountIds = parseListParam(query.accountIds || query.accountId || query.sharedAccountId);
  const categoryIds = parseListParam(query.categoryIds || query.categoryId);
  if (query.type === 'INCOME') return [];
  const where = {...buildTransactionWhere(userId, query), type: 'EXPENSE', date: {gte: from, lte: to}};
  const txs = await prisma.transaction.findMany({
    where, include: { category: true },
    orderBy: { amount: 'desc' }, take: 10,
  });
  return txs.map(tx => ({
    id: tx.id, date: tx.date, amount: toNum(tx.amount), currency: tx.currency,
    comment: tx.comment, categoryName: tx.category?.name || null,
  }));
}

async function computeUserAnalysis(userId, query, owner) {
  const { from, to } = resolveDateRange(query);
  const priorQuery = query.month || query.year || query.dateFrom || query.dateTo ? query : {month: from.toISOString().slice(0,7)};
  const prior = resolvePriorRange({ from, to }, priorQuery);
  const [kpis, catBreakdown, monthly, accountsInfo, activity, topExp, exchanges, usdTxs] = await Promise.all([
    computeKpis(userId, query, from, to, prior),
    categoryBreakdown(userId, query, from, to),
    monthlySeries(userId, query),
    accountsAnalysis(userId, query, from),
    recentActivity(userId, query, from, to),
    topExpenses(userId, query, from, to),
    query.currency === 'ARS' || parseListParam(query.categoryIds || query.categoryId).length ? [] : usdExchangesList(userId, from, to, query),
    query.currency === 'ARS' ? [] : usdTransactionsList(userId, from, to, query),
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
    topExpenses: topExp,
    usdExchanges: exchanges,
    usdTransactions: usdTxs,
  };
}

function mergeCombinedKpis(mine, partner) {
  const sum = (a, b) => money(decimal(a || 0).plus(b || 0));
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
  for (const m of mine.monthlySeries) map[m.month] = { month: m.month, income: m.income, incomeUSD: m.incomeUSD, expense: m.expense, expenseUSD: m.expenseUSD };
  for (const m of partner.monthlySeries) {
    if (!map[m.month]) map[m.month] = { month: m.month, income: 0, incomeUSD: 0, expense: 0, expenseUSD: 0 };
    map[m.month].income += m.income;
    map[m.month].incomeUSD += m.incomeUSD;
    map[m.month].expense += m.expense;
    map[m.month].expenseUSD += m.expenseUSD;
  }
  return Object.values(map)
    .map(m => ({
      month: m.month,
      income: parseFloat(m.income.toFixed(2)),
      incomeUSD: parseFloat(m.incomeUSD.toFixed(2)),
      expense: parseFloat(m.expense.toFixed(2)),
      expenseUSD: parseFloat(m.expenseUSD.toFixed(2)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

const getAnalysis = async (req, res, next) => {
  try {
    const source = req.query.source || 'mine';
    const partnerId = req.query.partnerId;
    if (!['mine', 'partner', 'both'].includes(source)) return res.status(400).json({error: 'source invalido'});
    const { from, to } = resolveDateRange(req.query);
    const shared = await sharedAccountsAnalysis(req.userId, from, to, req.query);

    if (source === 'mine') {
      const mine = await computeUserAnalysis(req.userId, req.query, 'mine');
      return res.json({ mine, shared });
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
      return res.json({ partner, shared });
    }

    // source === 'both'
    const [mine, partner] = await Promise.all([
      computeUserAnalysis(req.userId, req.query, 'mine'),
      computeUserAnalysis(partnerId, req.query, 'partner'),
    ]);
    const mergedMonthly = mergeMonthly(mine, partner);
    res.json({
      mine, partner, shared,
      combined: {
        kpis: mergeCombinedKpis(mine, partner),
        monthlySeries: mergedMonthly,
        currencyComparison: mergedMonthly.map(m => ({ month: m.month, expenseARS: m.expense, expenseUSD: m.expenseUSD })),
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
        topExpenses: [
          ...(mine.topExpenses || []).map(a => ({ ...a, owner: 'mine' })),
          ...(partner.topExpenses || []).map(a => ({ ...a, owner: 'partner' })),
        ].sort((a, b) => b.amount - a.amount).slice(0, 10),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getAnalysis, computeUserAnalysis, resolveDateRange, resolvePriorRange, rollingMonths, buildAccountFilter, parseListParam };

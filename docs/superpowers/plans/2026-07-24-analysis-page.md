# Página "Análisis" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, independent "Análisis" dashboard section (multi-account balance evolution, credit debt, ARS/USD comparison, mine/partner/both filtering) backed by a single new `GET /api/analysis` endpoint that pushes aggregation into Postgres via Prisma `aggregate`/`groupBy` and one raw SQL group-by-month query.

**Architecture:** Backend: one new controller (`analysis.controller.js`) computing KPIs/category breakdown via Prisma `aggregate`/`groupBy`, monthly income/expense series via `$queryRaw` (rolling 12 months, ignores the point-in-time filter), and account balance series/current balance/credit debt by reusing the existing `calcBalances` pattern from `accounts.controller.js` over already-fetched account+transaction data (no extra queries). Frontend: one new page (`AnalysisPage.jsx`) reusing `DashboardFilters`, `KpiCard`, `CategoryMultiSelect`, and the `CalculatorPage.jsx` mine/partner/both `source` pattern, plus two new chart components and one new `AccountMultiSelect`.

**Tech Stack:** Node.js/Express/Prisma (Postgres), React 18/Vite/Tailwind/Recharts — same as the rest of the app. No new dependencies. Spec: `docs/superpowers/specs/2026-07-24-analysis-page-design.md`.

**Testing note:** No automated test framework exists in this project (confirmed: no test files, no test script in `backend/package.json` or `frontend/package.json`). Every task is verified manually — backend tasks via `curl` against the local dev server, frontend tasks via the browser — matching the established convention in this codebase.

---

## Task 1: Backend — date helpers, KPIs, category breakdown

**Files:**
- Create: `backend/src/controllers/analysis.controller.js`
- Create: `backend/src/routes/analysis.js`
- Modify: `backend/server.js` (mount the route)

- [ ] **Step 1: Create the controller with date-range helpers, KPI aggregation, and category breakdown (mine-only for now)**

Create `backend/src/controllers/analysis.controller.js`:

```js
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

async function computeUserAnalysis(userId, query, owner) {
  const { from, to } = resolveDateRange(query);
  const prior = resolvePriorRange({ from, to }, query);
  const kpis = await computeKpis(userId, query, from, to, prior);
  const catBreakdown = await categoryBreakdown(userId, query, from, to);
  return { owner, range: { from, to }, kpis, categoryBreakdown: catBreakdown.ARS, categoryBreakdownUSD: catBreakdown.USD, topCategories: catBreakdown.ARS.slice(0, 5) };
}

const getAnalysis = async (req, res, next) => {
  try {
    const result = await computeUserAnalysis(req.userId, req.query, 'mine');
    res.json({ mine: result });
  } catch (err) { next(err); }
};

module.exports = { getAnalysis, computeUserAnalysis, resolveDateRange, resolvePriorRange, rollingMonths, buildAccountFilter, parseListParam };
```

- [ ] **Step 2: Create the route file**

Create `backend/src/routes/analysis.js`:

```js
const router = require('express').Router();
const { getAnalysis } = require('../controllers/analysis.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', getAnalysis);

module.exports = router;
```

- [ ] **Step 3: Mount the route in `server.js`**

In `backend/server.js`, replace:
```js
const transferRoutes      = require('./src/routes/transfers');
```
with:
```js
const transferRoutes      = require('./src/routes/transfers');
const analysisRoutes      = require('./src/routes/analysis');
```
and replace:
```js
app.use('/api/transfers',       transferRoutes);
```
with:
```js
app.use('/api/transfers',       transferRoutes);
app.use('/api/analysis',        analysisRoutes);
```

- [ ] **Step 4: Verify manually**

Run `cd backend && npm run dev`, then in another terminal (replace `<TOKEN>` with a JWT from logging in via `/api/auth/login`):

```bash
curl -s http://localhost:3001/api/analysis?month=2026-07 -H "Authorization: Bearer <TOKEN>" | head -c 2000
```

Expected: JSON with `mine.kpis.income`, `mine.kpis.expense`, `mine.categoryBreakdown` (array with `name`/`amount`/`percentage`), `mine.topCategories` (max 5 items), `mine.kpis.variation.income` as a number or `null`. Cross-check `income`/`expense` roughly match what `GET /api/dashboard?month=2026-07` reports for the same user (same underlying data, different aggregation method).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/analysis.controller.js backend/src/routes/analysis.js backend/server.js
git commit -m "feat: endpoint /api/analysis con KPIs y breakdown de categorías (agregación DB)"
```

---

## Task 2: Backend — monthly series (rolling 12 months) + currency comparison

**Files:**
- Modify: `backend/src/controllers/analysis.controller.js`

- [ ] **Step 1: Add the raw-SQL monthly series function**

In `backend/src/controllers/analysis.controller.js`, replace:
```js
const prisma = require('../utils/prisma');
const { calcBalances } = require('./accounts.controller');
```
with:
```js
const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const { calcBalances } = require('./accounts.controller');
```

Then, directly above `async function computeUserAnalysis(userId, query, owner) {`, insert:

```js
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
```

- [ ] **Step 2: Wire it into `computeUserAnalysis` and derive `currencyComparison` from it**

Replace:
```js
async function computeUserAnalysis(userId, query, owner) {
  const { from, to } = resolveDateRange(query);
  const prior = resolvePriorRange({ from, to }, query);
  const kpis = await computeKpis(userId, query, from, to, prior);
  const catBreakdown = await categoryBreakdown(userId, query, from, to);
  return { owner, range: { from, to }, kpis, categoryBreakdown: catBreakdown.ARS, categoryBreakdownUSD: catBreakdown.USD, topCategories: catBreakdown.ARS.slice(0, 5) };
}
```
with:
```js
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
```

- [ ] **Step 3: Verify manually**

Restart the backend dev server if needed, then:

```bash
curl -s "http://localhost:3001/api/analysis?month=2026-07" -H "Authorization: Bearer <TOKEN>" | python -m json.tool | grep -A5 monthlySeries
```

Expected: `mine.monthlySeries` is an array of exactly 12 objects (`month`, `income`, `expense`, `expenseUSD`), months ascending, ending in the current month, regardless of the `month=2026-07` point filter. `mine.currencyComparison` has the same 12 months with `expenseARS`/`expenseUSD`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/analysis.controller.js
git commit -m "feat: serie mensual de 12 meses (rolling) y comparativa ARS vs USD"
```

---

## Task 3: Backend — accounts detail, balance series, credit debt, recent activity

**Files:**
- Modify: `backend/src/controllers/analysis.controller.js`

- [ ] **Step 1: Add a balance-at-date helper and the accounts/credit-debt/balance-series function**

Insert directly above `async function computeUserAnalysis(userId, query, owner) {`:

```js
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
```

- [ ] **Step 2: Wire both into `computeUserAnalysis`**

Replace:
```js
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
```
with:
```js
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
```

- [ ] **Step 3: Verify manually**

```bash
curl -s "http://localhost:3001/api/analysis?month=2026-07" -H "Authorization: Bearer <TOKEN>" | python -m json.tool
```

Expected: `mine.accounts` lists every personal account with `balance`/`balanceUSD`/`variationPct`; `mine.kpis.creditDebt` is a non-negative number (0 if no CREDIT accounts are overdrawn); `mine.kpis.balance`/`mine.kpis.balanceUSD` equal the sum of all `mine.accounts[].balance`/`balanceUSD` (the consolidated "Balance total" KPI, per spec §2); `mine.accountBalanceSeries` has entries only from each account's creation month onward; `mine.recentActivity` has up to 10 items sorted by date descending, each with `kind: 'transaction'|'transfer'`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/analysis.controller.js
git commit -m "feat: detalle de cuentas, serie de saldo, deuda de tarjetas y actividad reciente"
```

---

## Task 4: Backend — source filter (mine/partner/both)

**Files:**
- Modify: `backend/src/controllers/analysis.controller.js`

- [ ] **Step 1: Add partnership authorization + the `both` merge logic**

Replace:
```js
const getAnalysis = async (req, res, next) => {
  try {
    const result = await computeUserAnalysis(req.userId, req.query, 'mine');
    res.json({ mine: result });
  } catch (err) { next(err); }
};
```
with:
```js
function mergeCombinedKpis(mine, partner) {
  const sum = (a, b) => parseFloat(((a || 0) + (b || 0)).toFixed(2));
  return {
    income: sum(mine.kpis.income, partner.kpis.income),
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
  for (const m of mine.monthlySeries) map[m.month] = { month: m.month, income: m.income, expense: m.expense, expenseUSD: m.expenseUSD, partnerIncome: 0, partnerExpense: 0, partnerExpenseUSD: 0 };
  for (const m of partner.monthlySeries) {
    if (!map[m.month]) map[m.month] = { month: m.month, income: 0, expense: 0, expenseUSD: 0, partnerIncome: 0, partnerExpense: 0, partnerExpenseUSD: 0 };
    map[m.month].partnerIncome = m.income; map[m.month].partnerExpense = m.expense; map[m.month].partnerExpenseUSD = m.expenseUSD;
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
```

- [ ] **Step 2: Verify manually**

With two demo accounts linked via an ACCEPTED partnership (or reuse an existing linked pair from earlier manual testing):

```bash
curl -s "http://localhost:3001/api/analysis?source=both&partnerId=<PARTNER_ID>&month=2026-07" -H "Authorization: Bearer <TOKEN>" | python -m json.tool | head -50
```

Expected: response has `mine`, `partner`, and `combined` keys; `combined.kpis.income` equals `mine.kpis.income + partner.kpis.income`; `combined.accounts` items each have an `owner` field. Also verify `source=partner` alone returns 403 with a made-up `partnerId` that has no accepted partnership.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/analysis.controller.js
git commit -m "feat: filtro de fuente mine/partner/both en /api/analysis"
```

---

## Task 5: Frontend — `AccountMultiSelect` component

**Files:**
- Create: `frontend/src/components/ui/AccountMultiSelect.jsx`

- [ ] **Step 1: Write the component (same pattern as `CategoryMultiSelect.jsx`)**

```jsx
import { useState, useRef, useEffect } from 'react';

export default function AccountMultiSelect({ accounts, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = accounts.length > 0 && selected.length === accounts.length;
  const toggleAll = () => onChange(allSelected ? [] : accounts.map(a => a.id));
  const toggleOne = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const label = accounts.length === 0
    ? 'Sin cuentas disponibles'
    : allSelected ? `Todas (${accounts.length})`
    : selected.length === 0 ? 'Todas las cuentas'
    : `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative">
      <button type="button" disabled={accounts.length === 0} onClick={() => setOpen(o => !o)}
        className="input text-xs w-full flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed">
        <span className="truncate">{label}</span>
        <span className="text-[var(--subtle)] ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && accounts.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-surface2 shadow-2xl">
          <button type="button" onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text2)] hover:bg-surface3 border-b border-[var(--border)]">
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
              {allSelected && '✓'}
            </span>
            Seleccionar todas
          </button>
          {accounts.map(a => {
            const isChecked = selected.includes(a.id);
            return (
              <button key={a.id} type="button" onClick={() => toggleOne(a.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text2)] hover:bg-surface3">
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-accent border-accent' : 'border-[var(--border2)]'}`}>
                  {isChecked && '✓'}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color || '#8A8478' }} />
                <span className="truncate flex-1 text-left">{a.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build` — expected: build succeeds (unused file, syntax-only check; becomes reachable in Task 6).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/AccountMultiSelect.jsx
git commit -m "feat: componente AccountMultiSelect con opción seleccionar todas"
```

---

## Task 6: Frontend — new chart components

**Files:**
- Modify: `frontend/src/components/charts/Charts.jsx`

- [ ] **Step 1: Add `AccountBalanceLineChart` and `CurrencyComparisonChart`**

At the end of `frontend/src/components/charts/Charts.jsx` (after the closing brace of `CategoryChartSelector`), append:

```jsx
// ── Account balance evolution (one line per account, includes CREDIT accounts) ──
export function AccountBalanceLineChart({ data }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-48 text-[var(--subtle)] text-sm">Sin datos de saldo</div>
  );
  const accountIds = [...new Set(data.map(d => d.accountId))];
  const accountNames = Object.fromEntries(data.map(d => [d.accountId, d.accountName]));
  const months = [...new Set(data.map(d => d.month))].sort();
  const byMonth = months.map(month => {
    const row = { month };
    for (const id of accountIds) {
      const point = data.find(d => d.accountId === id && d.month === month);
      if (point) row[id] = point.balance;
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={byMonth} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{v}</span>} />
        {accountIds.map((id, i) => (
          <Line key={id} type="monotone" dataKey={id} name={accountNames[id]} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── ARS vs USD expense comparison (grouped bars per month) ──────────────────
export function CurrencyComparisonChart({ data }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-48 text-[var(--subtle)] text-sm">Sin datos</div>
  );
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{v}</span>} />
        <Bar dataKey="expenseARS" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Gastos ARS" />
        <Bar dataKey="expenseUSD" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Gastos USD" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build` — expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/Charts.jsx
git commit -m "feat: gráficos de saldo por cuenta y comparativa ARS vs USD"
```

---

## Task 7: Frontend — `AnalysisPage.jsx` (filters, KPIs, charts)

**Files:**
- Create: `frontend/src/pages/AnalysisPage.jsx`

- [ ] **Step 1: Write the page — filters, data fetching, KPI row, and the 2×2 chart grid**

```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/format';
import KpiCard from '../components/ui/KpiCard';
import DashboardFilters from '../components/ui/DashboardFilters';
import AccountMultiSelect from '../components/ui/AccountMultiSelect';
import CategoryMultiSelect from '../components/ui/CategoryMultiSelect';
import { MonthlyChartSelector, CategoryChartSelector, AccountBalanceLineChart, CurrencyComparisonChart } from '../components/charts/Charts';

const sourceType = src => src.includes(':') ? src.split(':')[0] : src;
const getPartnerId = src => src.includes(':') ? src.split(':')[1] : null;

const defaultFilters = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { month: `${now.getFullYear()}-${m}` };
};

export default function AnalysisPage() {
  const [partnerships, setPartnerships] = useState([]);
  const [source, setSource] = useState('mine'); // 'mine' | 'partner:<id>' | 'both:<id>'
  const [filters, setFilters] = useState(defaultFilters());
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedCats, setSelectedCats] = useState([]);
  const [currency, setCurrency] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/partnerships').then(r => setPartnerships((r.data || []).filter(p => p.status === 'ACCEPTED'))).catch(() => {});
    api.get('/accounts').then(r => setAccounts(r.data)).catch(() => {});
    api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const stype = sourceType(source);
  const pid = getPartnerId(source);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('source', stype);
    if (pid) params.set('partnerId', pid);
    if (selectedAccounts.length) params.set('accountIds', selectedAccounts.join(','));
    if (selectedCats.length) params.set('categoryIds', selectedCats.join(','));
    if (currency) params.set('currency', currency);
    return params;
  }, [filters, stype, pid, selectedAccounts, selectedCats, currency]);

  useEffect(() => {
    setLoading(true);
    api.get(`/analysis?${buildParams()}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [buildParams]);

  const view = stype === 'both' ? data?.combined : stype === 'partner' ? data?.partner : data?.mine;

  const addAccountFilter = (id) => setSelectedAccounts(prev => prev.includes(id) ? prev : [...prev, id]);
  const addCategoryFilter = (id) => setSelectedCats(prev => prev.includes(id) ? prev : [...prev, id]);

  if (loading && !data) return <div className="flex items-center justify-center h-96 text-[var(--subtle)]">Cargando...</div>;
  const kpis = view?.kpis;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Análisis</h1>
        <p className="text-[var(--muted)] text-sm mt-0.5">Patrimonio, saldos por cuenta y deuda a través del tiempo</p>
      </div>

      {partnerships.length > 0 && (
        <div className="flex gap-1 bg-surface3 p-1 rounded-xl border border-[var(--border)] w-fit">
          <button onClick={() => setSource('mine')} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${stype === 'mine' ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>Mío</button>
          {partnerships.map(p => (
            <div key={p.partner.id} className="flex gap-1">
              <button onClick={() => setSource(`partner:${p.partner.id}`)} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${source === `partner:${p.partner.id}` ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>{p.partner.name}</button>
              <button onClick={() => setSource(`both:${p.partner.id}`)} className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${source === `both:${p.partner.id}` ? 'bg-accent text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>Ambos</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <DashboardFilters filters={filters} onChange={setFilters} showAccountFilter={false} />
        <div className="w-48"><AccountMultiSelect accounts={accounts} selected={selectedAccounts} onChange={setSelectedAccounts} /></div>
        <div className="w-56"><CategoryMultiSelect categories={categories.map(c => ({ ...c, owner: 'mine' }))} selected={selectedCats} onChange={setSelectedCats} showOwner={false} /></div>
        <select className="input text-xs w-auto" value={currency} onChange={e => setCurrency(e.target.value)}>
          <option value="">Todas las monedas</option>
          <option value="ARS">$ ARS</option>
          <option value="USD">U$D USD</option>
        </select>
        {(selectedAccounts.length > 0 || selectedCats.length > 0) && (
          <div className="flex gap-2 flex-wrap">
            {selectedAccounts.map(id => {
              const acc = accounts.find(a => a.id === id);
              return <span key={id} className="text-xs bg-surface3 border border-[var(--border)] rounded-full px-2.5 py-1 flex items-center gap-1.5">{acc?.name || id}<button onClick={() => setSelectedAccounts(p => p.filter(x => x !== id))} className="text-[var(--subtle)] hover:text-[var(--text)]">✕</button></span>;
            })}
            {selectedCats.map(id => {
              const cat = categories.find(c => c.id === id);
              return <span key={id} className="text-xs bg-surface3 border border-[var(--border)] rounded-full px-2.5 py-1 flex items-center gap-1.5">{cat?.name || id}<button onClick={() => setSelectedCats(p => p.filter(x => x !== id))} className="text-[var(--subtle)] hover:text-[var(--text)]">✕</button></span>;
            })}
          </div>
        )}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Balance Total ARS" value={formatCurrency(kpis.balance)} color={kpis.balance >= 0 ? 'income' : 'expense'} icon="◈" />
          <KpiCard label="Balance Total USD" value={formatCurrency(kpis.balanceUSD)} color={kpis.balanceUSD >= 0 ? 'income' : 'expense'} icon="◈" />
          <KpiCard label="Ingresos" value={formatCurrency(kpis.income)} color="income" icon="↑" trend={kpis.variation?.income} />
          <KpiCard label="Gastos ARS" value={formatCurrency(kpis.expense)} color="expense" icon="↓" trend={kpis.variation?.expense} />
          <KpiCard label="Gastos USD" value={formatCurrency(kpis.expenseUSD)} color="expense" icon="↓" trend={kpis.variation?.expenseUSD} />
          <KpiCard label="Neto" value={formatCurrency(kpis.net)} color={kpis.net >= 0 ? 'income' : 'expense'} icon="⚖️" />
          <KpiCard label="Deuda Tarjetas" value={formatCurrency(kpis.creditDebt)} color={kpis.creditDebt > 0 ? 'expense' : 'neutral'} icon="💳" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {view?.monthlySeries?.length > 0 && (
          <MonthlyChartSelector data={view.monthlySeries} />
        )}
        {view?.categoryBreakdown?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos por Categoría</h2>
            <div className="flex flex-col gap-1">
              {view.categoryBreakdown.slice(0, 8).map(c => (
                <button key={c.categoryId} onClick={() => addCategoryFilter(c.categoryId)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface3 text-left text-xs">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                  <span className="font-mono">{formatCurrency(c.amount)} · {c.percentage}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {view?.accountBalanceSeries?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Saldo por Cuenta</h2>
            <AccountBalanceLineChart data={view.accountBalanceSeries} />
          </div>
        )}
        {view?.currencyComparison?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos ARS vs USD</h2>
            <CurrencyComparisonChart data={view.currencyComparison} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build` — expected: build succeeds (page not routed yet, syntax-only check).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx
git commit -m "feat: página Análisis con filtros, KPIs y grilla de gráficos"
```

---

## Task 8: Frontend — tables, account drill-down, route, and nav entry

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Layout.jsx`

- [ ] **Step 1: Add the three tables (top categories already shown above; add accounts + recent activity) to `AnalysisPage.jsx`**

Replace the closing of the chart grid:
```jsx
        {view?.currencyComparison?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos ARS vs USD</h2>
            <CurrencyComparisonChart data={view.currencyComparison} />
          </div>
        )}
      </div>
    </div>
  );
}
```
with:
```jsx
        {view?.currencyComparison?.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Gastos ARS vs USD</h2>
            <CurrencyComparisonChart data={view.currencyComparison} />
          </div>
        )}
      </div>

      {view?.accounts?.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Detalle de Cuentas</h2>
          <div className="divide-y divide-[var(--border)]">
            {view.accounts.map(a => (
              <button key={a.id} onClick={() => addAccountFilter(a.id)}
                className="w-full flex items-center justify-between py-2.5 text-left hover:bg-surface3/40 px-2 rounded-lg transition-colors">
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
                  {a.name}
                  {stype === 'both' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${a.owner === 'partner' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {a.owner === 'partner' ? 'Partner' : 'Yo'}
                    </span>
                  )}
                </span>
                <span className="text-right font-mono text-sm">
                  {formatCurrency(a.balance)}
                  {a.variationPct !== null && a.variationPct !== undefined && (
                    <span className={`ml-2 text-xs ${a.variationPct >= 0 ? 'text-income' : 'text-expense'}`}>
                      {a.variationPct >= 0 ? '▲' : '▼'} {Math.abs(a.variationPct)}%
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view?.recentActivity?.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-display font-bold text-[var(--text)] mb-4">Últimos Movimientos</h2>
          <div className="divide-y divide-[var(--border)]">
            {view.recentActivity.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span>{item.kind === 'transfer' ? '↔' : item.type === 'INCOME' ? '↑' : '↓'}</span>
                  <span className="text-[var(--muted)]">{new Date(item.date).toLocaleDateString('es-AR')}</span>
                  <span>{item.kind === 'transfer' ? `${item.fromName} → ${item.toName}` : (item.categoryName || item.comment || 'Sin categoría')}</span>
                </span>
                <span className="font-mono">{item.currency === 'USD' ? 'U$D' : '$'} {item.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route in `App.jsx`**

Replace:
```jsx
import CalculatorPage      from './pages/CalculatorPage';
import Layout              from './components/layout/Layout';
```
with:
```jsx
import CalculatorPage      from './pages/CalculatorPage';
import AnalysisPage        from './pages/AnalysisPage';
import Layout              from './components/layout/Layout';
```
and replace:
```jsx
            <Route path="calculator"            element={<CalculatorPage />} />
```
with:
```jsx
            <Route path="calculator"            element={<CalculatorPage />} />
            <Route path="analysis"              element={<AnalysisPage />} />
```

- [ ] **Step 3: Add the nav entry in `Layout.jsx`**

Replace:
```jsx
const NAV_ITEMS = [
  { to: '/',             icon: '⬡', label: 'Mi Dashboard',  end: true },
  { to: '/transactions', icon: '↕', label: 'Transacciones' },
  { to: '/calculator',   icon: '🧮', label: 'Calculadora' },
  { to: '/categories',   icon: '◑', label: 'Categorías' },
  { to: '/accounts',     icon: '◈', label: 'Cuentas' },
  { to: '/partnerships', icon: '⊕', label: 'Vínculos', badge: true },
  { to: '/profile',      icon: '◎', label: 'Mi Cuenta' },
];
```
with:
```jsx
const NAV_ITEMS = [
  { to: '/',             icon: '⬡', label: 'Mi Dashboard',  end: true },
  { to: '/transactions', icon: '↕', label: 'Transacciones' },
  { to: '/calculator',   icon: '🧮', label: 'Calculadora' },
  { to: '/analysis',     icon: '📈', label: 'Análisis' },
  { to: '/categories',   icon: '◑', label: 'Categorías' },
  { to: '/accounts',     icon: '◈', label: 'Cuentas' },
  { to: '/partnerships', icon: '⊕', label: 'Vínculos', badge: true },
  { to: '/profile',      icon: '◎', label: 'Mi Cuenta' },
];
```

- [ ] **Step 4: Verify in the browser**

Run backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm run dev`), log in, click **Análisis** in the sidebar:
- Filters bar shows (source toggle only if a partnership exists), date mode, account multi-select, category multi-select, currency selector.
- KPI row renders with real numbers matching what's visible in **Mi Dashboard** / **Cuentas** for the same month.
- All 4 charts render (income vs expense, category breakdown list, balance-per-account line chart, ARS vs USD bars) — the two evolution charts show a 12-month window even when the date filter is set to a single month.
- Clicking a category in the breakdown list, or an account in the accounts table, adds a removable filter chip and the whole page recalculates (all API calls refire on any filter change).
- If a partnership exists, switching source to the partner's name or "Ambos" changes the data shown, and "Ambos" color-codes mine (emerald) vs partner (orange) in the accounts table.
- Resize to mobile width — KPI row and chart grid collapse to a single column without horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx frontend/src/App.jsx frontend/src/components/layout/Layout.jsx
git commit -m "feat: tablas, drill-down por cuenta, ruta y entrada de menú para Análisis"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Filtros globales (fecha/cuenta/moneda/categoría + fuente) → Tasks 4, 5, 7. KPIs (balance por cuenta y consolidado, ingresos, gastos, neto, deuda, variación %) → Tasks 1, 3, 4, 7. Los 4 gráficos pedidos → Task 6/7 (ingresos vs gastos reusa `MonthlyChartSelector`; distribución de categorías vía lista clickeable — ver nota abajo; saldo por cuenta → `AccountBalanceLineChart`; ARS vs USD → `CurrencyComparisonChart`). Tablas (top categorías, últimos movimientos, detalle de cuentas) → Task 3 (backend) + Task 8 (frontend). Drill-down por categoría/cuenta con filtros combinables → Task 8. Ruta/nav nueva → Task 8. Backend Node/Prisma con agregación DB → Tasks 1-4.
- **Deviation from spec noted:** the spec called for a torta/barras chart selector for category distribution (reusing `CategoryChartSelector`); Task 7 instead renders a clickable ranked list (top 8) because the backend's `categoryBreakdown` doesn't include the per-item transaction detail (`items`) that `CategoryChartSelector`'s pie/bar chart data shape expects, and adding that would mean re-fetching per-category transactions — out of scope for a first version. The clickable list still satisfies "distribución de gastos por categoría" and the drill-down requirement; a follow-up could swap it for the full chart selector once `categoryBreakdown` is extended with per-item detail.
- **Type/prop consistency:** `computeUserAnalysis`'s return shape (`kpis`, `categoryBreakdown`, `topCategories`, `monthlySeries`, `currencyComparison`, `accounts`, `accountBalanceSeries`, `recentActivity`) is defined once in Task 3 and consumed identically by `getAnalysis` (Task 4) and `AnalysisPage.jsx` (Tasks 7-8). `AccountMultiSelect`'s props (`accounts`, `selected`, `onChange`) match between Task 5's definition and Task 7's usage. Chart component props (`AccountBalanceLineChart({ data })`, `CurrencyComparisonChart({ data })`) match between Task 6's definition and Task 7's usage.
- **No backend schema changes** — confirmed no new Prisma models/fields needed, per the approved spec's descoping of due-dates/budgets.

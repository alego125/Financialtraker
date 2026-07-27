# Página "Análisis" — Design Spec

**Date:** 2026-07-24
**Status:** Approved (pending implementation plan)

## Goal

Add a new, independent dashboard section ("Análisis") focused on multi-account net worth, balance evolution over time, credit card debt, and ARS/USD comparison — none of which exist today anywhere in the app. This is explicitly a **new page**, not a modification of the existing `DashboardPage.jsx` ("Mi Dashboard" at `/`), which stays focused on monthly category spend.

## Context / Decisions Made During Brainstorming

- **Stack:** Node.js/Express/Prisma, same as the rest of the app. No Python — a second backend runtime would add operational cost (auth, deploy) with no functional benefit, since Prisma already supports the aggregations needed.
- **Credit card debt:** there is no dedicated "credit card" entity in the schema (no limit, no due date). Debt = sum of transactions/initial balance for accounts with `accountType='CREDIT'`, taken as a negative balance. No "vencimiento" (due date) alert — that data doesn't exist and adding it is out of scope.
- **"Gasto excesivo" alert:** descoped entirely for this iteration. There's no budget/limit concept in the schema; adding one is a separate feature, not part of a dashboard page.
- **Scope of accounts:** personal accounts, partner's accounts (if an `ACCEPTED` `Partnership` exists), or both combined — via a **Fuente** filter (`mine` / `partner` / `both`), mirroring the pattern already used in `CalculatorPage.jsx`'s `source` filter.
- **Multi-currency:** ARS and USD are never summed into one number. Every KPI/chart that involves money shows both currencies separately (same convention as the rest of the app).
- **Credit chart:** no separate "progreso de pago de tarjeta" chart. Credit accounts are just another series in the "saldo por cuenta a través del tiempo" line chart — avoids duplicating the same data in two widgets.
- **Layout:** single continuous scroll page (filters → KPI row → 2×2 chart grid → tables), chosen over a tabbed layout so KPIs/charts are all visible without extra clicks (validated via visual mockup in the brainstorming session).
- **Drill-down:** clicking a category (in the category chart) or an account (in the balance chart, legend, or accounts table) **adds** that as a filter chip on top of whatever filters are already active (date, currency, etc.) — it does not reset other filters. Each chip is individually removable.
- **Evolution charts window:** the two time-series charts (income vs expense, balance per account) always show a rolling **last 12 months**, independent of the point-in-time date filter (month/year/range). The point-in-time filter still governs KPIs, the category chart, and all tables. This is necessary because a single-month filter would otherwise leave the trend charts with one data point.
- **Backend aggregation:** existing `dashboard.controller.js` fetches filtered transactions and computes KPIs in JS (`computeKpis`). For Análisis, we improve on this pattern and push aggregation into the database via Prisma `aggregate`/`groupBy` (and one `$queryRaw` with `date_trunc('month', ...)` for the monthly time series, since Prisma has no portable "group by month" primitive) — meeting the requirement to keep filtering performant as transaction volume grows.

## Architecture

### Frontend
- **Route:** `/analysis`, added to `frontend/src/App.jsx` inside the existing `<Layout>` route block.
- **Nav entry:** "Análisis" added to `NAV_ITEMS` in `frontend/src/components/layout/Layout.jsx`.
- **Page:** `frontend/src/pages/AnalysisPage.jsx` (new).
- **New components** (`frontend/src/components/ui/`):
  - `AccountMultiSelect.jsx` — new, same checkbox+"select all" pattern as the existing `CategoryMultiSelect.jsx`.
- **New chart components** (added to `frontend/src/components/charts/Charts.jsx`):
  - `AccountBalanceLineChart` — multi-series line chart, one line per account (including CREDIT accounts), over the rolling 12-month window.
  - `CurrencyComparisonChart` — grouped bar chart, ARS spend vs USD spend per month.
- **Reused components:** `DashboardFilters` (date mode), `CategoryMultiSelect`, `KpiCard`, `MonthlyChartSelector`, `CategoryChartSelector`, `CustomTooltip`/`PieTooltip`, the existing mine/partner color convention (emerald/orange).

### Backend
- **Route:** `backend/src/routes/analysis.js` (new) → `authenticate` middleware → `backend/src/controllers/analysis.controller.js` (new). Mounted in `backend/server.js` as `/api/analysis`.
- **Endpoint:** single `GET /api/analysis`, query params:
  - `source`: `mine` | `partner` | `both` (default `mine`)
  - `partnerId`: required when `source !== 'mine'`
  - `mode`: `month` | `year` | `range` (mirrors `DashboardFilters`), plus `month`/`year`/`dateFrom`/`dateTo` as applicable
  - `accountIds[]`: optional, filters to specific personal/shared accounts
  - `currency`: `ARS` | `USD` | omitted (both)
  - `categoryIds[]`: optional
- **Authorization for `partner`/`both`:** before touching the partner's data, verify an `ACCEPTED` `Partnership` between the requesting user and `partnerId` exists — same `where: { status: 'ACCEPTED', OR: [...] }` check already used in `dashboard.controller.js` (`getSharedDashboard`) and `transfers.controller.js`.
- **Response shape** (single JSON payload):
  ```jsonc
  {
    "kpis": {
      "balanceARS": 0, "balanceUSD": 0,
      "income": 0, "expense": 0, "net": 0,
      "creditDebt": 0,
      "variation": { "income": 0.0, "expense": 0.0, "net": 0.0, "creditDebt": 0.0 } // % vs prior period
    },
    "monthlySeries": [{ "month": "2026-01", "income": 0, "expense": 0, "incomeUSD": 0, "expenseUSD": 0, "owner": "mine"|"partner" }],
    "accountBalanceSeries": [{ "month": "2026-01", "accountId": "...", "accountName": "...", "accountType": "REGULAR", "balance": 0, "owner": "mine"|"partner" }],
    "categoryBreakdown": [{ "categoryId": "...", "name": "...", "color": "...", "amount": 0, "percentage": 0, "owner": "mine"|"partner" }],
    "topCategories": [/* top 5 by amount, same shape as categoryBreakdown */],
    "currencyComparison": [{ "month": "2026-01", "expenseARS": 0, "expenseUSD": 0 }],
    "recentActivity": [{ "id": "...", "kind": "transaction"|"transfer", "date": "...", "amount": 0, "currency": "ARS", ... }], // last 10, merged & sorted desc
    "accounts": [{ "id": "...", "name": "...", "accountType": "REGULAR", "balance": 0, "balanceUSD": 0, "variationPct": 0, "owner": "mine"|"partner" }]
  }
  ```
- **Aggregation implementation notes:**
  - KPIs: `prisma.transaction.aggregate({ where, _sum: { amount: true } })` per type/currency, instead of summing fetched rows in JS.
  - Category breakdown / top categories: `prisma.transaction.groupBy({ by: ['categoryId'], where, _sum: { amount: true } })`.
  - Monthly series (income/expense) and account balance series: `$queryRaw` using Postgres `date_trunc('month', date)` grouped by month (and by `accountId` for the balance series), since this isn't expressible via Prisma's query builder.
  - Credit debt: filter accounts `accountType = 'CREDIT'`, compute `initialBalance + sum(transactions for that account)`, take the negative portion.
  - "Prior period" for variation %: same convention as `dashboard.controller.js` today — `month` mode compares to the previous calendar month; `year` mode compares to the previous calendar year; `range` mode compares to an immediately-preceding range of equal length.
  - `source='both'`: run the above once for `userId` and once for the partner's `userId` (post-authorization), tag each result row with `owner: 'mine'|'partner'`, and merge server-side before responding — frontend just renders using the existing mine/partner color convention.

## Out of Scope (this iteration)

- "Gasto excesivo" spending alerts (no budget concept exists).
- Credit card due-date tracking / expiration alerts (no due-date field exists).
- Any change to the existing `DashboardPage.jsx` or its `/api/dashboard` endpoints.

## Testing

No automated test framework exists in this project (confirmed convention from prior specs). Verification is manual via the dev server: apply each filter combination (source, date mode, account, currency, category), confirm KPIs/charts/tables update, confirm drill-down chips add/remove correctly, confirm `both` mode color-codes mine vs partner data, confirm large date ranges don't cause a slow response (spot-check query timing).

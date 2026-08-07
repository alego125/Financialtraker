# Graph Report - .  (2026-08-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 470 nodes · 881 edges · 21 communities (19 shown, 2 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.5)
- Token cost: 28,487 input · 204 output

## Graph Freshness
- Built from commit: `89722647`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard Charts & PDF
- Auth & App Routing
- Auth Controller & Security
- Frontend Dependencies
- Accounts & Exchange Logic
- Backend Dependencies
- Express Server & Routes
- Transfers Controller
- Transaction & Calculator UI
- Partnership Controller
- Shared Accounts Controller
- Dashboard Controller
- Transactions Controller
- Calculator & Category UI
- AI Analysis Panel
- Database Seed
- Email Service
- Vercel Config

## God Nodes (most connected - your core abstractions)
1. `api` - 17 edges
2. `formatDate()` - 17 edges
3. `formatCurrency()` - 16 edges
4. `authenticate()` - 15 edges
5. `useAuth()` - 12 edges
6. `generatePDF()` - 12 edges
7. `create()` - 11 edges
8. `computeUserAnalysis()` - 10 edges
9. `SharedDashboardPage()` - 9 edges
10. `calcBalances()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Card()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/PartnershipsPage.jsx → frontend/src/utils/format.js
- `getAccountBalance()` --calls--> `calcBalances()`  [EXTRACTED]
  backend/src/controllers/transfers.controller.js → backend/src/controllers/accounts.controller.js
- `TransfersTab()` --references--> `jspdf`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/package.json
- `TransfersTab()` --references--> `xlsx`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/package.json
- `generateExcel()` --references--> `xlsx`  [EXTRACTED]
  frontend/src/utils/excelExport.js → frontend/package.json

## Import Cycles
- None detected.

## Communities (21 total, 2 thin omitted)

### Community 0 - "Dashboard Charts & PDF"
Cohesion: 0.06
Nodes (57): jspdf, AccountBalanceLineChart(), CategoryBarChart(), CategoryChartSelector(), CHART_OPTIONS_CATEGORY, CHART_OPTIONS_MONTHLY, COLORS, CurrencyComparisonChart() (+49 more)

### Community 1 - "Auth & App Routing"
Cohesion: 0.09
Nodes (33): App(), PrivateRoute(), PublicRoute(), Layout(), NAV_ITEMS, useIsMobile(), useTheme(), CategoryModal() (+25 more)

### Community 2 - "Auth Controller & Security"
Cohesion: 0.06
Nodes (37): analyzeFinances(), bcrypt, crypto, forgotPassword(), jwt, login(), me(), prisma (+29 more)

### Community 3 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (41): autoprefixer, axios, date-fns, @emailjs/browser, dependencies, axios, date-fns, @emailjs/browser (+33 more)

### Community 4 - "Accounts & Exchange Logic"
Cohesion: 0.12
Nodes (35): calcBalances(), create(), exchange(), list(), listExchanges(), prisma, remove(), toNum() (+27 more)

### Community 5 - "Backend Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, cors, dotenv, express, express-validator, jsonwebtoken, prisma (+24 more)

### Community 6 - "Express Server & Routes"
Cohesion: 0.07
Nodes (26): accountRoutes, allowedOrigins, app, authRoutes, categoryRoutes, cors, dashboardRoutes, { errorHandler } (+18 more)

### Community 7 - "Transfers Controller"
Cohesion: 0.15
Nodes (26): { calcBalances }, cancel(), create(), enrichTransfer(), fullUpdate(), getAccountBalance(), getOne(), getTransferCategory() (+18 more)

### Community 8 - "Transaction & Calculator UI"
Cohesion: 0.17
Nodes (20): evaluateExpression(), KEYS, MiniCalculatorModal(), Modal(), getDefaultForm(), localToday(), TransactionModal(), ACCOUNT_TYPES (+12 more)

### Community 9 - "Partnership Controller"
Cohesion: 0.22
Nodes (17): getPartnerAccounts(), getPartnerDashboard(), getPartnerData(), getPartnerSolo(), listPartnerships(), prisma, removePartnership(), respondInvitation() (+9 more)

### Community 10 - "Shared Accounts Controller"
Cohesion: 0.17
Nodes (17): create(), exchange(), list(), prisma, remove(), toNum(), update(), { validationResult } (+9 more)

### Community 11 - "Dashboard Controller"
Cohesion: 0.20
Nodes (12): buildWhere(), computeKpis(), getDashboard(), getDefaultDateFilter(), getSharedDashboard(), prisma, toNum(), { authenticate } (+4 more)

### Community 12 - "Transactions Controller"
Cohesion: 0.19
Nodes (14): buildWhere(), create(), getOne(), list(), parseLocalDate(), prisma, remove(), update() (+6 more)

### Community 13 - "Calculator & Category UI"
Cohesion: 0.39
Nodes (7): CategoryMultiSelect(), CalculatorPage(), fmtARS(), fmtDate(), fmtUSD(), getPartnerId(), sourceType()

### Community 14 - "AI Analysis Panel"
Cohesion: 0.39
Nodes (6): AIAnalysisPanel(), fmtARS(), fmtUSD(), getSectionIcon(), parseAnalysis(), SECTION_ICONS

### Community 15 - "Database Seed"
Cohesion: 0.40
Nodes (3): bcrypt, prisma, { PrismaClient }

## Knowledge Gaps
- **167 isolated node(s):** `express`, `cors`, `{ errorHandler }`, `authRoutes`, `categoryRoutes` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Frontend Dependencies` to `Dashboard Charts & PDF`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `jspdf` connect `Dashboard Charts & PDF` to `Transaction & Calculator UI`, `Frontend Dependencies`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `authenticate()` connect `Auth Controller & Security` to `Accounts & Exchange Logic`, `Transfers Controller`, `Partnership Controller`, `Shared Accounts Controller`, `Dashboard Controller`, `Transactions Controller`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `express`, `cors`, `{ errorHandler }` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Charts & PDF` be split into smaller, more focused modules?**
  _Cohesion score 0.056842105263157895 - nodes in this community are weakly interconnected._
- **Should `Auth & App Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._
- **Should `Auth Controller & Security` be split into smaller, more focused modules?**
  _Cohesion score 0.06376811594202898 - nodes in this community are weakly interconnected._
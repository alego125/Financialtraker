# Graph Report - Financialtraker  (2026-09-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 732 nodes · 1201 edges · 41 communities (34 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `134efe48`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- middlewares/auth.js
- server.js
- graphify
- ReportPage.jsx
- dependencies
- backend-server.js
- App.jsx
- 💰 FinTrack — Seguimiento de Gastos e Ingresos
- Key Implementation Notes
- transfers.controller.js
- AccountsPage.jsx
- analysis.controller.js
- Account Transfers + Calculator Improvements Implementation Plan
- sharedAccounts.js
- Charts.jsx
- accounts.js
- transactions.js
- formatDate
- Financial Tracker — 6 Mejoras (Diseño)
- investment.js
- DashboardPage.jsx
- AnalysisPage.jsx
- SharedDashboardPage.jsx
- graphify reference: extra exports and benchmark
- generatePDF
- AIAnalysisPanel.jsx
- SharedFinanceExportPanel.jsx
- graphify reference: query, path, explain
- FinanceExportPanel.jsx
- seed.js
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- TransactionsPage.jsx
- mailer.js
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- vercel.json
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `formatDate()` - 19 edges
2. `formatCurrency()` - 18 edges
3. `buildPdf()` - 15 edges
4. `useAuth()` - 14 edges
5. `graphify` - 13 edges
6. `authenticate()` - 12 edges
7. `computeUserAnalysis()` - 12 edges
8. `generatePDF()` - 12 edges
9. `What You Must Do When Invoked` - 12 edges
10. `create()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Card()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/PartnershipsPage.jsx → frontend/src/utils/format.js
- `AccountDetail()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/src/utils/format.js
- `AccountTransfersList()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/src/utils/format.js
- `TransfersTab()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/src/utils/format.js
- `accountsAnalysis()` --calls--> `calcBalances()`  [EXTRACTED]
  backend/src/controllers/analysis.controller.js → backend/src/controllers/accounts.controller.js

## Import Cycles
- None detected.

## Communities (41 total, 5 thin omitted)

### Community 0 - "middlewares/auth.js"
Cohesion: 0.07
Nodes (42): analyzeFinances(), bcrypt, crypto, forgotPassword(), jwt, login(), me(), prisma (+34 more)

### Community 1 - "server.js"
Cohesion: 0.04
Nodes (45): dependencies, bcryptjs, cors, dotenv, express, express-validator, jsonwebtoken, prisma (+37 more)

### Community 2 - "graphify"
Cohesion: 0.04
Nodes (42): graphify, For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+34 more)

### Community 3 - "ReportPage.jsx"
Cohesion: 0.09
Nodes (42): AMBER, AMBER_DARK, applyPreset(), BORDER, buildPdf(), CREAM, CREAM2, drawAccountsTable() (+34 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (40): autoprefixer, axios, date-fns, @emailjs/browser, dependencies, axios, date-fns, @emailjs/browser (+32 more)

### Community 5 - "backend-server.js"
Cohesion: 0.06
Nodes (35): accountRoutes, allowedOrigins, app, authRoutes, categoryRoutes, cors, dashboardRoutes, { errorHandler } (+27 more)

### Community 6 - "App.jsx"
Cohesion: 0.09
Nodes (28): App(), PrivateRoute(), PublicRoute(), Layout(), NAV_ITEMS, useIsMobile(), useTheme(), CategoryModal() (+20 more)

### Community 7 - "💰 FinTrack — Seguimiento de Gastos e Ingresos"
Cohesion: 0.05
Nodes (38): Architecture, Context / Decisions Made During Brainstorming, Goal, Out of Scope (this iteration), Página "Análisis" — Design Spec, Testing, Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec, Frontend (todo en `frontend/src/pages/AccountsPage.jsx`) (+30 more)

### Community 8 - "Key Implementation Notes"
Cohesion: 0.06
Nodes (29): AI Analysis, Android Configuration, Charts, Color Picker, Currency Formatting, Date Pickers, Dependencies, "Exportar IA" (FinanceExportPanel) (+21 more)

### Community 9 - "transfers.controller.js"
Cohesion: 0.14
Nodes (27): { calcBalances }, cancel(), create(), enrichTransfer(), fullUpdate(), getAccountBalance(), getOne(), getTransferCategory() (+19 more)

### Community 10 - "AccountsPage.jsx"
Cohesion: 0.14
Nodes (25): evaluateExpression(), parseExpr(), parseFactor(), parseNumber(), parseTerm(), KEYS, MiniCalculatorModal(), Modal() (+17 more)

### Community 11 - "analysis.controller.js"
Cohesion: 0.17
Nodes (26): accountsAnalysis(), balanceAtDate(), buildAccountFilter(), { calcBalances }, categoryBreakdown(), computeKpis(), computeUserAnalysis(), getAnalysis() (+18 more)

### Community 12 - "Account Transfers + Calculator Improvements Implementation Plan"
Cohesion: 0.07
Nodes (25): Account Transfers + Calculator Improvements Implementation Plan, Task 1: `TransferModal` accepts a preselected origin account, Task 2: Transfers list inside the account detail panel, Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel, Task 4: `CategoryMultiSelect` component, Task 5: Wire `CategoryMultiSelect` into the Calculator page, Task 6: Fix the Calculator's expanded per-category results table, Task 7: `MiniCalculatorModal` component with a safe expression parser (+17 more)

### Community 13 - "sharedAccounts.js"
Cohesion: 0.17
Nodes (17): create(), exchange(), list(), prisma, remove(), toNum(), update(), { validationResult } (+9 more)

### Community 14 - "Charts.jsx"
Cohesion: 0.14
Nodes (16): AccountBalanceLineChart(), CategoryBarChart(), CategoryChartSelector(), CHART_OPTIONS_CATEGORY, CHART_OPTIONS_MONTHLY, COLORS, CurrencyComparisonChart(), ExpensePieChart() (+8 more)

### Community 15 - "accounts.js"
Cohesion: 0.22
Nodes (14): calcBalances(), create(), exchange(), list(), listExchanges(), prisma, remove(), toNum() (+6 more)

### Community 16 - "transactions.js"
Cohesion: 0.19
Nodes (14): buildWhere(), create(), getOne(), list(), parseLocalDate(), prisma, remove(), update() (+6 more)

### Community 17 - "formatDate"
Cohesion: 0.22
Nodes (9): CustomTooltip(), PieTooltip(), PT_LABELS, TransactionTable(), InvestmentsPage(), localToday(), PositionModal(), formatCurrency() (+1 more)

### Community 18 - "Financial Tracker — 6 Mejoras (Diseño)"
Cohesion: 0.24
Nodes (13): 1. Edición completa de transferencias, 2. Nueva transacción desde detalle de cuenta, 3. Seleccionar todas las categorías en calculadora, 4. Pago de tarjeta de crédito, 5. Calculadora emergente en campo de monto, 6. Selección de moneda en transferencias, Financial Tracker — 6 Mejoras (Diseño), Problema (+5 more)

### Community 19 - "investment.js"
Cohesion: 0.31
Nodes (9): createPosition(), deletePosition(), listPositions(), prisma, toNum(), updatePosition(), { authenticate }, { listPositions, createPosition, updatePosition, deletePosition } (+1 more)

### Community 20 - "DashboardPage.jsx"
Cohesion: 0.31
Nodes (8): currentMonth(), currentYear(), DashboardFilters(), DashboardPage(), defaultFilters(), api, generateExcel(), PT

### Community 21 - "AnalysisPage.jsx"
Cohesion: 0.36
Nodes (8): MonthlyChartSelector(), AccountMultiSelect(), AnalysisPage(), currentMonth(), currentYear(), defaultFilters(), getPartnerId(), sourceType()

### Community 22 - "SharedDashboardPage.jsx"
Cohesion: 0.29
Nodes (7): KpiCard(), currentMonth(), fmtARS(), fmtUSD(), PT, SharedDashboardPage(), ttStyle

### Community 23 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 24 - "generatePDF"
Cohesion: 0.39
Nodes (8): jspdf, formatMonth(), COLORS, generatePDF(), setDraw(), setFill(), setTextColor(), jspdf

### Community 25 - "AIAnalysisPanel.jsx"
Cohesion: 0.39
Nodes (6): AIAnalysisPanel(), fmtARS(), fmtUSD(), getSectionIcon(), parseAnalysis(), SECTION_ICONS

### Community 26 - "SharedFinanceExportPanel.jsx"
Cohesion: 0.43
Nodes (7): buildCategoryMap(), fmtARS(), fmtUSD(), formatCatBlock(), GENERAL_CATS, isGeneral(), SharedFinanceExportPanel()

### Community 27 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 28 - "FinanceExportPanel.jsx"
Cohesion: 0.53
Nodes (5): FinanceExportPanel(), fmtARS(), fmtUSD(), GENERAL_CATS, isGeneral()

### Community 29 - "seed.js"
Cohesion: 0.40
Nodes (3): bcrypt, prisma, { PrismaClient }

### Community 30 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 31 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 32 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 33 - "TransactionsPage.jsx"
Cohesion: 0.83
Nodes (3): fmtARS(), fmtUSD(), TransactionsPage()

## Knowledge Gaps
- **323 isolated node(s):** `bcrypt`, `crypto`, `jwt`, `prisma`, `{ validationResult }` (+318 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 361 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `generatePDF`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `generatePDF()` connect `generatePDF` to `formatDate`, `DashboardPage.jsx`, `SharedDashboardPage.jsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `jspdf` connect `generatePDF` to `dependencies`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `bcrypt`, `crypto`, `jwt` to the rest of the system?**
  _323 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `middlewares/auth.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07215686274509804 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `graphify` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
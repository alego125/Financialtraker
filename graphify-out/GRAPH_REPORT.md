# Graph Report - Financialtraker  (2026-09-12)

## Corpus Check
- 106 files · ~99,728 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .example 3, .prisma 2)

## Summary
- 789 nodes · 1398 edges · 53 communities (44 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `679b9e39`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- middlewares/auth.js
- server.js
- What You Must Do When Invoked
- ReportPage.jsx
- frontend/package.json
- backend-server.js
- App.jsx
- 💰 FinTrack — Seguimiento de Gastos e Ingresos
- Key Implementation Notes
- transfers.controller.js
- AccountsPage.jsx
- analysis.controller.js
- Página "Análisis" Implementation Plan
- sharedAccounts.js
- Charts.jsx
- partnerships.js
- transactions.js
- formatCurrency
- Financial Tracker — 6 Mejoras (Diseño)
- investment.controller.js
- react
- 🚀 Guía de Deploy — FinTrack
- SharedDashboardPage.jsx
- graphify reference: extra exports and benchmark
- backend/package.json
- AIAnalysisPanel.jsx
- SharedFinanceExportPanel.jsx
- graphify reference: query, path, explain
- FinanceExportPanel.jsx
- seed.js
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- TransactionModal.jsx
- mailer.js
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- vercel.json
- extraction-spec.md
- Account Transfers + Calculator Improvements Implementation Plan
- dependencies
- Informe PDF + Página de Inversiones Implementation Plan
- Página "Análisis" — Design Spec
- Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec
- CalculatorPage.jsx
- Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan
- Account Detail Transfers + Calculator Improvements — Design
- scripts
- evaluateExpression
- CLAUDE.md
- .claude/CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `react` - 30 edges
2. `formatCurrency()` - 22 edges
3. `api` - 20 edges
4. `formatDate()` - 19 edges
5. `express-validator` - 16 edges
6. `authenticate()` - 16 edges
7. `buildPdf()` - 15 edges
8. `toNum()` - 14 edges
9. `useAuth()` - 14 edges
10. `create()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `CustomTooltip()` --calls--> `formatCurrency()`  [EXTRACTED]
  frontend/src/components/charts/Charts.jsx → frontend/src/utils/format.js
- `PieTooltip()` --calls--> `formatCurrency()`  [EXTRACTED]
  frontend/src/components/charts/Charts.jsx → frontend/src/utils/format.js
- `Card()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/PartnershipsPage.jsx → frontend/src/utils/format.js
- `getAccountBalance()` --calls--> `calcBalances()`  [EXTRACTED]
  backend/src/controllers/transfers.controller.js → backend/src/controllers/accounts.controller.js
- `PrivateRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/App.jsx → frontend/src/hooks/useAuth.jsx

## Import Cycles
- None detected.

## Communities (53 total, 7 thin omitted)

### Community 0 - "middlewares/auth.js"
Cohesion: 0.05
Nodes (50): analyzeFinances(), bcrypt, crypto, forgotPassword(), jwt, login(), me(), prisma (+42 more)

### Community 1 - "server.js"
Cohesion: 0.12
Nodes (14): accountRoutes, analysisRoutes, app, authRoutes, categoryRoutes, cors, dashboardRoutes, { errorHandler } (+6 more)

### Community 2 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 3 - "ReportPage.jsx"
Cohesion: 0.09
Nodes (42): AMBER, AMBER_DARK, applyPreset(), BORDER, buildPdf(), CREAM, CREAM2, drawAccountsTable() (+34 more)

### Community 4 - "frontend/package.json"
Cohesion: 0.05
Nodes (38): dependencies, axios, date-fns, @emailjs/browser, jspdf, jspdf-autotable, react, react-dom (+30 more)

### Community 5 - "backend-server.js"
Cohesion: 0.14
Nodes (13): accountRoutes, allowedOrigins, app, authRoutes, categoryRoutes, cors, dashboardRoutes, { errorHandler } (+5 more)

### Community 6 - "App.jsx"
Cohesion: 0.20
Nodes (15): App(), PrivateRoute(), PublicRoute(), Layout(), NAV_ITEMS, useIsMobile(), useTheme(), useAuth() (+7 more)

### Community 7 - "💰 FinTrack — Seguimiento de Gastos e Ingresos"
Cohesion: 0.07
Nodes (29): 1. Clonar el proyecto y abrir el directorio, 2. Configurar el Backend, 3. Ejecutar Migración y Seed, 4. Iniciar el Backend, 5. Configurar el Frontend, 6. Iniciar el Frontend, 🗃️ API Endpoints, Auth (+21 more)

### Community 8 - "Key Implementation Notes"
Cohesion: 0.08
Nodes (23): AI Analysis, Android Configuration, Charts, Color Picker, Currency Formatting, Date Pickers, Dependencies, "Exportar IA" (FinanceExportPanel) (+15 more)

### Community 9 - "transfers.controller.js"
Cohesion: 0.15
Nodes (27): { calcBalances }, cancel(), create(), enrichTransfer(), fullUpdate(), getAccountBalance(), getOne(), getTransferCategory() (+19 more)

### Community 10 - "AccountsPage.jsx"
Cohesion: 0.28
Nodes (14): ACCOUNT_TYPES, AccountCard(), AccountDetail(), AccountTransfersList(), EditTransferDateModal(), ExchangeModal(), fmtARS(), fmtUSD() (+6 more)

### Community 11 - "analysis.controller.js"
Cohesion: 0.12
Nodes (37): calcBalances(), create(), exchange(), list(), listExchanges(), prisma, remove(), toNum() (+29 more)

### Community 12 - "Página "Análisis" Implementation Plan"
Cohesion: 0.18
Nodes (10): Plan Self-Review Notes, Página "Análisis" Implementation Plan, Task 1: Backend — date helpers, KPIs, category breakdown, Task 2: Backend — monthly series (rolling 12 months) + currency comparison, Task 3: Backend — accounts detail, balance series, credit debt, recent activity, Task 4: Backend — source filter (mine/partner/both), Task 5: Frontend — `AccountMultiSelect` component, Task 6: Frontend — new chart components (+2 more)

### Community 13 - "sharedAccounts.js"
Cohesion: 0.18
Nodes (17): create(), exchange(), list(), prisma, remove(), toNum(), update(), { validationResult } (+9 more)

### Community 14 - "Charts.jsx"
Cohesion: 0.11
Nodes (24): AccountBalanceLineChart(), CategoryBarChart(), CHART_OPTIONS_CATEGORY, CHART_OPTIONS_MONTHLY, COLORS, CurrencyComparisonChart(), CustomTooltip(), MonthlyChartSelector() (+16 more)

### Community 15 - "partnerships.js"
Cohesion: 0.21
Nodes (18): getPartnerAccounts(), getPartnerCategories(), getPartnerDashboard(), getPartnerData(), getPartnerSolo(), listPartnerships(), prisma, removePartnership() (+10 more)

### Community 16 - "transactions.js"
Cohesion: 0.21
Nodes (14): buildWhere(), create(), getOne(), list(), parseLocalDate(), prisma, remove(), update() (+6 more)

### Community 17 - "formatCurrency"
Cohesion: 0.25
Nodes (11): ExpensePieChart(), ActivityTooltip(), InvestmentDashboardPage(), monthKey(), round2(), tooltipStyle, InvestmentsPage(), localToday() (+3 more)

### Community 18 - "Financial Tracker — 6 Mejoras (Diseño)"
Cohesion: 0.09
Nodes (22): 1. Edición completa de transferencias, 2. Nueva transacción desde detalle de cuenta, 3. Seleccionar todas las categorías en calculadora, 4. Pago de tarjeta de crédito, 5. Calculadora emergente en campo de monto, 6. Selección de moneda en transferencias, Financial Tracker — 6 Mejoras (Diseño), Problema (+14 more)

### Community 19 - "investment.controller.js"
Cohesion: 0.17
Nodes (27): createAsset(), createOperation(), createPosition(), deleteAsset(), deleteOperation(), deletePosition(), fmtDate(), GAIN_CATEGORY (+19 more)

### Community 20 - "react"
Cohesion: 0.15
Nodes (14): AccountMultiSelect(), CategoryModal(), defaultForm, PRESET_COLORS, currentMonth(), currentYear(), DashboardFilters(), AuthContext (+6 more)

### Community 21 - "🚀 Guía de Deploy — FinTrack"
Cohesion: 0.11
Nodes (17): 2.1 — Crear el servicio, 2.2 — Variables de entorno en Render, 2.3 — Deploy, 2.4 — Verificar, 3.1 — Crear el proyecto, 3.2 — Variables de entorno en Vercel, 3.3 — Deploy, Antes de empezar — subir el código a GitHub (+9 more)

### Community 22 - "SharedDashboardPage.jsx"
Cohesion: 0.13
Nodes (20): CategoryChartSelector(), DashboardPage(), defaultFilters(), currentMonth(), fmtARS(), fmtUSD(), PT, SharedDashboardPage() (+12 more)

### Community 23 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 24 - "backend/package.json"
Cohesion: 0.14
Nodes (13): description, devDependencies, nodemon, main, name, prisma, seed, version (+5 more)

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
Cohesion: 0.29
Nodes (5): bcrypt, prisma, { PrismaClient }, bcryptjs, @prisma/client

### Community 30 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 31 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 32 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 33 - "TransactionModal.jsx"
Cohesion: 0.21
Nodes (11): KEYS, MiniCalculatorModal(), Modal(), getDefaultForm(), localToday(), TransactionModal(), PT_LABELS, TransactionTable() (+3 more)

### Community 40 - "Account Transfers + Calculator Improvements Implementation Plan"
Cohesion: 0.18
Nodes (10): Account Transfers + Calculator Improvements Implementation Plan, Plan Self-Review Notes, Task 1: `TransferModal` accepts a preselected origin account, Task 2: Transfers list inside the account detail panel, Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel, Task 4: `CategoryMultiSelect` component, Task 5: Wire `CategoryMultiSelect` into the Calculator page, Task 6: Fix the Calculator's expanded per-category results table (+2 more)

### Community 41 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, bcryptjs, cors, dotenv, express, express-validator, jsonwebtoken, prisma (+1 more)

### Community 42 - "Informe PDF + Página de Inversiones Implementation Plan"
Cohesion: 0.22
Nodes (8): Informe PDF + Página de Inversiones Implementation Plan, Plan Self-Review Notes, Task 1: `ReportPage.jsx` — esqueleto completo (estado, UI, PDF mínimo), Task 2: `buildPdf` — KPI grid, gráfico de torta y de línea (página 1, parte 1), Task 3: `buildPdf` — tablas, página 2 y resumen patrimonial, Task 4: `InvestmentsPage.jsx` — listado y tarjeta resumen, Task 5: `InvestmentsPage.jsx` — modal de crear/editar/eliminar posición, Task 6: Integración — rutas, menú y verificación completa en el navegador

### Community 43 - "Página "Análisis" — Design Spec"
Cohesion: 0.22
Nodes (8): Architecture, Backend, Context / Decisions Made During Brainstorming, Frontend, Goal, Out of Scope (this iteration), Página "Análisis" — Design Spec, Testing

### Community 44 - "Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec"
Cohesion: 0.22
Nodes (8): Architecture, Backend, Context / Decisions Made During Brainstorming, Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec, Frontend (todo en `frontend/src/pages/AccountsPage.jsx`), Goal, Out of Scope, Testing

### Community 45 - "CalculatorPage.jsx"
Cohesion: 0.39
Nodes (7): CategoryMultiSelect(), CalculatorPage(), fmtARS(), fmtDate(), fmtUSD(), getPartnerId(), sourceType()

### Community 46 - "Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan"
Cohesion: 0.25
Nodes (7): Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan, Plan Self-Review Notes, Task 1: Backend — endpoint `GET /transfers/:id`, Task 2: Frontend — `TransferModal` soporta modo edición, Task 3: Frontend — botón de editar en `AccountTransfersList`, Task 4: Frontend — `AccountDetail` conecta los editores de transacción y transferencia, Task 5: Frontend — importar `TransactionModal`, pasar props nuevas desde `AccountsPage` y verificar en el navegador

### Community 47 - "Account Detail Transfers + Calculator Improvements — Design"
Cohesion: 0.25
Nodes (7): 1. Transfers in Account Detail, 2. Calculator category multi-select dropdown, 3. Calculator expanded results table fix, 4. Popup calculator on the amount field, Account Detail Transfers + Calculator Improvements — Design, Overview, Testing / verification

### Community 48 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, migrate, seed, start, studio

### Community 49 - "evaluateExpression"
Cohesion: 0.90
Nodes (5): evaluateExpression(), parseExpr(), parseFactor(), parseNumber(), parseTerm()

## Knowledge Gaps
- **369 isolated node(s):** `express`, `cors`, `{ errorHandler }`, `authRoutes`, `categoryRoutes` (+364 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 408 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `TransactionModal.jsx`, `ReportPage.jsx`, `frontend/package.json`, `App.jsx`, `AccountsPage.jsx`, `CalculatorPage.jsx`, `Charts.jsx`, `formatCurrency`, `SharedDashboardPage.jsx`, `AIAnalysisPanel.jsx`, `SharedFinanceExportPanel.jsx`, `FinanceExportPanel.jsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `express-validator` connect `transfers.controller.js` to `middlewares/auth.js`, `analysis.controller.js`, `sharedAccounts.js`, `transactions.js`, `backend/package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `authenticate()` connect `middlewares/auth.js` to `transfers.controller.js`, `analysis.controller.js`, `sharedAccounts.js`, `partnerships.js`, `transactions.js`, `investment.controller.js`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `express`, `cors`, `{ errorHandler }` to the rest of the system?**
  _369 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `middlewares/auth.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05017921146953405 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `What You Must Do When Invoked` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
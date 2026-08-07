# Graph Report - expense-tracker  (2026-08-06)

## Corpus Check
- 100 files · ~83,444 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 687 nodes · 1077 edges · 41 communities (34 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97c8fc26`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard Charts & PDF
- App.jsx
- Auth Controller & Security
- dependencies
- analysis.controller.js
- Backend Dependencies
- server.js
- Transfers Controller
- 💰 FinTrack — Seguimiento de Gastos e Ingresos
- Partnership Controller
- Shared Accounts Controller
- What You Must Do When Invoked
- Transactions Controller
- Calculator & Category UI
- AI Analysis Panel
- Database Seed
- Email Service
- Vercel Config
- Key Implementation Notes
- Financial Tracker — 6 Mejoras (Diseño)
- 🚀 Guía de Deploy — FinTrack
- Account Transfers + Calculator Improvements Implementation Plan
- Página "Análisis" Implementation Plan
- graphify reference: extra exports and benchmark
- Página "Análisis" — Design Spec
- Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec
- Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan
- Account Detail Transfers + Calculator Improvements — Design
- SharedFinanceExportPanel.jsx
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `api` - 17 edges
2. `formatDate()` - 17 edges
3. `formatCurrency()` - 16 edges
4. `authenticate()` - 15 edges
5. `useAuth()` - 12 edges
6. `generatePDF()` - 12 edges
7. `What You Must Do When Invoked` - 12 edges
8. `create()` - 11 edges
9. `/graphify` - 11 edges
10. `💰 FinTrack — Seguimiento de Gastos e Ingresos` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Card()` --calls--> `formatDate()`  [EXTRACTED]
  frontend/src/pages/PartnershipsPage.jsx → frontend/src/utils/format.js
- `getAccountBalance()` --calls--> `calcBalances()`  [EXTRACTED]
  backend/src/controllers/transfers.controller.js → backend/src/controllers/accounts.controller.js
- `TransfersTab()` --references--> `jspdf`  [EXTRACTED]
  frontend/src/pages/AccountsPage.jsx → frontend/package.json
- `generateExcel()` --references--> `xlsx`  [EXTRACTED]
  frontend/src/utils/excelExport.js → frontend/package.json
- `PrivateRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/App.jsx → frontend/src/hooks/useAuth.jsx

## Import Cycles
- None detected.

## Communities (41 total, 7 thin omitted)

### Community 0 - "Dashboard Charts & PDF"
Cohesion: 0.06
Nodes (57): jspdf, AccountBalanceLineChart(), CategoryBarChart(), CategoryChartSelector(), CHART_OPTIONS_CATEGORY, CHART_OPTIONS_MONTHLY, COLORS, CurrencyComparisonChart() (+49 more)

### Community 1 - "App.jsx"
Cohesion: 0.07
Nodes (48): xlsx, App(), PrivateRoute(), PublicRoute(), Layout(), NAV_ITEMS, useIsMobile(), useTheme() (+40 more)

### Community 2 - "Auth Controller & Security"
Cohesion: 0.06
Nodes (37): analyzeFinances(), bcrypt, crypto, forgotPassword(), jwt, login(), me(), prisma (+29 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (39): autoprefixer, axios, date-fns, @emailjs/browser, dependencies, axios, date-fns, @emailjs/browser (+31 more)

### Community 4 - "analysis.controller.js"
Cohesion: 0.10
Nodes (37): calcBalances(), create(), exchange(), list(), listExchanges(), prisma, remove(), toNum() (+29 more)

### Community 5 - "Backend Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, cors, dotenv, express, express-validator, jsonwebtoken, prisma (+24 more)

### Community 6 - "server.js"
Cohesion: 0.06
Nodes (36): accountRoutes, allowedOrigins, app, authRoutes, categoryRoutes, cors, dashboardRoutes, { errorHandler } (+28 more)

### Community 7 - "Transfers Controller"
Cohesion: 0.15
Nodes (26): { calcBalances }, cancel(), create(), enrichTransfer(), fullUpdate(), getAccountBalance(), getOne(), getTransferCategory() (+18 more)

### Community 8 - "💰 FinTrack — Seguimiento de Gastos e Ingresos"
Cohesion: 0.07
Nodes (29): 1. Clonar el proyecto y abrir el directorio, 2. Configurar el Backend, 3. Ejecutar Migración y Seed, 4. Iniciar el Backend, 5. Configurar el Frontend, 6. Iniciar el Frontend, 🗃️ API Endpoints, Auth (+21 more)

### Community 9 - "Partnership Controller"
Cohesion: 0.22
Nodes (17): getPartnerAccounts(), getPartnerDashboard(), getPartnerData(), getPartnerSolo(), listPartnerships(), prisma, removePartnership(), respondInvitation() (+9 more)

### Community 10 - "Shared Accounts Controller"
Cohesion: 0.17
Nodes (17): create(), exchange(), list(), prisma, remove(), toNum(), update(), { validationResult } (+9 more)

### Community 11 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

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

### Community 21 - "Key Implementation Notes"
Cohesion: 0.08
Nodes (23): AI Analysis, Android Configuration, Charts, Color Picker, Currency Formatting, Date Pickers, Dependencies, "Exportar IA" (FinanceExportPanel) (+15 more)

### Community 22 - "Financial Tracker — 6 Mejoras (Diseño)"
Cohesion: 0.09
Nodes (22): 1. Edición completa de transferencias, 2. Nueva transacción desde detalle de cuenta, 3. Seleccionar todas las categorías en calculadora, 4. Pago de tarjeta de crédito, 5. Calculadora emergente en campo de monto, 6. Selección de moneda en transferencias, Financial Tracker — 6 Mejoras (Diseño), Problema (+14 more)

### Community 23 - "🚀 Guía de Deploy — FinTrack"
Cohesion: 0.11
Nodes (17): 2.1 — Crear el servicio, 2.2 — Variables de entorno en Render, 2.3 — Deploy, 2.4 — Verificar, 3.1 — Crear el proyecto, 3.2 — Variables de entorno en Vercel, 3.3 — Deploy, Antes de empezar — subir el código a GitHub (+9 more)

### Community 24 - "Account Transfers + Calculator Improvements Implementation Plan"
Cohesion: 0.18
Nodes (10): Account Transfers + Calculator Improvements Implementation Plan, Plan Self-Review Notes, Task 1: `TransferModal` accepts a preselected origin account, Task 2: Transfers list inside the account detail panel, Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel, Task 4: `CategoryMultiSelect` component, Task 5: Wire `CategoryMultiSelect` into the Calculator page, Task 6: Fix the Calculator's expanded per-category results table (+2 more)

### Community 25 - "Página "Análisis" Implementation Plan"
Cohesion: 0.18
Nodes (10): Plan Self-Review Notes, Página "Análisis" Implementation Plan, Task 1: Backend — date helpers, KPIs, category breakdown, Task 2: Backend — monthly series (rolling 12 months) + currency comparison, Task 3: Backend — accounts detail, balance series, credit debt, recent activity, Task 4: Backend — source filter (mine/partner/both), Task 5: Frontend — `AccountMultiSelect` component, Task 6: Frontend — new chart components (+2 more)

### Community 26 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 27 - "Página "Análisis" — Design Spec"
Cohesion: 0.22
Nodes (8): Architecture, Backend, Context / Decisions Made During Brainstorming, Frontend, Goal, Out of Scope (this iteration), Página "Análisis" — Design Spec, Testing

### Community 28 - "Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec"
Cohesion: 0.22
Nodes (8): Architecture, Backend, Context / Decisions Made During Brainstorming, Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec, Frontend (todo en `frontend/src/pages/AccountsPage.jsx`), Goal, Out of Scope, Testing

### Community 29 - "Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan"
Cohesion: 0.25
Nodes (7): Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan, Plan Self-Review Notes, Task 1: Backend — endpoint `GET /transfers/:id`, Task 2: Frontend — `TransferModal` soporta modo edición, Task 3: Frontend — botón de editar en `AccountTransfersList`, Task 4: Frontend — `AccountDetail` conecta los editores de transacción y transferencia, Task 5: Frontend — importar `TransactionModal`, pasar props nuevas desde `AccountsPage` y verificar en el navegador

### Community 30 - "Account Detail Transfers + Calculator Improvements — Design"
Cohesion: 0.25
Nodes (7): 1. Transfers in Account Detail, 2. Calculator category multi-select dropdown, 3. Calculator expanded results table fix, 4. Popup calculator on the amount field, Account Detail Transfers + Calculator Improvements — Design, Overview, Testing / verification

### Community 31 - "SharedFinanceExportPanel.jsx"
Cohesion: 0.43
Nodes (7): buildCategoryMap(), fmtARS(), fmtUSD(), formatCatBlock(), GENERAL_CATS, isGeneral(), SharedFinanceExportPanel()

### Community 32 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 33 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 34 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 35 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **324 isolated node(s):** `express`, `cors`, `{ errorHandler }`, `authRoutes`, `categoryRoutes` (+319 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `Dashboard Charts & PDF`, `App.jsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `jspdf` connect `Dashboard Charts & PDF` to `App.jsx`, `dependencies`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `authenticate()` connect `Auth Controller & Security` to `analysis.controller.js`, `server.js`, `Transfers Controller`, `Partnership Controller`, `Shared Accounts Controller`, `Transactions Controller`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `express`, `cors`, `{ errorHandler }` to the rest of the system?**
  _324 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Charts & PDF` be split into smaller, more focused modules?**
  _Cohesion score 0.056842105263157895 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06603346901854365 - nodes in this community are weakly interconnected._
- **Should `Auth Controller & Security` be split into smaller, more focused modules?**
  _Cohesion score 0.06376811594202898 - nodes in this community are weakly interconnected._
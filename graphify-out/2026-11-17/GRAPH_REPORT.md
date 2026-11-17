# Graph Report - Financialtraker  (2026-11-17)

## Corpus Check
- 152 files · ~98,162 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .example 3, (none) 2, .prisma 2)

## Summary
- 954 nodes · 2197 edges · 65 communities (51 shown, 14 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 195 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e336eab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.controller.js
- server.js
- env
- ReportPage.jsx
- frontend/package.json
- Hallazgos prioritarios
- App.jsx
- Despliegue de FinTrack
- Key Implementation Notes
- transfers.controller.js
- AccountsPage.jsx
- analysis.controller.js
- services
- sharedAccounts.js
- Charts.jsx
- partnerships.js
- transactions.js
- formatCurrency
- Financial Tracker — 6 Mejoras (Diseño)
- services
- react
- accounts.controller.js
- SharedDashboardPage.jsx
- reporting-remaining.test.cjs
- backend/package.json
- AIAnalysisPanel.jsx
- react
- frontend-remaining.test.cjs
- postgres.integration.cjs
- prisma.js
- dashboard.controller.js
- middlewares/auth.js
- critical-fixes.test.cjs
- PartnerViewPage.jsx
- mailer.js
- helpers.cjs
- financialMutation.js
- vercel.json
- investments-currency.test.cjs
- DashboardPage.jsx
- ledger-integrity.test.cjs
- security.test.cjs
- loadController
- Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec
- AnalysisPage.jsx
- Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan
- Account Detail Transfers + Calculator Improvements — Design
- Cierre de bloques de reparación — 2026-10-18
- evaluateExpression
- CLAUDE.md
- .claude/CLAUDE.md
- Frontend: solicitudes y exportaciones
- Tercera etapa: inversiones y separación por moneda
- parsePagination
- Rediseño Banca Digital A — 2026-10-18
- Digital Banking Implementation Plan
- Corrección móvil — 2026-10-18
- Dependencias: revisión 2026-10-18
- 2026-10-18-critical-fixes.md
- 2026-10-18-ledger-integrity.md
- 2026-10-18-remaining-blocks.md
- 2026-10-18-digital-banking-design.md

## God Nodes (most connected - your core abstractions)
1. `react` - 33 edges
2. `Icon()` - 30 edges
3. `decimal()` - 24 edges
4. `formatCurrency()` - 24 edges
5. `isCanceled()` - 24 edges
6. `Modal()` - 23 edges
7. `useRequestScope()` - 23 edges
8. `buildTransactionWhere()` - 22 edges
9. `App()` - 22 edges
10. `api` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Task 2: Backend — monthly series (rolling 12 months) + currency comparison` --references--> `computeUserAnalysis()`  [INFERRED]
  docs/superpowers/plans/2026-07-24-analysis-page.md → backend/src/controllers/analysis.controller.js
- `Task 3: Backend — accounts detail, balance series, credit debt, recent activity` --references--> `computeUserAnalysis()`  [INFERRED]
  docs/superpowers/plans/2026-07-24-analysis-page.md → backend/src/controllers/analysis.controller.js
- `Backend` --references--> `getSharedDashboard()`  [INFERRED]
  docs/superpowers/specs/2026-07-24-analysis-page-design.md → backend/src/controllers/dashboard.controller.js
- `Solución backend` --references--> `fullUpdate()`  [INFERRED]
  docs/superpowers/specs/2026-05-14-financial-tracker-improvements-design.md → backend/src/controllers/transfers.controller.js
- `Task 5: Wire `CategoryMultiSelect` into the Calculator page` --references--> `CategoryMultiSelect()`  [INFERRED]
  docs/superpowers/plans/2026-07-23-account-transfers-calculator-improvements.md → frontend/src/components/ui/CategoryMultiSelect.jsx

## Import Cycles
- None detected.

## Communities (65 total, 14 thin omitted)

### Community 0 - "auth.controller.js"
Cohesion: 0.19
Nodes (17): bcrypt, forgotPassword(), login(), logout(), me(), register(), updateProfile(), { validationResult } (+9 more)

### Community 1 - "server.js"
Cohesion: 0.12
Nodes (15): app, cors, express, analyzeFinances(), errorHandler(), { randomUUID }, corsOptions(), { randomUUID } (+7 more)

### Community 2 - "env"
Cohesion: 0.06
Nodes (32): DATABASE_URL, DIRECT_URL, FRONTEND_URL, JWT_SECRET, NODE_ENV, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER (+24 more)

### Community 3 - "ReportPage.jsx"
Cohesion: 0.08
Nodes (51): Informe PDF + Página de Inversiones Implementation Plan, Plan Self-Review Notes, Task 1: `ReportPage.jsx` — esqueleto completo (estado, UI, PDF mínimo), Task 2: `buildPdf` — KPI grid, gráfico de torta y de línea (página 1, parte 1), Task 3: `buildPdf` — tablas, página 2 y resumen patrimonial, Task 4: `InvestmentsPage.jsx` — listado y tarjeta resumen, Task 5: `InvestmentsPage.jsx` — modal de crear/editar/eliminar posición, Task 6: Integración — rutas, menú y verificación completa en el navegador (+43 more)

### Community 4 - "frontend/package.json"
Cohesion: 0.06
Nodes (41): dependencies, axios@^1.6.7, date-fns@^3.3.1, @emailjs/browser@^4.3.3, jspdf@^4.2.1, jspdf-autotable@^5.0.9, react@^18.2.0, react-dom@^18.2.0 (+33 more)

### Community 5 - "Hallazgos prioritarios"
Cohesion: 0.09
Nodes (22): A01 — Crítico: recuperación de contraseña permite tomar una cuenta, A02 — Crítico: edición de movimientos sin autorización de la cuenta destino, A03 — Alto: cancelación de transferencia altera saldos, A04 — Alto: edición y concurrencia permiten saltarse límites de saldo, A05 — Alto: se pueden modificar o borrar movimientos de sistemas derivados, A06 — Alto: indicadores mezclan monedas, A07 — Alto: migraciones no reconstruyen el esquema actual, A08 — Alto: inversiones se actualizan en varias escrituras independientes (+14 more)

### Community 6 - "App.jsx"
Cohesion: 0.10
Nodes (32): AccountsPage, AnalysisPage, App(), CalculatorPage, CategoriesPage, DashboardPage, ForgotPasswordPage, InvestmentDashboardPage (+24 more)

### Community 7 - "Despliegue de FinTrack"
Cohesion: 0.12
Nodes (15): Backend, Despliegue de FinTrack, Destinos confirmados para esta publicación, Frontend, Validación y reversión, Backup PostgreSQL, Dependencias, Ensayo de restauración (+7 more)

### Community 8 - "Key Implementation Notes"
Cohesion: 0.08
Nodes (23): AI Analysis, Android Configuration, Charts, Color Picker, Currency Formatting, Date Pickers, Dependencies, "Exportar IA" (FinanceExportPanel) (+15 more)

### Community 9 - "transfers.controller.js"
Cohesion: 0.17
Nodes (24): cancel(), create(), enrichTransfer(), fullUpdate(), getAccountBalance(), getOne(), getTransferCategory(), INCLUDE (+16 more)

### Community 10 - "AccountsPage.jsx"
Cohesion: 0.18
Nodes (27): Account Transfers + Calculator Improvements Implementation Plan, Plan Self-Review Notes, Task 1: `TransferModal` accepts a preselected origin account, Task 2: Transfers list inside the account detail panel, Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel, Task 5: Wire `CategoryMultiSelect` into the Calculator page, Task 6: Fix the Calculator's expanded per-category results table, Task 8: Wire the popup calculator into the transaction amount field (+19 more)

### Community 11 - "analysis.controller.js"
Cohesion: 0.08
Nodes (65): accountsAnalysis(), categoryBreakdown(), computeKpis(), computeUserAnalysis(), getAnalysis(), mergeCombinedKpis(), mergeMonthly(), monthlySeries() (+57 more)

### Community 12 - "services"
Cohesion: 0.13
Nodes (14): key, sync, value, services, buildCommand, env, envVars, healthCheckPath (+6 more)

### Community 13 - "sharedAccounts.js"
Cohesion: 0.25
Nodes (12): create(), exchange(), list(), remove(), toNum(), update(), { validationResult }, verifyPartnership() (+4 more)

### Community 14 - "Charts.jsx"
Cohesion: 0.09
Nodes (32): Página "Análisis" Implementation Plan, Task 1: Backend — date helpers, KPIs, category breakdown, Task 2: Backend — monthly series (rolling 12 months) + currency comparison, Task 3: Backend — accounts detail, balance series, credit debt, recent activity, Task 4: Backend — source filter (mine/partner/both), Task 5: Frontend — `AccountMultiSelect` component, Task 6: Frontend — new chart components, Task 7: Frontend — `AnalysisPage.jsx` (filters, KPIs, charts) (+24 more)

### Community 15 - "partnerships.js"
Cohesion: 0.31
Nodes (12): getPartnerAccounts(), getPartnerCategories(), getPartnerDashboard(), getPartnerData(), getPartnerSolo(), listPartnerships(), removePartnership(), respondInvitation() (+4 more)

### Community 16 - "transactions.js"
Cohesion: 0.17
Nodes (19): buildWhere(), create(), getOne(), list(), parseLocalDate(), remove(), update(), { validationResult } (+11 more)

### Community 17 - "formatCurrency"
Cohesion: 0.20
Nodes (15): useRequestScope(), ActivityTooltip(), InvestmentDashboardPage(), monthKey(), round2(), tooltipStyle, AssetsModal(), InvestmentsPage() (+7 more)

### Community 18 - "Financial Tracker — 6 Mejoras (Diseño)"
Cohesion: 0.09
Nodes (22): 1. Edición completa de transferencias, 2. Nueva transacción desde detalle de cuenta, 3. Seleccionar todas las categorías en calculadora, 4. Pago de tarjeta de crédito, 5. Calculadora emergente en campo de monto, 6. Selección de moneda en transferencias, Financial Tracker — 6 Mejoras (Diseño), Problema (+14 more)

### Community 19 - "services"
Cohesion: 0.13
Nodes (14): key, sync, value, services, buildCommand, env, envVars, healthCheckPath (+6 more)

### Community 20 - "react"
Cohesion: 0.22
Nodes (11): CategoryModal(), defaultForm, PRESET_COLORS, currentMonth(), currentYear(), DashboardFilters(), CategoriesPage(), Badge() (+3 more)

### Community 21 - "accounts.controller.js"
Cohesion: 0.27
Nodes (11): create(), exchange(), list(), listExchanges(), remove(), toNum(), update(), { validationResult } (+3 more)

### Community 22 - "SharedDashboardPage.jsx"
Cohesion: 0.17
Nodes (17): currentMonth(), fmtARS(), fmtUSD(), PT, SharedDashboardPage(), ttStyle, csvCell(), downloadCsv() (+9 more)

### Community 23 - "reporting-remaining.test.cjs"
Cohesion: 0.18
Nodes (7): assert, test, assert, test, analysis, assert, test

### Community 24 - "backend/package.json"
Cohesion: 0.06
Nodes (36): dependencies, bcryptjs@^2.4.3, cors@^2.8.5, dotenv@^16.4.5, express@^4.18.3, express-validator@^7.0.1, jsonwebtoken@^9.0.2, prisma@^5.10.0 (+28 more)

### Community 25 - "AIAnalysisPanel.jsx"
Cohesion: 0.39
Nodes (6): AIAnalysisPanel(), fmtARS(), fmtUSD(), getSectionIcon(), parseAnalysis(), SECTION_ICONS

### Community 26 - "react"
Cohesion: 0.17
Nodes (19): FinanceExportPanel(), fmtARS(), fmtUSD(), GENERAL_CATS, isGeneral(), KEYS, focusables(), Modal() (+11 more)

### Community 27 - "frontend-remaining.test.cjs"
Cohesion: 0.15
Nodes (7): assert, path, { pathToFileURL }, test, path, result, { spawnSync }

### Community 28 - "postgres.integration.cjs"
Cohesion: 0.18
Nodes (9): account(), assert, buy(), call(), path, { randomUUID }, { spawnSync }, test (+1 more)

### Community 29 - "prisma.js"
Cohesion: 0.24
Nodes (9): create(), list(), remove(), update(), { validationResult }, { body }, router, prisma (+1 more)

### Community 30 - "dashboard.controller.js"
Cohesion: 0.44
Nodes (7): buildWhere(), getDashboard(), getSharedDashboard(), router, combineKpis(), combineMonthly(), computeKpis()

### Community 31 - "middlewares/auth.js"
Cohesion: 0.31
Nodes (7): authenticate(), jwt, { timingSafeEqual }, cookieName(), jwt, { randomBytes }, readSession()

### Community 32 - "critical-fixes.test.cjs"
Cohesion: 0.25
Nodes (6): assert, db, edit(), original, test, response()

### Community 33 - "PartnerViewPage.jsx"
Cohesion: 0.25
Nodes (11): PT_LABELS, TransactionTable(), currentMonth(), fmtARS(), fmtMonthLabel(), fmtUSD(), PartnerViewPage(), fmtARS() (+3 more)

### Community 35 - "helpers.cjs"
Cohesion: 0.25
Nodes (4): { createRequire }, fs, path, vm

### Community 36 - "financialMutation.js"
Cohesion: 0.43
Nodes (5): validate(), validationError(), { validationResult }, financialMutation(), rejected

### Community 38 - "investments-currency.test.cjs"
Cohesion: 0.29
Nodes (4): assert, db, mixed, test

### Community 40 - "DashboardPage.jsx"
Cohesion: 0.30
Nodes (11): Task 7: `MiniCalculatorModal` component with a safe expression parser, 4. Popup calculator on the amount field, Icon(), paths, KpiCard(), MiniCalculatorModal(), getDefaultForm(), localToday() (+3 more)

### Community 41 - "ledger-integrity.test.cjs"
Cohesion: 0.33
Nodes (4): next(), assert, db, test

### Community 43 - "loadController"
Cohesion: 0.40
Nodes (4): fixture(), prisma, loadController(), load()

### Community 44 - "Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec"
Cohesion: 0.29
Nodes (6): Architecture, Context / Decisions Made During Brainstorming, Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec, Goal, Out of Scope, Testing

### Community 45 - "AnalysisPage.jsx"
Cohesion: 0.20
Nodes (15): Task 4: `CategoryMultiSelect` component, AccountMultiSelect(), CategoryMultiSelect(), AnalysisPage(), currentMonth(), currentYear(), defaultFilters(), getPartnerId() (+7 more)

### Community 46 - "Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan"
Cohesion: 0.33
Nodes (5): Edición de transacciones y transferencias desde el detalle de cuenta — Implementation Plan, Task 1: Backend — endpoint `GET /transfers/:id`, Task 2: Frontend — `TransferModal` soporta modo edición, Task 3: Frontend — botón de editar en `AccountTransfersList`, Task 5: Frontend — importar `TransactionModal`, pasar props nuevas desde `AccountsPage` y verificar en el navegador

### Community 47 - "Account Detail Transfers + Calculator Improvements — Design"
Cohesion: 0.33
Nodes (5): 2. Calculator category multi-select dropdown, 3. Calculator expanded results table fix, Account Detail Transfers + Calculator Improvements — Design, Overview, Testing / verification

### Community 48 - "Cierre de bloques de reparación — 2026-10-18"
Cohesion: 0.40
Nodes (4): Cierre de bloques de reparación — 2026-10-18, Operación y límites concretos, Resultado verificado, Seguridad de sesión

### Community 49 - "evaluateExpression"
Cohesion: 0.80
Nodes (5): evaluateExpression(), parseExpr(), parseFactor(), parseNumber(), parseTerm()

### Community 53 - "Frontend: solicitudes y exportaciones"
Cohesion: 0.40
Nodes (4): Frontend: solicitudes y exportaciones, Límites, Verificación, Verificación navegador final

### Community 54 - "Tercera etapa: inversiones y separación por moneda"
Cohesion: 0.40
Nodes (4): Evidencia de verificación, Implementación, Límites y trabajo restante, Tercera etapa: inversiones y separación por moneda

### Community 55 - "parsePagination"
Cohesion: 1.00
Nodes (3): invalid(), normalizeQuery(), parsePagination()

### Community 56 - "Rediseño Banca Digital A — 2026-10-18"
Cohesion: 0.50
Nodes (3): Cambios, Rediseño Banca Digital A — 2026-10-18, Verificaciones ejecutadas

### Community 57 - "Digital Banking Implementation Plan"
Cohesion: 0.50
Nodes (3): Constraints, Digital Banking Implementation Plan, Review focus

## Knowledge Gaps
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fullUpdate()` connect `transfers.controller.js` to `transactions.js`, `Financial Tracker — 6 Mejoras (Diseño)`, `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._
- **Why does `TransactionModal()` connect `DashboardPage.jsx` to `PartnerViewPage.jsx`, `AccountsPage.jsx`, `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec`, `SharedDashboardPage.jsx`, `react`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `env` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `Context / Decisions Made During Brainstorming` connect `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec` to `DashboardPage.jsx`, `transfers.controller.js`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `ReportPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08245981830887492 - nodes in this community are weakly interconnected._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06312292358803986 - nodes in this community are weakly interconnected._
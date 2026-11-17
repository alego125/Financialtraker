# Graph Report - Financialtraker  (2026-11-17)

## Corpus Check
- 152 files · ~98,162 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .example 3, (none) 2, .prisma 2)

## Summary
- 1030 nodes · 2341 edges · 58 communities (43 shown, 15 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 195 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e336eab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 20260303135936_init_full/migration.sql
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
- investment.controller.js
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
- Página "Análisis" — Design Spec
- frontend-remaining.test.cjs
- postgres.integration.cjs
- critical-fixes.test.cjs
- useRequestScope
- mailer.js
- helpers.cjs
- financialMutation.js
- vercel.json
- investments-currency.test.cjs
- ledger-integrity.test.cjs
- security.test.cjs
- Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec
- Cierre de bloques de reparación — 2026-10-18
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
3. `isCanceled()` - 24 edges
4. `decimal()` - 24 edges
5. `formatCurrency()` - 24 edges
6. `useRequestScope()` - 23 edges
7. `Modal()` - 23 edges
8. `buildTransactionWhere()` - 22 edges
9. `App()` - 22 edges
10. `formatDate()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Backend` --references--> `getSharedDashboard()`  [INFERRED]
  docs/superpowers/specs/2026-07-24-analysis-page-design.md → backend/src/controllers/dashboard.controller.js
- `Solución backend` --references--> `fullUpdate()`  [INFERRED]
  docs/superpowers/specs/2026-05-14-financial-tracker-improvements-design.md → backend/src/controllers/transfers.controller.js
- `Task 5: Frontend — importar `TransactionModal`, pasar props nuevas desde `AccountsPage` y verificar en el navegador` --references--> `AccountsPage()`  [INFERRED]
  docs/superpowers/plans/2026-08-03-account-detail-edit.md → frontend/src/pages/AccountsPage.jsx
- `Task 3: Frontend — botón de editar en `AccountTransfersList`` --references--> `AccountTransfersList()`  [INFERRED]
  docs/superpowers/plans/2026-08-03-account-detail-edit.md → frontend/src/pages/AccountsPage.jsx
- `Task 2: Frontend — `TransferModal` soporta modo edición` --references--> `TransferModal()`  [INFERRED]
  docs/superpowers/plans/2026-08-03-account-detail-edit.md → frontend/src/pages/AccountsPage.jsx

## Import Cycles
- None detected.

## Communities (58 total, 15 thin omitted)

### Community 0 - "20260303135936_init_full/migration.sql"
Cohesion: 0.05
Nodes (66): "Account", Account_userId_idx, Account_userId_name_key, "Category", Category_userId_idx, Category_userId_name_key, "Partnership", Partnership_receiverId_idx (+58 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (45): app, cors, express, analyzeFinances(), bcrypt, forgotPassword(), login(), logout() (+37 more)

### Community 2 - "env"
Cohesion: 0.06
Nodes (32): DATABASE_URL, DIRECT_URL, FRONTEND_URL, JWT_SECRET, NODE_ENV, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER (+24 more)

### Community 3 - "ReportPage.jsx"
Cohesion: 0.08
Nodes (50): Informe PDF + Página de Inversiones Implementation Plan, Plan Self-Review Notes, Task 1: `ReportPage.jsx` — esqueleto completo (estado, UI, PDF mínimo), Task 2: `buildPdf` — KPI grid, gráfico de torta y de línea (página 1, parte 1), Task 3: `buildPdf` — tablas, página 2 y resumen patrimonial, Task 4: `InvestmentsPage.jsx` — listado y tarjeta resumen, Task 5: `InvestmentsPage.jsx` — modal de crear/editar/eliminar posición, Task 6: Integración — rutas, menú y verificación completa en el navegador (+42 more)

### Community 4 - "frontend/package.json"
Cohesion: 0.07
Nodes (39): dependencies, axios@^1.6.7, date-fns@^3.3.1, @emailjs/browser@^4.3.3, jspdf@^4.2.1, jspdf-autotable@^5.0.9, react@^18.2.0, react-dom@^18.2.0 (+31 more)

### Community 5 - "Hallazgos prioritarios"
Cohesion: 0.09
Nodes (22): A01 — Crítico: recuperación de contraseña permite tomar una cuenta, A02 — Crítico: edición de movimientos sin autorización de la cuenta destino, A03 — Alto: cancelación de transferencia altera saldos, A04 — Alto: edición y concurrencia permiten saltarse límites de saldo, A05 — Alto: se pueden modificar o borrar movimientos de sistemas derivados, A06 — Alto: indicadores mezclan monedas, A07 — Alto: migraciones no reconstruyen el esquema actual, A08 — Alto: inversiones se actualizan en varias escrituras independientes (+14 more)

### Community 6 - "App.jsx"
Cohesion: 0.13
Nodes (26): AccountsPage, AnalysisPage, App(), CalculatorPage, CategoriesPage, DashboardPage, ForgotPasswordPage, InvestmentDashboardPage (+18 more)

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
Cohesion: 0.07
Nodes (58): Account Transfers + Calculator Improvements Implementation Plan, Plan Self-Review Notes, Task 1: `TransferModal` accepts a preselected origin account, Task 2: Transfers list inside the account detail panel, Task 3: Wire "+ Nueva Transferencia" end-to-end from the account detail panel, Task 4: `CategoryMultiSelect` component, Task 5: Wire `CategoryMultiSelect` into the Calculator page, Task 6: Fix the Calculator's expanded per-category results table (+50 more)

### Community 11 - "analysis.controller.js"
Cohesion: 0.07
Nodes (67): accountsAnalysis(), categoryBreakdown(), computeKpis(), computeUserAnalysis(), getAnalysis(), mergeCombinedKpis(), mergeMonthly(), monthlySeries() (+59 more)

### Community 12 - "services"
Cohesion: 0.13
Nodes (14): key, sync, value, services, buildCommand, env, envVars, healthCheckPath (+6 more)

### Community 13 - "sharedAccounts.js"
Cohesion: 0.24
Nodes (13): create(), exchange(), list(), remove(), toNum(), update(), { validationResult }, verifyPartnership() (+5 more)

### Community 14 - "Charts.jsx"
Cohesion: 0.13
Nodes (29): Task 5: Frontend — `AccountMultiSelect` component, Task 6: Frontend — new chart components, Frontend, AccountBalanceLineChart(), CategoryBarChart(), CategoryChartSelector(), CHART_OPTIONS_CATEGORY, CHART_OPTIONS_MONTHLY (+21 more)

### Community 15 - "investment.controller.js"
Cohesion: 0.17
Nodes (25): createAsset(), createOperation(), createPosition(), deleteAsset(), deleteOperation(), deletePosition(), getBoard(), listAssets() (+17 more)

### Community 16 - "transactions.js"
Cohesion: 0.19
Nodes (18): buildWhere(), create(), getOne(), list(), parseLocalDate(), remove(), update(), { validationResult } (+10 more)

### Community 17 - "formatCurrency"
Cohesion: 0.16
Nodes (18): assert, test, recharts@^2.12.2, ExpensePieChart(), ActivityTooltip(), InvestmentDashboardPage(), monthKey(), round2() (+10 more)

### Community 18 - "Financial Tracker — 6 Mejoras (Diseño)"
Cohesion: 0.09
Nodes (22): 1. Edición completa de transferencias, 2. Nueva transacción desde detalle de cuenta, 3. Seleccionar todas las categorías en calculadora, 4. Pago de tarjeta de crédito, 5. Calculadora emergente en campo de monto, 6. Selección de moneda en transferencias, Financial Tracker — 6 Mejoras (Diseño), Problema (+14 more)

### Community 19 - "services"
Cohesion: 0.13
Nodes (14): key, sync, value, services, buildCommand, env, envVars, healthCheckPath (+6 more)

### Community 20 - "react"
Cohesion: 0.16
Nodes (16): GROUPS, useTheme(), CategoryModal(), currentMonth(), currentYear(), DashboardFilters(), AuthContext, AuthProvider() (+8 more)

### Community 21 - "accounts.controller.js"
Cohesion: 0.25
Nodes (11): create(), exchange(), list(), listExchanges(), remove(), toNum(), update(), { validationResult } (+3 more)

### Community 22 - "SharedDashboardPage.jsx"
Cohesion: 0.12
Nodes (28): FinanceExportPanel(), fmtARS(), fmtUSD(), GENERAL_CATS, isGeneral(), Icon(), paths, KpiCard() (+20 more)

### Community 23 - "reporting-remaining.test.cjs"
Cohesion: 0.20
Nodes (7): fixture(), prisma, loadController(), load(), analysis, assert, test

### Community 24 - "backend/package.json"
Cohesion: 0.06
Nodes (36): dependencies, bcryptjs@^2.4.3, cors@^2.8.5, dotenv@^16.4.5, express@^4.18.3, express-validator@^7.0.1, jsonwebtoken@^9.0.2, prisma@^5.10.0 (+28 more)

### Community 25 - "AIAnalysisPanel.jsx"
Cohesion: 0.39
Nodes (6): AIAnalysisPanel(), fmtARS(), fmtUSD(), getSectionIcon(), parseAnalysis(), SECTION_ICONS

### Community 26 - "Página "Análisis" — Design Spec"
Cohesion: 0.25
Nodes (7): Architecture, Backend, Context / Decisions Made During Brainstorming, Goal, Out of Scope (this iteration), Página "Análisis" — Design Spec, Testing

### Community 27 - "frontend-remaining.test.cjs"
Cohesion: 0.15
Nodes (7): assert, path, { pathToFileURL }, test, path, result, { spawnSync }

### Community 28 - "postgres.integration.cjs"
Cohesion: 0.18
Nodes (9): account(), assert, buy(), call(), path, { randomUUID }, { spawnSync }, test (+1 more)

### Community 32 - "critical-fixes.test.cjs"
Cohesion: 0.25
Nodes (6): assert, db, edit(), original, test, response()

### Community 33 - "useRequestScope"
Cohesion: 0.16
Nodes (21): buildCategoryMap(), fmtARS(), fmtUSD(), formatCatBlock(), GENERAL_CATS, isGeneral(), SharedFinanceExportPanel(), PT_LABELS (+13 more)

### Community 35 - "helpers.cjs"
Cohesion: 0.25
Nodes (4): { createRequire }, fs, path, vm

### Community 36 - "financialMutation.js"
Cohesion: 0.43
Nodes (5): validate(), validationError(), { validationResult }, financialMutation(), rejected

### Community 38 - "investments-currency.test.cjs"
Cohesion: 0.29
Nodes (4): assert, db, mixed, test

### Community 41 - "ledger-integrity.test.cjs"
Cohesion: 0.33
Nodes (4): next(), assert, db, test

### Community 42 - "security.test.cjs"
Cohesion: 0.16
Nodes (6): assert, test, assert, test, assert, test

### Community 44 - "Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec"
Cohesion: 0.29
Nodes (6): Architecture, Context / Decisions Made During Brainstorming, Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec, Goal, Out of Scope, Testing

### Community 48 - "Cierre de bloques de reparación — 2026-10-18"
Cohesion: 0.40
Nodes (4): Cierre de bloques de reparación — 2026-10-18, Operación y límites concretos, Resultado verificado, Seguridad de sesión

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
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fullUpdate()` connect `transfers.controller.js` to `transactions.js`, `Financial Tracker — 6 Mejoras (Diseño)`, `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `20260303135936_init_full/migration.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.053313587560162905 - nodes in this community are weakly interconnected._
- **Why does `Context / Decisions Made During Brainstorming` connect `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec` to `transfers.controller.js`, `AccountsPage.jsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05792349726775956 - nodes in this community are weakly interconnected._
- **Why does `TransactionModal()` connect `AccountsPage.jsx` to `useRequestScope`, `Edición de transacciones y transferencias desde el detalle de cuenta — Design Spec`, `SharedDashboardPage.jsx`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `env` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `ReportPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0841799709724238 - nodes in this community are weakly interconnected._
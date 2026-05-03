# Flutter Migration Design — financialtracker_flutter

**Date:** 2026-05-02
**Status:** Approved

---

## Overview

Migrate the existing React/Vite expense tracker web app to a standalone Flutter Android app (`financialtracker_flutter`). The Flutter app consumes the existing REST API backend deployed at `https://financialtraker.onrender.com/api`. No backend changes required.

---

## Source App Summary

| Layer | Stack |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express + Prisma + PostgreSQL (Render) |
| Auth | JWT in localStorage |
| Charts | recharts |
| Exports | jsPDF + xlsx npm packages |

### Screens (10 total)
1. LoginPage
2. RegisterPage
3. ForgotPasswordPage
4. DashboardPage — KPIs, charts, infinite-scroll transactions, PDF/Excel/AI export
5. TransactionsPage — full history, multi-filter, infinite scroll, totals
6. CategoriesPage — CRUD with color picker
7. AccountsPage — personal + shared accounts, transfers, USD exchange, credit card payment; tab: Movimientos (transfers list)
8. PartnershipsPage — invite/accept/reject partnerships
9. SharedDashboardPage — combined finances view with partner (KPIs, charts, transactions)
10. PartnerViewPage — view partner's transactions only
11. ProfilePage — edit name/email/password
12. CalculatorPage — custom sum by date range + categories + source (mine/partner/both)

### Key Domain Concepts
- **Currencies:** ARS + USD (both tracked per transaction and account)
- **Account types:** REGULAR, INVESTMENT, CREDIT
- **Transaction types:** INCOME, EXPENSE (+ isReimbursement flag)
- **Payment types:** EFECTIVO, DEBITO, CREDITO, TRANSFERENCIA
- **Partnership status:** PENDING, ACCEPTED, REJECTED
- **Transfers:** between personal accounts, shared accounts, and partner accounts
- **Currency Exchange:** buy/sell USD within an account (personal or shared)

---

## Flutter Architecture

### State Management: Provider (ChangeNotifier)
Each feature screen has its own `ChangeNotifier` provider. `AuthProvider` lives at the root and persists token via `shared_preferences`.

### Project Structure
```
financialtracker_flutter/
├── lib/
│   ├── main.dart
│   ├── app.dart                        # MaterialApp + GoRouter setup + MultiProvider
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart         # Dio instance with JWT interceptor + 401 redirect
│   │   │   └── api_endpoints.dart      # Base URL + endpoint constants
│   │   ├── models/                     # Dart data classes (fromJson/toJson)
│   │   │   ├── user.dart
│   │   │   ├── transaction.dart
│   │   │   ├── category.dart
│   │   │   ├── account.dart
│   │   │   ├── shared_account.dart
│   │   │   ├── partnership.dart
│   │   │   ├── transfer.dart
│   │   │   └── dashboard_data.dart
│   │   ├── providers/
│   │   │   └── auth_provider.dart      # login/register/logout, token + user in SharedPrefs
│   │   └── utils/
│   │       └── formatters.dart         # fmtARS, fmtUSD, fmtDate (using intl)
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login_page.dart
│   │   │   ├── register_page.dart
│   │   │   └── forgot_password_page.dart
│   │   ├── dashboard/
│   │   │   ├── dashboard_page.dart
│   │   │   └── dashboard_provider.dart
│   │   ├── transactions/
│   │   │   ├── transactions_page.dart
│   │   │   └── transactions_provider.dart
│   │   ├── categories/
│   │   │   ├── categories_page.dart
│   │   │   └── categories_provider.dart
│   │   ├── accounts/
│   │   │   ├── accounts_page.dart
│   │   │   └── accounts_provider.dart
│   │   ├── partnerships/
│   │   │   ├── partnerships_page.dart
│   │   │   └── partnerships_provider.dart
│   │   ├── shared_dashboard/
│   │   │   ├── shared_dashboard_page.dart
│   │   │   └── shared_dashboard_provider.dart
│   │   ├── partner_view/
│   │   │   ├── partner_view_page.dart
│   │   │   └── partner_view_provider.dart
│   │   ├── calculator/
│   │   │   ├── calculator_page.dart
│   │   │   └── calculator_provider.dart
│   │   └── profile/
│   │       ├── profile_page.dart
│   │       └── profile_provider.dart
│   └── widgets/
│       ├── kpi_card.dart
│       ├── transaction_list_item.dart
│       ├── category_chart.dart         # fl_chart bar + pie charts
│       ├── transaction_form_sheet.dart # bottom sheet (replaces TransactionModal)
│       ├── account_form_sheet.dart
│       ├── category_form_sheet.dart
│       ├── transfer_form_sheet.dart
│       ├── exchange_form_sheet.dart
│       ├── pay_credit_sheet.dart
│       ├── account_detail_sheet.dart
│       ├── ai_analysis_sheet.dart
│       └── finance_export_sheet.dart   # copy-to-clipboard text formatter
└── android/
    └── app/
        └── src/main/
            ├── AndroidManifest.xml     # INTERNET + WRITE_EXTERNAL_STORAGE permissions
            └── res/                    # launcher icons
```

---

## Navigation (GoRouter)

```
/login              → LoginPage       (public)
/register           → RegisterPage    (public)
/forgot             → ForgotPasswordPage (public)

/ (ShellRoute)      → MainScaffold with BottomNavigationBar (authenticated)
  /                 → DashboardPage
  /transactions     → TransactionsPage
  /categories       → CategoriesPage
  /accounts         → AccountsPage
  /partnerships     → PartnershipsPage
  /calculator       → CalculatorPage
  /profile          → ProfilePage

/shared/:partnerId  → SharedDashboardPage (authenticated, no bottom nav)
/partner/:partnerId → PartnerViewPage     (authenticated, no bottom nav)
```

**Auth guard:** GoRouter `redirect` checks `AuthProvider.isLoggedIn`. Unauthenticated users go to `/login`; authenticated users on public routes go to `/`.

---

## Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Networking
  dio: ^5.7.0              # HTTP client with interceptors (replaces axios)

  # Navigation
  go_router: ^14.6.0       # Declarative routing (replaces react-router)

  # State Management
  provider: ^6.1.2         # ChangeNotifier (replaces React Context/useState)

  # Persistence
  shared_preferences: ^2.3.3  # JWT token + user (replaces localStorage)

  # Charts
  fl_chart: ^0.70.2        # Bar + Pie charts (replaces recharts)

  # Formatting
  intl: ^0.19.0            # ARS/USD currency + date formatting

  # PDF Export
  pdf: ^3.11.1             # PDF generation (replaces jsPDF + jsPDF-autotable)
  printing: ^5.13.2        # Share/save PDF via Android share sheet

  # Excel Export
  excel: ^4.0.6            # .xlsx generation (replaces xlsx npm)

  # File System
  path_provider: ^2.1.4    # Access Downloads directory on Android
  share_plus: ^10.0.3      # Native Android share sheet for files

  # UI
  flutter_colorpicker: ^1.1.0  # Color picker for categories/accounts
```

---

## Key Implementation Notes

### JWT Authentication
- Token stored via `shared_preferences` (replaces `localStorage`)
- Dio interceptor adds `Authorization: Bearer <token>` to every request
- On 401 response: clear token + navigate to `/login` (replicates axios interceptor behavior)

### Infinite Scroll
- `ScrollController` with listener: load next page when `position >= maxScrollExtent - 200px`
- Replaces `IntersectionObserver` from the web app

### Modals → Bottom Sheets
All forms (Transaction, Account, Category, Transfer, Exchange, PayCredit) become `showModalBottomSheet` with `isScrollControlled: true`. Drawers (AccountDetail, AIAnalysis) become `DraggableScrollableSheet`.

### PDF / Excel Export
- Generate bytes in memory using `pdf`/`excel` packages
- Save to `getDownloadsDirectory()` via `path_provider`
- Open Android share sheet via `share_plus` → user can open with Files, Drive, email, etc.
- Replaces browser `download` trigger from web

### Charts
- Bar charts → `BarChart` from `fl_chart`
- Pie/donut charts → `PieChart` from `fl_chart`
- CategoryChartSelector (bar/pie toggle) → replicated with a toggle widget + fl_chart

### AI Analysis
- Calls `POST https://financialtraker.onrender.com/api/ai/analyze` with JWT
- Same prompt-building logic translated to Dart
- Response parsed and displayed in expandable `ExpansionTile` list (replicates accordion UI)

### "Exportar IA" (FinanceExportPanel)
- Formats dashboard data into a plain-text report string
- Android: copies to clipboard via `Clipboard.setData()` (replaces `navigator.clipboard.writeText`)
- Shows a "Copiado ✓" snackbar

### Color Picker
- `flutter_colorpicker` package for category/account color selection
- Preset colors replicated as `GridView` of `InkWell` color swatches

### Date Pickers
- `showDatePicker()` — native Android Material date picker (replaces `<input type="date">`)
- Month/year filters: custom dropdown `DropdownButton` or `showDatePicker` in year-only mode

### Currency Formatting
- `NumberFormat.currency(locale: 'es_AR', symbol: '\$')` for ARS
- `NumberFormat.currency(locale: 'es_AR', symbol: 'U\$D')` for USD
- Using `intl` package (replaces `Intl.NumberFormat` JS)

---

## Android Configuration

**`AndroidManifest.xml` permissions:**
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28"/>
```

**`android/app/build.gradle`:**
- `minSdkVersion 21`
- `targetSdkVersion 35`
- `compileSdkVersion 35`

**Dark theme:** app uses a custom dark `ThemeData` matching the web app's color palette:
- Background: `#1A1714`
- Surface: `#111118`  
- Accent: `#1A7FD4` (blue)
- Income green: `#10b981`
- Expense red: `#f43f5e`

---

## Functionality Not Directly Migrated

| Web feature | Flutter resolution |
|---|---|
| `IntersectionObserver` infinite scroll | `ScrollController` listener |
| Browser download trigger (PDF/Excel) | `path_provider` + `share_plus` share sheet |
| `navigator.clipboard.writeText` | `Clipboard.setData()` |
| `window.confirm()` dialogs | `showDialog()` AlertDialog |
| CSS variables / TailwindCSS | Flutter `ThemeData` + `ColorScheme` |
| `localStorage` | `shared_preferences` |
| Recharts | `fl_chart` |
| `<input type="date">` | `showDatePicker()` native |
| `window.location.href = '/login'` on 401 | GoRouter `.go('/login')` in Dio interceptor |
| EmailJS (forgot password) | Same `/api/auth/forgot-password` backend endpoint — no EmailJS in Flutter |

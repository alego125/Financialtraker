import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const PartnershipsPage = lazy(() => import('./pages/PartnershipsPage'));
const SharedDashboardPage = lazy(() => import('./pages/SharedDashboardPage'));
const PartnerViewPage = lazy(() => import('./pages/PartnerViewPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const InvestmentsPage = lazy(() => import('./pages/InvestmentsPage'));
const InvestmentDashboardPage = lazy(() => import('./pages/InvestmentDashboardPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
import Layout              from './components/layout/Layout';

const PrivateRoute = ({ children }) => {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <p role="status" className="p-6">Comprobando sesión…</p>;
  if (sessionError) return <p role="alert" className="p-6">{sessionError}</p>;
  return user ? children : <Navigate to="/login" replace />;
};
const PublicRoute = ({ children }) => {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <p role="status" className="p-6">Comprobando sesión…</p>;
  if (sessionError) return <p role="alert" className="p-6">{sessionError}</p>;
  return user ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><Routes>
          <Route path="/login"            element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register"         element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password"  element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index                        element={<DashboardPage />} />
            <Route path="transactions"          element={<TransactionsPage />} />
            <Route path="categories"            element={<CategoriesPage />} />
            <Route path="accounts"              element={<AccountsPage />} />
            <Route path="partnerships"          element={<PartnershipsPage />} />
            <Route path="shared/:partnerId"     element={<SharedDashboardPage />} />
            <Route path="partner/:partnerId"    element={<PartnerViewPage />} />
            <Route path="profile"               element={<ProfilePage />} />
            <Route path="calculator"            element={<CalculatorPage />} />
            <Route path="analysis"              element={<AnalysisPage />} />
            <Route path="investments"           element={<InvestmentsPage />} />
            <Route path="investments/dashboard" element={<InvestmentDashboardPage />} />
            <Route path="reports"               element={<ReportPage />} />
          </Route>
        <Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

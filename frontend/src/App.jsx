import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import ForgotPasswordPage  from './pages/ForgotPasswordPage';
import DashboardPage       from './pages/DashboardPage';
import TransactionsPage    from './pages/TransactionsPage';
import CategoriesPage      from './pages/CategoriesPage';
import AccountsPage        from './pages/AccountsPage';
import PartnershipsPage    from './pages/PartnershipsPage';
import SharedDashboardPage from './pages/SharedDashboardPage';
import PartnerViewPage     from './pages/PartnerViewPage';
import ProfilePage         from './pages/ProfilePage';
import Layout              from './components/layout/Layout';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { useState } from 'react';
import logoUrl from '../assets/logo.png';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(form.email, form.password); }
    catch (err) { setError(err.response?.data?.error || 'Error al iniciar sesión'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-48 sm:w-64 h-48 sm:h-64 bg-violet-800/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoUrl} alt="FinancialTracker" className="w-14 h-14 rounded-2xl object-cover mb-4 shadow-lg shadow-accent/30" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Bienvenido</h1>
          <p className="text-slate-400 mt-1 text-sm">Ingresá a tu cuenta FinancialTracker</p>
        </div>

        <div className="card p-5 sm:p-7">
          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="tu@email.com" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Contraseña</label>
                <Link to="/forgot-password" className="text-xs text-accent-light hover:text-white transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input type="password" className="input" placeholder="••••••••" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm sm:text-base mt-1">
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-dark-500 text-center">
            <p className="text-slate-400 text-sm">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="text-accent-light hover:text-white font-medium transition-colors">Registrarse</Link>
            </p>
          </div>
          <div className="mt-3 p-3 bg-dark-700 rounded-xl">
            <p className="text-xs text-slate-500 text-center font-mono">Demo: demo@demo.com / demo1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}

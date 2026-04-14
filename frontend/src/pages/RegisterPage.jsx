import { useState } from 'react';
import logoUrl from '../assets/logo.png';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    if (form.password.length < 6) return setError('Mínimo 6 caracteres');
    setLoading(true);
    try { await register(form.name, form.email, form.password); }
    catch (err) { setError(err.response?.data?.error || 'Error al registrarse'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-72 sm:w-96 h-72 sm:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoUrl} alt="FinancialTracker" className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-lg shadow-accent/30 mx-auto block" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--text)]">Crear Cuenta</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Comenzá a trackear tus finanzas</p>
        </div>

        <div className="card p-5 sm:p-7">
          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre</label>
              <input type="text" className="input" placeholder="Tu nombre" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="tu@email.com" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="input pr-10" placeholder="Mínimo 6 caracteres" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] text-sm select-none">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirmar Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="input pr-10" placeholder="Repetir contraseña" value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm sm:text-base">
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-[var(--border)] text-center">
            <p className="text-[var(--muted)] text-sm">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-accent-light hover:text-[var(--text)] font-medium transition-colors">Iniciar Sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

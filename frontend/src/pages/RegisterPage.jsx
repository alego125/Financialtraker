import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-72 sm:w-96 h-72 sm:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent mb-4 shadow-lg shadow-accent/30">
            <span className="text-white font-display font-bold text-2xl">F</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Crear Cuenta</h1>
          <p className="text-slate-400 mt-1 text-sm">Comenzá a trackear tus finanzas</p>
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
              <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Confirmar Contraseña</label>
              <input type="password" className="input" placeholder="Repetir contraseña" value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm sm:text-base mt-1">
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-dark-500 text-center">
            <p className="text-slate-400 text-sm">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-accent-light hover:text-white font-medium transition-colors">Iniciar Sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('profile'); // 'profile' | 'password'
  const [form, setForm] = useState({ name: '', email: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(r => setForm({ name: r.data.name, email: r.data.email })).catch(() => {});
  }, []);

  const clearMessages = () => { setSuccess(''); setError(''); };

  const handleProfile = async (e) => {
    e.preventDefault(); clearMessages(); setLoading(true);
    try {
      const { data } = await api.put('/auth/profile', { name: form.name, email: form.email });
      // Update stored user
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, name: data.user.name, email: data.user.email }));
      setSuccess('Perfil actualizado correctamente');
    } catch (err) { setError(err.response?.data?.error || 'Error al actualizar'); }
    finally { setLoading(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault(); clearMessages();
    if (passForm.newPassword !== passForm.confirm) return setError('Las contraseñas no coinciden');
    if (passForm.newPassword.length < 6) return setError('Mínimo 6 caracteres');
    setLoading(true);
    try {
      await api.put('/auth/profile', { currentPassword: passForm.currentPassword, newPassword: passForm.newPassword });
      setSuccess('Contraseña cambiada. Volvé a iniciar sesión.');
      setPassForm({ currentPassword: '', newPassword: '', confirm: '' });
      setTimeout(() => { logout(); window.location.href = '/login'; }, 2000);
    } catch (err) { setError(err.response?.data?.error || 'Error al cambiar contraseña'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Mi Cuenta</h1>
        <p className="text-slate-400 text-sm mt-0.5">Gestioná tu información personal</p>
      </div>

      {/* Avatar card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-light font-display font-bold text-2xl flex-shrink-0">
          {form.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-white text-base truncate">{form.name}</div>
          <div className="text-slate-400 text-sm font-mono truncate">{form.email}</div>
          <div className="text-xs text-slate-600 mt-0.5">Miembro de FinancialTracker</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-700 p-1 rounded-xl border border-dark-500">
        {[['profile', '👤 Perfil'], ['password', '🔑 Contraseña']].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); clearMessages(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold transition-all ${tab === v ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error   && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm">{success}</div>}

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="card p-5">
          <h2 className="text-sm font-display font-bold text-white mb-4">Información Personal</h2>
          <form onSubmit={handleProfile} className="space-y-4">
            <div>
              <label className="label">Nombre</label>
              <input type="text" className="input" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <div className="card p-5">
          <h2 className="text-sm font-display font-bold text-white mb-1">Cambiar Contraseña</h2>
          <p className="text-xs text-slate-500 mb-4">Después de cambiarla vas a tener que volver a iniciar sesión.</p>
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="label">Contraseña actual</label>
              <input type="password" className="input" placeholder="••••••••"
                value={passForm.currentPassword}
                onChange={e => setPassForm(p => ({ ...p, currentPassword: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres"
                value={passForm.newPassword}
                onChange={e => setPassForm(p => ({ ...p, newPassword: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <input type="password" className="input" placeholder="Repetir contraseña"
                value={passForm.confirm}
                onChange={e => setPassForm(p => ({ ...p, confirm: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      )}

      {/* Danger zone */}
      <div className="card p-5 border-rose-500/20">
        <h2 className="text-sm font-display font-bold text-rose-400 mb-3">Zona de peligro</h2>
        <button onClick={() => { logout(); window.location.href = '/login'; }}
          className="btn-danger w-full text-sm py-2.5">
          Cerrar sesión en todos los dispositivos
        </button>
      </div>
    </div>
  );
}

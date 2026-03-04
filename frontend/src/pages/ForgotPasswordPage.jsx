import { useState } from 'react';
import { Link } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import api from '../services/api';

// Configurá estas variables con tus datos de EmailJS
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Pedirle al backend que genere la contraseña temporal
      const { data } = await api.post('/auth/forgot-password', { email });

      if (!data.found) {
        // No revelar si el email existe o no — mostrar el mismo mensaje de éxito
        setSent(true);
        return;
      }

      // 2. Enviar el email desde el frontend via EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email:      data.email,
          to_name:       data.name,
          temp_password: data.tempPassword,
        },
        EMAILJS_PUBLIC_KEY
      );

      setSent(true);
    } catch (err) {
      console.error('Reset error:', err);
      setError('Hubo un error al procesar la solicitud. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent mb-4 shadow-lg shadow-accent/30">
            <span className="text-white font-display font-bold text-2xl">F</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Olvidé mi contraseña</h1>
          <p className="text-slate-400 mt-1 text-sm">Te enviamos una contraseña temporal por email</p>
        </div>

        <div className="card p-5 sm:p-7">
          {!sent ? (
            <>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email de tu cuenta</label>
                  <input type="email" className="input" placeholder="tu@email.com"
                    value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Enviando...' : 'Enviar contraseña temporal'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl mx-auto">
                ✉️
              </div>
              <div>
                <h2 className="font-display font-bold text-white mb-1">Revisá tu email</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Si <strong className="text-slate-300">{email}</strong> está registrado, vas a recibir
                  una contraseña temporal en los próximos minutos.
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-amber-400 text-xs leading-relaxed">
                  ⚠️ Una vez que ingreses con la contraseña temporal, cambiala desde <strong>Mi Cuenta</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-dark-500 text-center">
            <Link to="/login" className="text-accent-light hover:text-white text-sm font-medium transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

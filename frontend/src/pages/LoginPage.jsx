import { useState, useEffect } from 'react';
import logoUrl from '../assets/logo.png';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('ft-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else      document.documentElement.classList.remove('dark');
    localStorage.setItem('ft-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
}

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError]     = useState('');
  const [dark, setDark]       = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(form.email, form.password); }
    catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || (err.response?.status === 401 ? 'Email o contraseña incorrectos' : null)
        || (err.response?.status === 404 ? 'Usuario no encontrado' : null)
        || 'Email o contraseña incorrectos';
      setError(msg);
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--surface)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px', width: '360px', height: '360px',
        background: 'var(--gold-pale)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.6,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-60px', width: '280px', height: '280px',
        background: 'var(--gold-pale)', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.4,
        pointerEvents: 'none',
      }} />

      {/* Theme toggle */}
      <button onClick={() => setDark(d => !d)} style={{
        position: 'absolute', top: '20px', right: '20px',
        width: '40px', height: '40px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface2)', border: '1.5px solid var(--border2)',
        color: 'var(--muted)', fontSize: '18px', cursor: 'pointer',
        zIndex: 10,
      }}>
        {dark ? '☀' : '☾'}
      </button>

      <div style={{position: 'relative', width: '100%', maxWidth: '400px'}}>
        {/* Header */}
        <div style={{textAlign: 'center', marginBottom: '32px'}}>
          <img src={logoUrl} alt="FinancialTracker"
            style={{width:'64px', height:'64px', borderRadius:'20px', objectFit:'cover',
              boxShadow:'0 8px 32px rgba(232,160,32,0.3)', margin:'0 auto 16px', display:'block'}} />
          <h1 style={{
            fontSize: '2rem', fontFamily: 'Syne, sans-serif', fontWeight: 800,
            color: 'var(--text)', margin: '0 0 6px',
          }}>Bienvenido</h1>
          <p style={{fontSize: '0.875rem', color: 'var(--muted)', margin: 0}}>
            Ingresá a tu cuenta para continuar
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface2)', border: '1.5px solid var(--border)',
          borderRadius: '24px', padding: '28px', boxShadow: 'var(--card-shadow2)',
        }}>
          {error && (
            <div style={{
              background: 'rgba(153,27,27,0.10)', border: '1.5px solid rgba(153,27,27,0.35)',
              color: 'var(--expense)', borderRadius: '12px', padding: '12px 16px',
              fontSize: '0.875rem', marginBottom: '20px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{fontSize:'1.1rem', flexShrink:0}}>⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="tu@email.com"
                value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div style={{position: 'relative'}}>
                <input type={showPass ? 'text' : 'password'} className="input"
                  style={{paddingRight: '44px'}}
                  placeholder="Tu contraseña"
                  value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem',
                }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div style={{textAlign: 'right', marginTop: '-8px'}}>
              <Link to="/forgot-password" style={{
                fontSize: '0.8rem', color: 'var(--gold)',
                textDecoration: 'none', fontWeight: 600, fontFamily: 'Syne, sans-serif',
              }}>¿Olvidaste tu contraseña?</Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary"
              style={{width: '100%', justifyContent: 'center', padding: '14px', fontSize: '0.95rem'}}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>

          <div style={{
            marginTop: '20px', paddingTop: '20px',
            borderTop: '1.5px solid var(--border)', textAlign: 'center',
          }}>
            <p style={{fontSize: '0.875rem', color: 'var(--muted)', margin: 0}}>
              ¿No tenés cuenta?{' '}
              <Link to="/register" style={{
                color: 'var(--gold)', fontWeight: 700,
                textDecoration: 'none', fontFamily: 'Syne, sans-serif',
              }}>Registrate</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

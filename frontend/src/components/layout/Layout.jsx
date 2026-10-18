import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import logoUrl from '../../assets/logo.png';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Icon from '../ui/Icon';
import './banking-layout.css';

const GROUPS = [
 { label: 'Mis finanzas', items: [ ['/', 'home', 'Resumen', true], ['/transactions', 'transactions', 'Transacciones'], ['/accounts', 'wallet', 'Cuentas'], ['/investments', 'trend', 'Inversiones'] ] },
 { label: 'Herramientas', items: [ ['/analysis', 'chart', 'Análisis'], ['/calculator', 'calculator', 'Calculadora'], ['/reports', 'file', 'Informe PDF'], ['/categories', 'category', 'Categorías'] ] },
 { label: 'Mi espacio', items: [ ['/partnerships', 'users', 'Vínculos'], ['/profile', 'user', 'Mi cuenta'] ] },
];
function useTheme() {
 const [dark, setDark] = useState(() => {
  const saved = localStorage.getItem('ft-theme');
  return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
 });
 useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('ft-theme', dark ? 'dark' : 'light'); }, [dark]);
 return [dark, setDark];
}
export default function Layout() {
 const { user, logout } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const [sessionError, setSessionError] = useState('');
 const [loggingOut, setLoggingOut] = useState(false);
 const [partners, setPartners] = useState([]);
 const [pendingCount, setPendingCount] = useState(0);
 const [collapsed, setCollapsed] = useState(false);
 const [mobileOpen, setMobileOpen] = useState(false);
 const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
 const [dark, setDark] = useTheme();
 const drawerRef = useRef(null);
 const mainRef = useRef(null);
 const headerRef = useRef(null);
 useEffect(() => { const resize = () => setIsMobile(window.innerWidth < 1024); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
 useEffect(() => { setMobileOpen(false); }, [location.pathname, isMobile]);
 useEffect(() => {
  if (!mobileOpen || !isMobile) return;
  const previous = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  mainRef.current?.setAttribute('inert', ''); headerRef.current?.setAttribute('inert', '');
  const drawer = drawerRef.current;
  drawer?.querySelector('button, a')?.focus();
  const keydown = e => {
   if (e.key === 'Escape') { e.preventDefault(); setMobileOpen(false); }
   if (e.key !== 'Tab') return;
   const controls = [...drawer.querySelectorAll('a[href], button:not(:disabled)')];
   const first = controls[0], last = controls[controls.length - 1];
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  document.addEventListener('keydown', keydown);
  return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; mainRef.current?.removeAttribute('inert'); headerRef.current?.removeAttribute('inert'); if (previous?.isConnected) previous.focus(); };
 }, [mobileOpen, isMobile]);
 useEffect(() => {
  const controller = new AbortController(); let active = true, pending = false;
  const load = async () => {
   if (pending) return; pending = true;
   try { const { data } = await api.get('/partnerships', { signal: controller.signal }); if (!active) return; setPartners(data.filter(p => p.status === 'ACCEPTED' && p.partner)); setPendingCount(data.filter(p => p.status === 'PENDING' && !p.isSender).length); }
   catch { if (active && !controller.signal.aborted) setSessionError('No se pudieron actualizar los vínculos'); }
   finally { pending = false; }
  };
  load(); const interval = setInterval(load, 30000);
  return () => { active = false; controller.abort(); clearInterval(interval); };
 }, []);
 const handleLogout = async () => {
  if (loggingOut) return; setSessionError(''); setLoggingOut(true);
  try { await logout(); navigate('/login'); }
  catch (err) { setSessionError(err.response?.data?.error || 'No se pudo cerrar la sesión. Volvé a intentarlo.'); }
  finally { setLoggingOut(false); }
 };
 const compact = collapsed && !isMobile;
 const renderLink = ([to, icon, label, end], extraLabel) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `bank-nav-link${isActive ? ' is-active' : ''}`} title={compact ? (extraLabel || label) : undefined} aria-label={compact ? (extraLabel || label) : undefined}><Icon name={icon} /><span className="bank-nav-label">{label}</span>{to === '/partnerships' && pendingCount > 0 && <span className="bank-nav-badge" aria-label={`${pendingCount} invitaciones pendientes`}>{pendingCount}</span>}</NavLink>;
 const themeButton = <button type="button" className="bank-icon-button" onClick={() => setDark(d => !d)} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} title={dark ? 'Modo claro' : 'Modo oscuro'}><Icon name={dark ? 'sun' : 'moon'} /></button>;
 const sidebar = <>
  <div className="bank-brand-row"><NavLink to="/" className="bank-brand" aria-label="FinancialTracker, inicio"><img src={logoUrl} alt="" /><span className="bank-brand-copy"><strong>FinancialTracker</strong><small>Tu espacio financiero</small></span></NavLink><button type="button" className="bank-icon-button bank-collapse" aria-label={isMobile ? 'Cerrar menú' : compact ? 'Expandir navegación' : 'Contraer navegación'} onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(c => !c)}><Icon name={isMobile ? 'close' : compact ? 'right' : 'left'} size={18} /></button></div>
  <nav className="bank-navigation" aria-label="Navegación principal">{GROUPS.map(group => <div className="bank-nav-group" key={group.label}><div className="bank-nav-heading">{group.label}</div>{group.items.map(item => renderLink(item))}</div>)}{partners.length > 0 && <div className="bank-nav-group"><div className="bank-nav-heading">Compartido</div>{partners.map(p => <div key={p.id}><div className="bank-partner-name">{p.partner.name}</div>{renderLink([`/shared/${p.partner.id}`, 'users', 'Dashboard conjunto'], `Dashboard conjunto de ${p.partner.name}`)}{renderLink([`/partner/${p.partner.id}`, 'wallet', 'Solo sus finanzas'], `Finanzas de ${p.partner.name}`)}</div>)}</div>}</nav>
  <div className="bank-sidebar-footer"><div className="bank-theme-row">{themeButton}<span className="bank-nav-label">{dark ? 'Modo oscuro' : 'Modo claro'}</span></div><div className="bank-user"><div className="bank-avatar" aria-hidden="true">{(user?.name || 'U').charAt(0).toUpperCase()}</div><div className="bank-user-copy"><strong>{user?.name}</strong><span>{user?.email}</span></div><button type="button" className="bank-icon-button" aria-label={loggingOut ? 'Cerrando sesión' : 'Cerrar sesión'} title="Cerrar sesión" disabled={loggingOut} onClick={handleLogout}><Icon name="logout" size={19} /></button></div></div>
 </>;
 return <div className={`bank-shell${compact ? ' bank-shell-compact' : ''}`}>
  {!isMobile && <aside className="bank-sidebar">{sidebar}</aside>}
  {isMobile && <header className="bank-mobile-header" ref={headerRef}><div className="bank-brand"><img src={logoUrl} alt="" /><strong>FinancialTracker</strong></div><div className="bank-mobile-actions">{themeButton}<button type="button" className="bank-icon-button" aria-label="Abrir menú" aria-expanded={mobileOpen} aria-controls="bank-mobile-menu" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button></div></header>}
  {isMobile && mobileOpen && <div className="bank-drawer-backdrop" onClick={() => setMobileOpen(false)}><aside className="bank-sidebar bank-drawer" id="bank-mobile-menu" role="dialog" aria-modal="true" aria-label="Menú de navegación" ref={drawerRef} onClick={e => e.stopPropagation()}>{sidebar}</aside></div>}
  <main className="bank-main" ref={mainRef}>{sessionError && <p role="alert" className="bank-session-error">{sessionError}</p>}<Outlet /></main>
 </div>;
}


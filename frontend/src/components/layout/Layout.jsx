import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';
import api from '../../services/api';

const NAV_ITEMS = [
  { to: '/',             icon: '📊', label: 'Mi Dashboard',  end: true },
  { to: '/transactions', icon: '💳', label: 'Transacciones' },
  { to: '/categories',   icon: '🏷️',  label: 'Categorías' },
  { to: '/accounts',     icon: '🏦', label: 'Cuentas' },
  { to: '/partnerships', icon: '💑', label: 'Vínculos', badge: true },
  { to: '/profile',      icon: '⚙️',  label: 'Mi Cuenta' },
];

export default function Layout() {
  const { user, logout }                = useAuth();
  const navigate                        = useNavigate();
  const location                        = useLocation();
  const [partners, setPartners]         = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [collapsed, setCollapsed]       = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/partnerships');
        setPartners(data.filter(p => p.status === 'ACCEPTED' && p.partner));
        setPendingCount(data.filter(p => p.status === 'PENDING' && !p.isSender).length);
      } catch {}
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const NavContent = ({ mobile = false }) => (
    <>
      {(mobile || !collapsed) && (
        <div className="text-xs font-display font-semibold text-slate-600 uppercase tracking-widest mb-2 mt-1 px-2">Principal</div>
      )}

      {NAV_ITEMS.map(({ to, icon, label, end, badge }) => (
        <NavLink key={to} to={to} end={end}
          title={!mobile && collapsed ? label : undefined}
          className={({ isActive }) =>
            'flex items-center gap-3 rounded-xl text-sm font-display font-medium transition-all border relative ' +
            (!mobile && collapsed ? 'justify-center px-0 py-3 ' : 'px-3 py-2.5 ') +
            (isActive ? 'bg-accent/20 text-accent-light border-accent/30' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-600 border-transparent')
          }>
          <span className="text-base flex-shrink-0">{icon}</span>
          {(mobile || !collapsed) && <span className="flex-1 truncate">{label}</span>}
          {(mobile || !collapsed) && badge && pendingCount > 0 && (
            <span className="bg-amber-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{pendingCount}</span>
          )}
          {!mobile && collapsed && badge && pendingCount > 0 && (
            <span className="absolute top-1 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </NavLink>
      ))}

      {partners.length > 0 && (
        <>
          {(mobile || !collapsed)
            ? <div className="text-xs font-display font-semibold text-slate-600 uppercase tracking-widest mt-4 mb-2 px-2">Compartido</div>
            : <div className="my-2 border-t border-dark-600" />}
          {partners.map(p => (
            <div key={p.id}>
              {(mobile || !collapsed) && (
                <div className="px-2 py-1 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center text-accent-light text-xs font-bold flex-shrink-0">
                    {p.partner.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-500 font-display font-semibold truncate">{p.partner.name}</span>
                </div>
              )}
              <Link to={`/shared/${p.partner.id}`}
                title={!mobile && collapsed ? `Conjunto — ${p.partner.name}` : undefined}
                className={'flex items-center gap-2 rounded-xl text-xs font-display font-medium transition-all border ' +
                  (!mobile && collapsed ? 'justify-center px-0 py-3 ' : 'pl-7 pr-3 py-2 ') +
                  (location.pathname === `/shared/${p.partner.id}` ? 'bg-accent/20 text-accent-light border-accent/30' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-600 border-transparent')}>
                <span className="flex-shrink-0">🤝</span>
                {(mobile || !collapsed) && <span className="truncate">Dashboard conjunto</span>}
              </Link>
              <Link to={`/partner/${p.partner.id}`}
                title={!mobile && collapsed ? `Finanzas — ${p.partner.name}` : undefined}
                className={'flex items-center gap-2 rounded-xl text-xs font-display font-medium transition-all border ' +
                  (!mobile && collapsed ? 'justify-center px-0 py-3 ' : 'pl-7 pr-3 py-2 ') +
                  (location.pathname === `/partner/${p.partner.id}` ? 'bg-accent/20 text-accent-light border-accent/30' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-600 border-transparent')}>
                <span className="flex-shrink-0">👁️</span>
                {(mobile || !collapsed) && <span className="truncate">Solo sus finanzas</span>}
              </Link>
            </div>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-500 flex flex-col transform transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-dark-500">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-white font-display font-bold text-sm">F</div>
            <div>
              <div className="font-display font-bold text-white text-base leading-tight">FinancialTracker</div>
              <div className="text-xs text-slate-500 font-mono">v3.0</div>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 text-slate-400 flex items-center justify-center">✕</button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto"><NavContent mobile /></nav>
        <div className="p-3 border-t border-dark-500">
          <div className="bg-dark-700 rounded-xl p-2.5 mb-2 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-light font-bold text-sm flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-display font-semibold text-white truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 font-mono truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full btn-secondary text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 text-xs py-2">
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-shrink-0 bg-dark-800 border-r border-dark-500 flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex items-center border-b border-dark-500 h-14 px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-accent flex-shrink-0 flex items-center justify-center text-white font-display font-bold text-sm">F</div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold text-white text-base leading-tight">FinancialTracker</div>
                <div className="text-xs text-slate-500 font-mono">v3.0</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} title="Colapsar"
              className="w-7 h-7 flex-shrink-0 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-400 text-slate-400 hover:text-white flex items-center justify-center text-xs">◀</button>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center pt-2">
            <button onClick={() => setCollapsed(false)} title="Expandir"
              className="w-8 h-8 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-400 text-slate-400 hover:text-white flex items-center justify-center text-xs">▶</button>
          </div>
        )}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden"><NavContent /></nav>
        <div className={`border-t border-dark-500 ${collapsed ? 'p-2' : 'p-3'}`}>
          {collapsed ? (
            <button onClick={() => { logout(); navigate('/login'); }} title="Cerrar sesión"
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">🚪</button>
          ) : (
            <>
              <Link to="/profile" className="bg-dark-700 hover:bg-dark-600 transition-colors rounded-xl p-2.5 mb-2 flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-light font-bold text-sm flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-display font-semibold text-white truncate group-hover:text-accent-light transition-colors">{user?.name}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{user?.email}</div>
                </div>
                <span className="text-slate-600 group-hover:text-slate-400 text-xs flex-shrink-0">⚙️</span>
              </Link>
              <button onClick={() => { logout(); navigate('/login'); }} className="w-full btn-secondary text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 text-xs py-2">Cerrar Sesión</button>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-dark-800 border-b border-dark-500 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 rounded-xl bg-dark-700 border border-dark-400 text-slate-400 flex items-center justify-center text-lg">☰</button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white font-display font-bold text-sm">F</div>
            <span className="font-display font-bold text-white text-base">FinancialTracker</span>
          </div>
          <Link to="/profile" className="w-9 h-9 rounded-xl bg-dark-700 border border-dark-400 flex items-center justify-center text-accent-light font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase()}
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}

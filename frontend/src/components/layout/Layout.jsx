import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import logoUrl from '../../assets/logo.png';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';
import api from '../../services/api';

const NAV_ITEMS = [
  { to: '/',             icon: '⬡', label: 'Mi Dashboard',  end: true },
  { to: '/transactions', icon: '↕', label: 'Transacciones' },
  { to: '/categories',   icon: '◑', label: 'Categorías' },
  { to: '/accounts',     icon: '◈', label: 'Cuentas' },
  { to: '/partnerships', icon: '⊕', label: 'Vínculos', badge: true },
  { to: '/profile',      icon: '◎', label: 'Mi Cuenta' },
];

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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout }                = useAuth();
  const navigate                        = useNavigate();
  const location                        = useLocation();
  const [partners, setPartners]         = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  // Desktop sidebar: starts collapsed on small screens, expanded on large
  const [collapsed, setCollapsed]       = useState(false);
  // Mobile drawer: starts CLOSED
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [dark, setDark]                 = useTheme();
  const isMobile                        = useIsMobile();

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

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const ThemeToggle = () => (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      style={{
        width:'36px', height:'36px', borderRadius:'10px', flexShrink: 0,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'var(--surface3)', border:'1.5px solid var(--border2)',
        color:'var(--text2)', fontSize:'16px', cursor:'pointer', transition:'all 0.2s',
      }}
    >{dark ? '☀' : '☾'}</button>
  );

  const navItemStyle = (isActive, isCollapsed = false) => ({
    display:'flex', alignItems:'center', gap:'12px',
    borderRadius:'14px', fontSize:'0.875rem',
    fontFamily:'Syne, sans-serif', fontWeight:600,
    transition:'all 0.2s', position:'relative', cursor:'pointer',
    padding: isCollapsed ? '12px 0' : '10px 14px',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    textDecoration:'none',
    ...(isActive
      ? { background:'var(--gold)', color:'#1A1714', boxShadow:'0 2px 12px rgba(232,160,32,0.3)' }
      : { background:'transparent', color:'var(--text2)' }
    ),
  });

  const NavContent = ({ mobile = false }) => {
    const isC = !mobile && collapsed;
    return (
      <>
        {!isC && (
          <div style={{
            fontSize:'0.65rem', fontFamily:'Syne,sans-serif', fontWeight:700,
            textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--subtle)',
            marginBottom:'6px', marginTop:'4px', paddingLeft:'8px',
          }}>Principal</div>
        )}

        {NAV_ITEMS.map(({ to, icon, label, end, badge }) => (
          <NavLink key={to} to={to} end={end}
            title={isC ? label : undefined}
            style={({ isActive }) => navItemStyle(isActive, isC)}
            onMouseEnter={e => {
              if (!e.currentTarget.style.background.includes('232,160,32') && e.currentTarget.style.background !== 'var(--gold)')
                e.currentTarget.style.background = 'var(--surface3)';
              e.currentTarget.style.color = e.currentTarget.style.background.includes('232,160,32') || e.currentTarget.style.background === 'var(--gold)' ? '#1A1714' : 'var(--text)';
            }}
            onMouseLeave={e => {
              const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
              if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }
            }}
          >
            <span style={{fontSize:'1rem', lineHeight:1, flexShrink:0}}>{icon}</span>
            {!isC && <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label}</span>}
            {!isC && badge && pendingCount > 0 && (
              <span style={{background:'var(--gold)',color:'#1A1714',fontSize:'0.65rem',fontWeight:700,width:'18px',height:'18px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{pendingCount}</span>
            )}
            {isC && badge && pendingCount > 0 && (
              <span style={{position:'absolute',top:'4px',right:'6px',width:'7px',height:'7px',borderRadius:'50%',background:'var(--gold)'}} />
            )}
          </NavLink>
        ))}

        {partners.length > 0 && (
          <>
            <div style={{borderTop:'1.5px solid var(--border)', margin:'10px 0 8px'}} />
            {!isC && (
              <div style={{fontSize:'0.65rem',fontFamily:'Syne,sans-serif',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--subtle)',marginBottom:'6px',paddingLeft:'8px'}}>
                Compartido
              </div>
            )}
            {partners.map(p => (
              <div key={p.id}>
                {!isC && (
                  <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 8px',marginBottom:'2px'}}>
                    <div style={{width:'22px',height:'22px',borderRadius:'7px',flexShrink:0,background:'var(--gold-pale)',border:'1.5px solid var(--gold-border)',color:'var(--gold)',fontSize:'0.65rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {(p.partner.name||'?').charAt(0).toUpperCase()}
                    </div>
                    <span style={{fontSize:'0.75rem',fontFamily:'Syne,sans-serif',fontWeight:600,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.partner.name}</span>
                  </div>
                )}
                {[
                  { to:`/shared/${p.partner.id}`, icon:'⊛', label:'Dashboard conjunto' },
                  { to:`/partner/${p.partner.id}`, icon:'◉', label:'Solo sus finanzas' },
                ].map(item => (
                  <NavLink key={item.to} to={item.to}
                    title={isC ? `${item.label} — ${p.partner.name}` : undefined}
                    style={({ isActive }) => ({...navItemStyle(isActive, isC), fontSize:'0.8rem'})}
                    onMouseEnter={e => {
                      if (!e.currentTarget.style.background.includes('232,160,32') && e.currentTarget.style.background !== 'var(--gold)')
                        e.currentTarget.style.background = 'var(--surface3)';
                    }}
                    onMouseLeave={e => {
                      const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                      if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }
                    }}
                  >
                    <span style={{fontSize:'1rem',lineHeight:1,flexShrink:0}}>{item.icon}</span>
                    {!isC && <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </>
        )}
      </>
    );
  };

  const sidebarBase = {
    background:'var(--surface2)', borderRight:'1.5px solid var(--border)',
    padding:'20px 12px', display:'flex', flexDirection:'column', gap:'4px',
    overflowY:'auto', overflowX:'hidden', flexShrink:0,
    transition:'width 0.25s ease',
  };

  return (
    <div style={{display:'flex', height:'100vh', overflow:'hidden', background:'var(--surface)'}}>

      {/* ── Desktop sidebar — only visible when not mobile ── */}
      {!isMobile && (
      <aside style={{...sidebarBase, width: collapsed ? '72px' : '240px', display:'flex', flexDirection:'column'}}>
        {/* Logo + collapse toggle */}
        <div style={{display:'flex', alignItems:'center', marginBottom:'24px', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '0' : '0 4px'}}>
          {!collapsed && (
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
              <img src={logoUrl} alt="FT" style={{width:'32px',height:'32px',borderRadius:'10px',objectFit:'cover'}} />
              <div>
                <div style={{fontSize:'0.875rem',fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--text)'}}>FinancialTracker</div>
                <div style={{fontSize:'0.65rem',color:'var(--subtle)'}}>v3.0</div>
              </div>
            </div>
          )}
          {collapsed && <img src={logoUrl} alt="FT" style={{width:'32px',height:'32px',borderRadius:'10px',objectFit:'cover'}} />}
          <button onClick={() => setCollapsed(c => !c)} style={{
            width:'28px',height:'28px',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'0.9rem',background:'var(--surface3)',color:'var(--muted)',
            border:'1px solid var(--border2)',cursor:'pointer',flexShrink:0,
          }}>{collapsed ? '›' : '‹'}</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'2px',flex:1}}>
          <NavContent />
        </div>

        {/* Bottom: theme + user */}
        <div style={{paddingTop:'12px',borderTop:'1.5px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',alignItems: collapsed ? 'center' : 'stretch'}}>
          <ThemeToggle />
          {!collapsed && (
            <div style={{borderRadius:'14px',padding:'10px 12px',display:'flex',alignItems:'center',gap:'10px',background:'var(--surface3)',border:'1.5px solid var(--border2)'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'10px',flexShrink:0,background:'var(--gold-pale)',border:'1.5px solid var(--gold-border)',color:'var(--gold)',fontSize:'0.875rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif'}}>
                {(user?.name||'U').charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.75rem',fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name}</div>
                <div style={{fontSize:'0.65rem',color:'var(--subtle)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} style={{fontSize:'0.7rem',fontWeight:600,padding:'4px 8px',borderRadius:'8px',color:'var(--expense)',background:'rgba(220,38,38,0.08)',border:'none',cursor:'pointer'}}>Salir</button>
            </div>
          )}
        </div>
      </aside>
      )}

      {/* ── Mobile top bar ── */}
      {isMobile && (
      <div style={{
        position:'fixed', top:0, left:0, right:0, zIndex:50,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', height:'56px',
        background:'var(--surface2)', borderBottom:'1.5px solid var(--border)',
        boxShadow:'var(--card-shadow)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <img src={logoUrl} alt="FT" style={{width:'32px',height:'32px',borderRadius:'10px',objectFit:'cover'}} />
          <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'0.875rem',color:'var(--text)'}}>FinancialTracker</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <ThemeToggle />
          {/* Hamburger — opens mobile drawer */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{
              width:'36px', height:'36px', borderRadius:'10px', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background: mobileOpen ? 'var(--gold)' : 'var(--surface3)',
              border:'1.5px solid var(--border2)',
              color: mobileOpen ? '#1A1714' : 'var(--text)',
              cursor:'pointer', fontSize:'1.1rem', transition:'all 0.2s',
            }}
            aria-label="Abrir menú"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
      )}

      {/* ── Mobile drawer overlay ── */}
      {isMobile && <div
        style={{
          position:'fixed', inset:0, zIndex:48,
          background:'var(--overlay)', backdropFilter:'blur(2px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition:'opacity 0.28s ease',
        }}
        onClick={() => setMobileOpen(false)}
      />}

      {/* ── Mobile drawer ── */}
      {isMobile && <div
        style={{
          position:'fixed', top:0, left:0, bottom:0, zIndex:49,
          width:'280px', background:'var(--surface2)',
          borderRight:'1.5px solid var(--border)',
          padding:'20px 12px', display:'flex', flexDirection:'column', gap:'4px',
          overflowY:'auto',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-280px)',
          transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          willChange:'transform',
          visibility: mobileOpen ? 'visible' : 'hidden',
        }}
      >
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px',marginBottom:'24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <img src={logoUrl} alt="FT" style={{width:'32px',height:'32px',borderRadius:'10px',objectFit:'cover'}} />
            <div>
              <div style={{fontSize:'0.875rem',fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--text)'}}>FinancialTracker</div>
              <div style={{fontSize:'0.65rem',color:'var(--subtle)'}}>v3.0</div>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} style={{width:'32px',height:'32px',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--surface3)',color:'var(--muted)',cursor:'pointer',border:'none'}}>✕</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'2px',flex:1}}>
          <NavContent mobile />
        </div>

        <div style={{paddingTop:'12px',borderTop:'1.5px solid var(--border)'}}>
          <div style={{borderRadius:'14px',padding:'10px 12px',display:'flex',alignItems:'center',gap:'10px',background:'var(--surface3)',border:'1.5px solid var(--border2)'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'10px',flexShrink:0,background:'var(--gold-pale)',color:'var(--gold)',fontSize:'0.875rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif'}}>
              {(user?.name||'U').charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'0.75rem',fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name}</div>
              <div style={{fontSize:'0.65rem',color:'var(--subtle)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} style={{fontSize:'0.75rem',fontWeight:600,padding:'6px 10px',borderRadius:'8px',color:'var(--expense)',background:'rgba(220,38,38,0.08)',border:'none',cursor:'pointer'}}>Salir</button>
          </div>
        </div>
      </div>}

      {/* ── Main content ── */}
      <main style={{flex:1, overflowY:'auto', background:'var(--surface)', minWidth:0, display:'flex', flexDirection:'column'}}>
        {/* Spacer for mobile top bar */}
        {isMobile && <div style={{height:'56px', flexShrink:0}} />}
        <div style={{flex:1, minHeight:0}}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

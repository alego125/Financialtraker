export default function KpiCard({ label, value, sub, icon, color = 'accent', trend }) {
  const styles = {
    income:  { bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.2)',  text: 'var(--income)' },
    expense: { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.2)', text: 'var(--expense)' },
    accent:  { bg: 'var(--gold-pale)',       border: 'var(--gold-border)',   text: 'var(--gold)' },
    neutral: { bg: 'var(--surface3)',        border: 'var(--border2)',       text: 'var(--text2)' },
  };
  const s = styles[color] || styles.accent;

  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: '16px', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px'}}>
        <span style={{
          fontSize: '0.65rem', fontFamily: 'Syne, sans-serif', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--muted)', lineHeight: 1.2,
        }}>{label}</span>
        {icon && <span style={{fontSize: '1rem', flexShrink: 0, opacity: 0.7}}>{icon}</span>}
      </div>
      <div style={{
        fontSize: 'clamp(1.1rem, 3vw, 1.5rem)',
        fontFamily: 'Syne, sans-serif', fontWeight: 800,
        color: s.text, lineHeight: 1.1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</div>
      {sub && <div style={{fontSize:'0.7rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>}
      {trend !== undefined && trend !== null && (
        <div style={{
          fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px',
          color: trend >= 0 ? 'var(--income)' : 'var(--expense)',
        }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs anterior
        </div>
      )}
    </div>
  );
}

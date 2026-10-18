import Icon from './Icon';
export default function KpiCard({ label, value, sub, icon, color = 'accent', trend }) {
  const featured = color === 'accent';
  const valueColor = color === 'income' ? 'var(--income)' : color === 'expense' ? 'var(--expense)' : undefined;
  return (
    <section className={`bank-kpi${featured ? ' bank-kpi--featured' : ''}`} aria-label={label}>
      <div className="flex items-center justify-between gap-3">
        <span className="bank-kpi-label">{label}</span>
        {icon && <Icon name={color === 'income' ? 'trend' : color === 'expense' ? 'chart' : color === 'accent' ? 'wallet' : 'layers'} size={18} className="opacity-70" />}
      </div>
      <div className="bank-kpi-value" style={{ color: featured ? undefined : valueColor }}>{value}</div>
      {sub && <div className="bank-kpi-sub">{sub}</div>}
      {trend !== undefined && trend !== null && (
        <div className="bank-kpi-trend" style={featured ? undefined : { color: trend >= 0 ? 'var(--income)' : 'var(--expense)' }}>
          {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)} % respecto al período anterior
        </div>
      )}
    </section>
  );
}

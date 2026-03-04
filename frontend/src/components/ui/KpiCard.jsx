export default function KpiCard({ label, value, sub, icon, color = 'accent', trend }) {
  const colorMap = {
    income:  'text-income  bg-income/10  border-income/20',
    expense: 'text-expense bg-expense/10 border-expense/20',
    accent:  'text-accent-light bg-accent/10 border-accent/20',
    neutral: 'text-slate-300 bg-dark-600 border-dark-400',
  };
  const cls = colorMap[color] || colorMap.accent;

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-display font-semibold uppercase tracking-wider opacity-70 leading-tight">{label}</span>
        {icon && <span className="text-base flex-shrink-0">{icon}</span>}
      </div>
      <div className="text-xl sm:text-2xl font-display font-bold truncate">{value}</div>
      {sub && <div className="text-xs opacity-60 truncate">{sub}</div>}
      {trend !== undefined && trend !== null && (
        <div className={`text-xs font-mono mt-0.5 ${trend >= 0 ? 'text-income' : 'text-expense'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs periodo anterior
        </div>
      )}
    </div>
  );
}
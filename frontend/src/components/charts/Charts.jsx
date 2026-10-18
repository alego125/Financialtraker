import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatMonth } from '../../utils/format';

const COLORS = ['#1E4FCA','#087C61','#BB4252','#536AB7','#147D92','#8867A4','#326EA7','#537B67','#A15174','#68788F'];

const tooltipStyle = {
  backgroundColor: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '12px',
  padding: '10px 14px',
};

const CustomTooltip = ({ active, payload, label, currency = 'ARS' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{...tooltipStyle, color: 'var(--text)'}} className="shadow-xl">
      <p style={{color:"var(--muted)", fontSize:"0.65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px"}}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{color:"var(--muted)", fontSize:"0.75rem"}}>{p.name}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--text)' }}>
            {typeof p.value === 'number' ? formatCurrency(p.value, currency) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload, currency = 'ARS' }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{...tooltipStyle, color: 'var(--text)'}} className="shadow-xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.payload.fill }} />
        <span style={{color:"var(--text)", fontFamily:"DM Sans, sans-serif", fontWeight:700, fontSize:"0.8rem"}}>{p.name}</span>
      </div>
      <div style={{color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:'0.875rem', margin:'4px 0 2px'}}>{formatCurrency(p.value, currency)}</div>
      <div style={{color:'var(--muted)', fontSize:'0.75rem'}}>{p.payload.percentage}% del total</div>
    </div>
  );
};

export const MonthlyLineChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ top:5, right:20, left:10, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill:'var(--muted)', fontSize:11 }} />
      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'var(--muted)', fontSize:11 }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend formatter={v => <span style={{ color:'var(--muted)', fontSize:'12px' }}>{v}</span>} />
      <Line type="monotone" dataKey="income"  stroke="var(--income)" strokeWidth={2.5} dot={{ fill:'var(--income)', r:4 }} name="Ingresos" />
      <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2.5} dot={{ fill:'var(--expense)', r:4 }} name="Gastos ARS" />
      <Line type="monotone" dataKey="expenseUSD" stroke="var(--primary)" strokeWidth={2} dot={{ fill:'var(--primary)', r:3 }} name="Gastos USD" strokeDasharray="4 2" />
    </LineChart>
  </ResponsiveContainer>
);

export const CategoryBarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data.slice(0,8)} layout="vertical" margin={{ top:5, right:12, left:0, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
      <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'var(--muted)', fontSize:11 }} />
      <YAxis type="category" dataKey="name" tick={{ fill:'var(--muted)', fontSize:11 }} width={75} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="value" name="Gasto ARS" radius={[0,6,6,0]}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const USDPieChart = ({ data }) => {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-48 text-[var(--subtle)] text-sm">Sin gastos en USD</div>
  );
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="45%" outerRadius={90} dataKey="value"
          labelLine={false}
          label={({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
            if (percentage < 5) return null;
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{`${percentage}%`}</text>;
          }}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend formatter={v => <span style={{ color:'var(--muted)', fontSize:'11px' }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const RADIAN = Math.PI / 180;
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
  if (percentage < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${percentage}%`}
    </text>
  );
};

export const ExpensePieChart = ({ data, currency = 'ARS' }) => (
  <ResponsiveContainer width="100%" height={280}>
    <PieChart>
      <Pie data={data} cx="50%" cy="45%" outerRadius={90} dataKey="value" labelLine={false} label={renderLabel}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip content={<PieTooltip currency={currency} />} />
      <Legend formatter={v => <span style={{ color:'var(--muted)', fontSize:'11px' }}>{v}</span>} />
    </PieChart>
  </ResponsiveContainer>
);

export const StackedBarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data} margin={{ top:5, right:20, left:10, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill:'var(--muted)', fontSize:11 }} />
      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'var(--muted)', fontSize:11 }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend formatter={v => <span style={{ color:'var(--muted)', fontSize:'12px' }}>{v}</span>} />
      <Bar dataKey="income"  stackId="a" fill="var(--income)" radius={[0,0,0,0]} name="Ingresos" />
      <Bar dataKey="expense" stackId="a" fill="var(--expense)" radius={[4,4,0,0]} name="Gastos ARS" />
    </BarChart>
  </ResponsiveContainer>
);

// ── ChartSelector: un gráfico a la vez con dropdown ──────────────────────────
const CHART_OPTIONS_MONTHLY = [
  { value: 'line',    label: 'Línea mensual' },
  { value: 'stacked', label: 'Barras apiladas' },
];
const CHART_OPTIONS_CATEGORY = [
  { value: 'bar', label: 'Barras por categoría' },
  { value: 'pie', label: 'Distribución' },
];

export function MonthlyChartSelector({ data }) {
  const [type, setType] = useState('line');
  if (!data?.length) return null;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-display font-bold text-[var(--text)]">Evolución Mensual</h2>
        <select
          aria-label="Tipo de gráfico"
          value={type}
          onChange={e => setType(e.target.value)}
          className="input text-xs py-1.5 w-auto"
        >
          {CHART_OPTIONS_MONTHLY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {type === 'line'    && <MonthlyLineChart data={data} />}
      {type === 'stacked' && <StackedBarChart data={data} />}
    </div>
  );
}

export function CategoryChartSelector({ data, dataPie, currency = 'ARS' }) {
  const [type, setType] = useState('bar');
  const isUSD = currency === 'USD';
  if (!data?.length) return null;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-display font-bold text-[var(--text)]">
            Gastos por Categoría {isUSD ? '(USD)' : '(ARS)'}
          </h2>
          {isUSD && <span className="text-xs bg-accent/10 text-accent-light border border-accent/30 px-2 py-0.5 rounded-full">USD</span>}
        </div>
        <select
          aria-label="Tipo de gráfico"
          value={type}
          onChange={e => setType(e.target.value)}
          className="input text-xs py-1.5 w-auto"
        >
          {CHART_OPTIONS_CATEGORY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {type === 'bar' && <CategoryBarChart data={data} />}
      {type === 'pie' && (isUSD
        ? <USDPieChart data={dataPie} />
        : <ExpensePieChart data={dataPie} />
      )}
    </div>
  );
}

// ── Account balance evolution (one line per account, includes CREDIT accounts) ──
export function AccountBalanceLineChart({ data }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-48 text-[var(--subtle)] text-sm">Sin datos de saldo</div>
  );
  const accountIds = [...new Set(data.map(d => d.accountId))];
  const accountNames = Object.fromEntries(data.map(d => [d.accountId, d.accountName]));
  const months = [...new Set(data.map(d => d.month))].sort();
  const byMonth = months.map(month => {
    const row = { month };
    for (const id of accountIds) {
      const point = data.find(d => d.accountId === id && d.month === month);
      if (point) row[id] = point.balance;
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={byMonth} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{v}</span>} />
        {accountIds.map((id, i) => (
          <Line key={id} type="monotone" dataKey={id} name={accountNames[id]} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── ARS vs USD expense comparison (grouped bars per month) ──────────────────
export function CurrencyComparisonChart({ data }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-48 text-[var(--subtle)] text-sm">Sin datos</div>
  );
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{v}</span>} />
        <Bar dataKey="expenseARS" fill="var(--expense)" radius={[4, 4, 0, 0]} name="Gastos ARS" />
        <Bar dataKey="expenseUSD" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Gastos USD" />
      </BarChart>
    </ResponsiveContainer>
  );
}

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatMonth } from '../../utils/format';

const COLORS = ['#7c3aed','#10b981','#f43f5e','#f59e0b','#06b6d4','#ec4899','#14b8a6','#3b82f6','#a78bfa','#84cc16'];

const tooltipStyle = {
  backgroundColor: '#111118',
  border: '1px solid #2e2e3e',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '12px',
  padding: '10px 14px',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="shadow-xl">
      <p className="text-[var(--muted)] text-xs mb-2 font-display font-semibold uppercase tracking-wide">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--muted)]">{p.name}:</span>
          <span className="font-mono font-medium" style={{ color: p.color }}>
            {typeof p.value === 'number' ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Tooltip especial para pie — muestra nombre + monto + porcentaje
const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={tooltipStyle} className="shadow-xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.payload.fill }} />
        <span className="text-[var(--text)] font-display font-semibold text-xs">{p.name}</span>
      </div>
      <div className="text-[var(--text2)] font-mono text-sm">{formatCurrency(p.value)}</div>
      <div className="text-[var(--subtle)] text-xs mt-0.5">{p.payload.percentage}% del total</div>
    </div>
  );
};

export const MonthlyLineChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ top:5, right:20, left:10, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill:'#64748b', fontSize:11 }} />
      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'#64748b', fontSize:11 }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'12px' }}>{v}</span>} />
      <Line type="monotone" dataKey="income"  stroke="#10b981" strokeWidth={2.5} dot={{ fill:'#10b981', r:4 }} name="Ingresos" />
      <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.5} dot={{ fill:'#f43f5e', r:4 }} name="Gastos ARS" />
      <Line type="monotone" dataKey="expenseUSD" stroke="#f59e0b" strokeWidth={2} dot={{ fill:'#f59e0b', r:3 }} name="Gastos USD" strokeDasharray="4 2" />
    </LineChart>
  </ResponsiveContainer>
);

export const CategoryBarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data.slice(0,8)} layout="vertical" margin={{ top:5, right:30, left:80, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" horizontal={false} />
      <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'#64748b', fontSize:11 }} />
      <YAxis type="category" dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }} width={75} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="value" name="Gasto ARS" radius={[0,6,6,0]}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// Pie chart de gastos USD por categoría
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
        <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'11px' }}>{v}</span>} />
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

export const ExpensePieChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <PieChart>
      <Pie data={data} cx="50%" cy="45%" outerRadius={90} dataKey="value" labelLine={false} label={renderLabel}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip content={<PieTooltip />} />
      <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'11px' }}>{v}</span>} />
    </PieChart>
  </ResponsiveContainer>
);

export const StackedBarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data} margin={{ top:5, right:20, left:10, bottom:5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill:'#64748b', fontSize:11 }} />
      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill:'#64748b', fontSize:11 }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend formatter={v => <span style={{ color:'#94a3b8', fontSize:'12px' }}>{v}</span>} />
      <Bar dataKey="income"  stackId="a" fill="#10b981" radius={[0,0,0,0]} name="Ingresos" />
      <Bar dataKey="expense" stackId="a" fill="#f43f5e" radius={[4,4,0,0]} name="Gastos ARS" />
    </BarChart>
  </ResponsiveContainer>
);

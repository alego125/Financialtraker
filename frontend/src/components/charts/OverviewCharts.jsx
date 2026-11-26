import { useEffect, useId, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

const tones = ['--chart-blue', '--chart-violet', '--chart-green', '--chart-gold', '--chart-red'];
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const monthName = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' });
const fill = token => `var(${token})`;

function sequence(end) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${end}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    return date.toISOString().slice(0, 7);
  });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="overview-tooltip">
    {label && <strong>{label}</strong>}
    {payload.map(item => <p key={item.name}>{item.name} <b>{formatCurrency(item.value)}</b></p>)}
  </div>;
}

export function OverviewCharts({ month, categories = [] }) {
  const gradient = useId().replace(/:/g, '');
  const [range, setRange] = useState(6);
  const [mode, setMode] = useState('balance');
  const [history, setHistory] = useState({ month: null, rows: null, error: false });
  useEffect(() => {
    const controller = new AbortController();
    const months = sequence(month);
    api.get('/dashboard', {
      params: { dateFrom: months[0] + '-01', dateTo: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10) },
      signal: controller.signal,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const monthly = new Map(data.charts.monthly.map(row => [row.month, row]));
      let total = 0;
      const rows = months.map(key => {
        const row = monthly.get(key);
        total += row?.balance || 0;
        return { month: monthName.format(new Date(key + '-01T12:00:00Z')), net: total,
          income: row?.income || 0, expense: row?.expense || 0 };
      });
      setHistory({ month, rows, error: false });
    }).catch(() => { if (!controller.signal.aborted) setHistory({ month, rows: null, error: true }); });
    return () => controller.abort();
  }, [month]);

  const rows = history.month === month ? history.rows?.slice(-range) : null;
  const top = categories.slice(0, 5);
  const remainder = categories.slice(5).reduce((sum, row) => sum + Number(row.value), 0);
  const slices = remainder ? [...top, { name: 'Resto de categorías', value: remainder }] : top;
  const expense = slices.reduce((sum, row) => sum + Number(row.value), 0);
  const axis = { stroke: 'var(--muted)', tickLine: false, axisLine: false, fontSize: 11 };
  const chartAnimation = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labels = mode === 'balance' ? 'Flujo neto acumulado' : 'Ingresos y gastos';

  return <div className="overview-grid">
    <section className="card overview-panel">
      <div className="overview-panel-head">
        <div><h2>{labels}</h2><p>{mode === 'balance' ? 'Flujo neto de los últimos seis meses en ARS' : 'Comparación mensual en ARS'}</p></div>
        <div className="overview-controls">
          <select className="input" aria-label="Tipo de gráfico" value={mode} onChange={event => setMode(event.target.value)}>
            <option value="balance">Flujo neto acumulado</option><option value="flow">Ingresos y gastos</option>
          </select>
          <select className="input" aria-label="Rango del gráfico" value={range} onChange={event => setRange(Number(event.target.value))}>
            <option value={3}>3 meses</option><option value={6}>6 meses</option>
          </select>
        </div>
      </div>
      {rows ? <div className="overview-chart" role="img" aria-label={labels}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'balance'
            ? <AreaChart data={rows}>
                <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0} />
                </linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axis} /><YAxis width={60} tickFormatter={value => compact.format(value)} {...axis} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" name="Flujo neto acumulado" dataKey="net" stroke="var(--chart-blue)" strokeWidth={2} fill={`url(#${gradient})`} isAnimationActive={chartAnimation} />
              </AreaChart>
            : <BarChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axis} /><YAxis width={60} tickFormatter={value => compact.format(value)} {...axis} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface3)' }} />
                <Bar dataKey="income" name="Ingresos" fill="var(--chart-green)" radius={[4, 4, 0, 0]} isAnimationActive={chartAnimation} />
                <Bar dataKey="expense" name="Gastos" fill="var(--chart-red)" radius={[4, 4, 0, 0]} isAnimationActive={chartAnimation} />
              </BarChart>}
        </ResponsiveContainer>
      </div> : <div className="overview-chart overview-empty" role={history.error ? 'alert' : 'status'}>
        {history.month === month && history.error ? 'No se pudo cargar el historial.' : 'Cargando historial…'}
      </div>}
    </section>
    <section className="card overview-panel">
      <div className="overview-panel-head"><div><h2>Gastos por categoría</h2><p>Distribución del período en ARS</p></div></div>
      {expense > 0 ? <>
        <div className="overview-donut" role="img" aria-label="Distribución de gastos por categoría">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={slices} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="92%" stroke="none" isAnimationActive={chartAnimation}>
              {slices.map((row, index) => <Cell key={row.name} fill={fill(tones[index % tones.length])} />)}
            </Pie><Tooltip content={<ChartTooltip />} /></PieChart>
          </ResponsiveContainer>
          <div className="overview-donut-total"><span>Total</span><strong>{formatCurrency(expense)}</strong></div>
        </div>
        <ul className="overview-legend">
          {slices.map((row, index) => <li key={row.name}>
            <span aria-hidden="true" style={{ background: fill(tones[index % tones.length]) }} />
            <span>{row.name}</span><strong>{formatCurrency(row.value)}</strong>
          </li>)}
        </ul>
      </> : <p className="overview-empty">Todavía no hay gastos en ARS para este período.</p>}
    </section>
  </div>;
}

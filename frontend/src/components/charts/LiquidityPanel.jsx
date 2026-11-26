import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate } from '../../utils/format';

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const dateLabel = day => formatDate(day).slice(0, 5);
const formatSigned = (amount, currency) => (amount > 0 ? '+' : '') + formatCurrency(amount, currency);

export default function LiquidityPanel({ liquidity }) {
  const [currency, setCurrency] = useState('ARS');
  const { data, error, retry } = liquidity;

  if (error) return <section className="card finance-panel">
    <h2>Flujo de caja</h2><p role="alert">No se pudo cargar la proyección.</p>
    <button type="button" className="btn-secondary" onClick={retry}>Reintentar</button>
  </section>;
  if (!data) return <div className="overview-loading" role="status" aria-label="Cargando liquidez" />;
  if (!data.accountCount) return <section className="card finance-panel">
    <h2>Flujo de caja</h2><p>Agregá una cuenta regular para consultar tu saldo y la proyección.</p>
  </section>;

  const rows = data.series[currency];
  const today = rows.find(row => row.day === data.today).actual;
  const upcoming = data.upcoming[currency];
  const closing = rows.at(-1).projected;
  const chartTitle = `Saldos reales y proyectados en ${currency}. Hoy ${formatCurrency(today, currency)}. Al ${dateLabel(data.end)}, ${formatCurrency(closing, currency)}.`;
  const axis = { tick: { fill: 'var(--muted)', fontSize: 11 }, axisLine: false, tickLine: false };
  const keyDates = [rows[0].day, rows[7].day, data.today, rows[21].day, data.end];
  return <section className="finance-feature" aria-label="Flujo de caja">
    <header className="finance-feature-head">
      <div><p>Disponible en cuentas regulares</p><strong>{formatCurrency(today, currency)}</strong></div>
      <label className="plan-month">Moneda
        <select className="input" value={currency} onChange={event => setCurrency(event.target.value)}>
          <option value="ARS">ARS</option><option value="USD">USD</option>
        </select>
      </label>
    </header>
    <div className="finance-feature-grid">
      <section className="card finance-panel">
        <h2>Saldo proyectado a 14 días</h2><p>Historial y movimientos futuros registrados en {currency}.</p>
        <div className="finance-chart" role="img" aria-label={chartTitle}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-rule)" />
              <XAxis dataKey="day" ticks={keyDates} tickFormatter={dateLabel} {...axis} />
              <YAxis width={58} domain={['auto', 'auto']} tickFormatter={value => compact.format(value)} {...axis} />
              <ReferenceLine x={data.today} stroke="var(--field-border)" />
              <Tooltip labelFormatter={dateLabel} formatter={value => formatCurrency(value, currency)}
                contentStyle={{ backgroundColor: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                itemStyle={{ color: 'var(--text)' }} />
              <Line dataKey="actual" type="stepAfter" name="Real" stroke="var(--chart-blue)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="projected" type="stepAfter" name="Proyectado" stroke="var(--chart-blue)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="finance-legend"><span>Real</span><span>Proyectado</span></div>
      </section>
      <section className="card finance-panel">
        <h2>Próximos movimientos</h2>
        {upcoming.length ? <ul className="finance-rows">
          {upcoming.map(item => <li key={item.id}><span><b>{item.description}</b><small>{dateLabel(item.day)}</small></span>
            <strong>{formatSigned(item.amount, currency)}</strong></li>)}
        </ul> : <p>Sin movimientos registrados para los próximos 14 días.</p>}
        <div className="finance-totals"><span>Saldo al {dateLabel(data.end)}</span><strong>{formatCurrency(closing, currency)}</strong></div>
      </section>
    </div>
  </section>;
}

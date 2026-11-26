import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

export default function DashboardPosition({ liquidity, refreshKey }) {
  const [currency, setCurrency] = useState('ARS');
  const [portfolio, setPortfolio] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/investments/board', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) {
        setPortfolio(data);
        setFailed(false);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [refreshKey, attempt]);

  const format = value => formatCurrency(value, currency);
  const balances = liquidity.data?.breakdown?.[currency];
  if (failed || liquidity.error) return <section className="card finance-panel">
    <h2>Patrimonio neto</h2>
    <p role="alert">No se pudo consultar la posición actual.</p>
    <button className="btn-secondary" type="button" onClick={() => {
      if (failed) { setFailed(false); setAttempt(value => value + 1); }
      if (liquidity.error) liquidity.retry();
    }}>Reintentar</button>
  </section>;
  if (!balances || !portfolio) return <div className="overview-loading" role="status" aria-label="Cargando patrimonio" />;

  const totals = portfolio.filter(item => item.currency === currency).reduce((sum, item) => ({
    value: sum.value + Number(item.currentValue || 0),
    realized: sum.realized + Number(item.realizedGain || 0),
    unrealized: sum.unrealized + Number(item.unrealizedGain || 0),
  }), { value: 0, realized: 0, unrealized: 0 });
  const assets = balances.cash + totals.value;
  const share = assets > 0 ? balances.cash / assets * 100 : 0;

  return <section className="wealth-overview" aria-labelledby="wealth-title">
    <header className="wealth-overview-head">
      <div>
        <h2 id="wealth-title">Patrimonio neto</h2>
        <strong className="wealth-amount">{format(assets - balances.debt)}</strong>
        <p>Al {formatDate(liquidity.data.today)}. Cuentas regulares, cartera y deudas registradas</p>
      </div>
      <label className="plan-month">Moneda
        <select className="input" value={currency} onChange={event => setCurrency(event.target.value)}>
          <option value="ARS">ARS</option><option value="USD">USD</option>
        </select>
      </label>
    </header>
    <div className="wealth-overview-grid">
      <section className="wealth-section">
        <h3>Composición de activos</h3>
        {assets > 0 && <div className="finance-allocation" role="img"
          aria-label={`Disponible ${Math.round(share)}%, invertido ${100 - Math.round(share)}%`}>
          <span style={{ width: `${share}%` }} /><span style={{ width: `${100 - share}%` }} />
        </div>}
        <dl className="wealth-breakdown">
          <div><dt>Disponible</dt><dd>{format(balances.cash)}</dd></div>
          <div><dt>Invertido</dt><dd>{format(totals.value)}</dd></div>
          <div><dt>Deuda</dt><dd className={balances.debt > 0 ? 'finance-negative' : undefined}>{format(balances.debt)}</dd></div>
        </dl>
      </section>
      <section className="wealth-section">
        <h3>Resultado de la cartera</h3>
        <dl className="wealth-results">
          <div><dt>Resultado realizado</dt><dd>{format(totals.realized)}</dd></div>
          <div><dt>No realizado</dt><dd>{format(totals.unrealized)}</dd></div>
        </dl>
        <Link className="wealth-link" to="/investments/dashboard">Ver inversiones</Link>
      </section>
    </div>
  </section>;
}

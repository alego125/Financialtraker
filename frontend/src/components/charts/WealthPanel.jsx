import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/format';

export default function WealthPanel({ currency, value, cost, realized }) {
  const [balances, setBalances] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/dashboard/liquidity', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setBalances(data.breakdown);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, []);

  const position = balances?.[currency];
  const assets = position ? position.cash + value : 0;
  const cashShare = assets > 0 ? (position.cash / assets) * 100 : 0;
  const result = value - cost;
  const facts = [
    ['Costo de posiciones abiertas', cost],
    ['Resultado no realizado', result],
    ['Resultado de ventas realizadas', realized],
  ];
  return <section className="finance-feature" aria-label="Patrimonio e inversiones">
    <div className="finance-feature-grid">
      <section className="card finance-panel">
        <h2>Patrimonio registrado en {currency}</h2>
        {position ? <>
          <div className="finance-feature-head"><div><strong>{formatCurrency(assets - position.debt, currency)}</strong>
            <p>Cuentas regulares, cartera valorizada y deudas.</p></div></div>
          {assets > 0 && <div className="finance-allocation" role="img"
            aria-label={`${Math.round(cashShare)}% disponible y ${Math.round(100 - cashShare)}% invertido`}>
            <span style={{ width: `${cashShare}%` }} /><span style={{ width: `${100 - cashShare}%` }} />
          </div>}
          <ul className="finance-rows">
            <li><span>Disponible</span><strong>{formatCurrency(position.cash, currency)}</strong></li>
            <li><span>Invertido a valor actual</span><strong>{formatCurrency(value, currency)}</strong></li>
            <li><span>Deuda registrada</span><strong>{formatCurrency(position.debt, currency)}</strong></li>
          </ul>
        </> : <p role={failed ? 'alert' : 'status'}>{failed ? 'No se pudo consultar el saldo de las cuentas.' : 'Cargando saldos…'}</p>}
      </section>
      <section className="card finance-panel">
        <h2>Resultado de la cartera</h2>
        <p>Valores de referencia y operaciones registradas en {currency}.</p>
        <ul className="finance-rows">
          {facts.map(([label, amount], index) => <li key={label}><span>{label}</span>
            <strong className={index > 0 && amount < 0 ? 'finance-negative' : undefined}>
              {index > 0 && amount > 0 ? '+' : ''}{formatCurrency(amount, currency)}
            </strong></li>)}
        </ul>
        <p>El gráfico de operaciones muestra aportes y ganancias realizadas por mes.</p>
      </section>
    </div>
  </section>;
}

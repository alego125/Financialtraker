/** Legacy KPI names represent ARS; USD always has its own explicit fields. */
export function currencyKpiRows(kpis = {}) {
  const indicators = [['Ingresos', 'totalIncome'], ['Gastos', 'totalExpense'], ['Balance', 'balance'], ['Promedio mensual ingresos', 'avgMonthlyIncome'], ['Promedio mensual gastos', 'avgMonthlyExpense'], ['Tasa de ahorro (%)', 'savingsRate']];
  return ['ARS', 'USD'].flatMap(currency => indicators.map(([label, field]) => ({
    label, currency, value: Number(kpis[field + (currency === 'USD' ? 'USD' : '')] ?? 0),
  })));
}

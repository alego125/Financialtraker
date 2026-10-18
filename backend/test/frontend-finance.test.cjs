const test = require('node:test');
const assert = require('node:assert/strict');
test('investment quantities retain six display decimals', async () => {
  const { formatQuantity } = await import('../../frontend/src/utils/format.js');
  assert.equal(formatQuantity(0.004), '0,004'); assert.equal(formatQuantity(0.000001), '0,000001');
});
test('portfolio currency selection excludes the other monetary unit', async () => {
  const { portfolioInCurrency } = await import('../../frontend/src/utils/portfolio.js');
  const rows = [{ currency: 'ARS', currentValue: 1000 }, { currency: 'USD', currentValue: 100 }];
  assert.equal(portfolioInCurrency(rows, 'ARS').reduce((s, p) => s + p.currentValue, 0), 1000);
  assert.equal(portfolioInCurrency(rows, 'USD').reduce((s, p) => s + p.currentValue, 0), 100);
});
test('report loads the current board and propagates failed investment requests', async () => {
  const { loadReportData } = await import('../../frontend/src/utils/portfolio.js');
  const api = { get: async url => {
    if (url === '/analysis') return { data: { mine: {} } };
    assert.equal(url, '/investments/board');
    return { data: [{ assetName: 'Fraction', currency: 'USD', invested: 4, currentValue: 5, unrealizedGain: 1, unrealizedGainPct: 25 }] };
  } };
  const report = await loadReportData(api, '2026-10-01', '2026-10-18');
  assert.equal(report.investments[0].name, 'Fraction'); assert.equal(report.investments[0].gain, 1);
  await assert.rejects(loadReportData({ get: async url => { if (url === '/analysis') return { data: {} }; throw new Error('investments unavailable'); } }, '', ''), /investments unavailable/);
});
test('report dates preserve the selected calendar date and prices can show four decimals', async () => {
  const { formatReportDate } = await import('../../frontend/src/utils/portfolio.js');
  const { formatCurrency } = await import('../../frontend/src/utils/format.js');
  assert.equal(formatReportDate('2026-10-01'), '01/10/26');
  assert.match(formatCurrency(0.0001, 'USD', 4), /0,0001/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localDay, liquiditySeries } = require('../src/utils/liquidity');

test('projection starts at today’s closing balance and keeps future amounts out of history', () => {
  const today = localDay(new Date('2026-11-27T01:30:00Z'));
  const row = (id, day, currency, amount) => ({ id, currency, amount, date: new Date(day), description: id });
  const result = liquiditySeries(today, { ARS: '1000.25', USD: '10' }, [
    row('today', '2026-11-26T12:00:00Z', 'ARS', '-0.25'),
    row('salary', '2026-11-27T12:00:00Z', 'ARS', '100'),
    row('rent', '2026-12-10T23:59:59Z', 'ARS', '-200'),
    row('outside', '2026-12-11T00:00:00Z', 'ARS', '-500'),
    row('dollars', '2026-12-01T12:00:00Z', 'USD', '3.40'),
  ]);
  assert.equal(result.today, '2026-11-26');
  assert.deepEqual(result.series.ARS[14], { day: '2026-11-26', actual: 1000, projected: 1000 });
  assert.deepEqual(result.series.ARS.at(-1), { day: '2026-12-10', actual: null, projected: 900 });
  assert.deepEqual(result.upcoming.ARS.map(item => item.id), ['salary', 'rent']);
  assert.equal(result.series.USD.at(-1).projected, 13.4);
});

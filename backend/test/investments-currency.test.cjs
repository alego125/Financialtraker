const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, response, next } = require('./helpers.cjs');
const tx = (type, amount, currency, extra = {}) => ({ type, amount, currency, date: new Date('2026-10-01T12:00:00Z'), category: { name: 'Test' }, ...extra });
const mixed = [tx('INCOME', 1000, 'ARS'), tx('INCOME', 100, 'USD'), tx('EXPENSE', 200, 'ARS'), tx('EXPENSE', 20, 'USD'), tx('INCOME', 5, 'USD', { isReimbursement: true })];

test('dashboard keeps ARS and USD income, reimbursements and balances separate', async () => {
  const res = response();
  await loadController('dashboard', { transaction: { findMany: async () => mixed } }).getDashboard({ userId: 'u', query: { month: '2026-10' } }, res, next);
  const k = res.body.kpis;
  assert.equal(k.totalIncome, 1000); assert.equal(k.totalIncomeUSD, 100);
  assert.equal(k.balance, 800); assert.equal(k.balanceUSD, 85);
  assert.equal(k.totalReimbursement, 0); assert.equal(k.totalReimbursementUSD, 5);
  assert.equal(res.body.charts.monthly[0].incomeUSD, 100);
});

test('partner solo applies the same currency split as the personal dashboard', async () => {
  const res = response();
  const db = { partnership: { findFirst: async () => ({ status: 'ACCEPTED' }) }, user: { findUnique: async () => ({ id: 'p' }) }, transaction: { findMany: async () => mixed } };
  await loadController('partnership', db).getPartnerSolo({ userId: 'u', params: { partnerId: 'p' }, query: {} }, res, next);
  assert.equal(res.body.kpis.totalIncome, 1000); assert.equal(res.body.kpis.totalIncomeUSD, 100);
  assert.equal(res.body.kpis.balanceUSD, 85); assert.equal(res.body.kpis.totalExpense, 200);
});

test('board preserves a 0.004-unit investment and its four dollar valuation', async () => {
  const res = response();
  const db = { investmentOperation: { findMany: async () => [
    { assetId: 'asset', accountId: 'a', type: 'BUY', quantity: '0.004', unitPrice: '1000', asset: { id: 'asset', name: 'Fraction', currency: 'USD', referencePrice: '1000' }, account: { id: 'a', name: 'Investment' } },
  ] } };
  await loadController('investment', db).getBoard({ userId: 'u' }, res, next);
  assert.equal(res.body.length, 1); assert.equal(res.body[0].quantity, 0.004);
  assert.equal(res.body[0].currentValue, 4); assert.equal(res.body[0].unrealizedGain, 0);
});

test('an asset with operations cannot change its accounting currency', async () => {
  let changed = false;
  const db = { investmentAsset: { findFirst: async () => ({ id: 'asset', currency: 'ARS' }), update: async ({ data }) => { changed = true; return data; } }, investmentOperation: { count: async () => 1 } };
  db.$transaction = async fn => fn(db);
  const res = response();
  await loadController('investment', db).updateAsset({ userId: 'u', params: { id: 'asset' }, body: { currency: 'USD' } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(changed, false);
});

test('dashboard period comparison preserves filters and separates reimbursements and currencies', async () => {
  const queries = [], res = response();
  const db = { transaction: { findMany: async query => {
    queries.push(query);
    return queries.length === 1 ? mixed : [tx('INCOME', 1000, 'ARS'), tx('INCOME', 50, 'USD'), tx('INCOME', 500, 'ARS', { isReimbursement: true })];
  } } };
  await loadController('dashboard', db).getDashboard({ userId: 'u', query: { dateFrom: '2026-10-01', dateTo: '2026-10-31', accountId: 'a', categoryId: 'c' } }, res, next);
  assert.equal(queries[1].where.accountId, 'a'); assert.equal(queries[1].where.categoryId, 'c');
  assert.ok(queries[1].where.date.lte < queries[0].where.date.gte);
  assert.equal(res.body.kpis.incomeVariation, 0); assert.equal(res.body.kpis.incomeVariationUSD, 100);
});
test('dashboard accepts one-sided date ranges without fabricating a comparison period', async () => {
  for (const query of [{ dateFrom: '2026-10-01' }, { dateTo: '2026-10-31' }]) {
    const res = response();
    await loadController('dashboard', { transaction: { findMany: async () => mixed } }).getDashboard({ userId: 'u', query }, res, next);
    assert.equal(res.body.kpis.totalIncome, 1000); assert.equal(res.body.kpis.incomeVariation, null);
  }
});

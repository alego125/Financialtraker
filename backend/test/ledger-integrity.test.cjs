const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, response, next } = require('./helpers.cjs');

test('deleting spent income is rejected rather than overdrawing the account', async () => {
  let deleted = false;
  const db = {
    transaction: { findFirst: async () => ({ id: 'income', userId: 'u', type: 'INCOME', amount: 100, currency: 'ARS', accountId: 'a' }), delete: async () => { deleted = true; } },
    account: { findFirst: async () => ({ id: 'a', name: 'Cash', accountType: 'REGULAR', initialBalance: 10, transactions: [], exchangesFrom: [] }) },
    investmentOperation: { findFirst: async () => null },
  };
  db.$transaction = async callback => callback(db);
  db.account.findUnique = db.account.findFirst;
  const controller = loadController('transactions', db); const res = response();
  await controller.remove({ userId: 'u', params: { id: 'income' } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(deleted, false);
});

test('editing a transfer cannot exceed its source funds', async () => {
  let written = false;
  const account = id => ({ id, userId: 'u', name: id, accountType: 'REGULAR', initialBalance: 10, transactions: [], exchangesFrom: [] });
  const db = {
    category: { findFirst: async () => ({ id: 'cat' }) },
    account: { findFirst: async ({ where }) => account(where.id), findUnique: async ({ where }) => account(where.id) },
    transfer: { findFirst: async () => ({ id: 't', amount: 20, currency: 'ARS', fromAccountId: 'a', toAccountId: 'b' }), update: async ({ data }) => { written = true; return data; } },
    transaction: { deleteMany: async () => {}, create: async () => {} },
  };
  db.$transaction = async callback => callback(db);
  const controller = loadController('transfers', db); const res = response();
  await controller.fullUpdate({ userId: 'u', params: { id: 't' }, body: { amount: 31, currency: 'ARS', date: '2026-10-18', fromAccountId: 'a', toAccountId: 'b' } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(written, false);
});

for (const name of ['accounts', 'sharedAccounts']) {
  test(`${name} exchange rejects a negative rate`, async () => {
    let written = false;
    const db = { account: { findFirst: async () => ({ id: 'a' }) }, sharedAccount: { findFirst: async () => ({ id: 'a' }) },
      currencyExchange: { create: async ({ data }) => { written = true; return data; } }, sharedAccountExchange: { create: async ({ data }) => { written = true; return data; } } };
    db.$transaction = async callback => callback(db);
    const controller = loadController(name, db); const res = response();
    await controller.exchange({ userId: 'u', params: { id: 'a' }, body: { usdAmount: 10, rate: -100 } }, res, next);
    assert.equal(res.statusCode, 400); assert.equal(written, false);
  });
}

test('cancelling a transfer cannot withdraw money already spent by its recipient', async () => {
  let deleted = false;
  const db = {
    transfer: { findFirst: async () => ({ id: 't', amount: 20, currency: 'ARS', fromAccountId: 'a', toAccountId: 'b' }), delete: async () => { deleted = true; } },
    transaction: { deleteMany: async () => {} },
    account: { findUnique: async () => ({ name: 'Recipient', accountType: 'REGULAR', initialBalance: 10, transactions: [] }) },
  };
  db.$transaction = async callback => callback(db);
  const res = response();
  await loadController('transfers', db).cancel({ userId: 'u', params: { id: 't' } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(deleted, false);
});

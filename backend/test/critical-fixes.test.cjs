const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, response, next } = require('./helpers.cjs');

test('public password reset never changes a password or reveals credentials', async () => {
  let changed = false;
  const controller = loadController('auth', { user: {
    findUnique: async () => ({ id: 'victim', email: 'victim@example.invalid' }),
    update: async () => { changed = true; },
  } }, { bcryptjs: { hash: async () => 'hash' }, jsonwebtoken: {} });
  const res = response();
  await controller.forgotPassword({ body: { email: 'victim@example.invalid' } }, res, next);
  assert.equal(changed, false);
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.tempPassword, undefined);
  assert.equal(res.body.found, undefined);
});

test('disabled recovery responds uniformly without looking up whether the user exists', async () => {
  const unavailableDatabase = new Proxy({}, { get() { throw new Error('Recovery must not access the database'); } });
  const controller = loadController('auth', unavailableDatabase, { bcryptjs: {}, jsonwebtoken: {} });
  for (const body of [{ email: 'unknown@example.invalid' }, {}, { email: 'victim@example.invalid' }]) {
    const res = response();
    await controller.forgotPassword({ body }, res, next);
    assert.equal(res.statusCode, 410); assert.equal(res.body.found, undefined); assert.equal(res.body.tempPassword, undefined);
  }
});

const original = { id: 'tx', userId: 'u', type: 'EXPENSE', amount: 20, currency: 'ARS', accountId: 'own', sharedAccountId: null, categoryId: 'cat', paymentType: 'DEBITO' };
function fixture({ existing = original, personal = true, shared = true, accountType = 'REGULAR', balance = 100, derived = false } = {}) {
  const state = { written: null, deleted: false };
  const account = { id: 'own', name: 'Account', accountType, initialBalance: balance, initialBalanceUSD: 50, transactions: [], exchangesFrom: [] };
  const prisma = {
    category: { findFirst: async () => ({ id: 'cat', type: 'EXPENSE' }) },
    account: { findFirst: async ({ where }) => personal && where.id === 'own' && where.userId === 'u' ? account : null },
    sharedAccount: { findFirst: async ({ where }) => shared && where.id === 'shared' && where.OR?.some(clause => clause.userAId === 'u' || clause.userBId === 'u') ? account : null },
    investmentOperation: { findFirst: async () => derived ? { id: 'op' } : null },
    transaction: {
      findFirst: async () => existing,
      update: async ({ data }) => { state.written = data; return { ...existing, ...data }; },
      create: async ({ data }) => { state.written = data; return data; },
      delete: async () => { state.deleted = true; },
    },
  };
  prisma.$transaction = async callback => callback(prisma);
  prisma.account.findUnique = async () => account;
  prisma.sharedAccount.findUnique = async () => account;
  return { controller: loadController('transactions', prisma), state };
}
async function edit(f, body) {
  const res = response();
  await f.controller.update({ userId: 'u', params: { id: 'tx' }, body }, res, next);
  return res;
}

test('cannot reassign own transaction to another users personal account', async () => {
  const f = fixture(); const res = await edit(f, { accountId: 'foreign' });
  assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
});
test('cannot reassign own transaction to inaccessible shared account', async () => {
  const f = fixture({ shared: false }); const res = await edit(f, { accountId: null, sharedAccountId: 'shared' });
  assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
});
test('transaction cannot affect personal and shared accounts simultaneously', async () => {
  const f = fixture(); const res = await edit(f, { sharedAccountId: 'shared' });
  assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
});
test('expense edit cannot exceed funds after excluding its original effect', async () => {
  const f = fixture({ balance: 10 }); const res = await edit(f, { amount: 31 });
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INSUFFICIENT_BALANCE');
  assert.equal(f.state.written, null);
});
test('expense edit may reuse its own original amount and preserves omitted payment type', async () => {
  const f = fixture({ balance: 10 }); const res = await edit(f, { amount: 30 });
  assert.equal(res.statusCode, 200); assert.equal(f.state.written.amount, 30);
  assert.equal(f.state.written.paymentType, 'DEBITO');
});
test('edit into USD cannot reuse the original ARS amount', async () => {
  const f = fixture(); const res = await edit(f, { currency: 'USD', amount: 51 });
  assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
});
test('editing into investment expense or credit income respects account rules', async () => {
  for (const [accountType, type] of [['INVESTMENT', 'EXPENSE'], ['CREDIT', 'INCOME']]) {
    const f = fixture({ accountType }); const res = await edit(f, { type });
    assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
  }
});
test('shared expense creation checks available funds', async () => {
  const f = fixture({ balance: 10 }); const res = response();
  await f.controller.create({ userId: 'u', body: { type: 'EXPENSE', amount: 11, currency: 'ARS', categoryId: 'cat', sharedAccountId: 'shared', date: '2026-10-18' } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
});
test('ordinary personal expense can still be created', async () => {
  const f = fixture(); const res = response();
  await f.controller.create({ userId: 'u', body: { type: 'EXPENSE', amount: 15, categoryId: 'cat', accountId: 'own', date: '2026-10-18', paymentType: 'DEBITO' } }, res, next);
  assert.equal(res.statusCode, 201); assert.equal(res.body.accountId, 'own'); assert.equal(res.body.amount, 15);
});

test('authorized shared expense can still be edited', async () => {
  const f = fixture(); const res = await edit(f, { accountId: null, sharedAccountId: 'shared', amount: 15 });
  assert.equal(res.statusCode, 200); assert.equal(res.body.sharedAccountId, 'shared'); assert.equal(res.body.accountId, null);
});

test('ordinary transaction can still be deleted', async () => {
  const f = fixture(); const res = response();
  await f.controller.remove({ userId: 'u', params: { id: 'tx' } }, res, next);
  assert.equal(res.statusCode, 200); assert.equal(f.state.deleted, true);
});

test('invalid currency and nonpositive amount cannot be saved', async () => {
  for (const body of [{ currency: 'EUR' }, { amount: 0 }, { amount: -10 }, { amount: 'NaN' }]) {
    const f = fixture(); const res = await edit(f, body);
    assert.equal(res.statusCode, 400); assert.equal(f.state.written, null);
  }
});

test('moving expense to another account does not reuse original accounts funds', async () => {
  const f = fixture({ balance: 10 }); const res = await edit(f, { accountId: null, sharedAccountId: 'shared', amount: 11 });
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INSUFFICIENT_BALANCE');
});

for (const kind of ['transfer', 'investment']) {
  for (const operation of ['update', 'remove']) {
    test(`${operation} cannot alter a ${kind} derived transaction directly`, async () => {
      const f = fixture({ existing: { ...original, transferId: kind === 'transfer' ? 't' : null }, derived: kind === 'investment' });
      const res = response();
      await f.controller[operation]({ userId: 'u', params: { id: 'tx' }, body: { amount: 25 } }, res, next);
      assert.equal(res.statusCode, 409); assert.equal(f.state.written, null); assert.equal(f.state.deleted, false);
    });
  }
}

test('cancelling a transfer restores both original balances without standalone income or expense', async () => {
  const rows = [ { accountId: 'A', type: 'EXPENSE', amount: 100, transferId: 't' }, { accountId: 'B', type: 'INCOME', amount: 100, transferId: 't' } ];
  let transferExists = true;
  const db = {
    category: { findFirst: async () => ({ id: 'cat' }) },
    account: { findUnique: async () => ({ name: 'Recipient', accountType: 'REGULAR', initialBalance: 100, transactions: [] }) },
    transfer: { findFirst: async () => transferExists ? { id: 't', amount: 100, currency: 'ARS', fromAccountId: 'A', toAccountId: 'B', toAccount: { userId: 'u' } } : null, delete: async () => { transferExists = false; } },
    transaction: { create: async ({ data }) => rows.push(data), deleteMany: async () => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].transferId === 't') rows.splice(i, 1); } },
  };
  db.$transaction = async callback => callback(db);
  const controller = loadController('transfers', db);
  const res = response();
  await controller.cancel({ userId: 'u', params: { id: 't' } }, res, next);
  assert.equal(res.statusCode, 200); assert.equal(rows.length, 0); assert.equal(transferExists, false);
  const repeated = response();
  await controller.cancel({ userId: 'u', params: { id: 't' } }, repeated, next);
  assert.equal(repeated.statusCode, 404); assert.equal(rows.length, 0);
});

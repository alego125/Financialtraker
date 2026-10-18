const test = require('node:test');
const assert = require('node:assert/strict');
const { financialMutation } = require('../src/utils/financialMutation');
const { response, next } = require('./helpers.cjs');
test('a response is sent only after a successful serializable commit, retrying P2034', async () => {
  const res = response(); let attempts = 0;
  const root = { $transaction: async (callback, options) => {
    attempts++; assert.equal(options.isolationLevel, 'Serializable');
    await callback({ amount: attempts });
    assert.equal(res.body, undefined);
    if (attempts === 1) throw Object.assign(new Error('serialization'), { code: 'P2034' });
  } };
  await financialMutation(root, async (_req, buffered, _next, tx) => buffered.status(201).json({ amount: tx.amount }))({}, res, next);
  assert.equal(attempts, 2); assert.equal(res.body.amount, 2); assert.equal(res.statusCode, 201);
});
test('ambiguous connection failures are not retried and never emit success', async () => {
  let attempts = 0; const res = response(); let failure;
  const root = { $transaction: async callback => { attempts++; await callback({}); throw Object.assign(new Error('lost connection'), { code: 'P1001' }); } };
  await financialMutation(root, async (_req, buffered) => buffered.json({ ok: true }))({}, res, e => { failure = e; });
  assert.equal(attempts, 1); assert.equal(res.body, undefined); assert.equal(failure.code, 'P1001');
});
test('serialization retries stop after three attempts', async () => {
  let attempts = 0; const res = response();
  const root = { $transaction: async () => { attempts++; throw Object.assign(new Error('conflict'), { code: 'P2034' }); } };
  await financialMutation(root, async () => {})({}, res, next);
  assert.equal(attempts, 3); assert.equal(res.statusCode, 409);
});
test('error responses abort the transaction instead of committing partial writes', async () => {
  let committed = false; const res = response();
  const root = { $transaction: async callback => { await callback({}); committed = true; } };
  await financialMutation(root, async (_req, buffered) => buffered.status(400).json({ error: 'invalid' }))({}, res, next);
  assert.equal(committed, false); assert.equal(res.statusCode, 400);
});

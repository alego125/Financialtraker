const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, response, next } = require('./helpers.cjs');
test('wrong current password rejects a sensitive operation without invalidating the session', async () => {
  const db = { user: { findUnique: async () => ({ id: 'u', passwordHash: 'old', email: 'u@test.invalid' }) } };
  const controller = loadController('auth', db, { bcryptjs: { compare: async () => false }, jsonwebtoken: {} });
  const res = response();
  await controller.updateProfile({ userId: 'u', body: { currentPassword: 'wrong', newPassword: 'newpassword' } }, res, next);
  assert.equal(res.statusCode, 403);
});

test('CORS only grants explicitly configured origins including preflight', () => {
  const { corsOptions } = require('../src/middlewares/security');
  const options = corsOptions({ NODE_ENV: 'production', FRONTEND_URL: 'https://fin.example' });
  let allowed, denied;
  options.origin('https://fin.example', (error, value) => { assert.equal(error, null); allowed = value; });
  options.origin('https://attacker.vercel.app', error => { denied = error; });
  assert.equal(allowed, true); assert.equal(denied.status, 403);
  assert.ok(options.allowedHeaders.includes('X-CSRF-Token'));
});

test('rate limiter rejects abusive attempts and resets after its window', () => {
  const { rateLimit } = require('../src/middlewares/security');
  let now = 0, passed = 0;
  const limit = rateLimit({ max: 2, windowMs: 1000, now: () => now });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; }, setHeader() {} };
  for (let i = 0; i < 3; i++) limit({ ip: 'test' }, res, () => passed++);
  assert.equal(passed, 2); assert.equal(res.code, 429);
  now = 1001; limit({ ip: 'test' }, res, () => passed++); assert.equal(passed, 3);
});

test('unexpected server errors never disclose internal exception messages', () => {
  const { errorHandler } = require('../src/middlewares/errorHandler');
  const res = response(); res.setHeader = () => {};
  errorHandler(new Error('postgresql://private:secret@host'), {}, res, next);
  assert.equal(res.statusCode, 500); assert.equal(res.body.error, 'Error interno del servidor');
  assert.ok(res.body.requestId);
});

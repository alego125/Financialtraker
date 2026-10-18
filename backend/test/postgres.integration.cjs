const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const url = new URL(process.env.TEST_DATABASE_URL || 'postgresql://invalid/disabled');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/fintrack_integrity_test(?:_[a-z0-9]+)*$/.test(url.pathname)) {
  throw new Error('TEST_DATABASE_URL must name an isolated local fintrack_integrity_test database');
}
process.env.DATABASE_URL = url.href;
process.env.DIRECT_URL = url.href;
const prisma = require('../src/utils/prisma');
const transactions = require('../src/controllers/transactions.controller');
const transfers = require('../src/controllers/transfers.controller');
const accounts = require('../src/controllers/accounts.controller');
const investments = require('../src/controllers/investment.controller');
const { financialMutation } = require('../src/utils/financialMutation');
const { calcBalances } = require('../src/utils/balances');
const { response, next } = require('./helpers.cjs');

let user, category;
test.before(async () => {
  user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid`, name: 'Integration', passwordHash: 'not-a-real-login' } });
  category = await prisma.category.create({ data: { userId: user.id, name: 'Test', type: 'EXPENSE' } });
});
test.after(async () => { try { if (user) await prisma.user.delete({ where: { id: user.id } }); } finally { await prisma.$disconnect(); } });
const account = balance => prisma.account.create({ data: { userId: user.id, name: randomUUID(), initialBalance: balance } });
async function call(handler, body, id) {
  const res = response();
  await handler({ userId: user.id, body, params: { id } }, res, error => {
    if (error.status) res.status(error.status).json({ error: error.message });
    else next(error);
  });
  return res;
}
const expense = (id, amount) => ({ accountId: id, amount, type: 'EXPENSE', currency: 'ARS', categoryId: category.id, date: '2026-10-18' });
const transfer = (from, to, amount) => ({ fromAccountId: from.id, toAccountId: to.id, amount, currency: 'ARS', date: '2026-10-18' });
async function balances(id) {
  return calcBalances(await prisma.account.findUnique({ where: { id }, include: { transactions: true, exchangesFrom: true } }));
}

test('PostgreSQL: two simultaneous expenses cannot both spend the same funds', async () => {
  for (let round = 0; round < 5; round++) {
    const a = await account(100);
    const results = await Promise.all([call(transactions.create, expense(a.id, 80)), call(transactions.create, expense(a.id, 80))]);
    assert.equal(results.filter(r => r.statusCode === 201).length, 1);
    assert.equal(results.filter(r => r.statusCode === 400).length, 1);
    assert.equal((await balances(a.id)).currentBalance, 20);
  }
});

test('PostgreSQL: simultaneous transfer and expense share the same funds constraint', async () => {
  const a = await account(100), b = await account(0);
  const results = await Promise.all([call(transfers.create, transfer(a, b, 80)), call(transactions.create, expense(a.id, 80))]);
  assert.equal(results.filter(r => r.statusCode === 201).length, 1);
  assert.equal((await balances(a.id)).currentBalance, 20);
});

test('PostgreSQL: a transfer edit checks funds and rolls back without losing either leg', async () => {
  const a = await account(100), b = await account(0);
  const created = await call(transfers.create, transfer(a, b, 80));
  const edited = await call(transfers.fullUpdate, transfer(a, b, 101), created.body.id);
  assert.equal(edited.statusCode, 400);
  assert.equal((await balances(a.id)).currentBalance, 20);
  assert.equal((await balances(b.id)).currentBalance, 80);
  assert.equal(await prisma.transaction.count({ where: { transferId: created.body.id } }), 2);
});

test('PostgreSQL: cancellation cannot take already spent funds from the recipient', async () => {
  const a = await account(100), b = await account(0);
  const created = await call(transfers.create, transfer(a, b, 80));
  await call(transactions.create, expense(b.id, 70));
  const cancelled = await call(transfers.cancel, {}, created.body.id);
  assert.equal(cancelled.statusCode, 400);
  assert.equal((await balances(a.id)).currentBalance, 20);
  assert.equal((await balances(b.id)).currentBalance, 10);
});

test('PostgreSQL: currency purchase cannot spend unavailable ARS', async () => {
  const a = await account(100);
  const result = await call(accounts.exchange, { usdAmount: 2, rate: 100 }, a.id);
  assert.equal(result.statusCode, 400);
  assert.equal(await prisma.currencyExchange.count({ where: { accountId: a.id } }), 0);
});

test('PostgreSQL: failure after a write rolls back the entire mutation and emits no success', async () => {
  const a = await account(100); let error;
  const handler = financialMutation(prisma, async (_req, res, _next, tx) => {
    await tx.transaction.create({ data: { ...expense(a.id, 20), userId: user.id, date: new Date('2026-10-18') } });
    res.status(201).json({ ok: true });
    throw new Error('injected failure after write');
  });
  const res = response();
  await handler({}, res, e => { error = e; });
  assert.match(error.message, /injected failure/); assert.equal(res.body, undefined);
  assert.equal((await balances(a.id)).currentBalance, 100);
  assert.equal(await prisma.transaction.count({ where: { accountId: a.id } }), 0);
});

test('PostgreSQL: core repair can run again without losing existing data', async () => {
  const a = await account(123.45);
  const migration = path.resolve(__dirname, '../prisma/migrations/20260701000000_restore_core_ledger/migration.sql');
  const psqlUrl = new URL(url.href);
  psqlUrl.searchParams.delete('schema'); // Prisma-only parameter; libpq rejects it.
  const result = spawnSync(process.env.TEST_PSQL_BIN || 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', psqlUrl.href, '-f', migration], { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await balances(a.id)).currentBalance, 123.45);
  assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).email, user.email);
});

async function buy(quantity = '1', unitPrice = '10', currency = 'ARS') {
  const a = await account(100);
  const asset = await call(investments.createAsset, { name: randomUUID(), currency, referencePrice: unitPrice });
  const result = await call(investments.createOperation, { assetId: asset.body.id, accountId: a.id, type: 'BUY', quantity, unitPrice, date: '2026-10-01' });
  assert.equal(result.statusCode, 201);
  return { account: a, asset: asset.body, buy: result.body };
}
const sale = (f, quantity = '1', unitPrice = '20') => ({ assetId: f.asset.id, accountId: f.account.id, type: 'SELL', quantity, unitPrice, date: '2026-10-02' });

test('PostgreSQL: a six-decimal holding is retained and a one-millionth oversell is rejected', async () => {
  const f = await buy('0.004', '1000', 'USD');
  const board = await call(investments.getBoard, {});
  const position = board.body.find(p => p.assetId === f.asset.id);
  assert.equal(position.quantity, 0.004); assert.equal(position.currentValue, 4);
  const sold = await call(investments.createOperation, sale(f, '0.004001', '1000'));
  assert.equal(sold.statusCode, 400);
  assert.equal(await prisma.investmentOperation.count({ where: { assetId: f.asset.id } }), 1);
});

test('PostgreSQL: simultaneous sales cannot sell the same holding twice', async () => {
  const f = await buy();
  const results = await Promise.all([call(investments.createOperation, sale(f)), call(investments.createOperation, sale(f))]);
  assert.equal(results.filter(r => r.statusCode === 201).length, 1);
  assert.equal(results.filter(r => r.statusCode === 400).length, 1);
  assert.equal(await prisma.investmentOperation.count({ where: { assetId: f.asset.id, type: 'SELL' } }), 1);
  assert.equal((await balances(f.account.id)).currentBalance, 110);
});

test('PostgreSQL: editing the date of a sale synchronizes the gain even if its amount is unchanged', async () => {
  const f = await buy(); const sold = await call(investments.createOperation, sale(f));
  const edited = await call(investments.updateOperation, { date: '2026-10-03' }, sold.body.id);
  assert.equal(edited.statusCode, 200);
  const movement = await prisma.transaction.findUnique({ where: { id: edited.body.gainTransactionId } });
  assert.equal(movement.date.toISOString().slice(0, 10), '2026-10-03'); assert.equal(Number(movement.amount), 10);
});

test('PostgreSQL: a missing result movement is recreated without changing the computed gain', async () => {
  const f = await buy(); const sold = await call(investments.createOperation, sale(f));
  await prisma.transaction.delete({ where: { id: sold.body.gainTransactionId } });
  const edited = await call(investments.updateOperation, { notes: 'repair missing link' }, sold.body.id);
  assert.equal(edited.statusCode, 200); assert.notEqual(edited.body.gainTransactionId, sold.body.gainTransactionId);
  assert.equal((await balances(f.account.id)).currentBalance, 110);
});

test('PostgreSQL: deleting a sale whose gain was spent is rejected without changing its history', async () => {
  const f = await buy(); const sold = await call(investments.createOperation, sale(f));
  await call(transactions.create, expense(f.account.id, 110));
  const removed = await call(investments.deleteOperation, {}, sold.body.id);
  assert.equal(removed.statusCode, 400);
  assert.ok(await prisma.investmentOperation.findUnique({ where: { id: sold.body.id } }));
  assert.ok(await prisma.transaction.findUnique({ where: { id: sold.body.gainTransactionId } }));
  assert.equal((await balances(f.account.id)).currentBalance, 0);
});

test('PostgreSQL: failure to persist a sale result rolls back the sale itself', async () => {
  const f = await buy();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_fail_investment_gain() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${user.id}' AND NEW."comment" LIKE 'Resultado venta%' THEN RAISE EXCEPTION 'injected gain failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER test_fail_gain BEFORE INSERT ON "Transaction" FOR EACH ROW EXECUTE FUNCTION test_fail_investment_gain()');
  try {
    await assert.rejects(call(investments.createOperation, sale(f)), /injected gain failure/);
    assert.equal(await prisma.investmentOperation.count({ where: { assetId: f.asset.id, type: 'SELL' } }), 0);
    assert.equal((await balances(f.account.id)).currentBalance, 100);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER test_fail_gain ON "Transaction"');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_fail_investment_gain()');
  }
});

test('PostgreSQL: prices and quantities with excess decimals are rejected before persistence', async () => {
  const f = await buy();
  for (const body of [sale(f, '0.0000001'), sale(f, '1', '10.00001')]) {
    const result = await call(investments.createOperation, body); assert.equal(result.statusCode, 400);
  }
  assert.equal(await prisma.investmentOperation.count({ where: { assetId: f.asset.id } }), 1);
});

test('PostgreSQL: editing an earlier buy recalculates later realized gains', async () => {
  const f = await buy(); const sold = await call(investments.createOperation, sale(f));
  const edited = await call(investments.updateOperation, { unitPrice: '15' }, f.buy.id);
  assert.equal(edited.statusCode, 200);
  const operation = await prisma.investmentOperation.findUnique({ where: { id: sold.body.id } });
  assert.equal(Number(operation.realizedGain), 5);
  assert.equal((await balances(f.account.id)).currentBalance, 105);
  const invalidEdit = await call(investments.updateOperation, { quantity: '0.5' }, f.buy.id);
  assert.equal(invalidEdit.statusCode, 400);
  assert.equal(Number((await prisma.investmentOperation.findUnique({ where: { id: f.buy.id } })).quantity), 1);
});

test('PostgreSQL: moving a sale to another funded holding moves its gain exactly once', async () => {
  const f = await buy(), other = await account(100);
  await call(investments.createOperation, { ...sale(f), type: 'BUY', accountId: other.id, date: '2026-10-01', unitPrice: '10' });
  const sold = await call(investments.createOperation, sale(f));
  const moved = await call(investments.updateOperation, { accountId: other.id }, sold.body.id);
  assert.equal(moved.statusCode, 200);
  assert.equal((await balances(f.account.id)).currentBalance, 100);
  assert.equal((await balances(other.id)).currentBalance, 110);
  assert.equal(await prisma.transaction.count({ where: { accountId: f.account.id } }), 0);
  const linked = await prisma.transaction.findUnique({ where: { id: moved.body.gainTransactionId } });
  assert.equal(linked.accountId, other.id); assert.equal(Number(linked.amount), 10);
});

test('PostgreSQL: deleting a historical sale validates its net effect including later recalculations', async () => {
  const f = await buy('2', '10');
  await prisma.account.update({ where: { id: f.account.id }, data: { initialBalance: 0 } });
  const first = await call(investments.createOperation, sale(f, '1', '20'));
  await call(investments.createOperation, { ...sale(f, '1', '30'), type: 'BUY', date: '2026-10-03' });
  const second = await call(investments.createOperation, { ...sale(f, '2', '30'), date: '2026-10-04' });
  await call(transactions.create, expense(f.account.id, 26));
  assert.equal((await balances(f.account.id)).currentBalance, 4);
  const removed = await call(investments.deleteOperation, {}, first.body.id);
  assert.equal(removed.statusCode, 204);
  assert.equal((await balances(f.account.id)).currentBalance, 0.67);
  const later = await prisma.investmentOperation.findUnique({ where: { id: second.body.id } });
  assert.equal(Number(later.realizedGain), 26.67);
});

const { getAccountBalances } = require('../src/utils/accountBalances');
const { accountBalanceSeries } = require('../src/utils/accountHistory');
test('PostgreSQL: balance SQL includes both currencies/exchanges and uses an exclusive opening cutoff', async () => {
  const a = await prisma.account.create({data:{userId:user.id,name:randomUUID(),initialBalance:100,initialBalanceUSD:2,createdAt:new Date('2026-09-01')}});
  const tx = (type,amount,date) => ({userId:user.id,accountId:a.id,categoryId:category.id,type,amount,date:new Date(date),currency:'ARS'});
  await prisma.transaction.createMany({data:[tx('EXPENSE','10','2026-09-15'),tx('INCOME','0.10','2026-10-01'),tx('INCOME','0.20','2026-10-02'),tx('EXPENSE','5','2026-11-01')]});
  await prisma.currencyExchange.create({data:{userId:user.id,accountId:a.id,date:new Date('2026-10-03'),usdAmount:1,arsAmount:20,rate:20}});
  const current = await getAccountBalances(prisma,[a.id]);
  assert.deepEqual(current.get(a.id),{currentBalance:65.3,currentBalanceUSD:3});
  const opening = await getAccountBalances(prisma,[a.id],false,{at:new Date('2026-10-01')});
  assert.deepEqual(opening.get(a.id),{currentBalance:90,currentBalanceUSD:2});
  const series = await accountBalanceSeries(prisma,[a],['2026-09','2026-10']);
  assert.deepEqual(series.map(row=>[row.month,row.balance,row.balanceUSD]),[['2026-09',90,2],['2026-10',70.3,3]]);
});
test('PostgreSQL: shared balance SQL sums both owners and shared exchange rows without binary drift', async () => {
  const other=await prisma.user.create({data:{email:`${randomUUID()}@test.invalid`,name:'Other',passwordHash:'not-a-login'}});
  try {
    const a=await prisma.sharedAccount.create({data:{name:randomUUID(),userAId:user.id,userBId:other.id,initialBalance:50,initialBalanceUSD:1}});
    await prisma.transaction.createMany({data:[user.id,other.id].map((userId,index)=>({userId,sharedAccountId:a.id,categoryId:category.id,type:'EXPENSE',currency:'ARS',amount:index?'0.20':'0.10',date:new Date('2026-10-01')}))});
    await prisma.sharedAccountExchange.create({data:{userId:user.id,sharedAccountId:a.id,date:new Date('2026-10-02'),usdAmount:1,arsAmount:10,rate:10}});
    assert.deepEqual((await getAccountBalances(prisma,[a.id],true)).get(a.id),{currentBalance:39.7,currentBalanceUSD:2});
    assert.deepEqual((await getAccountBalances(prisma,[a.id],true,{at:new Date('2026-10-01')})).get(a.id),{currentBalance:50,currentBalanceUSD:1});
  } finally {await prisma.user.delete({where:{id:other.id}});}
});
test('PostgreSQL: analysis SQL series accepts shared report filters and keeps currency totals separate',async()=>{
  const a=await account(100);
  await prisma.transaction.createMany({data:[
    {userId:user.id,accountId:a.id,categoryId:category.id,type:'EXPENSE',currency:'ARS',amount:'0.10',date:new Date('2026-10-03'),paymentType:'EFECTIVO',comment:'literal 10% item'},
    {userId:user.id,accountId:a.id,categoryId:category.id,type:'EXPENSE',currency:'USD',amount:'0.20',date:new Date('2026-10-04'),paymentType:'EFECTIVO',comment:'literal 10% item'},
    {userId:user.id,accountId:a.id,categoryId:category.id,type:'EXPENSE',currency:'ARS',amount:'1.00',date:new Date('2026-10-05'),paymentType:'EFECTIVO',comment:'literal 100 item'},
  ]});
  const {computeUserAnalysis}=require('../src/controllers/analysis.controller');
  const result=await computeUserAnalysis(user.id,{month:'2026-10',accountIds:a.id,categoryIds:category.id,paymentType:'EFECTIVO',comment:'10%',amountMax:'0.50',type:'EXPENSE'},'mine');
  assert.equal(result.kpis.expense,0.1);assert.equal(result.kpis.expenseUSD,0.2);
  const month=result.monthlySeries.find(row=>row.month==='2026-10');
  assert.equal(month.expense,0.1);assert.equal(month.expenseUSD,0.2);
  assert.equal(result.recentActivity.length,2);
});

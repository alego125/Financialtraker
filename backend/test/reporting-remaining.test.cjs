const test = require('node:test');
const assert = require('node:assert/strict');
const { loadController, response, next } = require('./helpers.cjs');
const analysis = loadController('analysis', {});
test('analysis accepts timestamp bounds without appending a second time suffix', () => {
  const range = analysis.resolveDateRange({ dateFrom: '2026-10-01T14:00:00.000Z', dateTo: '2026-10-04' });
  assert.equal(range.from.toISOString(), '2026-10-01T14:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-10-04T23:59:59.999Z');
});
test('analysis previous custom period is adjacent, equal duration, and never overlaps', () => {
  const from = new Date('2026-10-01T00:00:00Z'), to = new Date('2026-10-02T23:59:59.999Z');
  const prior = analysis.resolvePriorRange({ from, to }, {});
  assert.equal(prior.to.getTime(), from.getTime() - 1);
  assert.equal(prior.to - prior.from, to - from);
});
test('shared dashboard account filter never creates an unconstrained OR branch', async () => {
  const seen = [];
  const prisma = { partnership: { findFirst: async () => ({}) }, transaction: { findMany: async ({where}) => { seen.push(where); return []; } }, user: { findUnique: async () => ({id:'u'}) }, sharedAccount: { findMany: async () => [] } };
  await loadController('dashboard', prisma).getSharedDashboard({ userId:'u', params:{partnerId:'p'}, query:{accountId:'selected', month:'2026-10'} }, response(), next);
  assert.equal(seen.length, 2);
  for (const where of seen) assert.ok(!where.OR || where.OR.every(branch => Object.values(branch).every(value => value !== undefined)));
});
test('partner listing applies currency and list account/category filters with inclusive UTC dates', async () => {
  let seen;
  const prisma = { partnership: {findFirst:async()=>({})}, transaction:{ findMany:async args => {seen=args; return [];}, count:async()=>0 }, user:{findUnique:async()=>({})} };
  await loadController('partnership', prisma).getPartnerData({userId:'u',params:{partnerId:'p'},query:{currency:'USD',accountIds:'a,b',categoryIds:'c',dateTo:'2026-10-03'}},response(),next);
  assert.equal(seen.where.currency,'USD');
  assert.equal(seen.where.categoryId.in[0],'c');
  assert.equal(seen.where.OR[1].sharedAccountId.in[1],'b');
  assert.equal(seen.where.date.lte.toISOString(),'2026-10-03T23:59:59.999Z');
});
function analysisDb() {
  const calls = {accounts:[],shared:[],transactions:[],transfers:[],exchanges:[]};
  const db = {
    account:{findMany:async args => {calls.accounts.push(args); return [];}},
    sharedAccount:{findMany:async args => {calls.shared.push(args);return [];}},
    transaction:{aggregate:async()=>({_sum:{amount:0}}),groupBy:async()=>[], findMany:async args=>{calls.transactions.push(args);return [];}},
    category:{findMany:async()=>[]}, transfer:{findMany:async args=>{calls.transfers.push(args);return [];}},
    currencyExchange:{findMany:async args=>{calls.exchanges.push(args);return [];}},
    $queryRaw:async()=>[]
  };
  return {db,calls};
}
test('analysis loads account metadata without transaction histories',async()=>{
  const {db,calls}=analysisDb();
  await loadController('analysis',db).computeUserAnalysis('u',{month:'2026-10'},'mine');
  assert.ok(!calls.accounts[0].include?.transactions,'account history must be aggregated in the database');
});
test('analysis USD details and recent activity obey category/account/date filters',async()=>{
  const {db,calls}=analysisDb();
  await loadController('analysis',db).computeUserAnalysis('u',{month:'2026-10',accountIds:'a',categoryIds:'c'},'mine');
  const usd=calls.transactions.find(args=>args.where.currency==='USD');
  assert.equal(usd.where.categoryId.in[0],'c');
  assert.equal(usd.where.OR[0].accountId.in[0],'a');
  const activity=calls.transactions.find(args=>args.take===10 && !args.where.type);
  assert.equal(activity.where.date.gte.toISOString(),'2026-10-01T00:00:00.000Z');
  assert.equal(calls.transfers.length,0,'a category filter excludes transfers which have no category');
});
test('analysis shared spending excludes transfers and honors account/category/currency',async()=>{
  const {db,calls}=analysisDb();
  const sums=[];
  db.transaction.groupBy=async args=>{sums.push(args);return [];};
  db.sharedAccount.findMany=async args=>{calls.shared.push(args);return [{id:'s',initialBalance:0,initialBalanceUSD:0,transactions:[],exchangesFrom:[]}]};
  await loadController('analysis',db).getAnalysis({userId:'u',query:{month:'2026-10',accountIds:'s',categoryIds:'c',currency:'USD'}},response(),next);
  const spend=sums.find(args=>args.where.sharedAccountId && args.where.type==='EXPENSE');
  assert.ok(spend,'shared expense is aggregated separately from full account balances');
  assert.equal(spend.where.transferId,null);
  assert.equal(spend.where.currency,'USD');
  assert.equal(spend.where.categoryId.in[0],'c');
  assert.equal(calls.shared[0].where.id.in[0],'s');
});
const { getAccountBalances } = require('../src/utils/accountBalances');
test('balance aggregation stays in SQL and rounds only the numeric result', async () => {
  let sql;
  const at = new Date('2026-10-01T00:00:00Z');
  const balances = await getAccountBalances({$queryRaw: async query => {
    sql = query;
    return [{id:'a', ars:'100000000000.015', usd:'0.105'}];
  }}, ['a'], false, {at});
  assert.equal(balances.get('a').currentBalance, 100000000000.02);
  assert.equal(balances.get('a').currentBalanceUSD, 0.11);
  assert.match(sql.text, /SUM\(ars\)/);
  assert.match(sql.text, /"CurrencyExchange"/);
  assert.equal(sql.values.filter(value => value === at).length, 2);
  assert.match(sql.text, /date </);
});
test('empty account selection does not issue any balance query',async()=>{
  const balances=await getAccountBalances({$queryRaw:()=>assert.fail('unnecessary database query')},[]);
  assert.equal(balances.size,0);
});
test('personal account list fetches counts and metadata, never a ledger',async()=>{
  let args;
  const db={account:{findMany:async query=>{args=query;return [{id:'a',initialBalance:2,initialBalanceUSD:0,_count:{transactions:9}}]}},$queryRaw:async()=>[{id:'a',ars:'10.10',usd:'1.20'}]};
  const res=response();
  await loadController('accounts',db).list({userId:'u'},res,next);
  assert.equal(args.include.transactions,undefined);
  assert.equal(args.include.exchangesFrom,undefined);
  assert.equal(res.body[0].currentBalance,10.1);
  assert.equal(res.body[0].transactionCount,9);
});
test('transaction pagination caps limits and uses stable ordering with list filters',async()=>{
  let args;
  const db={transaction:{findMany:async query=>{args=query;return []},count:async()=>0}};
  const controller=loadController('transactions',db);
  await controller.list({userId:'u',query:{page:'2',limit:'500',accountIds:'a,b',dateTo:'2026-10-01T14:00:00Z'}},response(),next);
  assert.equal(args.skip,500);assert.equal(args.take,500);
  assert.equal(args.orderBy[1].id,'desc');
  assert.equal(args.where.OR[0].accountId.in[1],'b');
  assert.equal(args.where.date.lte.toISOString(),'2026-10-01T14:00:00.000Z');
  await assert.rejects(()=>controller.list({userId:'u',query:{limit:'501'}},response(),next),/Paginación/);
});
test('transfer list applies account lists, currency and inclusive calendar bounds',async()=>{
  let args;
  const db={transfer:{findMany:async query=>{args=query;return []},count:async()=>0}};
  await loadController('transfers',db).list({userId:'u',query:{accountIds:'a,s',currency:'USD',month:'2026-02',page:'2',limit:'5'}},response(),next);
  assert.equal(args.where.currency,'USD');assert.equal(args.where.OR.length,4);
  assert.equal(args.where.OR[3].toSharedAccountId.in[1],'s');
  assert.equal(args.where.date.lte.toISOString(),'2026-02-28T23:59:59.999Z');
  assert.equal(args.skip,5);assert.equal(args.orderBy[1].id,'desc');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const moduleAt = name => import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/' + name)).href);
test('export retrieves every capped page preserving date and currency filters', async () => {
  const { getCompleteResponse } = await moduleAt('pagination.js');
  const calls = [];
  const client = { get: async url => { const q = new URL(url, 'http://local').searchParams; calls.push(q); const page = +q.get('page'); return { data: { data: [{id:String(page)}], pagination:{total:3,pages:3,limit:1} } }; } };
  const result = await getCompleteResponse(client, '/transactions?limit=5000&dateFrom=2026-01-01&currency=USD');
  assert.equal(result.data.data.length, 3);
  assert.ok(calls.every(q => q.get('dateFrom') === '2026-01-01' && q.get('currency') === 'USD' && +q.get('limit') <= 500));
});
test('partial pages and changing totals fail instead of exporting incomplete data', async () => {
  const { getCompleteResponse } = await moduleAt('pagination.js');
  let page = 0;
  await assert.rejects(getCompleteResponse({get:async()=>({data:{data: ++page === 1 ? [{id:'a'}] : [],pagination:{total:2,pages:2}}})}, '/transactions'), /complet|cambi|incomplet/i);
});
test('duplicate pages fail instead of silently dropping rows', async () => {
  const { getCompleteResponse } = await moduleAt('pagination.js');
  await assert.rejects(getCompleteResponse({get:async()=>({data:{data:[{id:'a'}],pagination:{total:2,pages:2}}})}, '/transactions'), /duplic|cambi|incomplet/i);
});
test('request identity rejects stale responses even if transport ignores abort', async () => {
  const { createRequestScope } = await moduleAt('requestScope.js');
  const scope = createRequestScope();
  const first = scope.start(); const second = scope.start();
  assert.equal(first.current(), false); assert.equal(second.current(), true);
  assert.throws(first.check, /cancel|obsolet/i);
  scope.cancel(); assert.equal(second.current(), false);
});
test('summary keeps ARS and USD amounts and rates independent', async () => {
  const { currencyKpiRows } = await moduleAt('exportSummary.js');
  const rows = currencyKpiRows({totalIncome:1000,totalIncomeUSD:10,balance:900,balanceUSD:8,savingsRate:90,savingsRateUSD:80});
  assert.equal(rows.find(r=>r.label==='Ingresos'&&r.currency==='ARS').value,1000);
  assert.equal(rows.find(r=>r.label==='Ingresos'&&r.currency==='USD').value,10);
  assert.equal(rows.find(r=>r.label==='Tasa de ahorro (%)'&&r.currency==='USD').value,80);
});
test('export abort after a response cannot produce a partial file', async () => {
  const { getCompleteResponse } = await moduleAt('pagination.js');
  const controller = new AbortController();
  await assert.rejects(getCompleteResponse({get:async()=>{controller.abort();return {data:{data:[],pagination:{total:0,pages:0}}};}}, '/transactions', {signal:controller.signal}), {name:'AbortError'});
});
test('export refuses a total change between pages', async () => {
  const { getCompleteResponse } = await moduleAt('pagination.js'); let n=0;
  await assert.rejects(getCompleteResponse({get:async()=>({data:{data:[{id:String(++n)}],pagination:{total:n===1?2:3,pages:2}}})}, '/transactions'), /cambi/);
});

test('CSV escapes quotes, line breaks and spreadsheet formulas', async () => {
  const { rowsToCsv } = await moduleAt('csv.js');
  const csv = rowsToCsv([{comment:'=HYPERLINK("x")', amount:-2}, {comment:'line\nnext', amount:4}]);
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('"-2"'));
  assert.ok(csv.includes('"line\nnext"'));
  assert.ok(csv.includes('""x""'));
});

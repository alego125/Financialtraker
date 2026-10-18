const { Prisma } = require('@prisma/client');
const { decimal, money } = require('./decimal');
// Fetch one opening bucket and at most twelve monthly deltas per account, rather than its ledger.
async function accountBalanceSeries(db, accounts, months) {
  if (!accounts.length) return [];
  const ids = accounts.map(account => account.id);
  const start = new Date(`${months[0]}-01T00:00:00.000Z`);
  const end = new Date(`${months[months.length - 1]}-01T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const rows = await db.$queryRaw(Prisma.sql`
    WITH ledger AS (
      SELECT "accountId", date,
        CASE WHEN currency = 'ARS' THEN CASE WHEN type = 'INCOME' THEN amount ELSE -amount END ELSE 0 END AS ars,
        CASE WHEN currency = 'USD' THEN CASE WHEN type = 'INCOME' THEN amount ELSE -amount END ELSE 0 END AS usd
      FROM "Transaction" WHERE "accountId" IN (${Prisma.join(ids)}) AND date < ${end}
      UNION ALL
      SELECT "accountId", date, -"arsAmount" AS ars, "usdAmount" AS usd
      FROM "CurrencyExchange" WHERE "accountId" IN (${Prisma.join(ids)}) AND date < ${end}
    )
    SELECT "accountId", CASE WHEN date < ${start} THEN '' ELSE to_char(date, 'YYYY-MM') END AS month,
      SUM(ars) AS ars, SUM(usd) AS usd
    FROM ledger GROUP BY "accountId", month
  `);
  const deltas = new Map();
  for (const row of rows) {
    if (!deltas.has(row.accountId)) deltas.set(row.accountId, new Map());
    deltas.get(row.accountId).set(row.month, row);
  }
  const series = [];
  for (const account of accounts) {
    const buckets = deltas.get(account.id) || new Map(), opening = buckets.get('');
    let ars = decimal(account.initialBalance).plus(opening?.ars || 0);
    let usd = decimal(account.initialBalanceUSD || 0).plus(opening?.usd || 0);
    const createdMonth = new Date(account.createdAt).toISOString().slice(0,7);
    for (const month of months) {
      const delta = buckets.get(month);
      ars = ars.plus(delta?.ars || 0); usd = usd.plus(delta?.usd || 0);
      if (month >= createdMonth) series.push({accountId: account.id, accountName: account.name, accountType: account.accountType, month, balance: money(ars), balanceUSD: money(usd)});
    }
  }
  return series;
}
module.exports = { accountBalanceSeries };

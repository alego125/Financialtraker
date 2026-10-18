const { Prisma } = require('@prisma/client');
const { money } = require('./decimal');

// All ledger arithmetic stays NUMERIC in PostgreSQL, including currency exchanges.
async function getAccountBalances(db, ids, shared = false, { at } = {}) {
  const balances = new Map(ids.map(id => [id, {currentBalance: 0, currentBalanceUSD: 0}]));
  if (!ids.length) return balances;
  const table = shared ? Prisma.sql`"SharedAccount"` : Prisma.sql`"Account"`;
  const exchangeTable = shared ? Prisma.sql`"SharedAccountExchange"` : Prisma.sql`"CurrencyExchange"`;
  const key = shared ? Prisma.sql`"sharedAccountId"` : Prisma.sql`"accountId"`;
  const cutoff = at ? Prisma.sql`AND date < ${at}` : Prisma.empty;
  const rows = await db.$queryRaw(Prisma.sql`
    WITH ledger AS (
      SELECT ${key} AS id,
        CASE WHEN currency = 'ARS' THEN CASE WHEN type = 'INCOME' THEN amount ELSE -amount END ELSE 0 END AS ars,
        CASE WHEN currency = 'USD' THEN CASE WHEN type = 'INCOME' THEN amount ELSE -amount END ELSE 0 END AS usd
      FROM "Transaction" WHERE ${key} IN (${Prisma.join(ids)}) ${cutoff}
      UNION ALL
      SELECT ${key} AS id, -"arsAmount" AS ars, "usdAmount" AS usd
      FROM ${exchangeTable} WHERE ${key} IN (${Prisma.join(ids)}) ${cutoff}
    ), totals AS (SELECT id, SUM(ars) AS ars, SUM(usd) AS usd FROM ledger GROUP BY id)
    SELECT a.id, a."initialBalance" + COALESCE(t.ars, 0) AS ars,
      a."initialBalanceUSD" + COALESCE(t.usd, 0) AS usd
    FROM ${table} a LEFT JOIN totals t ON t.id = a.id WHERE a.id IN (${Prisma.join(ids)})
  `);
  for (const row of rows) balances.set(row.id, {currentBalance: money(row.ars), currentBalanceUSD: money(row.usd)});
  return balances;
}
module.exports = { getAccountBalances };

const prisma = require('../utils/prisma');
const { decimal, money } = require('../utils/decimal');
const { getAccountBalances } = require('../utils/accountBalances');
const { localDay, shift, liquiditySeries } = require('../utils/liquidity');

async function getLiquidity(req, res, next) {
  try {
    const today = localDay();
    const date = { gte: shift(today, -14), lt: shift(today, 15) };

    const result = await prisma.$transaction(async database => {
      const accounts = await database.account.findMany({
        where: { userId: req.userId, accountType: { in: ['REGULAR', 'CREDIT'] } },
        select: { id: true, accountType: true },
      });
      const accountId = { in: accounts.filter(account => account.accountType === 'REGULAR').map(account => account.id) };
      const where = { userId: req.userId, accountId, date };
      const [opening, transactions, exchanges, current] = await Promise.all([
        getAccountBalances(database, accountId.in, false, { at: date.gte }),
        database.transaction.findMany({
          where,
          select: { id: true, date: true, type: true, amount: true, currency: true, comment: true,
            category: { select: { name: true } } },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        }),
        database.currencyExchange.findMany({
          where,
          select: { id: true, date: true, arsAmount: true, usdAmount: true },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        }),
        getAccountBalances(database, accounts.map(account => account.id), false, { at: shift(today, 1) }),
      ]);
      const initial = { ARS: decimal(0), USD: decimal(0) };
      for (const account of opening.values()) {
        initial.ARS = initial.ARS.plus(account.currentBalance);
        initial.USD = initial.USD.plus(account.currentBalanceUSD);
      }
      const movements = transactions.map(row => ({
        id: row.id, date: row.date, currency: row.currency,
        description: row.comment || row.category.name,
        amount: decimal(row.amount).mul(row.type === 'INCOME' ? 1 : -1),
      }));
      for (const row of exchanges) {
        movements.push(
          { id: row.id, date: row.date, currency: 'ARS', amount: decimal(row.arsAmount).neg(), description: 'Cambio de moneda' },
          { id: row.id, date: row.date, currency: 'USD', amount: decimal(row.usdAmount), description: 'Cambio de moneda' },
        );
      }
      const position = { ARS: { cash: decimal(0), debt: decimal(0) }, USD: { cash: decimal(0), debt: decimal(0) } };
      for (const account of accounts) {
        const balance = current.get(account.id);
        for (const [currency, amount] of [['ARS', balance.currentBalance], ['USD', balance.currentBalanceUSD]]) {
          const side = position[currency];
          if (amount < 0) side.debt = side.debt.minus(amount);
          else if (account.accountType === 'REGULAR') side.cash = side.cash.plus(amount);
        }
      }
      const breakdown = Object.fromEntries(Object.entries(position).map(([currency, values]) =>
        [currency, { cash: money(values.cash), debt: money(values.debt) }]));
      return {
        breakdown,
        ...liquiditySeries(today, initial, movements.sort((a, b) => a.date - b.date)),
        accountCount: accountId.in.length,
      };
    }, { isolationLevel: 'RepeatableRead' });

    res.json(result);
  } catch (error) { next(error); }
}

module.exports = { getLiquidity };

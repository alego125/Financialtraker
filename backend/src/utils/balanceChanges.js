const { calcBalances } = require('./balances');

function transactionChange(transaction, direction = 1) {
  return { ...transaction, delta: direction * (transaction.type === 'INCOME' ? 1 : -1) * Number(transaction.amount) };
}

// Validate net effects, not just the new source: changing/removing an income
// or a transfer can overdraw its former destination as well.
async function validateBalanceChanges(prisma, changes) {
  const grouped = new Map();
  for (const change of changes) {
    const shared = Boolean(change.sharedAccountId);
    const id = shared ? change.sharedAccountId : change.accountId;
    if (!id) continue;
    const key = `${shared ? 'shared' : 'personal'}:${id}:${change.currency}`;
    if (!grouped.has(key)) grouped.set(key, { id, shared, currency: change.currency, cents: 0 });
    grouped.get(key).cents += Math.round(change.delta * 100);
  }
  for (const entry of grouped.values()) {
    if (entry.cents >= 0) continue;
    const account = await (entry.shared ? prisma.sharedAccount : prisma.account).findUnique({
      where: { id: entry.id }, include: {
        transactions: { select: { type: true, amount: true, currency: true } },
        exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
      },
    });
    if (!account) return { error: 'Cuenta no encontrada' };
    if (account.accountType === 'CREDIT') continue;
    const balances = calcBalances(account);
    const balance = entry.currency === 'USD' ? balances.currentBalanceUSD : balances.currentBalance;
    if (Math.round(balance * 100) + entry.cents < 0) {
      return { error: `Saldo insuficiente en "${account.name}"`, code: 'INSUFFICIENT_BALANCE', currentBalance: balance, currency: entry.currency };
    }
  }
  return null;
}
module.exports = { validateBalanceChanges, transactionChange };

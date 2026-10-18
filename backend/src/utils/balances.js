const toNum = value => Number(value?.toString() || 0);
function calcBalances(account) {
  let ars = toNum(account.initialBalance), usd = toNum(account.initialBalanceUSD);
  for (const tx of account.transactions || []) {
    const amount = (tx.type === 'INCOME' ? 1 : -1) * toNum(tx.amount);
    if (tx.currency === 'USD') usd += amount; else ars += amount;
  }
  for (const exchange of account.exchangesFrom || []) {
    usd += toNum(exchange.usdAmount); ars -= toNum(exchange.arsAmount);
  }
  return { currentBalance: Number(ars.toFixed(2)), currentBalanceUSD: Number(usd.toFixed(2)) };
}
module.exports = { calcBalances };

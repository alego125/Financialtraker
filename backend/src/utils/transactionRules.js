const { calcBalances } = require('./balances');

// Validate the final state, including unchanged fields in a partial update.
async function validateAccounts(prisma, userId, state, previous = null) {
  if (!['ARS', 'USD'].includes(state.currency)) return { error: 'Moneda inválida' };
  if (state.accountId && state.sharedAccountId) return { error: 'Seleccioná una sola cuenta' };
  if (!Number.isFinite(Number(state.amount)) || Number(state.amount) <= 0) return { error: 'Monto debe ser mayor a 0' };
  const include = {
    transactions: { select: { type: true, amount: true, currency: true } },
    exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
  };
  let account;
  if (state.accountId) {
    account = await prisma.account.findFirst({ where: { id: state.accountId, userId }, include });
    if (!account) return { error: 'Cuenta inválida' };
  } else if (state.sharedAccountId) {
    account = await prisma.sharedAccount.findFirst({
      where: { id: state.sharedAccountId, OR: [{ userAId: userId }, { userBId: userId }] }, include,
    });
    if (!account) return { error: 'Cuenta compartida inválida' };
  }
  // Keep legacy transactions without accounts editable.
  if (!account) return null;
  if (account.accountType === 'INVESTMENT' && state.type === 'EXPENSE') {
    return { error: 'Las cuentas de inversión solo aceptan transferencias, no gastos directos' };
  }
  if (account.accountType === 'CREDIT' && state.type === 'INCOME') {
    return { error: 'Las cuentas de crédito solo aceptan gastos' };
  }
  if (state.type === 'EXPENSE' && account.accountType !== 'CREDIT') {
    const balances = calcBalances(account);
    let available = state.currency === 'USD' ? balances.currentBalanceUSD : balances.currentBalance;
    const sameAccount = previous && (state.accountId
      ? state.accountId === previous.accountId
      : state.sharedAccountId === previous.sharedAccountId);
    if (sameAccount && state.currency === previous.currency) {
      available -= (previous.type === 'INCOME' ? 1 : -1) * Number(previous.amount);
    }
    // Compare cents to avoid binary floating point errors at an exact boundary.
    if (Math.round(available * 100) < Math.round(Number(state.amount) * 100)) {
      return { error: `Saldo insuficiente en "${account.name}"`, code: 'INSUFFICIENT_BALANCE', currentBalance: available, currency: state.currency };
    }
  }
  return null;
}

async function isDerived(prisma, transaction) {
  if (transaction.transferId) return true;
  return Boolean(await prisma.investmentOperation.findFirst({ where: { gainTransactionId: transaction.id }, select: { id: true } }));
}

module.exports = { validateAccounts, isDerived };

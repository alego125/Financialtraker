const { validateBalanceChanges } = require('./balanceChanges');
async function validateExchange(prisma, body, accountId, sharedAccountId) {
  const usd = Number(body.usdAmount), rate = Number(body.rate);
  if (!Number.isFinite(usd) || usd === 0 || !Number.isFinite(rate) || rate <= 0) return { error: 'Monto USD o cotización inválidos' };
  if (body.date && !Number.isFinite(new Date(body.date).getTime())) return { error: 'Fecha inválida' };
  const ars = Number((usd * rate).toFixed(2));
  if (!Number.isFinite(ars) || ars === 0) return { error: 'El importe debe ser de al menos un centavo' };
  return validateBalanceChanges(prisma, [
    { accountId, sharedAccountId, currency: 'ARS', delta: -ars },
    { accountId, sharedAccountId, currency: 'USD', delta: usd },
  ]);
}
module.exports = { validateExchange };

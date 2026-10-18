const { replay } = require('./investmentMath');
const { validateBalanceChanges, transactionChange } = require('./balanceChanges');
const GAIN = { name: 'Inversiones', type: 'INCOME', color: '#8b5cf6' };
const LOSS = { name: 'Pérdida en inversiones', type: 'EXPENSE', color: '#dc2626' };
function assertBalance(error) {
  if (error) throw Object.assign(new Error(error.error), { status: 400, code: error.code });
}
async function ownedGain(prisma, userId, id, operationId) {
  if (!id) return null;
  const linked = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!linked) return null;
  const duplicate = await prisma.investmentOperation.findFirst({ where: { gainTransactionId: id, id: { not: operationId } } });
  if (duplicate || linked.transferId || linked.sharedAccountId) throw Object.assign(new Error('El movimiento vinculado requiere revisión de integridad'), { status: 409 });
  return linked;
}
async function recomputeGroup(prisma, userId, assetId, accountId) {
  return recomputeGroups(prisma, userId, [{ assetId, accountId }]);
}
async function recomputeGroups(prisma, userId, groups, removedOperations = []) {
  const plans = [], changes = [];
  for (const operation of removedOperations) {
    const linked = await ownedGain(prisma, userId, operation.gainTransactionId, operation.id);
    if (linked) {
      changes.push(transactionChange(linked, -1));
      plans.push({ op: null, linked, data: null });
    }
  }
  const uniqueGroups = new Map(groups.map(group => [`${group.assetId}:${group.accountId || ''}`, group]));
  for (const { assetId, accountId } of uniqueGroups.values()) {
    const ops = await prisma.investmentOperation.findMany({
      where: { userId, assetId, accountId: accountId || null }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    const { steps } = replay(ops);
    const asset = await prisma.investmentAsset.findUnique({ where: { id: assetId } });
    for (const { op, realizedGain } of steps) {
      const linked = await ownedGain(prisma, userId, op.gainTransactionId, op.id);
      let data = null;
      if (realizedGain !== null && realizedGain !== 0 && op.accountId) {
        const definition = realizedGain > 0 ? GAIN : LOSS;
        const category = await prisma.category.upsert({ where: { userId_name: { userId, name: definition.name } }, create: { ...definition, userId }, update: {} });
        if (category.type !== definition.type) throw Object.assign(new Error(`La categoría "${category.name}" tiene un tipo incompatible`), { status: 400 });
        data = { type: definition.type, amount: Math.abs(realizedGain), currency: asset.currency, date: op.date,
          accountId: op.accountId, sharedAccountId: null, transferId: null, isReimbursement: false,
          categoryId: category.id, userId, comment: `Resultado venta ${asset.name} (${op.quantity} u.)` };
        changes.push(transactionChange(data));
      }
      if (linked) changes.push(transactionChange(linked, -1));
      plans.push({ op, realizedGain, linked, data });
    }
  }
  // Apply the removal and every affected group's recalculation as one net
  // balance change. Intermediate debit-first ordering must not reject a
  // mutation whose final balances are sufficient.
  assertBalance(await validateBalanceChanges(prisma, changes));
  for (const { op, realizedGain, linked, data } of plans) {
    let gainTransactionId = null;
    if (data) {
      const movement = linked
        ? await prisma.transaction.update({ where: { id: linked.id }, data })
        : await prisma.transaction.create({ data });
      gainTransactionId = movement.id;
    } else if (linked) {
      await prisma.transaction.delete({ where: { id: linked.id } });
    }
    if (op) await prisma.investmentOperation.update({ where: { id: op.id }, data: { realizedGain, gainTransactionId } });
  }
}
module.exports = { recomputeGroup, recomputeGroups };

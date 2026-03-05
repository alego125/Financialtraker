const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

// Obtener o crear la categoría especial "Transferencia entre cuentas"
// Esta categoría se usa internamente y se excluye del dashboard
const getTransferCategory = async (userId) => {
  const existing = await prisma.category.findFirst({
    where: { userId, name: 'Transferencia entre cuentas' },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: { name: 'Transferencia entre cuentas', type: 'EXPENSE', color: '#6366f1', userId },
  });
};

const verifyAccountAccess = async (userId, accountId, sharedAccountId) => {
  if (accountId) {
    const acc = await prisma.account.findFirst({ where: { id: accountId, userId } });
    return !!acc;
  }
  if (sharedAccountId) {
    const acc = await prisma.sharedAccount.findFirst({
      where: { id: sharedAccountId, OR: [{ userAId: userId }, { userBId: userId }] },
    });
    return !!acc;
  }
  return false;
};

const enrichTransfer = (t) => ({
  ...t,
  fromName:  t.fromAccount?.name  || t.fromSharedAccount?.name  || '—',
  fromColor: t.fromAccount?.color || t.fromSharedAccount?.color || '#6366f1',
  fromKind:  t.fromAccount ? 'personal' : 'shared',
  toName:    t.toAccount?.name    || t.toSharedAccount?.name    || '—',
  toColor:   t.toAccount?.color   || t.toSharedAccount?.color   || '#6366f1',
  toKind:    t.toAccount ? 'personal' : 'shared',
});

const INCLUDE = {
  fromAccount:       { select: { id: true, name: true, color: true } },
  fromSharedAccount: { select: { id: true, name: true, color: true } },
  toAccount:         { select: { id: true, name: true, color: true } },
  toSharedAccount:   { select: { id: true, name: true, color: true } },
  initiator:         { select: { id: true, name: true } },
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, accountId, sharedAccountId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { initiatorId: req.userId };
    if (accountId) {
      where = { ...where, OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] };
    } else if (sharedAccountId) {
      where = { ...where, OR: [{ fromSharedAccountId: sharedAccountId }, { toSharedAccountId: sharedAccountId }] };
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({ where, include: INCLUDE, orderBy: { date: 'desc' }, skip, take: parseInt(limit) }),
      prisma.transfer.count({ where }),
    ]);

    res.json({
      data: transfers.map(enrichTransfer),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, date, comment, fromAccountId, fromSharedAccountId, toAccountId, toSharedAccountId } = req.body;

    if (fromAccountId && fromAccountId === toAccountId)
      return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });
    if (fromSharedAccountId && fromSharedAccountId === toSharedAccountId)
      return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });

    const fromCount = [fromAccountId, fromSharedAccountId].filter(Boolean).length;
    const toCount   = [toAccountId, toSharedAccountId].filter(Boolean).length;
    if (fromCount !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta origen' });
    if (toCount   !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta destino' });

    const fromOk = await verifyAccountAccess(req.userId, fromAccountId, fromSharedAccountId);
    if (!fromOk) return res.status(403).json({ error: 'No tenés acceso a la cuenta origen' });

    const toOk = await verifyAccountAccess(req.userId, toAccountId, toSharedAccountId);
    if (!toOk) return res.status(403).json({ error: 'No tenés acceso a la cuenta destino' });

    // Obtener categoría especial de transferencia
    const transferCategory = await getTransferCategory(req.userId);

    const parsedAmount = parseFloat(amount);
    const parsedDate   = new Date(date);
    const txComment    = comment ? `[Transferencia] ${comment}` : '[Transferencia entre cuentas]';

    // Todo en una transacción atómica
    const [transfer] = await prisma.$transaction(async (tx) => {
      // 1. Registrar la transferencia
      const transfer = await tx.transfer.create({
        data: {
          amount: parsedAmount,
          date:   parsedDate,
          comment: comment || null,
          initiatorId:         req.userId,
          fromAccountId:       fromAccountId       || null,
          fromSharedAccountId: fromSharedAccountId || null,
          toAccountId:         toAccountId         || null,
          toSharedAccountId:   toSharedAccountId   || null,
        },
        include: INCLUDE,
      });

      // 2. EXPENSE en la cuenta origen (débito)
      await tx.transaction.create({
        data: {
          type:            'EXPENSE',
          amount:          parsedAmount,
          date:            parsedDate,
          comment:         txComment,
          userId:          req.userId,
          categoryId:      transferCategory.id,
          accountId:       fromAccountId       || null,
          sharedAccountId: fromSharedAccountId || null,
          transferId:      transfer.id,
        },
      });

      // 3. INCOME en la cuenta destino (crédito)
      await tx.transaction.create({
        data: {
          type:            'INCOME',
          amount:          parsedAmount,
          date:            parsedDate,
          comment:         txComment,
          userId:          req.userId,
          categoryId:      transferCategory.id,
          accountId:       toAccountId         || null,
          sharedAccountId: toSharedAccountId   || null,
          transferId:      transfer.id,
        },
      });

      return [transfer];
    });

    res.status(201).json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};

// Al eliminar la transferencia, eliminar también las transacciones vinculadas
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId } });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { transferId: id } });
      await tx.transfer.delete({ where: { id } });
    });

    res.json({ message: 'Transferencia eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, remove };

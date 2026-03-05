const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

// Verificar que el usuario tiene acceso a una cuenta
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

// Enriquecer transferencia con nombres de cuentas
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

// GET /api/transfers — listar todas las transferencias del usuario
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, accountId, sharedAccountId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filtro por cuenta específica si se pide
    let where = {
      initiatorId: req.userId,
    };

    if (accountId) {
      where = { ...where, OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] };
    } else if (sharedAccountId) {
      where = { ...where, OR: [{ fromSharedAccountId: sharedAccountId }, { toSharedAccountId: sharedAccountId }] };
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: INCLUDE,
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transfer.count({ where }),
    ]);

    res.json({
      data: transfers.map(enrichTransfer),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

// POST /api/transfers — crear transferencia
const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      amount, date, comment,
      fromAccountId, fromSharedAccountId,
      toAccountId,   toSharedAccountId,
    } = req.body;

    // Validar que origen y destino no sean el mismo
    if (fromAccountId && fromAccountId === toAccountId) return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });
    if (fromSharedAccountId && fromSharedAccountId === toSharedAccountId) return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });

    // Validar que exactamente una cuenta origen y una destino estén seteadas
    const fromCount = [fromAccountId, fromSharedAccountId].filter(Boolean).length;
    const toCount   = [toAccountId,   toSharedAccountId].filter(Boolean).length;
    if (fromCount !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta origen' });
    if (toCount   !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta destino' });

    // Verificar acceso a las cuentas
    const fromOk = await verifyAccountAccess(req.userId, fromAccountId, fromSharedAccountId);
    if (!fromOk) return res.status(403).json({ error: 'No tenés acceso a la cuenta origen' });

    const toOk = await verifyAccountAccess(req.userId, toAccountId, toSharedAccountId);
    if (!toOk) return res.status(403).json({ error: 'No tenés acceso a la cuenta destino' });

    const transfer = await prisma.transfer.create({
      data: {
        amount:               parseFloat(amount),
        date:                 new Date(date),
        comment:              comment || null,
        initiatorId:          req.userId,
        fromAccountId:        fromAccountId       || null,
        fromSharedAccountId:  fromSharedAccountId || null,
        toAccountId:          toAccountId         || null,
        toSharedAccountId:    toSharedAccountId   || null,
      },
      include: INCLUDE,
    });

    res.status(201).json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};

// DELETE /api/transfers/:id
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId } });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });
    await prisma.transfer.delete({ where: { id } });
    res.json({ message: 'Transferencia eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, remove };

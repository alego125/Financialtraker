const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

// Verify caller is part of an active partnership with partnerId
const verifyPartnership = async (userId, partnerId) => {
  return prisma.partnership.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: userId,   receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    },
  });
};

const list = async (req, res, next) => {
  try {
    const accounts = await prisma.sharedAccount.findMany({
      where: { OR: [{ userAId: req.userId }, { userBId: req.userId }] },
      include: {
        userA: { select: { id: true, name: true, email: true } },
        userB: { select: { id: true, name: true, email: true } },
        transactions: { select: { type: true, amount: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = accounts.map(a => {
      let balance = toNum(a.initialBalance);
      for (const tx of a.transactions) {
        balance += tx.type === 'INCOME' ? toNum(tx.amount) : -toNum(tx.amount);
      }
      return {
        id: a.id, name: a.name, color: a.color,
        initialBalance: toNum(a.initialBalance),
        currentBalance: parseFloat(balance.toFixed(2)),
        transactionCount: a._count.transactions,
        userA: a.userA, userB: a.userB,
        partner: a.userAId === req.userId ? a.userB : a.userA,
        createdAt: a.createdAt,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, initialBalance = 0, color, partnerId } = req.body;

    if (!partnerId) return res.status(400).json({ error: 'partnerId requerido' });

    const partnership = await verifyPartnership(req.userId, partnerId);
    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con ese usuario' });

    const account = await prisma.sharedAccount.create({
      data: {
        name,
        initialBalance: parseFloat(initialBalance),
        color: color || '#7c3aed',
        userAId: req.userId,
        userBId: partnerId,
      },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(account);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.sharedAccount.findFirst({
      where: { id, OR: [{ userAId: req.userId }, { userBId: req.userId }] },
    });
    if (!account) return res.status(404).json({ error: 'Cuenta compartida no encontrada' });

    const updated = await prisma.sharedAccount.update({
      where: { id },
      data: {
        ...(req.body.name !== undefined && { name: req.body.name }),
        ...(req.body.initialBalance !== undefined && { initialBalance: parseFloat(req.body.initialBalance) }),
        ...(req.body.color !== undefined && { color: req.body.color }),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.sharedAccount.findFirst({
      where: { id, OR: [{ userAId: req.userId }, { userBId: req.userId }] },
    });
    if (!account) return res.status(404).json({ error: 'Cuenta compartida no encontrada' });

    const txCount = await prisma.transaction.count({ where: { sharedAccountId: id } });
    if (txCount > 0) return res.status(400).json({ error: `No podés eliminar una cuenta con ${txCount} transacciones` });

    await prisma.sharedAccount.delete({ where: { id } });
    res.json({ message: 'Cuenta compartida eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };

const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

// Calculate current balance = initialBalance + all income - all expense
const calcBalance = async (accountId) => {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { transactions: { select: { type: true, amount: true } } },
  });
  if (!account) return null;
  let balance = toNum(account.initialBalance);
  for (const tx of account.transactions) {
    balance += tx.type === 'INCOME' ? toNum(tx.amount) : -toNum(tx.amount);
  }
  return parseFloat(balance.toFixed(2));
};

const list = async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { transactions: true } }, transactions: { select: { type: true, amount: true } } },
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

    const { name, initialBalance = 0, color } = req.body;
    const account = await prisma.account.create({
      data: { name, initialBalance: parseFloat(initialBalance), color: color || '#6366f1', userId: req.userId },
    });
    res.status(201).json({ ...account, currentBalance: toNum(account.initialBalance) });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.account.findFirst({ where: { id, userId: req.userId } });
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const updated = await prisma.account.update({
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
    const account = await prisma.account.findFirst({ where: { id, userId: req.userId } });
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const txCount = await prisma.transaction.count({ where: { accountId: id } });
    if (txCount > 0) return res.status(400).json({ error: `No podés eliminar una cuenta con ${txCount} transacciones` });

    await prisma.account.delete({ where: { id } });
    res.json({ message: 'Cuenta eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };

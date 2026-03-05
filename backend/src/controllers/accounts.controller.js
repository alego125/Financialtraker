const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

const calcBalances = (account) => {
  let arsBalance = toNum(account.initialBalance);
  let usdBalance = toNum(account.initialBalanceUSD || 0);

  for (const tx of account.transactions || []) {
    const amt = toNum(tx.amount);
    const isUSD = tx.currency === 'USD';
    if (tx.type === 'INCOME') {
      isUSD ? (usdBalance += amt) : (arsBalance += amt);
    } else {
      isUSD ? (usdBalance -= amt) : (arsBalance -= amt);
    }
  }

  // Apply currency exchanges
  for (const ex of account.exchangesFrom || []) {
    usdBalance += toNum(ex.usdAmount);
    arsBalance -= toNum(ex.arsAmount);
  }

  return {
    currentBalance:    parseFloat(arsBalance.toFixed(2)),
    currentBalanceUSD: parseFloat(usdBalance.toFixed(2)),
  };
};

const list = async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.userId },
      include: {
        _count: { select: { transactions: true } },
        transactions: { select: { type: true, amount: true, currency: true } },
        exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = accounts.map(a => ({
      id: a.id, name: a.name, color: a.color,
      accountType: a.accountType,
      initialBalance: toNum(a.initialBalance),
      initialBalanceUSD: toNum(a.initialBalanceUSD),
      ...calcBalances(a),
      transactionCount: a._count.transactions,
      createdAt: a.createdAt,
    }));

    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, initialBalance = 0, initialBalanceUSD = 0, color, accountType = 'REGULAR' } = req.body;
    const account = await prisma.account.create({
      data: {
        name,
        accountType,
        initialBalance: parseFloat(initialBalance),
        initialBalanceUSD: parseFloat(initialBalanceUSD),
        color: color || '#6366f1',
        userId: req.userId,
      },
    });
    res.status(201).json({ ...account, currentBalance: toNum(account.initialBalance), currentBalanceUSD: toNum(account.initialBalanceUSD) });
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
        ...(req.body.initialBalanceUSD !== undefined && { initialBalanceUSD: parseFloat(req.body.initialBalanceUSD) }),
        ...(req.body.color !== undefined && { color: req.body.color }),
        ...(req.body.accountType !== undefined && { accountType: req.body.accountType }),
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

// POST /api/accounts/:id/exchange — compra/venta de divisas
const exchange = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.account.findFirst({ where: { id, userId: req.userId } });
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const { usdAmount, rate, date, comment } = req.body;
    if (!usdAmount || !rate) return res.status(400).json({ error: 'usdAmount y rate son requeridos' });

    const parsedUSD = parseFloat(usdAmount);
    const parsedRate = parseFloat(rate);
    const arsAmount = parseFloat((parsedUSD * parsedRate).toFixed(2));

    const ex = await prisma.currencyExchange.create({
      data: {
        accountId: id,
        userId: req.userId,
        date: new Date(date || new Date().toISOString().slice(0, 10)),
        usdAmount: parsedUSD,
        arsAmount,
        rate: parsedRate,
        comment: comment || null,
      },
    });

    res.status(201).json({ ...ex, arsAmount });
  } catch (err) { next(err); }
};

const listExchanges = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.account.findFirst({ where: { id, userId: req.userId } });
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const exchanges = await prisma.currencyExchange.findMany({
      where: { accountId: id },
      orderBy: { date: 'desc' },
    });
    res.json(exchanges);
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove, exchange, listExchanges, calcBalances };

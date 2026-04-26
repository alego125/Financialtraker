const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const buildWhere = (userId, query) => {
  // Exclude transfer transactions by default (they show in Transfers tab)
  const where = { userId, transferId: query.includeTransfers === 'true' ? undefined : null };
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
  if (query.sharedAccountId) where.sharedAccountId = query.sharedAccountId;
  if (query.currency) where.currency = query.currency;
  if (query.paymentType) where.paymentType = query.paymentType;
  if (query.comment) where.comment = { contains: query.comment, mode: 'insensitive' };

  if (query.month && !query.dateFrom) {
    const [y, m] = query.month.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    where.date = {
      gte: new Date(`${y}-${m}-01T00:00:00.000Z`),
      lte: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`),
    };
  } else if (query.year && !query.dateFrom && !query.month) {
    where.date = {
      gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
      lte: new Date(`${query.year}-12-31T23:59:59.999Z`),
    };
  } else if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
    if (query.dateTo)   where.date.lte = new Date(query.dateTo   + 'T23:59:59.999Z');
  }
  if (query.amountMin || query.amountMax) {
    where.amount = {};
    if (query.amountMin) where.amount.gte = parseFloat(query.amountMin);
    if (query.amountMax) where.amount.lte = parseFloat(query.amountMax);
  }
  return where;
};

// Parse date string keeping local date (avoids -1 day timezone bug)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  // "2025-03-04" → stored as 2025-03-04T12:00:00Z (noon UTC = same day in AR -3)
  return new Date(dateStr + 'T12:00:00.000Z');
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc', ...filters } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = buildWhere(req.userId, filters);
    const validSortFields = ['date', 'amount', 'type', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'date';

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true, sharedAccount: true },
        orderBy: { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId, paymentType, currency = 'ARS', isReimbursement = false } = req.body;

    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
    if (!category) return res.status(400).json({ error: 'Categoría inválida' });

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: req.userId },
        include: {
          transactions: { select: { type: true, amount: true, currency: true } },
          exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
        },
      });
      if (!account) return res.status(400).json({ error: 'Cuenta inválida' });

      if (account.accountType === 'INVESTMENT' && type === 'EXPENSE')
        return res.status(400).json({ error: 'Las cuentas de inversión solo aceptan transferencias, no gastos directos' });
      if (account.accountType === 'CREDIT' && type === 'INCOME')
        return res.status(400).json({ error: 'Las cuentas de crédito solo aceptan gastos' });

      // Validar saldo suficiente para cuentas no crédito
      if (type === 'EXPENSE' && account.accountType !== 'CREDIT') {
        const { calcBalances } = require('./accounts.controller');
        const balances = calcBalances(account);
        const isUSD = currency === 'USD';
        const currentBalance = isUSD ? balances.currentBalanceUSD : balances.currentBalance;
        if (currentBalance - parseFloat(amount) < 0) {
          const sym = isUSD ? 'U$D' : '$';
          return res.status(400).json({
            error: `Saldo insuficiente en "${account.name}". Saldo actual: ${sym} ${currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            code: 'INSUFFICIENT_BALANCE',
            currentBalance,
            currency,
          });
        }
      }
    }

    if (sharedAccountId) {
      const shared = await prisma.sharedAccount.findFirst({
        where: { id: sharedAccountId, OR: [{ userAId: req.userId }, { userBId: req.userId }] },
      });
      if (!shared) return res.status(400).json({ error: 'Cuenta compartida inválida' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        comment: comment || null,
        date: parseLocalDate(date),
        currency,
        userId: req.userId,
        categoryId,
        accountId: accountId || null,
        sharedAccountId: sharedAccountId || null,
        paymentType: type === 'EXPENSE' && paymentType ? paymentType : null,
        isReimbursement: type === 'INCOME' ? Boolean(isReimbursement) : false,
      },
      include: { category: true, account: true, sharedAccount: true },
    });
    res.status(201).json(transaction);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Transacción no encontrada' });

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId, paymentType, currency, isReimbursement } = req.body;

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
      if (!category) return res.status(400).json({ error: 'Categoría inválida' });
    }

    const effectiveType = type || existing.type;
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(comment !== undefined && { comment: comment || null }),
        ...(date && { date: parseLocalDate(date) }),
        ...(categoryId && { categoryId }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(sharedAccountId !== undefined && { sharedAccountId: sharedAccountId || null }),
        ...(currency && { currency }),
        paymentType: effectiveType === 'EXPENSE' && paymentType ? paymentType : null,
        isReimbursement: isReimbursement !== undefined ? (effectiveType === 'INCOME' ? Boolean(isReimbursement) : false) : undefined,
      },
      include: { category: true, account: true, sharedAccount: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Transacción no encontrada' });
    await prisma.transaction.delete({ where: { id } });
    res.json({ message: 'Transacción eliminada' });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const tx = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { category: true, account: true, sharedAccount: true },
    });
    if (!tx) return res.status(404).json({ error: 'Transacción no encontrada' });
    res.json(tx);
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove, getOne, buildWhere };

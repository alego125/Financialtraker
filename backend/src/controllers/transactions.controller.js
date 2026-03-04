const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const buildWhere = (userId, query) => {
  const where = { userId };
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
  if (query.sharedAccountId) where.sharedAccountId = query.sharedAccountId;
  if (query.comment) where.comment = { contains: query.comment, mode: 'insensitive' };

  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.date.lte = new Date(query.dateTo + 'T23:59:59.999Z');
  }
  if (query.amountMin || query.amountMax) {
    where.amount = {};
    if (query.amountMin) where.amount.gte = parseFloat(query.amountMin);
    if (query.amountMax) where.amount.lte = parseFloat(query.amountMax);
  }
  return where;
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

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId } = req.body;

    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
    if (!category) return res.status(400).json({ error: 'Categoría inválida' });

    // Validate account ownership
    if (accountId) {
      const account = await prisma.account.findFirst({ where: { id: accountId, userId: req.userId } });
      if (!account) return res.status(400).json({ error: 'Cuenta inválida' });
    }

    if (sharedAccountId) {
      const shared = await prisma.sharedAccount.findFirst({
        where: { id: sharedAccountId, OR: [{ userAId: req.userId }, { userBId: req.userId }] },
      });
      if (!shared) return res.status(400).json({ error: 'Cuenta compartida inválida' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        type, amount: parseFloat(amount), comment,
        date: new Date(date), userId: req.userId, categoryId,
        accountId: accountId || null,
        sharedAccountId: sharedAccountId || null,
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

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId } = req.body;

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
      if (!category) return res.status(400).json({ error: 'Categoría inválida' });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(comment !== undefined && { comment }),
        ...(date && { date: new Date(date) }),
        ...(categoryId && { categoryId }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(sharedAccountId !== undefined && { sharedAccountId: sharedAccountId || null }),
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

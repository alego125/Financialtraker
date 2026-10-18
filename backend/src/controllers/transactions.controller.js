const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { financialMutation } = require('../utils/financialMutation');
const { validateBalanceChanges, transactionChange } = require('../utils/balanceChanges');
const { validateAccounts, isDerived } = require('../utils/transactionRules');

const { buildTransactionWhere } = require('../utils/reportFilters');
const { parsePagination } = require('../utils/query');
const buildWhere = (userId, query) => buildTransactionWhere(userId, query, {excludeTransfers: query.includeTransfers !== 'true'});

// Parse date string keeping local date (avoids -1 day timezone bug)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  // "2025-03-04" → stored as 2025-03-04T12:00:00Z (noon UTC = same day in AR -3)
  return new Date(dateStr + 'T12:00:00.000Z');
};

const list = async (req, res, next) => {
  try {
    const {page, limit, skip, take} = parsePagination(req.query);
    const {sortBy = 'date', sortOrder = 'desc', ...filters} = req.query;
    const where = buildWhere(req.userId, filters);
    const validSortFields = ['date', 'amount', 'type', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'date';

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true, sharedAccount: true },
        orderBy: [{ [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' }, {id: 'desc'}],
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

const create = async (req, res, next, prisma) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId, paymentType, currency = 'ARS', isReimbursement = false } = req.body;

    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
    if (!category) return res.status(400).json({ error: 'Categoría inválida' });

    const accountError = await validateAccounts(prisma, req.userId, { type, amount, currency, accountId, sharedAccountId });
    if (accountError) return res.status(400).json(accountError);

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

const update = async (req, res, next, prisma) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Transacción no encontrada' });

    if (await isDerived(prisma, existing)) return res.status(409).json({ error: 'Este movimiento se gestiona desde su transferencia u operación de inversión' });

    const { type, amount, comment, date, categoryId, accountId, sharedAccountId, paymentType, currency, isReimbursement } = req.body;

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.userId } });
      if (!category) return res.status(400).json({ error: 'Categoría inválida' });
    }

    const effectiveType = type || existing.type;
    const effectiveState = {
      type: effectiveType,
      amount: amount !== undefined ? amount : existing.amount,
      currency: currency !== undefined ? currency : existing.currency,
      accountId: accountId !== undefined ? accountId : existing.accountId,
      sharedAccountId: sharedAccountId !== undefined ? sharedAccountId : existing.sharedAccountId,
    };
    const accountError = await validateAccounts(prisma, req.userId, effectiveState, existing);
    if (accountError) return res.status(400).json(accountError);
    const balanceError = await validateBalanceChanges(prisma, [transactionChange(existing, -1), transactionChange(effectiveState)]);
    if (balanceError) return res.status(400).json(balanceError);
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
        paymentType: effectiveType === 'EXPENSE' ? (paymentType !== undefined ? paymentType || null : existing.paymentType) : null,
        isReimbursement: isReimbursement !== undefined ? (effectiveType === 'INCOME' ? Boolean(isReimbursement) : false) : undefined,
      },
      include: { category: true, account: true, sharedAccount: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next, prisma) => {
  try {
    const { id } = req.params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Transacción no encontrada' });
    if (await isDerived(prisma, existing)) return res.status(409).json({ error: 'Este movimiento se gestiona desde su transferencia u operación de inversión' });
    const balanceError = await validateBalanceChanges(prisma, [transactionChange(existing, -1)]);
    if (balanceError) return res.status(400).json(balanceError);
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

module.exports = { list, create: financialMutation(prisma, create), update: financialMutation(prisma, update), remove: financialMutation(prisma, remove), getOne, buildWhere };

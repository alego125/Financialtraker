const { parsePagination } = require('../utils/query');
const { resolveDateRange, parseListParam, buildTransactionWhere } = require('../utils/reportFilters');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { financialMutation } = require('../utils/financialMutation');
const { validateBalanceChanges } = require('../utils/balanceChanges');
const { calcBalances } = require('./accounts.controller');

const toNum = d => parseFloat(d?.toString() || '0');
// The exported mutation already owns the serializable transaction.
const withinTransaction = (tx, callback) => callback(tx);
const transferChanges = (t, direction = 1) => [
  { accountId: t.fromAccountId, sharedAccountId: t.fromSharedAccountId, currency: t.currency, delta: -direction * Number(t.amount) },
  { accountId: t.toAccountId, sharedAccountId: t.toSharedAccountId, currency: t.currency, delta: direction * Number(t.amount) },
];

const getTransferCategory = async (userId, prisma) => {
  const existing = await prisma.category.findFirst({
    where: { userId, name: 'Transferencia entre cuentas' },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: { name: 'Transferencia entre cuentas', type: 'EXPENSE', color: '#6366f1', userId },
  });
};

const verifyFromAccess = async (userId, accountId, sharedAccountId, prisma) => {
  if (accountId) {
    const acc = await prisma.account.findFirst({ where: { id: accountId, userId } });
    return acc ? { ok: true, account: acc } : { ok: false };
  }
  if (sharedAccountId) {
    const acc = await prisma.sharedAccount.findFirst({
      where: { id: sharedAccountId, OR: [{ userAId: userId }, { userBId: userId }] },
    });
    return acc ? { ok: true, account: acc } : { ok: false };
  }
  return { ok: false };
};

const verifyToAccess = async (userId, accountId, sharedAccountId, prisma) => {
  if (accountId) {
    const own = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (own) return { ok: true, ownerId: userId, account: own };

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return { ok: false };

    const partnership = await prisma.partnership.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId,         receiverId: account.userId },
          { senderId: account.userId, receiverId: userId },
        ],
      },
    });
    if (partnership) return { ok: true, ownerId: account.userId, account };
    return { ok: false };
  }
  if (sharedAccountId) {
    const acc = await prisma.sharedAccount.findFirst({
      where: { id: sharedAccountId, OR: [{ userAId: userId }, { userBId: userId }] },
    });
    return acc ? { ok: true, ownerId: userId, account: acc } : { ok: false };
  }
  return { ok: false };
};

// Calcula el saldo actual de una cuenta (personal o compartida)
const getAccountBalance = async (accountId, sharedAccountId, currency, prisma) => {
  if (accountId) {
    const acc = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        transactions: { select: { type: true, amount: true, currency: true } },
        exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
      },
    });
    if (!acc) return null;
    const b = calcBalances(acc);
    return currency === 'USD' ? b.currentBalanceUSD : b.currentBalance;
  }
  if (sharedAccountId) {
    const acc = await prisma.sharedAccount.findUnique({
      where: { id: sharedAccountId },
      include: {
        transactions: { select: { type: true, amount: true, currency: true } },
        exchangesFrom: { select: { usdAmount: true, arsAmount: true } },
      },
    });
    if (!acc) return null;
    let ars = toNum(acc.initialBalance), usd = toNum(acc.initialBalanceUSD || 0);
    for (const tx of acc.transactions) {
      const amt = toNum(tx.amount), isUSD = tx.currency === 'USD';
      if (tx.type === 'INCOME') { isUSD ? (usd += amt) : (ars += amt); }
      else                      { isUSD ? (usd -= amt) : (ars -= amt); }
    }
    for (const ex of (acc.exchangesFrom || [])) { usd += toNum(ex.usdAmount); ars -= toNum(ex.arsAmount); }
    return currency === 'USD' ? parseFloat(usd.toFixed(2)) : parseFloat(ars.toFixed(2));
  }
  return null;
};

const enrichTransfer = (t) => ({
  ...t,
  fromName:  t.fromAccount?.name  || t.fromSharedAccount?.name  || '—',
  fromColor: t.fromAccount?.color || t.fromSharedAccount?.color || '#6366f1',
  fromKind:  t.fromAccount ? 'personal' : 'shared',
  toName:    t.toAccount?.name    || t.toSharedAccount?.name    || '—',
  toColor:   t.toAccount?.color   || t.toSharedAccount?.color   || '#6366f1',
  toKind:    t.toAccount ? 'personal' : 'shared',
  currency:  t.currency || 'ARS',
});

const INCLUDE = {
  fromAccount:       { select: { id: true, name: true, color: true, accountType: true } },
  fromSharedAccount: { select: { id: true, name: true, color: true, accountType: true } },
  toAccount:         { select: { id: true, name: true, color: true, accountType: true, userId: true } },
  toSharedAccount:   { select: { id: true, name: true, color: true, accountType: true } },
  initiator:         { select: { id: true, name: true } },
};

const list = async (req, res, next) => {
  try {
    const {page, limit, skip, take} = parsePagination(req.query);
    const {from, to} = resolveDateRange(req.query, {defaultMonth: false});
    const ids = parseListParam(req.query.accountIds || req.query.accountId || req.query.sharedAccountId);
    const common = buildTransactionWhere(req.userId, req.query);
    const where = {initiatorId: req.userId,
      ...(common.amount && {amount: common.amount}),
      ...(common.comment && {comment: common.comment}),
      ...(ids.length && {OR: ['fromAccountId','toAccountId','fromSharedAccountId','toSharedAccountId'].map(key => ({[key]: {in: ids}}))}),
      ...(req.query.currency && {currency: req.query.currency}),
      ...((from || to) && {date: {...(from && {gte: from}), ...(to && {lte: to})}}),
    };
    const orderField = ['date','amount','createdAt'].includes(req.query.sortBy) ? req.query.sortBy : 'date';
    const orderBy = [{[orderField]: req.query.sortOrder === 'asc' ? 'asc' : 'desc'}, {id: 'desc'}];

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({ where, include: INCLUDE, orderBy, skip, take }),
      prisma.transfer.count({ where }),
    ]);

    res.json({
      data: transfers.map(enrichTransfer),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId }, include: INCLUDE });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });
    res.json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};

const create = async (req, res, next, prisma) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, date, comment, currency = 'ARS', fromAccountId, fromSharedAccountId, toAccountId, toSharedAccountId } = req.body;

    if (fromAccountId && fromAccountId === toAccountId)
      return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });
    if (fromSharedAccountId && fromSharedAccountId === toSharedAccountId)
      return res.status(400).json({ error: 'La cuenta origen y destino no pueden ser la misma' });

    const fromCount = [fromAccountId, fromSharedAccountId].filter(Boolean).length;
    const toCount   = [toAccountId,   toSharedAccountId].filter(Boolean).length;
    if (fromCount !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta origen' });
    if (toCount   !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta destino' });

    const fromResult = await verifyFromAccess(req.userId, fromAccountId, fromSharedAccountId, prisma);
    if (!fromResult.ok) return res.status(403).json({ error: 'No tenés acceso a la cuenta origen' });

    const toResult = await verifyToAccess(req.userId, toAccountId, toSharedAccountId, prisma);
    if (!toResult.ok) return res.status(403).json({ error: 'No tenés acceso a la cuenta destino' });

    // ── Regla: cuenta CRÉDITO no puede ser origen de transferencia ──
    const fromAccountType = fromResult.account?.accountType;
    if (fromAccountType === 'CREDIT') {
      return res.status(400).json({ error: 'Las cuentas de crédito no pueden enviar transferencias. Solo se les puede transferir para pagar el saldo.' });
    }

    const parsedAmount   = parseFloat(amount);
    const parsedCurrency = ['ARS','USD'].includes(currency) ? currency : 'ARS';

    // ── Regla: cuenta origen no puede quedar en negativo (excepto CREDIT) ──
    const currentBalance = await getAccountBalance(fromAccountId, fromSharedAccountId, parsedCurrency, prisma);
    if (currentBalance !== null && fromAccountType !== 'CREDIT' && currentBalance - parsedAmount < 0) {
      const curr = parsedCurrency === 'USD' ? 'U$D' : '$';
      return res.status(400).json({
        error: `Saldo insuficiente. Saldo actual: ${curr} ${currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        code: 'INSUFFICIENT_BALANCE',
        currentBalance,
        currency: parsedCurrency,
      });
    }

    const parsedDate   = new Date(date);
    const txComment    = comment ? `[Transferencia] ${comment}` : '[Transferencia entre cuentas]';
    const toOwnerId    = toResult.ownerId || req.userId;
    const isPartnerAccount = toAccountId && toOwnerId !== req.userId;

    const transferCategory = await getTransferCategory(req.userId, prisma);

    const [transfer] = await withinTransaction(prisma, async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          amount:              parsedAmount,
          date:                parsedDate,
          currency:            parsedCurrency,
          comment:             comment || null,
          initiatorId:         req.userId,
          fromAccountId:       fromAccountId       || null,
          fromSharedAccountId: fromSharedAccountId || null,
          toAccountId:         toAccountId         || null,
          toSharedAccountId:   toSharedAccountId   || null,
        },
        include: INCLUDE,
      });

      await tx.transaction.create({
        data: {
          type: 'EXPENSE', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: req.userId,
          categoryId: transferCategory.id,
          accountId: fromAccountId || null, sharedAccountId: fromSharedAccountId || null,
          transferId: transfer.id,
        },
      });

      let toUserId = toOwnerId;
      let toCatId  = transferCategory.id;
      if (isPartnerAccount) {
        const partnerCat = await getTransferCategory(toOwnerId, prisma);
        toCatId  = partnerCat.id;
        toUserId = toOwnerId;
      }

      await tx.transaction.create({
        data: {
          type: 'INCOME', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: toUserId,
          categoryId: toCatId,
          accountId: toAccountId || null, sharedAccountId: toSharedAccountId || null,
          transferId: transfer.id,
        },
      });

      return [transfer];
    });

    res.status(201).json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};

// Pago de tarjeta de crédito — debita de cuenta origen, acredita en cuenta crédito
const payCreditCard = async (req, res, next, prisma) => {
  try {
    const { creditAccountId, creditSharedAccountId, sourceAccountId, sourceSharedAccountId, amount, date, comment, currency = 'ARS' } = req.body;

    const targetCreditId       = creditAccountId || null;
    const targetSharedCreditId = creditSharedAccountId || null;

    if (!targetCreditId && !targetSharedCreditId)
      return res.status(400).json({ error: 'creditAccountId requerido' });
    if (!sourceAccountId && !sourceSharedAccountId)
      return res.status(400).json({ error: 'Seleccioná una cuenta origen para el pago' });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Monto debe ser mayor a 0' });

    // Verificar que la cuenta destino es CREDIT — puede ser personal o compartida
    let creditAccount = null;
    let creditIsShared = false;

    if (targetCreditId) {
      creditAccount = await prisma.account.findFirst({
        where: { id: targetCreditId, userId: req.userId, accountType: 'CREDIT' },
      });
    }
    if (!creditAccount && targetSharedCreditId) {
      creditAccount = await prisma.sharedAccount.findFirst({
        where: { id: targetSharedCreditId, accountType: 'CREDIT', OR: [{ userAId: req.userId }, { userBId: req.userId }] },
      });
      if (creditAccount) creditIsShared = true;
    }
    if (!creditAccount) return res.status(404).json({ error: 'Cuenta de crédito no encontrada' });

    // Verificar acceso a la cuenta origen
    const fromResult = await verifyFromAccess(req.userId, sourceAccountId, sourceSharedAccountId, prisma);
    if (!fromResult.ok) return res.status(403).json({ error: 'No tenés acceso a la cuenta origen' });

    const fromAccountType = fromResult.account?.accountType;
    if (fromAccountType === 'CREDIT')
      return res.status(400).json({ error: 'No podés pagar una tarjeta con otra tarjeta de crédito' });

    const parsedAmount   = parseFloat(amount);
    const parsedCurrency = ['ARS', 'USD'].includes(currency) ? currency : 'ARS';

    // Validar saldo suficiente en cuenta origen
    const currentBalance = await getAccountBalance(sourceAccountId, sourceSharedAccountId, parsedCurrency, prisma);
    if (currentBalance !== null && currentBalance - parsedAmount < 0) {
      const sym = parsedCurrency === 'USD' ? 'U$D' : '$';
      return res.status(400).json({
        error: `Saldo insuficiente en la cuenta origen. Saldo actual: ${sym} ${currentBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        code: 'INSUFFICIENT_BALANCE',
        currentBalance,
        currency: parsedCurrency,
      });
    }

    const parsedDate   = new Date(date || new Date().toISOString().slice(0, 10));
    const txComment    = comment ? `[Pago Tarjeta] ${comment}` : `[Pago Tarjeta] ${creditAccount.name}`;
    const transferCategory = await getTransferCategory(req.userId, prisma);

    const [transfer] = await withinTransaction(prisma, async (tx) => {
      // Registrar la transferencia especial
      const transfer = await tx.transfer.create({
        data: {
          amount:              parsedAmount,
          date:                parsedDate,
          currency:            parsedCurrency,
          comment:             comment || `Pago ${creditAccount.name}`,
          initiatorId:         req.userId,
          fromAccountId:       sourceAccountId       || null,
          fromSharedAccountId: sourceSharedAccountId || null,
          toAccountId:         creditIsShared ? null : (targetCreditId || null),
          toSharedAccountId:   creditIsShared ? (targetSharedCreditId || null) : null,
        },
        include: INCLUDE,
      });

      // EXPENSE en cuenta origen (sale el dinero)
      await tx.transaction.create({
        data: {
          type: 'EXPENSE', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: req.userId,
          categoryId: transferCategory.id,
          accountId: sourceAccountId || null,
          sharedAccountId: sourceSharedAccountId || null,
          transferId: transfer.id,
        },
      });

      // INCOME en cuenta crédito (reduce la deuda)
      await tx.transaction.create({
        data: {
          type: 'INCOME', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: req.userId,
          categoryId: transferCategory.id,
          accountId:       creditIsShared ? null : (targetCreditId || null),
          sharedAccountId: creditIsShared ? (targetSharedCreditId || null) : null,
          transferId: transfer.id,
        },
      });

      return [transfer];
    });

    res.status(201).json(enrichTransfer(transfer));
  } catch (err) { next(err); }
};


// Cancelar transferencia — revierte los movimientos
const cancel = async (req, res, next, prisma) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({
      where: { id, initiatorId: req.userId },
      include: INCLUDE,
    });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });

    const balanceError = await validateBalanceChanges(prisma, transferChanges(transfer, -1));
    if (balanceError) return res.status(400).json(balanceError);

    await withinTransaction(prisma, async (tx) => {
      // Balances are derived from these entries. Removing both legs restores
      // the pre-transfer balances; adding inverse entries would reverse twice.
      await tx.transaction.deleteMany({ where: { transferId: id } });
      await tx.transfer.delete({ where: { id } });
    });

    res.json({ message: 'Transferencia cancelada y fondos devueltos a la cuenta origen' });
  } catch (err) { next(err); }
};

// Actualizar fecha de transferencia
const update = async (req, res, next, prisma) => {
  try {
    const { id } = req.params;
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Fecha requerida' });

    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId } });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });

    const parsedDate = new Date(date + 'T12:00:00.000Z'); // noon UTC to avoid timezone issues

    // Update transfer date
    const updated = await prisma.transfer.update({
      where: { id },
      data: { date: parsedDate },
      include: INCLUDE,
    });

    // Update all linked transactions date
    await prisma.transaction.updateMany({
      where: { transferId: id },
      data: { date: parsedDate },
    });

    res.json(enrichTransfer(updated));
  } catch (err) { next(err); }
};


const remove = async (req, res, next, prisma) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId } });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });

    const balanceError = await validateBalanceChanges(prisma, transferChanges(transfer, -1));
    if (balanceError) return res.status(400).json(balanceError);

    await withinTransaction(prisma, async (tx) => {
      await tx.transaction.deleteMany({ where: { transferId: id } });
      await tx.transfer.delete({ where: { id } });
    });

    res.json({ message: 'Transferencia eliminada' });
  } catch (err) { next(err); }
};

// Edición completa de transferencia — elimina tx vinculadas y las recrea
const fullUpdate = async (req, res, next, prisma) => {
  try {
    const { id } = req.params;
    const { amount, date, currency, fromAccountId, fromSharedAccountId, toAccountId, toSharedAccountId, comment } = req.body;

    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
    if (!date)
      return res.status(400).json({ error: 'Fecha requerida' });

    const fromCount = [fromAccountId, fromSharedAccountId].filter(Boolean).length;
    const toCount   = [toAccountId,   toSharedAccountId].filter(Boolean).length;
    if (fromCount !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta origen' });
    if (toCount   !== 1) return res.status(400).json({ error: 'Seleccioná exactamente una cuenta destino' });

    if (fromAccountId && fromAccountId === toAccountId)
      return res.status(400).json({ error: 'Origen y destino no pueden ser la misma cuenta' });

    const transfer = await prisma.transfer.findFirst({ where: { id, initiatorId: req.userId } });
    if (!transfer) return res.status(404).json({ error: 'Transferencia no encontrada' });

    const fromResult = await verifyFromAccess(req.userId, fromAccountId, fromSharedAccountId, prisma);
    if (!fromResult.ok) return res.status(403).json({ error: 'No tenés acceso a la cuenta origen' });
    if (fromResult.account?.accountType === 'CREDIT')
      return res.status(400).json({ error: 'Las cuentas de crédito no pueden enviar transferencias' });

    const toResult = await verifyToAccess(req.userId, toAccountId, toSharedAccountId, prisma);
    if (!toResult.ok) return res.status(403).json({ error: 'No tenés acceso a la cuenta destino' });

    const parsedAmount   = parseFloat(amount);
    const parsedCurrency = ['ARS', 'USD'].includes(currency) ? currency : 'ARS';
    const parsedDate     = new Date(date + 'T12:00:00.000Z');
    const balanceError = await validateBalanceChanges(prisma, [
      ...transferChanges(transfer, -1),
      ...transferChanges({ amount: parsedAmount, currency: parsedCurrency, fromAccountId, fromSharedAccountId, toAccountId, toSharedAccountId }),
    ]);
    if (balanceError) return res.status(400).json(balanceError);
    const txComment      = comment ? `[Transferencia] ${comment}` : '[Transferencia entre cuentas]';
    const toOwnerId      = toResult.ownerId || req.userId;
    const isPartnerAccount = toAccountId && toOwnerId !== req.userId;
    const transferCategory = await getTransferCategory(req.userId, prisma);

    const updated = await withinTransaction(prisma, async (tx) => {
      await tx.transaction.deleteMany({ where: { transferId: id } });

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          amount: parsedAmount, date: parsedDate, currency: parsedCurrency,
          comment: comment || null,
          fromAccountId: fromAccountId || null, fromSharedAccountId: fromSharedAccountId || null,
          toAccountId: toAccountId || null,     toSharedAccountId: toSharedAccountId || null,
        },
        include: INCLUDE,
      });

      await tx.transaction.create({
        data: {
          type: 'EXPENSE', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: req.userId,
          categoryId: transferCategory.id,
          accountId: fromAccountId || null, sharedAccountId: fromSharedAccountId || null,
          transferId: id,
        },
      });

      let toUserId = toOwnerId, toCatId = transferCategory.id;
      if (isPartnerAccount) {
        const partnerCat = await getTransferCategory(toOwnerId, prisma);
        toCatId = partnerCat.id; toUserId = toOwnerId;
      }
      await tx.transaction.create({
        data: {
          type: 'INCOME', amount: parsedAmount, currency: parsedCurrency,
          date: parsedDate, comment: txComment, userId: toUserId,
          categoryId: toCatId,
          accountId: toAccountId || null, sharedAccountId: toSharedAccountId || null,
          transferId: id,
        },
      });

      return updated;
    });

    res.json(enrichTransfer(updated));
  } catch (err) { next(err); }
};

module.exports = { list, getOne,
  create: financialMutation(prisma, create), update: financialMutation(prisma, update),
  fullUpdate: financialMutation(prisma, fullUpdate), payCreditCard: financialMutation(prisma, payCreditCard),
  cancel: financialMutation(prisma, cancel), remove: financialMutation(prisma, remove),
};

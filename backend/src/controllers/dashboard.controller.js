const prisma = require('../utils/prisma');
const { decimal } = require('../utils/decimal');

const { buildTransactionWhere, resolvePriorRange } = require('../utils/reportFilters');
const buildWhere = (userId, query) => buildTransactionWhere(userId, query, {defaultMonth: true});

const { computeKpis, combineKpis, combineMonthly } = require('../utils/financeReport');

const getDashboard = async (req, res, next) => {
  try {
    const where = buildWhere(req.userId, req.query);
    const transactions = await prisma.transaction.findMany({
      where, include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' },
    });
    const result = computeKpis(transactions);

    const from = where.date.gte, to = where.date.lte;
    if (!from || !to) {
      Object.assign(result.kpis, { incomeVariation: null, expenseVariation: null, incomeVariationUSD: null, expenseVariationUSD: null });
      return res.json(result);
    }
    const previousRange = resolvePriorRange({from, to}, req.query);
    const prior = {gte: previousRange.from, lte: previousRange.to};
    const prevTx = await prisma.transaction.findMany({
      where: { ...where, date: prior },
      select: { type: true, amount: true, currency: true, isReimbursement: true, date: true },
    });
    const previous = computeKpis(prevTx).kpis;
    for (const suffix of ['', 'USD']) {
      for (const [variation, total] of [['incomeVariation', 'totalIncome'], ['expenseVariation', 'totalExpense']]) {
        const prev = decimal(previous[total + suffix]);
        result.kpis[variation + suffix] = prev.gt(0)
          ? decimal(result.kpis[total + suffix]).minus(prev).div(prev).mul(100).toDecimalPlaces(1).toNumber() : null;
      }
    }
    res.json(result);
  } catch (err) { next(err); }
};

const getSharedDashboard = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const partnership = await prisma.partnership.findFirst({
      where: { status: 'ACCEPTED', OR: [
        { senderId: req.userId, receiverId: partnerId },
        { senderId: partnerId,  receiverId: req.userId },
      ]},
    });
    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const buildQ = uid => buildWhere(uid, req.query);

    const [myTx, partnerTx, me, partner, sharedAccounts] = await Promise.all([
      prisma.transaction.findMany({ where: buildQ(req.userId), include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' } }),
      prisma.transaction.findMany({ where: buildQ(partnerId),  include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' } }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true } }),
      prisma.user.findUnique({ where: { id: partnerId },  select: { id: true, name: true, email: true } }),
      prisma.sharedAccount.findMany({
        where: { OR: [{ userAId: req.userId, userBId: partnerId }, { userAId: partnerId, userBId: req.userId }] },
        include: { transactions: { include: { category: true } } },
      }),
    ]);

    const myResult      = computeKpis(myTx);
    const partnerResult = computeKpis(partnerTx);
    const combined = combineKpis(myResult.kpis, partnerResult.kpis);
    const combinedMonthly = combineMonthly(myResult.charts.monthly, partnerResult.charts.monthly);

    const allTransactions = [
      ...myTx.map(tx => ({ ...tx, owner: me })),
      ...partnerTx.map(tx => ({ ...tx, owner: partner })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      me, partner,
      my: myResult, partnerData: partnerResult,
      combined, combinedMonthly,
      sharedAccounts,
      recentTransactions: allTransactions.slice(0, 50),
    });
  } catch (err) { next(err); }
};

module.exports = { getDashboard, getSharedDashboard };

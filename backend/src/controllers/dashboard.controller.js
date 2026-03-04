const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

const buildWhere = (userId, query) => {
  const where = { userId };
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
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

const computeKpis = (transactions, query) => {
  let totalIncome = 0, totalExpense = 0;
  const monthlyMap = {};
  const categoryExpenseMap = {};

  for (const tx of transactions) {
    const amt = toNum(tx.amount);
    const monthKey = tx.date.toISOString().slice(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { income: 0, expense: 0 };

    if (tx.type === 'INCOME') {
      totalIncome += amt;
      monthlyMap[monthKey].income += amt;
    } else {
      totalExpense += amt;
      monthlyMap[monthKey].expense += amt;
      const catName = tx.category?.name || 'Sin categoría';
      categoryExpenseMap[catName] = (categoryExpenseMap[catName] || 0) + amt;
    }
  }

  const months = Object.keys(monthlyMap).sort();
  const numMonths = Math.max(months.length, 1);
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const topExpenseCategory = Object.entries(categoryExpenseMap).sort((a, b) => b[1] - a[1])[0];

  const monthlyChartData = months.map(m => ({
    month: m,
    income:  parseFloat(monthlyMap[m].income.toFixed(2)),
    expense: parseFloat(monthlyMap[m].expense.toFixed(2)),
  }));

  const categoryChartData = Object.entries(categoryExpenseMap)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const total = categoryChartData.reduce((s, c) => s + c.value, 0);
  const pieData = categoryChartData.map(c => ({
    ...c,
    percentage: total > 0 ? parseFloat(((c.value / total) * 100).toFixed(1)) : 0,
  }));

  return {
    kpis: {
      totalIncome:       parseFloat(totalIncome.toFixed(2)),
      totalExpense:      parseFloat(totalExpense.toFixed(2)),
      balance:           parseFloat(balance.toFixed(2)),
      avgMonthlyIncome:  parseFloat((totalIncome / numMonths).toFixed(2)),
      avgMonthlyExpense: parseFloat((totalExpense / numMonths).toFixed(2)),
      savingsRate:       parseFloat(savingsRate.toFixed(1)),
      topExpenseCategory: topExpenseCategory
        ? { name: topExpenseCategory[0], amount: parseFloat(topExpenseCategory[1].toFixed(2)) }
        : null,
    },
    charts: { monthly: monthlyChartData, categoryExpense: categoryChartData, pie: pieData },
  };
};

// My personal dashboard
const getDashboard = async (req, res, next) => {
  try {
    const where = buildWhere(req.userId, req.query);
    const transactions = await prisma.transaction.findMany({
      where, include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' },
    });

    const result = computeKpis(transactions, req.query);

    // Variation vs previous period
    let prevIncome = 0, prevExpense = 0;
    if (req.query.dateFrom && req.query.dateTo) {
      const from = new Date(req.query.dateFrom);
      const to   = new Date(req.query.dateTo);
      const diff = to - from;
      const prevTx = await prisma.transaction.findMany({
        where: { userId: req.userId, date: { gte: new Date(from - diff), lte: from } },
        select: { type: true, amount: true },
      });
      for (const tx of prevTx) {
        if (tx.type === 'INCOME') prevIncome += toNum(tx.amount);
        else prevExpense += toNum(tx.amount);
      }
    }

    result.kpis.incomeVariation  = prevIncome  > 0 ? parseFloat((((result.kpis.totalIncome  - prevIncome)  / prevIncome)  * 100).toFixed(1)) : null;
    result.kpis.expenseVariation = prevExpense > 0 ? parseFloat((((result.kpis.totalExpense - prevExpense) / prevExpense) * 100).toFixed(1)) : null;

    res.json(result);
  } catch (err) { next(err); }
};

// Combined dashboard — my data + partner data side by side
const getSharedDashboard = async (req, res, next) => {
  try {
    const { partnerId } = req.params;

    const partnership = await prisma.partnership.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: req.userId,  receiverId: partnerId },
          { senderId: partnerId,   receiverId: req.userId },
        ],
      },
    });
    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const buildQ = (uid) => {
      const w = { userId: uid };
      const q = req.query;
      if (q.type) w.type = q.type;
      if (q.dateFrom || q.dateTo) {
        w.date = {};
        if (q.dateFrom) w.date.gte = new Date(q.dateFrom);
        if (q.dateTo)   w.date.lte = new Date(q.dateTo + 'T23:59:59.999Z');
      }
      return w;
    };

    const [myTx, partnerTx, me, partner, sharedAccounts] = await Promise.all([
      prisma.transaction.findMany({ where: buildQ(req.userId),  include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' } }),
      prisma.transaction.findMany({ where: buildQ(partnerId),   include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' } }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true } }),
      prisma.user.findUnique({ where: { id: partnerId },  select: { id: true, name: true, email: true } }),
      prisma.sharedAccount.findMany({
        where: { OR: [{ userAId: req.userId, userBId: partnerId }, { userAId: partnerId, userBId: req.userId }] },
        include: { transactions: { include: { category: true }, select: undefined } },
      }),
    ]);

    const myResult      = computeKpis(myTx);
    const partnerResult = computeKpis(partnerTx);

    // Combined totals
    const combined = {
      totalIncome:  myResult.kpis.totalIncome  + partnerResult.kpis.totalIncome,
      totalExpense: myResult.kpis.totalExpense + partnerResult.kpis.totalExpense,
      balance:      myResult.kpis.balance      + partnerResult.kpis.balance,
    };

    // Combined monthly chart (merge both)
    const allMonths = new Set([
      ...myResult.charts.monthly.map(m => m.month),
      ...partnerResult.charts.monthly.map(m => m.month),
    ]);
    const myMonthMap      = Object.fromEntries(myResult.charts.monthly.map(m => [m.month, m]));
    const partnerMonthMap = Object.fromEntries(partnerResult.charts.monthly.map(m => [m.month, m]));
    const combinedMonthly = [...allMonths].sort().map(month => ({
      month,
      myIncome:       myMonthMap[month]?.income  || 0,
      myExpense:      myMonthMap[month]?.expense || 0,
      partnerIncome:  partnerMonthMap[month]?.income  || 0,
      partnerExpense: partnerMonthMap[month]?.expense || 0,
    }));

    // All transactions combined with owner tag
    const allTransactions = [
      ...myTx.map(tx => ({ ...tx, owner: me })),
      ...partnerTx.map(tx => ({ ...tx, owner: partner })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      me,
      partner,
      my:      myResult,
      partnerData: partnerResult,
      combined,
      combinedMonthly,
      sharedAccounts,
      recentTransactions: allTransactions.slice(0, 50),
    });
  } catch (err) { next(err); }
};

module.exports = { getDashboard, getSharedDashboard };

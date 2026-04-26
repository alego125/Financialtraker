const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

// Default to current month if no date filters provided
const getDefaultDateFilter = (query) => {
  if (query.dateFrom || query.dateTo || query.month || query.year) return query;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { ...query, dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${new Date(y, now.getMonth()+1, 0).getDate()}` };
};

const buildWhere = (userId, query) => {
  const q = getDefaultDateFilter(query);
  const where = { userId, transferId: null };
  if (q.type)       where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.accountId)  where.accountId = q.accountId;
  if (q.currency)   where.currency = q.currency;
  if (q.comment)    where.comment = { contains: q.comment, mode: 'insensitive' };

  // month filter: "2025-03"
  if (q.month && !q.dateFrom) {
    const [y, m] = q.month.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    where.date = { gte: new Date(`${y}-${m}-01T00:00:00.000Z`), lte: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`) };
  }
  // year filter
  else if (q.year && !q.dateFrom && !q.month) {
    where.date = { gte: new Date(`${q.year}-01-01T00:00:00.000Z`), lte: new Date(`${q.year}-12-31T23:59:59.999Z`) };
  }
  else if (q.dateFrom || q.dateTo) {
    where.date = {};
    if (q.dateFrom) where.date.gte = new Date(q.dateFrom + 'T00:00:00.000Z');
    if (q.dateTo)   where.date.lte = new Date(q.dateTo   + 'T23:59:59.999Z');
  }

  if (q.amountMin || q.amountMax) {
    where.amount = {};
    if (q.amountMin) where.amount.gte = parseFloat(q.amountMin);
    if (q.amountMax) where.amount.lte = parseFloat(q.amountMax);
  }
  return where;
};

const computeKpis = (transactions) => {
  let totalIncome = 0, totalExpense = 0, totalExpenseUSD = 0, totalReimbursement = 0;
  const monthlyMap = {};
  const categoryExpenseMap = {};
  const categoryExpenseUSDMap = {};
  const categoryDetailMap = {};
  const categoryDetailUSDMap = {};

  for (const tx of transactions) {
    const amt    = toNum(tx.amount);
    const isUSD  = tx.currency === 'USD';
    const monthKey = new Date(tx.date).toISOString().slice(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { income:0, expense:0, expenseUSD:0 };
    const catName = tx.category?.name || 'Sin categoría';

    if (tx.type === 'INCOME') {
      if (tx.isReimbursement) {
        // Reembolso: suma al balance pero NO al ingreso ni a los gráficos
        totalReimbursement += amt;
      } else {
        totalIncome += amt;
        monthlyMap[monthKey].income += amt;
      }
    } else {
      if (isUSD) {
        totalExpenseUSD += amt;
        monthlyMap[monthKey].expenseUSD += amt;
        categoryExpenseUSDMap[catName] = (categoryExpenseUSDMap[catName]||0) + amt;
        if (!categoryDetailUSDMap[catName]) categoryDetailUSDMap[catName] = { total:0, items:[] };
        categoryDetailUSDMap[catName].total += amt;
        if (tx.comment && !tx.comment.startsWith('[Transferencia')) categoryDetailUSDMap[catName].items.push({ comment:tx.comment, amount:amt });
      } else {
        totalExpense += amt;
        monthlyMap[monthKey].expense += amt;
        categoryExpenseMap[catName] = (categoryExpenseMap[catName]||0) + amt;
        if (!categoryDetailMap[catName]) categoryDetailMap[catName] = { total:0, items:[] };
        categoryDetailMap[catName].total += amt;
        if (tx.comment && !tx.comment.startsWith('[Transferencia')) categoryDetailMap[catName].items.push({ comment:tx.comment, amount:amt });
      }
    }
  }

  const months = Object.keys(monthlyMap).sort();
  const numMonths = Math.max(months.length, 1);
  const balance = totalIncome + totalReimbursement - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const topExpenseCategory = Object.entries(categoryExpenseMap).sort((a, b) => b[1] - a[1])[0];

  const monthlyChartData = months.map(m => ({
    month:      m,
    income:     parseFloat(monthlyMap[m].income.toFixed(2)),
    expense:    parseFloat(monthlyMap[m].expense.toFixed(2)),
    expenseUSD: parseFloat(monthlyMap[m].expenseUSD.toFixed(2)),
  }));

  const categoryChartData = Object.entries(categoryExpenseMap)
    .map(([name, value]) => ({
      name, value: parseFloat(value.toFixed(2)),
      items: (categoryDetailMap[name]?.items||[]).sort((a,b)=>b.amount-a.amount).slice(0,5).map(i=>({comment:i.comment,amount:parseFloat(i.amount.toFixed(2))})),
    })).sort((a, b) => b.value - a.value);
  const total = categoryChartData.reduce((s, c) => s + c.value, 0);
  const pieData = categoryChartData.map(c => ({ ...c, percentage: total > 0 ? parseFloat(((c.value/total)*100).toFixed(1)) : 0 }));

  const categoryExpenseUSDData = Object.entries(categoryExpenseUSDMap)
    .map(([name, value]) => ({
      name, value: parseFloat(value.toFixed(2)),
      items: (categoryDetailUSDMap[name]?.items||[]).sort((a,b)=>b.amount-a.amount).slice(0,5).map(i=>({comment:i.comment,amount:parseFloat(i.amount.toFixed(2))})),
    })).sort((a, b) => b.value - a.value);
  const totalUSD = categoryExpenseUSDData.reduce((s, c) => s + c.value, 0);
  const pieUSDData = categoryExpenseUSDData.map(c => ({ ...c, percentage: totalUSD > 0 ? parseFloat(((c.value/totalUSD)*100).toFixed(1)) : 0 }));

  return {
    kpis: {
      totalIncome:          parseFloat(totalIncome.toFixed(2)),
      totalExpense:         parseFloat(totalExpense.toFixed(2)),
      totalExpenseUSD:      parseFloat(totalExpenseUSD.toFixed(2)),
      totalReimbursement:   parseFloat(totalReimbursement.toFixed(2)),
      balance:              parseFloat(balance.toFixed(2)),
      avgMonthlyIncome:     parseFloat((totalIncome/numMonths).toFixed(2)),
      avgMonthlyExpense:    parseFloat((totalExpense/numMonths).toFixed(2)),
      savingsRate:          parseFloat(savingsRate.toFixed(1)),
      topExpenseCategory:   topExpenseCategory ? { name:topExpenseCategory[0], amount:parseFloat(topExpenseCategory[1].toFixed(2)) } : null,
    },
    charts: { monthly:monthlyChartData, categoryExpense:categoryChartData, pie:pieData, categoryExpenseUSD:categoryExpenseUSDData, pieUSD:pieUSDData },
  };
};

const getDashboard = async (req, res, next) => {
  try {
    const where = buildWhere(req.userId, req.query);
    const transactions = await prisma.transaction.findMany({
      where, include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' },
    });
    const result = computeKpis(transactions);

    let prevIncome = 0, prevExpense = 0;
    if (req.query.dateFrom && req.query.dateTo) {
      const from = new Date(req.query.dateFrom);
      const to   = new Date(req.query.dateTo);
      const diff = to - from;
      const prevTx = await prisma.transaction.findMany({
        where: { userId: req.userId, transferId: null, date: { gte: new Date(from - diff), lte: from } },
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

    const buildQ = (uid) => {
      const q = getDefaultDateFilter(req.query);
      const w = { userId: uid, transferId: null };
      if (q.type) w.type = q.type;
      if (q.sharedAccountId) w.sharedAccountId = q.sharedAccountId;
      if (q.accountId) { w.OR = [{ accountId: q.accountId }, { sharedAccountId: q.sharedAccountId }]; }

      if (q.month && !q.dateFrom) {
        const [y, m] = q.month.split('-');
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        w.date = { gte: new Date(`${y}-${m}-01T00:00:00.000Z`), lte: new Date(`${y}-${m}-${lastDay}T23:59:59.999Z`) };
      } else if (q.year && !q.dateFrom && !q.month) {
        w.date = { gte: new Date(`${q.year}-01-01T00:00:00.000Z`), lte: new Date(`${q.year}-12-31T23:59:59.999Z`) };
      } else if (q.dateFrom || q.dateTo) {
        w.date = {};
        if (q.dateFrom) w.date.gte = new Date(q.dateFrom + 'T00:00:00.000Z');
        if (q.dateTo)   w.date.lte = new Date(q.dateTo   + 'T23:59:59.999Z');
      }
      return w;
    };

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
    const combined = {
      totalIncome:  myResult.kpis.totalIncome  + partnerResult.kpis.totalIncome,
      totalExpense: myResult.kpis.totalExpense + partnerResult.kpis.totalExpense,
      balance:      myResult.kpis.balance      + partnerResult.kpis.balance,
    };
    const allMonths = new Set([
      ...myResult.charts.monthly.map(m => m.month),
      ...partnerResult.charts.monthly.map(m => m.month),
    ]);
    const myMap = Object.fromEntries(myResult.charts.monthly.map(m => [m.month, m]));
    const pMap  = Object.fromEntries(partnerResult.charts.monthly.map(m => [m.month, m]));
    const combinedMonthly = [...allMonths].sort().map(month => ({
      month,
      myIncome:       myMap[month]?.income  || 0,
      myExpense:      myMap[month]?.expense || 0,
      partnerIncome:  pMap[month]?.income  || 0,
      partnerExpense: pMap[month]?.expense || 0,
    }));

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

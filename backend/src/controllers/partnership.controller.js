const prisma = require('../utils/prisma');

const toNum = d => parseFloat(d?.toString() || '0');

const verifyPartnership = async (userId, partnerId) =>
  prisma.partnership.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: userId,    receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    },
  });

const sendInvitation = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (me.email === email) return res.status(400).json({ error: 'No podés invitarte a vos mismo' });
    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) return res.status(404).json({ error: 'No existe ningún usuario con ese email' });
    const existing = await prisma.partnership.findFirst({
      where: { OR: [{ senderId: req.userId, receiverId: target.id }, { senderId: target.id, receiverId: req.userId }] },
    });
    if (existing) {
      const msg = { PENDING:'Ya enviaste una invitación a este usuario o tenés una pendiente', ACCEPTED:'Ya estás vinculado con este usuario', REJECTED:'Esta invitación fue rechazada anteriormente' };
      return res.status(409).json({ error: msg[existing.status] || 'Ya existe una relación con este usuario' });
    }
    const partnership = await prisma.partnership.create({
      data: { senderId: req.userId, receiverId: target.id },
      include: { sender: { select:{id:true,name:true,email:true} }, receiver: { select:{id:true,name:true,email:true} } },
    });
    res.status(201).json(partnership);
  } catch (err) { next(err); }
};

const listPartnerships = async (req, res, next) => {
  try {
    const partnerships = await prisma.partnership.findMany({
      where: { OR: [{ senderId: req.userId }, { receiverId: req.userId }] },
      include: { sender: { select:{id:true,name:true,email:true} }, receiver: { select:{id:true,name:true,email:true} } },
      orderBy: { createdAt: 'desc' },
    });
    const result = partnerships.map(p => {
      const isSender = p.senderId === req.userId;
      const partner  = isSender ? p.receiver : p.sender;
      if (!partner) return null;
      return { ...p, isSender, partner };
    }).filter(Boolean);
    res.json(result);
  } catch (err) { next(err); }
};

const respondInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!['accept','reject'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });
    const partnership = await prisma.partnership.findUnique({ where: { id } });
    if (!partnership) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (partnership.receiverId !== req.userId) return res.status(403).json({ error: 'No tenés permiso' });
    if (partnership.status !== 'PENDING') return res.status(400).json({ error: 'Esta invitación ya fue respondida' });
    const updated = await prisma.partnership.update({
      where: { id },
      data: { status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' },
      include: { sender: { select:{id:true,name:true,email:true} }, receiver: { select:{id:true,name:true,email:true} } },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const removePartnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const partnership = await prisma.partnership.findUnique({ where: { id } });
    if (!partnership) return res.status(404).json({ error: 'Vínculo no encontrado' });
    if (partnership.senderId !== req.userId && partnership.receiverId !== req.userId)
      return res.status(403).json({ error: 'No tenés permiso' });
    await prisma.partnership.delete({ where: { id } });
    res.json({ message: 'Vínculo eliminado' });
  } catch (err) { next(err); }
};

// ── GET partner's transactions (paginado) ────────────────────────────────────
const getPartnerData = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const { page=1, limit=20, sortBy='date', sortOrder='desc', ...filters } = req.query;
    const skip = (parseInt(page)-1)*parseInt(limit);
    const where = { userId: partnerId };
    if (filters.type)       where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.month) {
      const [y,m] = filters.month.split('-');
      where.date = { gte: new Date(parseInt(y),parseInt(m)-1,1), lte: new Date(parseInt(y),parseInt(m),0,23,59,59,999) };
    } else if (filters.year) {
      where.date = { gte: new Date(parseInt(filters.year),0,1), lte: new Date(parseInt(filters.year),11,31,23,59,59,999) };
    } else if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.date.lte = new Date(filters.dateTo+'T23:59:59.999Z');
    }

    const validSort = ['date','amount','type','createdAt'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'date';

    const [transactions, total, partner] = await Promise.all([
      prisma.transaction.findMany({
        where, include: { category:true, account:true, sharedAccount:true },
        orderBy: { [orderField]: sortOrder==='asc'?'asc':'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
      prisma.user.findUnique({ where:{ id:partnerId }, select:{id:true,name:true,email:true} }),
    ]);

    res.json({ partner, data: transactions, pagination:{ page:parseInt(page), limit:parseInt(limit), total, pages:Math.ceil(total/parseInt(limit)) } });
  } catch (err) { next(err); }
};

// ── GET partner's accounts (with balances) ───────────────────────────────────
const getPartnerAccounts = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const accounts = await prisma.account.findMany({
      where: { userId: partnerId },
      include: {
        transactions: { select:{ type:true, amount:true, currency:true } },
        exchangesFrom: { select:{ usdAmount:true, arsAmount:true } },
      },
      orderBy: { createdAt:'asc' },
    });

    const partner = await prisma.user.findUnique({ where:{id:partnerId}, select:{name:true} });

    const result = accounts.map(a => {
      let ars = toNum(a.initialBalance), usd = toNum(a.initialBalanceUSD||0);
      for (const tx of a.transactions) {
        const amt = toNum(tx.amount), isUSD = tx.currency==='USD';
        if (tx.type==='INCOME') { isUSD?(usd+=amt):(ars+=amt); }
        else                    { isUSD?(usd-=amt):(ars-=amt); }
      }
      for (const ex of (a.exchangesFrom||[])) { usd+=toNum(ex.usdAmount); ars-=toNum(ex.arsAmount); }
      return {
        id:a.id, name:a.name, color:a.color,
        accountType: a.accountType || 'REGULAR',
        currentBalance:    parseFloat(ars.toFixed(2)),
        currentBalanceUSD: parseFloat(usd.toFixed(2)),
        ownerName: partner?.name || '',
      };
    });

    res.json(result);
  } catch (err) { next(err); }
};

// ── GET "Solo sus finanzas" — kpis + charts del partner ──────────────────────
// Formato: { partner, kpis, charts } — usado por PartnerViewPage
const getPartnerSolo = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const partner = await prisma.user.findUnique({ where:{id:partnerId}, select:{id:true,name:true,email:true} });
    if (!partner) return res.status(404).json({ error: 'Usuario no encontrado' });

    // All partner transactions (no filter — show totals for all time, same as personal dashboard)
    const transactions = await prisma.transaction.findMany({
      where: { userId: partnerId, transferId: null },
      include: { category:true, account:true, sharedAccount:true },
      orderBy: { date:'asc' },
    });

    let inc=0, exp=0;
    const monthly={}, catExp={}, catInc={};

    for (const tx of transactions) {
      const amt = toNum(tx.amount);
      const mk  = tx.date.toISOString().slice(0,7);
      if (!monthly[mk]) monthly[mk] = { month:mk, income:0, expense:0 };
      if (tx.type==='INCOME') {
        inc += amt; monthly[mk].income += amt;
        catInc[tx.category?.name||'Sin cat'] = (catInc[tx.category?.name||'Sin cat']||0)+amt;
      } else {
        exp += amt; monthly[mk].expense += amt;
        catExp[tx.category?.name||'Sin cat'] = (catExp[tx.category?.name||'Sin cat']||0)+amt;
      }
    }

    const months = Object.keys(monthly).sort();
    const nm     = Math.max(months.length, 1);
    const topCat = Object.entries(catExp).sort((a,b)=>b[1]-a[1])[0];

    const kpis = {
      totalIncome:         parseFloat(inc.toFixed(2)),
      totalExpense:        parseFloat(exp.toFixed(2)),
      balance:             parseFloat((inc-exp).toFixed(2)),
      avgMonthlyIncome:    parseFloat((inc/nm).toFixed(2)),
      avgMonthlyExpense:   parseFloat((exp/nm).toFixed(2)),
      savingsRate:         inc>0 ? parseFloat(((inc-exp)/inc*100).toFixed(1)) : 0,
      topExpenseCategory:  topCat ? { name:topCat[0], amount:parseFloat(topCat[1].toFixed(2)) } : null,
    };

    const monthlyArr = months.map(m => ({
      month:   m,
      income:  parseFloat(monthly[m].income.toFixed(2)),
      expense: parseFloat(monthly[m].expense.toFixed(2)),
      balance: parseFloat((monthly[m].income - monthly[m].expense).toFixed(2)),
    }));

    const categoryExpense = Object.entries(catExp)
      .sort((a,b)=>b[1]-a[1])
      .map(([name,amount]) => ({ name, amount:parseFloat(amount.toFixed(2)) }));

    const totalExp = categoryExpense.reduce((s,c)=>s+c.amount,0)||1;
    const pie = categoryExpense.map(c => ({ name:c.name, value:parseFloat(c.amount.toFixed(2)), percentage:parseFloat((c.amount/totalExp*100).toFixed(1)) }));

    res.json({
      partner,
      kpis,
      charts: { monthly: monthlyArr, categoryExpense, pie },
    });
  } catch (err) { next(err); }
};

// ── GET shared dashboard (Dashboard conjunto) ────────────────────────────────
// Formato: { me, partner, my, partnerData, combined, combinedMonthly, sharedAccounts }
const getPartnerDashboard = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const buildWhere = (userId, q) => {
      const where = { userId, transferId: null };
      if (q.type)       where.type = q.type;
      if (q.categoryId) where.categoryId = q.categoryId;
      if (q.month) {
        const [y,m] = q.month.split('-');
        where.date = { gte:new Date(parseInt(y),parseInt(m)-1,1), lte:new Date(parseInt(y),parseInt(m),0,23,59,59,999) };
      } else if (q.year) {
        where.date = { gte:new Date(parseInt(q.year),0,1), lte:new Date(parseInt(q.year),11,31,23,59,59,999) };
      } else if (q.dateFrom||q.dateTo) {
        where.date = {};
        if (q.dateFrom) where.date.gte = new Date(q.dateFrom);
        if (q.dateTo)   where.date.lte = new Date(q.dateTo+'T23:59:59.999Z');
      }
      return where;
    };

    const [myTx, partnerTx, me, partner, sharedAccounts] = await Promise.all([
      prisma.transaction.findMany({ where: buildWhere(req.userId, req.query), include:{category:true,account:true,sharedAccount:true}, orderBy:{date:'asc'} }),
      prisma.transaction.findMany({ where: buildWhere(partnerId, req.query), include:{category:true,account:true,sharedAccount:true}, orderBy:{date:'asc'} }),
      prisma.user.findUnique({ where:{id:req.userId}, select:{id:true,name:true,email:true} }),
      prisma.user.findUnique({ where:{id:partnerId}, select:{id:true,name:true,email:true} }),
      prisma.sharedAccount.findMany({
        where:{ OR:[{userAId:req.userId,userBId:partnerId},{userAId:partnerId,userBId:req.userId}] },
        include:{
          transactions:{select:{type:true,amount:true,currency:true}},
          exchangesFrom:{select:{usdAmount:true,arsAmount:true}},
          userA:{select:{id:true,name:true}},
          userB:{select:{id:true,name:true}},
        },
      }),
    ]);

    const calcKpis = (txs) => {
      let inc=0, exp=0;
      const monthly={}, catExp={};
      for (const tx of txs) {
        const amt=toNum(tx.amount), mk=tx.date.toISOString().slice(0,7);
        if (!monthly[mk]) monthly[mk]={income:0,expense:0};
        if (tx.type==='INCOME') { inc+=amt; monthly[mk].income+=amt; }
        else { exp+=amt; monthly[mk].expense+=amt; catExp[tx.category?.name||'Sin cat']=(catExp[tx.category?.name||'Sin cat']||0)+amt; }
      }
      const months=Object.keys(monthly).sort(), nm=Math.max(months.length,1);
      const topCat=Object.entries(catExp).sort((a,b)=>b[1]-a[1])[0];
      const categoryExpense = Object.entries(catExp)
        .sort((a,b)=>b[1]-a[1])
        .map(([name,value])=>({ name, value: parseFloat(value.toFixed(2)) }));
      return {
        kpis:{ totalIncome:parseFloat(inc.toFixed(2)), totalExpense:parseFloat(exp.toFixed(2)), balance:parseFloat((inc-exp).toFixed(2)), avgMonthlyIncome:parseFloat((inc/nm).toFixed(2)), avgMonthlyExpense:parseFloat((exp/nm).toFixed(2)), savingsRate:inc>0?parseFloat(((inc-exp)/inc*100).toFixed(1)):0, topExpenseCategory:topCat?{name:topCat[0],amount:parseFloat(topCat[1].toFixed(2))}:null },
        monthly,
        categoryExpense,
      };
    };

    const myCalc = calcKpis(myTx), partCalc = calcKpis(partnerTx);
    const allMonths = [...new Set([...Object.keys(myCalc.monthly),...Object.keys(partCalc.monthly)])].sort();
    const combinedMonthly = allMonths.map(m => ({
      month:m,
      myIncome:       parseFloat((myCalc.monthly[m]?.income||0).toFixed(2)),
      myExpense:      parseFloat((myCalc.monthly[m]?.expense||0).toFixed(2)),
      partnerIncome:  parseFloat((partCalc.monthly[m]?.income||0).toFixed(2)),
      partnerExpense: parseFloat((partCalc.monthly[m]?.expense||0).toFixed(2)),
    }));

    const cInc = myCalc.kpis.totalIncome+partCalc.kpis.totalIncome;
    const cExp = myCalc.kpis.totalExpense+partCalc.kpis.totalExpense;

    // Enrich shared accounts with balances
    const enrichedShared = sharedAccounts.map(a => {
      let ars = toNum(a.initialBalance), usd = toNum(a.initialBalanceUSD||0);
      for (const tx of (a.transactions||[])) {
        const amt = toNum(tx.amount), isUSD = tx.currency==='USD';
        if (tx.type==='INCOME') { isUSD?(usd+=amt):(ars+=amt); }
        else                    { isUSD?(usd-=amt):(ars-=amt); }
      }
      for (const ex of (a.exchangesFrom||[])) { usd+=toNum(ex.usdAmount); ars-=toNum(ex.arsAmount); }
      return {
        id:a.id, name:a.name, color:a.color,
        accountType: a.accountType||'REGULAR',
        currentBalance:    parseFloat(ars.toFixed(2)),
        currentBalanceUSD: parseFloat(usd.toFixed(2)),
        partner: a.userAId===req.userId ? a.userB : a.userA,
      };
    });

    res.json({
      me, partner,
      my:          { kpis: myCalc.kpis,    charts: { categoryExpense: myCalc.categoryExpense } },
      partnerData: { kpis: partCalc.kpis, charts: { categoryExpense: partCalc.categoryExpense } },
      combined:    { totalIncome:parseFloat(cInc.toFixed(2)), totalExpense:parseFloat(cExp.toFixed(2)), balance:parseFloat((cInc-cExp).toFixed(2)), savingsRate:cInc>0?parseFloat(((cInc-cExp)/cInc*100).toFixed(1)):0 },
      combinedMonthly,
      sharedAccounts: enrichedShared,
    });
  } catch (err) { next(err); }
};

module.exports = {
  sendInvitation, listPartnerships, respondInvitation, removePartnership,
  getPartnerData, getPartnerAccounts, getPartnerSolo, getPartnerDashboard,
};

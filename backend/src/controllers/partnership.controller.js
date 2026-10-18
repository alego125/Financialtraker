const { getAccountBalances } = require('../utils/accountBalances');
const { buildTransactionWhere } = require('../utils/reportFilters');
const { parsePagination } = require('../utils/query');
const { computeKpis, combineKpis, combineMonthly } = require('../utils/financeReport');
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

    const {page, limit, skip, take} = parsePagination(req.query);
    const {sortBy = 'date', sortOrder = 'desc'} = req.query;
    const where = buildTransactionWhere(partnerId, req.query, {excludeTransfers: false});

    const validSort = ['date','amount','type','createdAt'];
    const orderField = validSort.includes(sortBy) ? sortBy : 'date';

    const [transactions, total, partner] = await Promise.all([
      prisma.transaction.findMany({
        where, include: { category:true, account:true, sharedAccount:true },
        orderBy: [{ [orderField]: sortOrder==='asc'?'asc':'desc' }, {id: 'desc'}],
        skip, take,
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

    const accounts = await prisma.account.findMany({where: {userId: partnerId}, orderBy: {createdAt: 'asc'}});
    const balances = await getAccountBalances(prisma, accounts.map(account => account.id));

    const partner = await prisma.user.findUnique({ where:{id:partnerId}, select:{name:true} });

    const result = accounts.map(a => {
      return {
        id:a.id, name:a.name, color:a.color,
        accountType: a.accountType || 'REGULAR',
        currentBalance: balances.get(a.id).currentBalance,
        currentBalanceUSD: balances.get(a.id).currentBalanceUSD,
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

    const where = buildTransactionWhere(partnerId, req.query);

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category:true, account:true, sharedAccount:true },
      orderBy: { date:'asc' },
    });

    res.json({ partner, ...computeKpis(transactions) });
  } catch (err) { next(err); }
};

// ── GET shared dashboard (Dashboard conjunto) ────────────────────────────────
// Formato: { me, partner, my, partnerData, combined, combinedMonthly, sharedAccounts }
const getPartnerDashboard = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const buildWhere = (userId, query) => buildTransactionWhere(userId, query);

    const [myTx, partnerTx, me, partner, sharedAccounts] = await Promise.all([
      prisma.transaction.findMany({ where: buildWhere(req.userId, req.query), include:{category:true,account:true,sharedAccount:true}, orderBy:{date:'asc'} }),
      prisma.transaction.findMany({ where: buildWhere(partnerId, req.query), include:{category:true,account:true,sharedAccount:true}, orderBy:{date:'asc'} }),
      prisma.user.findUnique({ where:{id:req.userId}, select:{id:true,name:true,email:true} }),
      prisma.user.findUnique({ where:{id:partnerId}, select:{id:true,name:true,email:true} }),
      prisma.sharedAccount.findMany({
        where:{ OR:[{userAId:req.userId,userBId:partnerId},{userAId:partnerId,userBId:req.userId}] },
        include:{
          userA:{select:{id:true,name:true}},
          userB:{select:{id:true,name:true}},
        },
      }),
    ]);

    const myCalc = computeKpis(myTx), partCalc = computeKpis(partnerTx);
    const combinedMonthly = combineMonthly(myCalc.charts.monthly, partCalc.charts.monthly);

    const sharedBalances = await getAccountBalances(prisma, sharedAccounts.map(account => account.id), true);
    const enrichedShared = sharedAccounts.map(a => {
      return {
        id:a.id, name:a.name, color:a.color,
        accountType: a.accountType||'REGULAR',
        currentBalance: sharedBalances.get(a.id).currentBalance,
        currentBalanceUSD: sharedBalances.get(a.id).currentBalanceUSD,
        partner: a.userAId===req.userId ? a.userB : a.userA,
      };
    });

    res.json({
      me, partner,
      my: myCalc,
      partnerData: partCalc,
      combined: combineKpis(myCalc.kpis, partCalc.kpis),
      combinedMonthly,
      sharedAccounts: enrichedShared,
    });
  } catch (err) { next(err); }
};

// ── GET partner's categories ─────────────────────────────────────────────────
const getPartnerCategories = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const ok = await verifyPartnership(req.userId, partnerId);
    if (!ok) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const categories = await prisma.category.findMany({
      where: { userId: partnerId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (err) { next(err); }
};

module.exports = {
  sendInvitation, listPartnerships, respondInvitation, removePartnership,
  getPartnerData, getPartnerAccounts, getPartnerSolo, getPartnerDashboard,
  getPartnerCategories,
};

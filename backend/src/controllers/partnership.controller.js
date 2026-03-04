const prisma = require('../utils/prisma');

// Send a partnership invitation by email
const sendInvitation = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    // Can't invite yourself
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (me.email === email) return res.status(400).json({ error: 'No podés invitarte a vos mismo' });

    // Find target user
    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) return res.status(404).json({ error: 'No existe ningún usuario con ese email' });

    // Check if partnership already exists in either direction
    const existing = await prisma.partnership.findFirst({
      where: {
        OR: [
          { senderId: req.userId, receiverId: target.id },
          { senderId: target.id, receiverId: req.userId },
        ],
      },
    });

    if (existing) {
      const msg = {
        PENDING:  'Ya enviaste una invitación a este usuario o tenés una pendiente',
        ACCEPTED: 'Ya estás vinculado con este usuario',
        REJECTED: 'Esta invitación fue rechazada anteriormente',
      };
      return res.status(409).json({ error: msg[existing.status] || 'Ya existe una relación con este usuario' });
    }

    const partnership = await prisma.partnership.create({
      data: { senderId: req.userId, receiverId: target.id },
      include: {
        sender:   { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(partnership);
  } catch (err) { next(err); }
};

// List all partnerships for current user (sent + received)
const listPartnerships = async (req, res, next) => {
  try {
    const partnerships = await prisma.partnership.findMany({
      where: {
        OR: [{ senderId: req.userId }, { receiverId: req.userId }],
      },
      include: {
        sender:   { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Annotate each with the "other" user and direction
    const result = partnerships
      .map(p => {
        const isSender = p.senderId === req.userId;
        const partner  = isSender ? p.receiver : p.sender;
        // Skip entries where the partner user was deleted
        if (!partner) return null;
        return { ...p, isSender, partner };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) { next(err); }
};

// Accept or reject an invitation (only the receiver can do this)
const respondInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Usá accept o reject' });
    }

    const partnership = await prisma.partnership.findUnique({ where: { id } });
    if (!partnership) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (partnership.receiverId !== req.userId) return res.status(403).json({ error: 'No tenés permiso para responder esta invitación' });
    if (partnership.status !== 'PENDING') return res.status(400).json({ error: 'Esta invitación ya fue respondida' });

    const updated = await prisma.partnership.update({
      where: { id },
      data: { status: action === 'accept' ? 'ACCEPTED' : 'REJECTED' },
      include: {
        sender:   { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (err) { next(err); }
};

// Remove / cancel a partnership
const removePartnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const partnership = await prisma.partnership.findUnique({ where: { id } });
    if (!partnership) return res.status(404).json({ error: 'Vínculo no encontrado' });

    // Both sender and receiver can remove it
    if (partnership.senderId !== req.userId && partnership.receiverId !== req.userId) {
      return res.status(403).json({ error: 'No tenés permiso' });
    }

    await prisma.partnership.delete({ where: { id } });
    res.json({ message: 'Vínculo eliminado' });
  } catch (err) { next(err); }
};

// Get partner's transactions (read-only)
const getPartnerData = async (req, res, next) => {
  try {
    const { partnerId } = req.params;

    // Verify active partnership exists
    const partnership = await prisma.partnership.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: req.userId,   receiverId: partnerId },
          { senderId: partnerId,    receiverId: req.userId },
        ],
      },
    });

    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc', ...filters } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: partnerId };
    if (filters.type)          where.type = filters.type;
    if (filters.categoryId)    where.categoryId = filters.categoryId;
    if (filters.comment)       where.comment = { contains: filters.comment, mode: 'insensitive' };
    if (filters.paymentType) where.paymentType = filters.paymentType;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.date.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }
    if (filters.amountMin || filters.amountMax) {
      where.amount = {};
      if (filters.amountMin) where.amount.gte = parseFloat(filters.amountMin);
      if (filters.amountMax) where.amount.lte = parseFloat(filters.amountMax);
    }

    const validSortFields = ['date', 'amount', 'type', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'date';

    const [transactions, total, partner] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true, sharedAccount: true },
        orderBy: { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
      prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    res.json({
      partner,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
};

// Get partner's dashboard KPIs + charts (read-only)
const getPartnerDashboard = async (req, res, next) => {
  try {
    const { partnerId } = req.params;

    const partnership = await prisma.partnership.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: req.userId,   receiverId: partnerId },
          { senderId: partnerId,    receiverId: req.userId },
        ],
      },
    });

    if (!partnership) return res.status(403).json({ error: 'No tenés un vínculo activo con este usuario' });

    const where = { userId: partnerId };
    const { dateFrom, dateTo, type, categoryId } = req.query;
    if (type)       where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo)   where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const [transactions, partner] = await Promise.all([
      prisma.transaction.findMany({ where, include: { category: true, account: true, sharedAccount: true }, orderBy: { date: 'asc' } }),
      prisma.user.findUnique({ where: { id: partnerId }, select: { id: true, name: true, email: true } }),
    ]);

    const toNum = d => parseFloat(d?.toString() || '0');
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

    res.json({
      partner,
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
      charts: {
        monthly:        monthlyChartData,
        categoryExpense: categoryChartData,
        pie:            pieData,
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  sendInvitation,
  listPartnerships,
  respondInvitation,
  removePartnership,
  getPartnerData,
  getPartnerDashboard,
};

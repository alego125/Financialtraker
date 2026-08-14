const prisma = require('../utils/prisma');
const toNum = d => parseFloat(d?.toString() || '0');

const listPositions = async (req, res, next) => {
  try {
    const positions = await prisma.investmentPosition.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
    });
    res.json(positions.map(p => {
      const invested = toNum(p.investedAmount);
      const current  = toNum(p.currentValue);
      return {
        id: p.id, name: p.name, currency: p.currency,
        investedAmount: invested, currentValue: current,
        gain: parseFloat((current - invested).toFixed(2)),
        gainPct: invested > 0 ? parseFloat((((current - invested) / invested) * 100).toFixed(2)) : 0,
        date: p.date, notes: p.notes, accountName: p.accountName || null,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      };
    }));
  } catch (err) { next(err); }
};

const createPosition = async (req, res, next) => {
  try {
    const { name, currency, investedAmount, currentValue, date, notes, accountName } = req.body;
    if (!name || investedAmount == null || currentValue == null || !date) {
      return res.status(400).json({ error: 'Requeridos: name, investedAmount, currentValue, date' });
    }
    const pos = await prisma.investmentPosition.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        currency: currency || 'ARS',
        investedAmount,
        currentValue,
        date: new Date(date),
        notes: notes?.trim() || null,
        accountName: accountName?.trim() || null,
      },
    });
    const invested = toNum(pos.investedAmount), current = toNum(pos.currentValue);
    res.status(201).json({
      ...pos, investedAmount: invested, currentValue: current,
      gain: parseFloat((current - invested).toFixed(2)),
      gainPct: invested > 0 ? parseFloat((((current - invested) / invested) * 100).toFixed(2)) : 0,
    });
  } catch (err) { next(err); }
};

const updatePosition = async (req, res, next) => {
  try {
    const existing = await prisma.investmentPosition.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Posición no encontrada' });
    const { name, currency, investedAmount, currentValue, date, notes, accountName } = req.body;
    const pos = await prisma.investmentPosition.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(currency != null && { currency }),
        ...(investedAmount != null && { investedAmount }),
        ...(currentValue != null && { currentValue }),
        ...(date != null && { date: new Date(date) }),
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        accountName: accountName !== undefined ? (accountName?.trim() || null) : existing.accountName,
      },
    });
    const invested = toNum(pos.investedAmount), current = toNum(pos.currentValue);
    res.json({
      ...pos, investedAmount: invested, currentValue: current,
      gain: parseFloat((current - invested).toFixed(2)),
      gainPct: invested > 0 ? parseFloat((((current - invested) / invested) * 100).toFixed(2)) : 0,
    });
  } catch (err) { next(err); }
};

const deletePosition = async (req, res, next) => {
  try {
    const existing = await prisma.investmentPosition.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Posición no encontrada' });
    await prisma.investmentPosition.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

module.exports = { listPositions, createPosition, updatePosition, deletePosition };

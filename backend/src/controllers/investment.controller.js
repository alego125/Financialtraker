const prisma = require('../utils/prisma');
const toNum = d => parseFloat(d?.toString() || '0');
const round2 = n => parseFloat(n.toFixed(2));

// ── Legacy positions (kept for backward compatibility, no longer used by the UI) ──

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

// ── Asset catalog ──────────────────────────────────────────────────────────

const listAssets = async (req, res, next) => {
  try {
    const assets = await prisma.investmentAsset.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(assets.map(a => ({
      id: a.id, name: a.name, currency: a.currency,
      referencePrice: toNum(a.referencePrice),
      createdAt: a.createdAt, updatedAt: a.updatedAt,
    })));
  } catch (err) { next(err); }
};

const createAsset = async (req, res, next) => {
  try {
    const { name, currency, referencePrice } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Ingresá un nombre para el activo' });
    const existing = await prisma.investmentAsset.findUnique({ where: { userId_name: { userId: req.userId, name: name.trim() } } });
    if (existing) return res.status(409).json({ error: 'Ya existe un activo con ese nombre' });
    const asset = await prisma.investmentAsset.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        currency: currency || 'ARS',
        referencePrice: referencePrice != null ? parseFloat(referencePrice) : 0,
      },
    });
    res.status(201).json({ ...asset, referencePrice: toNum(asset.referencePrice) });
  } catch (err) { next(err); }
};

const updateAsset = async (req, res, next) => {
  try {
    const existing = await prisma.investmentAsset.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Activo no encontrado' });
    const { name, currency, referencePrice } = req.body;
    const asset = await prisma.investmentAsset.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(currency != null && { currency }),
        ...(referencePrice != null && { referencePrice: parseFloat(referencePrice) }),
      },
    });
    res.json({ ...asset, referencePrice: toNum(asset.referencePrice) });
  } catch (err) { next(err); }
};

const deleteAsset = async (req, res, next) => {
  try {
    const existing = await prisma.investmentAsset.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Activo no encontrado' });
    const opCount = await prisma.investmentOperation.count({ where: { assetId: existing.id } });
    if (opCount > 0) return res.status(400).json({ error: 'No se puede eliminar: el activo tiene operaciones cargadas. Eliminá primero las operaciones.' });
    await prisma.investmentAsset.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ── Operations (buy/sell) ──────────────────────────────────────────────────

// Replays a chronologically-sorted list of operations using the moving-average
// cost method: avgCost only changes on BUY; a SELL realizes (price - avgCost) * qty
// and reduces invested proportionally so avgCost stays the same.
const replay = (ops) => {
  let qty = 0, invested = 0;
  for (const o of ops) {
    const q = toNum(o.quantity), price = toNum(o.unitPrice);
    if (o.type === 'BUY') {
      invested += q * price;
      qty += q;
    } else {
      const avgCost = qty > 0 ? invested / qty : 0;
      invested -= avgCost * q;
      qty -= q;
    }
  }
  const avgCost = qty > 1e-9 ? invested / qty : 0;
  return { qty: round2(qty), invested: round2(invested), avgCost };
};

const GAIN_CATEGORY   = { name: 'Inversiones',             type: 'INCOME',  color: '#8b5cf6' };
const LOSS_CATEGORY   = { name: 'Pérdida en inversiones',  type: 'EXPENSE', color: '#dc2626' };

const getOrCreateCategory = async (userId, def) => {
  let cat = await prisma.category.findUnique({ where: { userId_name: { userId, name: def.name } } });
  if (!cat) cat = await prisma.category.create({ data: { userId, name: def.name, type: def.type, color: def.color } });
  return cat;
};

const listOperations = async (req, res, next) => {
  try {
    const ops = await prisma.investmentOperation.findMany({
      where: { userId: req.userId },
      include: { asset: true, account: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(ops.map(o => ({
      id: o.id, assetId: o.assetId, assetName: o.asset.name, currency: o.asset.currency,
      accountId: o.accountId, accountName: o.account?.name || null,
      type: o.type, quantity: toNum(o.quantity), unitPrice: toNum(o.unitPrice),
      total: round2(toNum(o.quantity) * toNum(o.unitPrice)),
      date: o.date, notes: o.notes,
      realizedGain: o.realizedGain != null ? toNum(o.realizedGain) : null,
      createdAt: o.createdAt,
    })));
  } catch (err) { next(err); }
};

const createOperation = async (req, res, next) => {
  try {
    let { assetId, assetName, currency, accountId, type, quantity, unitPrice, date, notes } = req.body;
    if (!['BUY', 'SELL'].includes(type)) return res.status(400).json({ error: 'Tipo inválido (BUY/SELL)' });
    quantity = parseFloat(quantity); unitPrice = parseFloat(unitPrice);
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'Precio unitario inválido' });
    if (!date) return res.status(400).json({ error: 'La fecha es requerida' });

    let asset;
    if (assetId) {
      asset = await prisma.investmentAsset.findFirst({ where: { id: assetId, userId: req.userId } });
      if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
    } else if (assetName?.trim()) {
      asset = await prisma.investmentAsset.findUnique({ where: { userId_name: { userId: req.userId, name: assetName.trim() } } });
      if (!asset) {
        asset = await prisma.investmentAsset.create({
          data: { userId: req.userId, name: assetName.trim(), currency: currency || 'ARS', referencePrice: type === 'BUY' ? unitPrice : 0 },
        });
      }
    } else {
      return res.status(400).json({ error: 'Falta el activo (assetId o assetName)' });
    }

    if (accountId) {
      const acc = await prisma.account.findFirst({ where: { id: accountId, userId: req.userId } });
      if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const opDate = new Date(date);
    const existingOps = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: asset.id, accountId: accountId || null },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const lastOp = existingOps[existingOps.length - 1];
    if (lastOp && opDate < new Date(lastOp.date)) {
      return res.status(400).json({ error: `Cargá las operaciones en orden cronológico: la última registrada para este activo/cuenta es del ${new Date(lastOp.date).toLocaleDateString('es-AR')}.` });
    }

    const state = replay(existingOps);
    let realizedGain = null;
    if (type === 'SELL') {
      if (quantity > state.qty + 1e-6) {
        return res.status(400).json({ error: `No tenés suficiente cantidad: disponible ${state.qty}, intentás vender ${quantity}.` });
      }
      realizedGain = round2((unitPrice - state.avgCost) * quantity);
    }

    const op = await prisma.investmentOperation.create({
      data: {
        userId: req.userId, assetId: asset.id, accountId: accountId || null,
        type, quantity, unitPrice, date: opDate, notes: notes?.trim() || null,
        realizedGain,
      },
    });

    let gainTransactionId = null;
    if (type === 'SELL' && accountId && realizedGain != null && Math.abs(realizedGain) > 0.004) {
      const isGain = realizedGain > 0;
      const cat = await getOrCreateCategory(req.userId, isGain ? GAIN_CATEGORY : LOSS_CATEGORY);
      const tx = await prisma.transaction.create({
        data: {
          type: isGain ? 'INCOME' : 'EXPENSE',
          amount: Math.abs(realizedGain),
          currency: asset.currency,
          date: opDate,
          accountId,
          categoryId: cat.id,
          userId: req.userId,
          comment: `Resultado venta ${asset.name} (${quantity} u.)`,
        },
      });
      gainTransactionId = tx.id;
      await prisma.investmentOperation.update({ where: { id: op.id }, data: { gainTransactionId } });
    }

    res.status(201).json({
      id: op.id, assetId: asset.id, assetName: asset.name, currency: asset.currency,
      accountId: op.accountId, type: op.type, quantity: toNum(op.quantity), unitPrice: toNum(op.unitPrice),
      date: op.date, notes: op.notes, realizedGain, gainTransactionId,
    });
  } catch (err) { next(err); }
};

// Only notes/date may be edited, and only within the existing chronological slot
// (can't move it before the previous op or after the next one) — quantity/price/type
// are immutable because other operations' avgCost may already depend on them.
const updateOperation = async (req, res, next) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });
    const { notes, date } = req.body;
    const data = {};
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (date != null) {
      const newDate = new Date(date);
      const siblings = await prisma.investmentOperation.findMany({
        where: { userId: req.userId, assetId: existing.assetId, accountId: existing.accountId, id: { not: existing.id } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      });
      const prev = [...siblings].reverse().find(o => new Date(o.date) <= existing.date);
      const next = siblings.find(o => new Date(o.date) >= existing.date);
      if (prev && newDate < new Date(prev.date)) return res.status(400).json({ error: 'La fecha no puede ser anterior a la operación previa de este activo/cuenta.' });
      if (next && newDate > new Date(next.date)) return res.status(400).json({ error: 'La fecha no puede ser posterior a la siguiente operación de este activo/cuenta.' });
      data.date = newDate;
    }
    const op = await prisma.investmentOperation.update({ where: { id: existing.id }, data });
    if (data.date && existing.gainTransactionId) {
      await prisma.transaction.update({ where: { id: existing.gainTransactionId }, data: { date: data.date } }).catch(() => {});
    }
    res.json({ ...op, quantity: toNum(op.quantity), unitPrice: toNum(op.unitPrice), realizedGain: op.realizedGain != null ? toNum(op.realizedGain) : null });
  } catch (err) { next(err); }
};

// Only the most recent operation of an asset/account can be deleted, so earlier
// operations' avgCost / realized gain never need to be recomputed.
const deleteOperation = async (req, res, next) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });
    const later = await prisma.investmentOperation.count({
      where: {
        userId: req.userId, assetId: existing.assetId, accountId: existing.accountId,
        OR: [
          { date: { gt: existing.date } },
          { date: existing.date, createdAt: { gt: existing.createdAt } },
        ],
      },
    });
    if (later > 0) return res.status(400).json({ error: 'Solo se puede eliminar la operación más reciente de este activo/cuenta.' });
    if (existing.gainTransactionId) {
      await prisma.transaction.delete({ where: { id: existing.gainTransactionId } }).catch(() => {});
    }
    await prisma.investmentOperation.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ── Board: positions grouped by asset + account ────────────────────────────

const getBoard = async (req, res, next) => {
  try {
    const ops = await prisma.investmentOperation.findMany({
      where: { userId: req.userId },
      include: { asset: true, account: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const groups = new Map();
    for (const o of ops) {
      const key = `${o.assetId}::${o.accountId || 'none'}`;
      if (!groups.has(key)) groups.set(key, { asset: o.asset, account: o.account, ops: [] });
      groups.get(key).ops.push(o);
    }
    const board = [...groups.values()].map(g => {
      const state = replay(g.ops);
      const refPrice = toNum(g.asset.referencePrice);
      const currentValue = round2(state.qty * refPrice);
      const unrealizedGain = round2(currentValue - state.invested);
      const realizedGain = round2(g.ops.reduce((s, o) => s + (o.realizedGain != null ? toNum(o.realizedGain) : 0), 0));
      return {
        assetId: g.asset.id, assetName: g.asset.name, currency: g.asset.currency, referencePrice: refPrice,
        accountId: g.account?.id || null, accountName: g.account?.name || 'Sin cuenta',
        quantity: state.qty, avgCost: round2(state.avgCost), invested: state.invested,
        currentValue, unrealizedGain,
        unrealizedGainPct: state.invested > 0 ? round2((unrealizedGain / state.invested) * 100) : 0,
        realizedGain,
        operationCount: g.ops.length,
      };
    }).filter(g => g.quantity > 0 || g.realizedGain !== 0)
      .sort((a, b) => a.assetName.localeCompare(b.assetName));
    res.json(board);
  } catch (err) { next(err); }
};

module.exports = {
  listPositions, createPosition, updatePosition, deletePosition,
  listAssets, createAsset, updateAsset, deleteAsset,
  listOperations, createOperation, updateOperation, deleteOperation,
  getBoard,
};

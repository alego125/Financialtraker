const prisma = require('../utils/prisma');
const { randomUUID } = require('node:crypto');
const { financialMutation } = require('../utils/financialMutation');
const { decimal, money, inputDecimal } = require('../utils/decimal');
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

const createAsset = async (req, res, next, prisma) => {
  try {
    const { name, currency, referencePrice } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Ingresá un nombre para el activo' });
    if (currency && !['ARS', 'USD'].includes(currency)) return res.status(400).json({ error: 'Moneda inválida' });
    const price = inputDecimal(referencePrice ?? 0, 4, 10);
    const existing = await prisma.investmentAsset.findUnique({ where: { userId_name: { userId: req.userId, name: name.trim() } } });
    if (existing) return res.status(409).json({ error: 'Ya existe un activo con ese nombre' });
    const asset = await prisma.investmentAsset.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        currency: currency || 'ARS',
        referencePrice: price,
      },
    });
    res.status(201).json({ ...asset, referencePrice: toNum(asset.referencePrice) });
  } catch (err) { next(err); }
};

const updateAsset = async (req, res, next, prisma) => {
  try {
    const existing = await prisma.investmentAsset.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Activo no encontrado' });
    const { name, currency, referencePrice } = req.body;
    if (currency && !['ARS', 'USD'].includes(currency)) return res.status(400).json({ error: 'Moneda inválida' });
    if (currency && currency !== existing.currency && await prisma.investmentOperation.count({ where: { assetId: existing.id } })) {
      return res.status(400).json({ error: 'No podés cambiar la moneda de un activo con operaciones' });
    }
    const asset = await prisma.investmentAsset.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(currency != null && { currency }),
        ...(referencePrice != null && { referencePrice: inputDecimal(referencePrice, 4, 10) }),
      },
    });
    res.json({ ...asset, referencePrice: toNum(asset.referencePrice) });
  } catch (err) { next(err); }
};

const deleteAsset = async (req, res, next, prisma) => {
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

const { replay } = require('../utils/investmentMath');
const replayDetailed = replay;

const { recomputeGroup, recomputeGroups } = require('../utils/investmentLedger');

const listOperations = async (req, res, next) => {
  try {
    const ops = await prisma.investmentOperation.findMany({
      where: { userId: req.userId },
      include: { asset: true, account: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    res.json(ops.map(o => ({
      id: o.id, assetId: o.assetId, assetName: o.asset.name, currency: o.asset.currency,
      accountId: o.accountId, accountName: o.account?.name || null,
      type: o.type, quantity: toNum(o.quantity), unitPrice: toNum(o.unitPrice),
      total: money(decimal(o.quantity).mul(o.unitPrice)),
      date: o.date, notes: o.notes,
      realizedGain: o.realizedGain != null ? toNum(o.realizedGain) : null,
      createdAt: o.createdAt,
    })));
  } catch (err) { next(err); }
};

const createOperation = async (req, res, next, prisma) => {
  try {
    let { assetId, assetName, currency, accountId, type, quantity, unitPrice, date, notes } = req.body;
    if (!['BUY', 'SELL'].includes(type)) return res.status(400).json({ error: 'Tipo inválido (BUY/SELL)' });
    quantity = inputDecimal(quantity, 6, 12, true); unitPrice = inputDecimal(unitPrice, 4, 10);
    if (!date || !Number.isFinite(new Date(date).getTime())) return res.status(400).json({ error: 'Fecha inválida' });
    if (currency && !['ARS', 'USD'].includes(currency)) return res.status(400).json({ error: 'Moneda inválida' });

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

    // Operations can be inserted at any point in time, not just appended after the
    // last one (e.g. you forgot to log an older purchase) — validate the insertion
    // against the asset+account's full history, wherever it lands chronologically.
    const opDate = new Date(date);
    const existingOps = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: asset.id, accountId: accountId || null },
    });
    const draft = { id: randomUUID(), type, quantity, unitPrice, date: opDate, createdAt: new Date() };
    try {
      replayDetailed(sortOps([...existingOps, draft]));
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const op = await prisma.investmentOperation.create({
      data: {
        id: draft.id, createdAt: draft.createdAt,
        userId: req.userId, assetId: asset.id, accountId: accountId || null,
        type, quantity, unitPrice, date: opDate, notes: notes?.trim() || null,
        realizedGain: null,
      },
    });

    // recomputeGroup computes this op's realizedGain (and creates its gain/loss
    // transaction if it's a SELL) and, since inserting earlier than existing
    // operations can shift avgCost going forward, fixes up every later operation too.
    await recomputeGroup(prisma, req.userId, asset.id, accountId || null);

    const fresh = await prisma.investmentOperation.findUnique({ where: { id: op.id } });
    res.status(201).json({
      id: fresh.id, assetId: asset.id, assetName: asset.name, currency: asset.currency,
      accountId: fresh.accountId, type: fresh.type, quantity: toNum(fresh.quantity), unitPrice: toNum(fresh.unitPrice),
      date: fresh.date, notes: fresh.notes,
      realizedGain: fresh.realizedGain != null ? toNum(fresh.realizedGain) : null,
      gainTransactionId: fresh.gainTransactionId,
    });
  } catch (err) { next(err); }
};

const sortOps = ops => ops.sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id));

// Quantity/unitPrice/type/date/notes/accountId can all be edited (asset cannot —
// delete and recreate to move an operation to a different asset). Moving accountId
// takes the operation out of its old asset+account group and into a new one: both
// the remaining old group and the new group (with this op inserted) are validated —
// no SELL left overselling — before anything is persisted. Both groups and the
// linked gain/loss transaction are then synchronized using their combined net
// balance effect, within the same serializable transaction.
const updateOperation = async (req, res, next, prisma) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });
    const { type, quantity, unitPrice, date, notes, accountId } = req.body;
    const data = {};
    if (type != null) {
      if (!['BUY', 'SELL'].includes(type)) return res.status(400).json({ error: 'Tipo inválido (BUY/SELL)' });
      data.type = type;
    }
    if (quantity != null) {
      data.quantity = inputDecimal(quantity, 6, 12, true);
    }
    if (unitPrice != null) {
      data.unitPrice = inputDecimal(unitPrice, 4, 10);
    }
    if (date != null) {
      if (!Number.isFinite(new Date(date).getTime())) return res.status(400).json({ error: 'Fecha inválida' });
      data.date = new Date(date);
    }
    if (notes !== undefined) data.notes = notes?.trim() || null;

    let accountChanged = false;
    if (accountId !== undefined) {
      const newAccountId = accountId || null;
      if (newAccountId !== existing.accountId) {
        if (newAccountId) {
          const acc = await prisma.account.findFirst({ where: { id: newAccountId, userId: req.userId } });
          if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        data.accountId = newAccountId;
        accountChanged = true;
      }
    }

    const oldGroupSiblings = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: existing.assetId, accountId: existing.accountId, id: { not: existing.id } },
    });
    if (accountChanged) {
      try {
        replayDetailed(sortOps(oldGroupSiblings));
      } catch (e) {
        return res.status(e.status || 400).json({ error: `No se puede mover de cuenta: ${e.message}` });
      }
    }

    const newAccountId = accountChanged ? data.accountId : existing.accountId;
    const newGroupSiblings = accountChanged
      ? await prisma.investmentOperation.findMany({ where: { userId: req.userId, assetId: existing.assetId, accountId: newAccountId } })
      : oldGroupSiblings;
    const merged = sortOps([...newGroupSiblings, { ...existing, ...data }]);
    try {
      replayDetailed(merged);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    await prisma.investmentOperation.update({ where: { id: existing.id }, data });
    await recomputeGroups(prisma, req.userId, [
      { assetId: existing.assetId, accountId: existing.accountId },
      { assetId: existing.assetId, accountId: newAccountId },
    ]);

    const fresh = await prisma.investmentOperation.findUnique({ where: { id: existing.id } });
    res.json({ ...fresh, quantity: toNum(fresh.quantity), unitPrice: toNum(fresh.unitPrice), realizedGain: fresh.realizedGain != null ? toNum(fresh.realizedGain) : null });
  } catch (err) { next(err); }
};

// Any operation can be deleted as long as the rest of the asset+account history stays
// consistent (no SELL left overselling once it's gone); recomputeGroup then fixes up
// realizedGain/transactions for whatever operation came after it.
const deleteOperation = async (req, res, next, prisma) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });

    const siblings = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: existing.assetId, accountId: existing.accountId, id: { not: existing.id } },
    });
    const remaining = sortOps(siblings);
    try {
      replayDetailed(remaining);
    } catch (e) {
      return res.status(e.status || 400).json({ error: `No se puede eliminar: ${e.message}` });
    }

    await prisma.investmentOperation.delete({ where: { id: existing.id } });
    await recomputeGroups(prisma, req.userId, [{ assetId: existing.assetId, accountId: existing.accountId }], [existing]);
    res.status(204).end();
  } catch (err) { next(err); }
};

// ── Board: positions grouped by asset + account ────────────────────────────

const getBoard = async (req, res, next) => {
  try {
    const ops = await prisma.investmentOperation.findMany({
      where: { userId: req.userId },
      include: { asset: true, account: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
      const currentValue = money(state.quantityDecimal.mul(g.asset.referencePrice));
      const unrealizedGain = money(decimal(currentValue).minus(state.investedDecimal));
      const realizedGain = money(g.ops.reduce((s, o) => s.plus(o.realizedGain ?? 0), decimal(0)));
      return {
        assetId: g.asset.id, assetName: g.asset.name, currency: g.asset.currency, referencePrice: refPrice,
        accountId: g.account?.id || null, accountName: g.account?.name || 'Sin cuenta',
        quantity: state.qty, avgCost: state.avgCostDecimal.toDecimalPlaces(4).toNumber(), invested: state.invested,
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
  listAssets, createAsset: financialMutation(prisma, createAsset), updateAsset: financialMutation(prisma, updateAsset), deleteAsset: financialMutation(prisma, deleteAsset),
  listOperations, createOperation: financialMutation(prisma, createOperation), updateOperation: financialMutation(prisma, updateOperation), deleteOperation: financialMutation(prisma, deleteOperation),
  getBoard,
};

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

const fmtDate = d => new Date(d).toISOString().slice(0, 10);

// Same as replay(), but also returns the realizedGain computed for each SELL step
// (in chronological order) and throws a 400-flagged error the moment a SELL would
// oversell — used to validate a full asset+account history after an edit/delete.
const replayDetailed = (ops) => {
  let qty = 0, invested = 0;
  const steps = [];
  for (const o of ops) {
    const q = toNum(o.quantity), price = toNum(o.unitPrice);
    if (o.type === 'BUY') {
      invested += q * price;
      qty += q;
      steps.push({ op: o, realizedGain: null });
    } else {
      if (q > qty + 1e-6) {
        const err = new Error(`No hay cantidad suficiente para la venta del ${fmtDate(o.date)}: se necesitan ${q} y solo hay ${round2(qty)} disponibles en ese momento.`);
        err.status = 400;
        throw err;
      }
      const avgCost = qty > 1e-9 ? invested / qty : 0;
      const realizedGain = round2((price - avgCost) * q);
      invested -= avgCost * q;
      qty -= q;
      steps.push({ op: o, realizedGain });
    }
  }
  return { steps, qty: round2(qty), invested: round2(invested), avgCost: qty > 1e-9 ? invested / qty : 0 };
};

const GAIN_CATEGORY   = { name: 'Inversiones',             type: 'INCOME',  color: '#8b5cf6' };
const LOSS_CATEGORY   = { name: 'Pérdida en inversiones',  type: 'EXPENSE', color: '#dc2626' };

const getOrCreateCategory = async (userId, def) => {
  let cat = await prisma.category.findUnique({ where: { userId_name: { userId, name: def.name } } });
  if (!cat) cat = await prisma.category.create({ data: { userId, name: def.name, type: def.type, color: def.color } });
  return cat;
};

// Re-replays every operation of an asset+account and fixes up realizedGain plus the
// linked gain/loss Transaction for every SELL whose value changed as a result — used
// after editing or deleting any operation in the group, not just the most recent one.
const recomputeGroup = async (userId, assetId, accountId) => {
  const ops = await prisma.investmentOperation.findMany({
    where: { userId, assetId, accountId: accountId || null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  const { steps } = replayDetailed(ops);
  const asset = await prisma.investmentAsset.findUnique({ where: { id: assetId } });

  for (const { op, realizedGain } of steps) {
    const prevGain = op.realizedGain != null ? toNum(op.realizedGain) : null;
    const same = (realizedGain == null && prevGain == null) || (realizedGain != null && prevGain != null && Math.abs(realizedGain - prevGain) < 0.005);
    if (same) continue;

    await prisma.investmentOperation.update({ where: { id: op.id }, data: { realizedGain } });
    const hasGain = realizedGain != null && Math.abs(realizedGain) > 0.004 && op.accountId;

    if (op.gainTransactionId && !hasGain) {
      await prisma.transaction.delete({ where: { id: op.gainTransactionId } }).catch(() => {});
      await prisma.investmentOperation.update({ where: { id: op.id }, data: { gainTransactionId: null } });
    } else if (hasGain) {
      const isGain = realizedGain > 0;
      const cat = await getOrCreateCategory(userId, isGain ? GAIN_CATEGORY : LOSS_CATEGORY);
      const comment = `Resultado venta ${asset.name} (${toNum(op.quantity)} u.)`;
      if (op.gainTransactionId) {
        await prisma.transaction.update({
          where: { id: op.gainTransactionId },
          data: { type: isGain ? 'INCOME' : 'EXPENSE', amount: Math.abs(realizedGain), categoryId: cat.id, date: op.date, comment },
        }).catch(() => {});
      } else {
        const tx = await prisma.transaction.create({
          data: {
            type: isGain ? 'INCOME' : 'EXPENSE', amount: Math.abs(realizedGain), currency: asset.currency,
            date: op.date, accountId: op.accountId, categoryId: cat.id, userId, comment,
          },
        });
        await prisma.investmentOperation.update({ where: { id: op.id }, data: { gainTransactionId: tx.id } });
      }
    }
  }
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

// Quantity/unitPrice/type/date/notes can all be edited (asset/account cannot — delete
// and recreate to move an operation to a different one). Before persisting, the full
// asset+account history is replayed with this edit applied to make sure no SELL ends
// up overselling at any point in time; after persisting, recomputeGroup fixes up
// realizedGain and the linked gain/loss Transaction for this and every later operation
// whose value shifted as a result.
const updateOperation = async (req, res, next) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });
    const { type, quantity, unitPrice, date, notes } = req.body;
    const data = {};
    if (type != null) {
      if (!['BUY', 'SELL'].includes(type)) return res.status(400).json({ error: 'Tipo inválido (BUY/SELL)' });
      data.type = type;
    }
    if (quantity != null) {
      const q = parseFloat(quantity);
      if (!q || q <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      data.quantity = q;
    }
    if (unitPrice != null) {
      const p = parseFloat(unitPrice);
      if (isNaN(p) || p < 0) return res.status(400).json({ error: 'Precio unitario inválido' });
      data.unitPrice = p;
    }
    if (date != null) data.date = new Date(date);
    if (notes !== undefined) data.notes = notes?.trim() || null;

    const siblings = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: existing.assetId, accountId: existing.accountId, id: { not: existing.id } },
    });
    const merged = [...siblings, { ...existing, ...data }]
      .sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));
    try {
      replayDetailed(merged);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    await prisma.investmentOperation.update({ where: { id: existing.id }, data });
    await recomputeGroup(req.userId, existing.assetId, existing.accountId);

    const fresh = await prisma.investmentOperation.findUnique({ where: { id: existing.id } });
    res.json({ ...fresh, quantity: toNum(fresh.quantity), unitPrice: toNum(fresh.unitPrice), realizedGain: fresh.realizedGain != null ? toNum(fresh.realizedGain) : null });
  } catch (err) { next(err); }
};

// Any operation can be deleted as long as the rest of the asset+account history stays
// consistent (no SELL left overselling once it's gone); recomputeGroup then fixes up
// realizedGain/transactions for whatever operation came after it.
const deleteOperation = async (req, res, next) => {
  try {
    const existing = await prisma.investmentOperation.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Operación no encontrada' });

    const siblings = await prisma.investmentOperation.findMany({
      where: { userId: req.userId, assetId: existing.assetId, accountId: existing.accountId, id: { not: existing.id } },
    });
    const remaining = siblings.sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));
    try {
      replayDetailed(remaining);
    } catch (e) {
      return res.status(e.status || 400).json({ error: `No se puede eliminar: ${e.message}` });
    }

    if (existing.gainTransactionId) {
      await prisma.transaction.delete({ where: { id: existing.gainTransactionId } }).catch(() => {});
    }
    await prisma.investmentOperation.delete({ where: { id: existing.id } });
    await recomputeGroup(req.userId, existing.assetId, existing.accountId);
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

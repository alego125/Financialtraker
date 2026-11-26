const router = require('express').Router();
const { isDeepStrictEqual: same } = require('node:util');
const { authenticate } = require('../middlewares/auth');
const prisma = require('../utils/prisma');

router.use(authenticate);

const idPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const amountPattern = /^\d{1,10}(\.\d{1,2})?$/;
const ratePattern = /^\d{1,8}(\.\d{1,4})?$/;
const money = (value, allowZero = false) =>
  typeof value === 'string' && amountPattern.test(value) && (allowZero || Number(value) > 0);
const validDate = value => {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

router.get('/', async (req, res, next) => {
  try {
    const plan = await prisma.financialPlan.findUnique({ where: { userId: req.userId } });
    res.json(plan || { budgets: [], goals: [], exchangeRate: null });
  } catch (error) { next(error); }
});

router.put('/', async (req, res, next) => {
  try {
    const { budgets, goals, exchangeRate, previous } = req.body ?? {};
    if (!Array.isArray(budgets) || !Array.isArray(goals) || budgets.length > 150 || goals.length > 100
      || !previous || typeof previous !== 'object') {
      return res.status(422).json({ error: 'Plan financiero inválido' });
    }
    if (exchangeRate !== null && (typeof exchangeRate !== 'string' || !ratePattern.test(exchangeRate) || Number(exchangeRate) === 0)) {
      return res.status(422).json({ error: 'Ingresá un tipo de cambio positivo' });
    }
    const keys = new Set();
    for (const budget of budgets) {
      const key = budget && `${budget.month}/${budget.categoryId}`;
      if (!budget || !idPattern.test(budget.categoryId) || !monthPattern.test(budget.month) || !money(budget.limit) || keys.has(key)) {
        return res.status(422).json({ error: 'Ingresá un solo presupuesto válido por categoría y mes' });
      }
      keys.add(key);
    }
    const goalIds = new Set();
    for (const goal of goals) {
      if (!goal || !idPattern.test(goal.id) || goalIds.has(goal.id) || typeof goal.name !== 'string'
        || !goal.name.trim() || goal.name.trim().length > 80 || !money(goal.target)
        || !money(goal.saved, true) || !validDate(goal.due)) {
        return res.status(422).json({ error: 'Revisá el nombre, importe y fecha de las metas' });
      }
      goalIds.add(goal.id);
    }

    const updates = {
      budgets: budgets.map(({ categoryId, month, limit }) => ({ categoryId, month, limit })),
      goals: goals.map(({ id, name, target, saved, due }) => ({ id, name: name.trim(), target, saved, due })),
      exchangeRate,
    };
    const result = await prisma.$transaction(async tx => {
      // Lock the user's planning mutations and compare only the sections being changed.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${req.userId} FOR UPDATE`;
      const existing = await tx.financialPlan.findUnique({ where: { userId: req.userId } });
      const current = existing || { budgets: [], goals: [], exchangeRate: null };
      const changed = {};
      for (const key of ['budgets', 'goals', 'exchangeRate']) {
        if (same(updates[key], previous[key])) continue;
        const value = key === 'exchangeRate' ? current[key]?.toString() ?? null : current[key];
        if (!same(value, previous[key])) return null;
        changed[key] = updates[key];
      }
      if (changed.budgets) {
        const oldIds = new Set(current.budgets.map(item => item.categoryId));
        const newIds = [...new Set(changed.budgets.map(item => item.categoryId))].filter(id => !oldIds.has(id));
        const count = await tx.category.count({ where: { id: { in: newIds }, userId: req.userId, type: 'EXPENSE' } });
        if (count !== newIds.length) return false;
      }
      return tx.financialPlan.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...changed }, update: changed });
    });
    if (result === null) return res.status(409).json({ error: 'El plan cambió en otra sesión. Recargá para volver a intentarlo.' });
    if (result === false) return res.status(422).json({ error: 'Elegí una categoría de gasto propia' });
    res.json(result);
  } catch (error) { next(error); }
});

module.exports = router;

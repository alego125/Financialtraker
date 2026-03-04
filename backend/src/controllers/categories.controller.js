const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const list = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { transactions: true } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, type, color } = req.body;
    const category = await prisma.category.create({
      data: { name, type, color: color || '#6366f1', userId: req.userId },
    });
    res.status(201).json(category);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const category = await prisma.category.findFirst({ where: { id, userId: req.userId } });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });

    const updated = await prisma.category.update({
      where: { id },
      data: { name: req.body.name, type: req.body.type, color: req.body.color },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findFirst({ where: { id, userId: req.userId } });
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });

    const txCount = await prisma.transaction.count({ where: { categoryId: id } });
    if (txCount > 0) return res.status(400).json({ error: `No puedes eliminar una categoría con ${txCount} transacciones` });

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Categoría eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    // Create default categories
    const defaultCategories = [
      { name: 'Salario', type: 'INCOME', color: '#10b981' },
      { name: 'Freelance', type: 'INCOME', color: '#06b6d4' },
      { name: 'Inversiones', type: 'INCOME', color: '#8b5cf6' },
      { name: 'Otros ingresos', type: 'INCOME', color: '#f59e0b' },
      { name: 'Alimentación', type: 'EXPENSE', color: '#ef4444' },
      { name: 'Transporte', type: 'EXPENSE', color: '#f97316' },
      { name: 'Entretenimiento', type: 'EXPENSE', color: '#ec4899' },
      { name: 'Salud', type: 'EXPENSE', color: '#14b8a6' },
      { name: 'Educación', type: 'EXPENSE', color: '#3b82f6' },
      { name: 'Hogar', type: 'EXPENSE', color: '#a78bfa' },
      { name: 'Ropa', type: 'EXPENSE', color: '#f43f5e' },
      { name: 'Otros gastos', type: 'EXPENSE', color: '#6b7280' },
    ];

    await prisma.category.createMany({
      data: defaultCategories.map(c => ({ ...c, userId: user.id })),
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me };

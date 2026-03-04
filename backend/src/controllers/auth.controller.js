const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { sendPasswordReset } = require('../utils/mailer');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    const defaultCategories = [
      { name: 'Salario',          type: 'INCOME',  color: '#10b981' },
      { name: 'Freelance',        type: 'INCOME',  color: '#06b6d4' },
      { name: 'Inversiones',      type: 'INCOME',  color: '#8b5cf6' },
      { name: 'Otros ingresos',   type: 'INCOME',  color: '#f59e0b' },
      { name: 'Alimentación',     type: 'EXPENSE', color: '#ef4444' },
      { name: 'Transporte',       type: 'EXPENSE', color: '#f97316' },
      { name: 'Entretenimiento',  type: 'EXPENSE', color: '#ec4899' },
      { name: 'Salud',            type: 'EXPENSE', color: '#14b8a6' },
      { name: 'Educación',        type: 'EXPENSE', color: '#3b82f6' },
      { name: 'Hogar',            type: 'EXPENSE', color: '#a78bfa' },
      { name: 'Ropa',             type: 'EXPENSE', color: '#f43f5e' },
      { name: 'Otros gastos',     type: 'EXPENSE', color: '#6b7280' },
    ];
    await prisma.category.createMany({ data: defaultCategories.map(c => ({ ...c, userId: user.id })) });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
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

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) { next(err); }
};

// PUT /api/auth/profile — update name, email, password
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updateData = {};

    if (name && name.trim()) updateData.name = name.trim();

    if (email && email !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(409).json({ error: 'Ese email ya está en uso' });
      updateData.email = email;
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Debés ingresar tu contraseña actual' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No hay cambios para guardar' });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: { id: true, name: true, email: true, createdAt: true },
    });

    res.json({ message: 'Perfil actualizado', user: updated });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password — genera contraseña temporal y envía email
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await prisma.user.findUnique({ where: { email } });

    // Siempre responder igual para no revelar si el email existe
    if (!user) {
      return res.json({ message: 'Si el email está registrado, recibirás las instrucciones en breve.' });
    }

    // Generar contraseña temporal legible (4 grupos de 4 chars)
    const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    try {
      await sendPasswordReset({ to: user.email, name: user.name, tempPassword });
    } catch (mailErr) {
      console.error('Mail error:', mailErr.message);
      // No fallar el request si el mail falla, loguear el error
    }

    res.json({ message: 'Si el email está registrado, recibirás las instrucciones en breve.' });
  } catch (err) { next(err); }
};

module.exports = { register, login, me, updateProfile, forgotPassword };

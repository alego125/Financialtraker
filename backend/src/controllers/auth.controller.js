const bcrypt = require('bcryptjs');
const { issueSession, clearSession } = require('../utils/session');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(({ msg, path }) => ({ msg, path })) });

    const { name, email, password } = req.body;
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);
    let user;

    const defaultCategories = [
      { name: 'Salario',         type: 'INCOME',  color: '#10b981' },
      { name: 'Freelance',       type: 'INCOME',  color: '#06b6d4' },
      { name: 'Inversiones',     type: 'INCOME',  color: '#8b5cf6' },
      { name: 'Otros ingresos',  type: 'INCOME',  color: '#f59e0b' },
      { name: 'Alimentación',    type: 'EXPENSE', color: '#ef4444' },
      { name: 'Transporte',      type: 'EXPENSE', color: '#f97316' },
      { name: 'Entretenimiento', type: 'EXPENSE', color: '#ec4899' },
      { name: 'Salud',           type: 'EXPENSE', color: '#14b8a6' },
      { name: 'Educación',       type: 'EXPENSE', color: '#3b82f6' },
      { name: 'Hogar',           type: 'EXPENSE', color: '#a78bfa' },
      { name: 'Ropa',            type: 'EXPENSE', color: '#f43f5e' },
      { name: 'Otros gastos',    type: 'EXPENSE', color: '#6b7280' },
    ];
    user = await prisma.$transaction(async db => {
      const created = await db.user.create({ data: { name, email, passwordHash } });
      await db.category.createMany({ data: defaultCategories.map(c => ({ ...c, userId: created.id })) });
      return created;
    });

    const csrfToken = issueSession(res, user);
    res.status(201).json({ csrfToken, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(({ msg, path }) => ({ msg, path })) });

    const { email, password } = req.body;
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const csrfToken = issueSession(res, user);
    res.json({ csrfToken, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ...user, csrfToken: req.csrfToken });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(({ msg, path }) => ({ msg, path })) });

    const { name, email, currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const sensitive = Boolean(newPassword || (email && email !== user.email));
    if (sensitive) {
      if (!currentPassword) return res.status(400).json({ error: 'Debés ingresar tu contraseña actual' });
      if (!await bcrypt.compare(currentPassword, user.passwordHash)) return res.status(403).json({ error: 'Contraseña actual incorrecta' });
    }
    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();

    if (email && email !== user.email) {
      const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (exists) return res.status(409).json({ error: 'Ese email ya está en uso' });
      updateData.email = email;
    }

    if (newPassword) {
      if (newPassword.length < 10 || Buffer.byteLength(newPassword, 'utf8') > 72) return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres y como máximo 72 bytes' });
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No hay cambios para guardar' });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { ...updateData, ...(sensitive ? { authVersion: { increment: 1 } } : {}) },
      select: { id: true, name: true, email: true, createdAt: true, authVersion: true },
    });
    const csrfToken = sensitive ? issueSession(res, updated) : req.csrfToken;
    delete updated.authVersion;
    res.json({ csrfToken, message: 'Perfil actualizado', user: updated });
  } catch (err) { next(err); }
};

// Recovery is manual in the current UI. Never change a credential before
// verifying ownership of the email address, or disclose it in an API response.
const forgotPassword = (_req, res) => res.status(410).json({
  error: 'La recuperación automática no está disponible. Contactá al administrador desde la pantalla de recuperación.',
});

const logout = async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { authVersion: { increment: 1 } } });
    clearSession(res); res.status(204).end();
  } catch (err) { next(err); }
};
module.exports = { register, login, me, updateProfile, forgotPassword, logout };

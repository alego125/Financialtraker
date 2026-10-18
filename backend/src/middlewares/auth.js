const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { readSession } = require('../utils/session');
const { timingSafeEqual } = require('node:crypto');

const authenticate = async (req, res, next) => {
  const { token, cookie } = readSession(req);
  if (!token) return res.status(401).json({ error: 'Sesión requerida', code: 'SESSION_REQUIRED' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'fintrack', audience: 'fintrack-web' });
    if (typeof decoded.userId !== 'string' || !Number.isInteger(decoded.authVersion)) throw new Error();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada', code: 'SESSION_INVALID' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { authVersion: true } });
    if (!user || user.authVersion !== decoded.authVersion) return res.status(401).json({ error: 'Sesión revocada', code: 'SESSION_REVOKED' });
    if (cookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const actual = Buffer.from(req.headers['x-csrf-token'] || ''), expected = Buffer.from(decoded.csrf || '');
      if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(403).json({ error: 'Verificación de sesión requerida', code: 'CSRF_INVALID' });
    }
    req.userId = decoded.userId;
    req.csrfToken = decoded.csrf;
    next();
  } catch (error) { next(error); }
};

module.exports = { authenticate };

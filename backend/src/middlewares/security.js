const { randomUUID } = require('node:crypto');
const corsOptions = (env = process.env) => ({
  origin(origin, cb) {
    const allowed = (env.FRONTEND_URL || '').split(',').map(x => x.trim()).filter(Boolean);
    if (env.NODE_ENV !== 'production') allowed.push('http://localhost:5173', 'http://localhost:4173');
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(Object.assign(new Error('Origen no permitido'), { status: 403 }));
  }, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token'],
});
function rateLimit({ max, windowMs, now = Date.now }) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, value] of buckets) if (value.until <= time) buckets.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = buckets.get(key);
    if (!entry) { entry = { count: 0, until: time + windowMs }; buckets.set(key, entry); }
    if (++entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.until - time) / 1000));
      return res.status(429).json({ error: 'Demasiados intentos. Intentá nuevamente más tarde.' });
    }
    next();
  };
}
function securityHeaders(req, res, next) {
  req.requestId = randomUUID(); res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Cache-Control','no-store'); next();
}
module.exports = { corsOptions, rateLimit, securityHeaders };

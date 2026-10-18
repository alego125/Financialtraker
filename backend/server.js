require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./src/middlewares/errorHandler');
const { corsOptions, rateLimit, securityHeaders } = require('./src/middlewares/security');
const { normalizeQuery } = require('./src/utils/query');
const prisma = require('./src/utils/prisma');
const app = express();
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new Error('TRUST_PROXY_HOPS inválido');
  app.set('trust proxy', hops);
}
app.disable('x-powered-by');
app.use(securityHeaders, cors(corsOptions()), express.json({ limit: '64kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/ready', async (_req, res) => {
  let timer;
  try {
    await Promise.race([prisma.user.findFirst({ select: { id: true, authVersion: true } }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 4000); })]);
    res.json({ status: 'ready' });
  } catch { res.status(503).json({ status: 'unavailable' }); }
  finally { clearTimeout(timer); }
});
app.use('/api', rateLimit({ max: 600, windowMs: 60000 }), normalizeQuery);
for (const [path, file] of Object.entries({ auth:'auth', categories:'categories', transactions:'transactions', dashboard:'dashboard', partnerships:'partnerships', accounts:'accounts', 'shared-accounts':'sharedAccounts', transfers:'transfers', analysis:'analysis', investments:'investment', ai:'ai' })) app.use('/api/' + path, require('./src/routes/' + file));
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);
function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Configurá DATABASE_URL y JWT_SECRET de al menos 32 caracteres');
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) throw new Error('FRONTEND_URL requerido');
  return app.listen(process.env.PORT || 3001, '0.0.0.0');
}
if (require.main === module) start();
module.exports = { app, start };

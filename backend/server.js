require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { errorHandler } = require('./src/middlewares/errorHandler');

const authRoutes          = require('./src/routes/auth');
const categoryRoutes      = require('./src/routes/categories');
const transactionRoutes   = require('./src/routes/transactions');
const dashboardRoutes     = require('./src/routes/dashboard');
const partnershipRoutes   = require('./src/routes/partnerships');
const accountRoutes       = require('./src/routes/accounts');
const sharedAccountRoutes = require('./src/routes/sharedAccounts');

const app  = express();
const PORT = process.env.PORT || 3001;

// Allowed origins: variable de entorno + localhost para desarrollo
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  if (process.env.FRONTEND_URL) {
    // Soporta múltiples URLs separadas por coma
    process.env.FRONTEND_URL.split(',').forEach(u => origins.push(u.trim()));
  }
  return origins;
};

app.use(cors({
  origin: (origin, cb) => {
    const allowed = getAllowedOrigins();
    // Sin origin = Postman/curl, siempre permitir
    if (!origin) return cb(null, true);
    // Verificar exact match
    if (allowed.includes(origin)) return cb(null, true);
    // Verificar que sea cualquier subdominio de vercel.app (cubre previews)
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    console.warn('CORS blocked:', origin, '| Allowed:', allowed);
    cb(new Error('CORS no permitido: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Responder OPTIONS explícitamente (preflight)
app.options('*', cors());

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV });
});

app.use('/api/auth',            authRoutes);
app.use('/api/categories',      categoryRoutes);
app.use('/api/transactions',    transactionRoutes);
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/partnerships',    partnershipRoutes);
app.use('/api/accounts',        accountRoutes);
app.use('/api/shared-accounts', sharedAccountRoutes);

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server on port ${PORT} [${process.env.NODE_ENV}]`);
  console.log(`✓ Allowed origins:`, getAllowedOrigins());
});

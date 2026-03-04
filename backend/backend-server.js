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

// CORS — permite el frontend de Vercel y desarrollo local
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (Postman, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS no permitido para: ' + origin));
  },
  credentials: true,
}));

app.use(express.json());

// Health check — usado por Railway/Render para verificar que la app está viva
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/auth',            authRoutes);
app.use('/api/categories',      categoryRoutes);
app.use('/api/transactions',    transactionRoutes);
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/partnerships',    partnershipRoutes);
app.use('/api/accounts',        accountRoutes);
app.use('/api/shared-accounts', sharedAccountRoutes);

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => console.log(`✓ Server on port ${PORT} [${process.env.NODE_ENV}]`));

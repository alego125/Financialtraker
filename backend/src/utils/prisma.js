const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

// Do not retry individual statements after ambiguous connection failures:
// a write may already have committed. Retry whole aborted P2034 transactions only.
module.exports = prisma;

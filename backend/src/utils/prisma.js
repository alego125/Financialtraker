const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

// Reconexión automática ante errores de conexión cerrada (Neon cold start)
const withReconnect = (client) => {
  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err) {
      if (err.message?.includes('Closed') || err.message?.includes('Connection') || err.code === 'P1001' || err.code === 'P1002') {
        console.warn('Prisma: reconectando tras error de conexión...');
        await client.$disconnect();
        await client.$connect();
        return await next(params);
      }
      throw err;
    }
  });
  return client;
};

module.exports = withReconnect(prisma);

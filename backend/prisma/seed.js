const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@demo.com' },
    update: {},
    create: { name: 'Usuario Demo', email: 'demo@demo.com', passwordHash },
  });

  console.log(`✅ User: ${user.email}`);

  // Default accounts
  const accounts = await Promise.all([
    prisma.account.upsert({ where: { userId_name: { userId: user.id, name: 'Cuenta Bancaria' } }, update: {}, create: { name: 'Cuenta Bancaria', initialBalance: 5000, color: '#3b82f6', userId: user.id } }),
    prisma.account.upsert({ where: { userId_name: { userId: user.id, name: 'Efectivo' } }, update: {}, create: { name: 'Efectivo', initialBalance: 500, color: '#10b981', userId: user.id } }),
    prisma.account.upsert({ where: { userId_name: { userId: user.id, name: 'Billetera Virtual' } }, update: {}, create: { name: 'Billetera Virtual', initialBalance: 1000, color: '#8b5cf6', userId: user.id } }),
  ]);

  // Default categories
  const cats = await Promise.all([
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Salario' } }, update: {}, create: { name: 'Salario', type: 'INCOME', color: '#10b981', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Freelance' } }, update: {}, create: { name: 'Freelance', type: 'INCOME', color: '#06b6d4', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Inversiones' } }, update: {}, create: { name: 'Inversiones', type: 'INCOME', color: '#8b5cf6', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Alimentación' } }, update: {}, create: { name: 'Alimentación', type: 'EXPENSE', color: '#ef4444', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Transporte' } }, update: {}, create: { name: 'Transporte', type: 'EXPENSE', color: '#f97316', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Entretenimiento' } }, update: {}, create: { name: 'Entretenimiento', type: 'EXPENSE', color: '#ec4899', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Salud' } }, update: {}, create: { name: 'Salud', type: 'EXPENSE', color: '#14b8a6', userId: user.id } }),
    prisma.category.upsert({ where: { userId_name: { userId: user.id, name: 'Hogar' } }, update: {}, create: { name: 'Hogar', type: 'EXPENSE', color: '#a78bfa', userId: user.id } }),
  ]);

  const [salario, freelance, inversiones, alimentacion, transporte, entretenimiento, salud, hogar] = cats;
  const [banco, efectivo, billetera] = accounts;
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = m.getFullYear(); const mo = m.getMonth();
    await Promise.all([
      prisma.transaction.create({ data: { type: 'INCOME',  amount: 3500 + Math.random()*500,  date: new Date(y,mo,1),  categoryId: salario.id,         accountId: banco.id,      userId: user.id, comment: 'Salario mensual' } }),
      prisma.transaction.create({ data: { type: 'INCOME',  amount: 500  + Math.random()*1000, date: new Date(y,mo,10), categoryId: freelance.id,        accountId: billetera.id,  userId: user.id, comment: 'Proyecto web' } }),
      prisma.transaction.create({ data: { type: 'INCOME',  amount: 100  + Math.random()*300,  date: new Date(y,mo,20), categoryId: inversiones.id,      accountId: banco.id,      userId: user.id, comment: 'Dividendos' } }),
      prisma.transaction.create({ data: { type: 'EXPENSE', amount: 400  + Math.random()*200,  date: new Date(y,mo,5),  categoryId: alimentacion.id,     accountId: efectivo.id,   userId: user.id, comment: 'Supermercado' } }),
      prisma.transaction.create({ data: { type: 'EXPENSE', amount: 150  + Math.random()*100,  date: new Date(y,mo,8),  categoryId: transporte.id,       accountId: banco.id,      userId: user.id, comment: 'Combustible' } }),
      prisma.transaction.create({ data: { type: 'EXPENSE', amount: 80   + Math.random()*120,  date: new Date(y,mo,15), categoryId: entretenimiento.id,  accountId: billetera.id,  userId: user.id, comment: 'Streaming' } }),
      prisma.transaction.create({ data: { type: 'EXPENSE', amount: 200  + Math.random()*300,  date: new Date(y,mo,18), categoryId: hogar.id,            accountId: banco.id,      userId: user.id, comment: 'Servicios' } }),
      prisma.transaction.create({ data: { type: 'EXPENSE', amount: 50   + Math.random()*150,  date: new Date(y,mo,22), categoryId: salud.id,            accountId: efectivo.id,   userId: user.id, comment: 'Farmacia' } }),
    ]);
  }

  console.log('✅ Seed complete!');
  console.log('📧 demo@demo.com / demo1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());

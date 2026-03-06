const { validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const toNum = d => parseFloat(d?.toString() || '0');

const verifyPartnership = async (userId, partnerId) =>
  prisma.partnership.findFirst({
    where: { status:'ACCEPTED', OR:[{senderId:userId,receiverId:partnerId},{senderId:partnerId,receiverId:userId}] },
  });

const list = async (req, res, next) => {
  try {
    const accounts = await prisma.sharedAccount.findMany({
      where: { OR:[{userAId:req.userId},{userBId:req.userId}] },
      include: {
        userA: { select:{id:true,name:true,email:true} },
        userB: { select:{id:true,name:true,email:true} },
        transactions: { select:{type:true,amount:true,currency:true} },
        _count: { select:{transactions:true} },
      },
      orderBy: { createdAt:'asc' },
    });

    const result = accounts.map(a => {
      let ars = toNum(a.initialBalance), usd = toNum(a.initialBalanceUSD||0);
      for (const tx of a.transactions) {
        const amt = toNum(tx.amount);
        const isUSD = tx.currency === 'USD';
        if (tx.type==='INCOME') { isUSD?(usd+=amt):(ars+=amt); }
        else                    { isUSD?(usd-=amt):(ars-=amt); }
      }
      return {
        id:a.id, name:a.name, color:a.color,
        accountType: a.accountType || 'REGULAR',
        initialBalance: toNum(a.initialBalance),
        initialBalanceUSD: toNum(a.initialBalanceUSD||0),
        currentBalance: parseFloat(ars.toFixed(2)),
        currentBalanceUSD: parseFloat(usd.toFixed(2)),
        transactionCount: a._count.transactions,
        userA:a.userA, userB:a.userB,
        partner: a.userAId===req.userId ? a.userB : a.userA,
        createdAt: a.createdAt,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors:errors.array() });

    const { name, initialBalance=0, initialBalanceUSD=0, color, partnerId, accountType='REGULAR' } = req.body;
    if (!partnerId) return res.status(400).json({ error:'partnerId requerido' });

    const partnership = await verifyPartnership(req.userId, partnerId);
    if (!partnership) return res.status(403).json({ error:'No tenés un vínculo activo con ese usuario' });

    const account = await prisma.sharedAccount.create({
      data: {
        name, color:color||'#7c3aed',
        accountType,
        initialBalance: parseFloat(initialBalance),
        initialBalanceUSD: parseFloat(initialBalanceUSD||0),
        userAId:req.userId, userBId:partnerId,
      },
      include: { userA:{select:{id:true,name:true}}, userB:{select:{id:true,name:true}} },
    });
    res.status(201).json(account);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.sharedAccount.findFirst({
      where:{ id, OR:[{userAId:req.userId},{userBId:req.userId}] },
    });
    if (!account) return res.status(404).json({ error:'Cuenta compartida no encontrada' });
    const updated = await prisma.sharedAccount.update({
      where:{id},
      data:{
        ...(req.body.name!==undefined && {name:req.body.name}),
        ...(req.body.initialBalance!==undefined && {initialBalance:parseFloat(req.body.initialBalance)}),
        ...(req.body.initialBalanceUSD!==undefined && {initialBalanceUSD:parseFloat(req.body.initialBalanceUSD)}),
        ...(req.body.color!==undefined && {color:req.body.color}),
        ...(req.body.accountType!==undefined && {accountType:req.body.accountType}),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await prisma.sharedAccount.findFirst({
      where:{ id, OR:[{userAId:req.userId},{userBId:req.userId}] },
    });
    if (!account) return res.status(404).json({ error:'Cuenta compartida no encontrada' });
    const txCount = await prisma.transaction.count({ where:{sharedAccountId:id} });
    if (txCount>0) return res.status(400).json({ error:`No podés eliminar una cuenta con ${txCount} transacciones` });
    await prisma.sharedAccount.delete({ where:{id} });
    res.json({ message:'Cuenta compartida eliminada' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };

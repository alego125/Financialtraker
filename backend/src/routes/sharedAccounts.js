const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, update, remove, exchange } = require('../controllers/sharedAccounts.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', list);
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('partnerId').notEmpty().withMessage('partnerId requerido'),
  body('initialBalance').optional().isFloat(),
  body('initialBalanceUSD').optional().isFloat(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('accountType').optional().isIn(['REGULAR','INVESTMENT','CREDIT']),
], create);
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('initialBalance').optional().isFloat(),
  body('initialBalanceUSD').optional().isFloat(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('accountType').optional().isIn(['REGULAR','INVESTMENT','CREDIT']),
], update);
router.delete('/:id', remove);
router.post('/:id/exchange', [
  body('usdAmount').isFloat({ gt:0 }).withMessage('Monto USD inválido'),
  body('rate').isFloat({ gt:0 }).withMessage('Precio de compra inválido'),
  body('date').optional().isISO8601(),
], exchange);

module.exports = router;

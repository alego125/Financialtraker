const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, update, remove, exchange, listExchanges } = require('../controllers/accounts.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('initialBalance').optional().isFloat().withMessage('Saldo inicial inválido'),
  body('initialBalanceUSD').optional().isFloat().withMessage('Saldo USD inválido'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color hex inválido'),
  body('accountType').optional().isIn(['REGULAR', 'INVESTMENT', 'CREDIT']).withMessage('Tipo inválido'),
], create);
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('initialBalance').optional().isFloat(),
  body('initialBalanceUSD').optional().isFloat(),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('accountType').optional().isIn(['REGULAR', 'INVESTMENT', 'CREDIT']),
], update);
router.delete('/:id', remove);
router.get('/:id/exchanges', listExchanges);
router.post('/:id/exchange', [
  body('usdAmount').isFloat({ gt: 0 }).withMessage('Monto USD inválido'),
  body('rate').isFloat({ gt: 0 }).withMessage('Precio de compra inválido'),
  body('date').optional().isISO8601(),
], exchange);

module.exports = router;

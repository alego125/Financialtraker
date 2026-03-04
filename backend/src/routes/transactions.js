const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, update, remove, getOne } = require('../controllers/transactions.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

const txValidation = [
  body('type').isIn(['INCOME', 'EXPENSE']).withMessage('Tipo inválido'),
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
  body('date').isISO8601().withMessage('Fecha inválida'),
  body('categoryId').notEmpty().withMessage('Categoría requerida'),
];

router.get('/', list);
router.get('/:id', getOne);
router.post('/', txValidation, create);
router.put('/:id', [
  body('amount').optional().isFloat({ gt: 0 }),
  body('date').optional().isISO8601(),
  body('type').optional().isIn(['INCOME', 'EXPENSE']),
], update);
router.delete('/:id', remove);

module.exports = router;

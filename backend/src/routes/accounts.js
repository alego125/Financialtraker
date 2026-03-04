const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, update, remove } = require('../controllers/accounts.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('initialBalance').optional().isFloat({ min: 0 }).withMessage('Saldo inicial debe ser >= 0'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color hex inválido'),
], create);
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('initialBalance').optional().isFloat({ min: 0 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
], update);
router.delete('/:id', remove);

module.exports = router;

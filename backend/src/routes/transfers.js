const router = require('express').Router();
const { body } = require('express-validator');
const { list, create, cancel, remove } = require('../controllers/transfers.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', list);

router.post('/', [
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
  body('date').isISO8601().withMessage('Fecha inválida'),
], create);

router.post('/:id/cancel', cancel);

router.delete('/:id', remove);

module.exports = router;

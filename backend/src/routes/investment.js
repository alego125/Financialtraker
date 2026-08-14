const router = require('express').Router();
const { listPositions, createPosition, updatePosition, deletePosition } = require('../controllers/investment.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', listPositions);
router.post('/', createPosition);
router.put('/:id', updatePosition);
router.delete('/:id', deletePosition);

module.exports = router;

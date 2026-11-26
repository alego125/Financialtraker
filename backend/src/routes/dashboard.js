const router = require('express').Router();
const { getDashboard, getSharedDashboard } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');
const { getLiquidity } = require('../controllers/liquidity.controller');

router.use(authenticate);
router.get('/', getDashboard);
router.get('/liquidity', getLiquidity);
router.get('/shared/:partnerId', getSharedDashboard);

module.exports = router;

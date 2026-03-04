const router = require('express').Router();
const { getDashboard, getSharedDashboard } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', getDashboard);
router.get('/shared/:partnerId', getSharedDashboard);

module.exports = router;

const router = require('express').Router();
const { getAnalysis } = require('../controllers/analysis.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', getAnalysis);

module.exports = router;

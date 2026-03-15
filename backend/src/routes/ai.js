const router  = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { analyzeFinances } = require('../controllers/ai.controller');

router.use(authenticate);
router.post('/analyze', analyzeFinances);

module.exports = router;

const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { rateLimit } = require('../middlewares/security');
const { analyzeFinances } = require('../controllers/ai.controller');
router.use(authenticate);
router.post('/analyze', rateLimit({ max: 10, windowMs: 3600000 }), analyzeFinances);
module.exports = router;

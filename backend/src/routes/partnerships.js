const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const {
  sendInvitation,
  listPartnerships,
  respondInvitation,
  removePartnership,
  getPartnerData,
  getPartnerDashboard,
} = require('../controllers/partnership.controller');

router.use(authenticate);

router.get('/',                              listPartnerships);
router.post('/',                             sendInvitation);
router.patch('/:id/respond',                 respondInvitation);
router.delete('/:id',                        removePartnership);
router.get('/partner/:partnerId/transactions', getPartnerData);
router.get('/partner/:partnerId/dashboard',   getPartnerDashboard);

module.exports = router;

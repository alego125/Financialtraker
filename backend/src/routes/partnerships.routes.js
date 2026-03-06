const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const {
  sendInvitation, listPartnerships, respondInvitation,
  removePartnership, getPartnerData, getPartnerAccounts,
  getPartnerSolo, getPartnerDashboard,
} = require('../controllers/partnership.controller');

router.use(authenticate);
router.get('/',                                listPartnerships);
router.post('/',                               sendInvitation);
router.patch('/:id/respond',                   respondInvitation);
router.delete('/:id',                          removePartnership);
router.get('/partner/:partnerId/transactions', getPartnerData);
router.get('/partner/:partnerId/accounts',     getPartnerAccounts);
router.get('/partner/:partnerId/solo',         getPartnerSolo);      // ← "Solo sus finanzas"
router.get('/partner/:partnerId/dashboard',    getPartnerDashboard); // ← "Dashboard conjunto"

module.exports = router;

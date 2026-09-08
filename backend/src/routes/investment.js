const router = require('express').Router();
const {
  listPositions, createPosition, updatePosition, deletePosition,
  listAssets, createAsset, updateAsset, deleteAsset,
  listOperations, createOperation, updateOperation, deleteOperation,
  getBoard,
} = require('../controllers/investment.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

// Legacy positions (kept for backward compatibility)
router.get('/', listPositions);
router.post('/', createPosition);
router.put('/:id', updatePosition);
router.delete('/:id', deletePosition);

// Asset catalog
router.get('/assets', listAssets);
router.post('/assets', createAsset);
router.put('/assets/:id', updateAsset);
router.delete('/assets/:id', deleteAsset);

// Buy/sell operations
router.get('/operations', listOperations);
router.post('/operations', createOperation);
router.put('/operations/:id', updateOperation);
router.delete('/operations/:id', deleteOperation);

// Board (positions grouped by asset + account)
router.get('/board', getBoard);

module.exports = router;

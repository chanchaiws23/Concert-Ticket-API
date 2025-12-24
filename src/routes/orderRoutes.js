const express = require('express');
const router = express.Router();
const { getMyOrders, purchaseTickets } = require('../controllers/orderController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/purchase', authenticateToken, purchaseTickets);
router.get('/my-orders', authenticateToken, getMyOrders);

module.exports = router;
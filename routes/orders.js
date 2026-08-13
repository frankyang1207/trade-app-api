const router = require('express').Router();
const middleware = require('../middleware/middleware');
const order_service = require('../services/orders');

// Create order record after Stripe success
router.post('/api/v1/orders/confirm', middleware.authenticateToken, order_service.confirmOrder);

// Order history for current user
router.get('/api/v1/orders', middleware.authenticateToken, order_service.getMyOrders);

// Single order detail for current user
router.get('/api/v1/orders/:order_id', middleware.authenticateToken, order_service.getMyOrderDetail);

module.exports = router;
// Libraries
const router = require('express').Router();
const product_service = require('../services/products');
const middleware = require('../middleware/middleware');

/**
 * Product Routes
 */

// Fetch all products
router.get('/api/v1/products',  product_service.getProducts);

// Fetch single product by ID
router.get('/api/v1/product/:product_id', product_service.getProduct);

// Create product (protected)
router.post('/api/v1/product', middleware.authenticateToken, product_service.createProduct);

// Update product by ID (protected)
router.put('/api/v1/product/:product_id', middleware.authenticateToken, product_service.updateProduct);

// Delete product by ID (protected)
router.delete('/api/v1/product/:product_id', middleware.authenticateToken, product_service.deleteProduct);


module.exports = router;
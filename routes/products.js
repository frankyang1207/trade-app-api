const router = require('express').Router();
const product_service = require('../services/products');
const middleware = require('../middleware/middleware');


router.get('/products',  product_service.getProducts);
router.get('/product/:product_id', product_service.getProduct);
router.post('/product', middleware.authenticateToken, product_service.createProduct);
router.put('/product', middleware.authenticateToken, product_service.updateProduct);
router.delete('/product', middleware.authenticateToken, product_service.deleteProduct);


module.exports = router;
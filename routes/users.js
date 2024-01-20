const router = require('express').Router();
const user_service = require('../services/users');
const middleware = require('../middleware/middleware');


router.get('/users', middleware.authenticateToken, user_service.getUsers);
router.get('/user/:user_id', middleware.authenticateToken, user_service.getUser);
router.post('/user', user_service.createUser);
router.put('/user', middleware.authenticateToken, user_service.updateUser);
router.delete('/user', middleware.authenticateToken, user_service.deleteUser);
router.post('/login', user_service.login);
router.post('/token', user_service.token);
router.delete('/logout', user_service.logout);

module.exports = router;
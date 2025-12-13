// Libraries
const router = require('express').Router();
const user_service = require('../services/users');
const middleware = require('../middleware/middleware');

/**
 * User Routes
 */

// Fetch all users (protected)
router.get('/api/v1/users', middleware.authenticateToken, user_service.getUsers);

// Fetch single user by ID (protected)
router.get('/api/v1/user/:user_id', middleware.authenticateToken, user_service.getUser);

// Create a new user (public)
router.post('/api/v1/user', user_service.createUser);

// Update user by ID (protected)
router.put('/api/v1/user/:user_id', middleware.authenticateToken, user_service.updateUser);

// Delete user by ID (protected)
router.delete('/api/v1/user/:user_id', middleware.authenticateToken, user_service.deleteUser);

// User login → returns jwt tokens
router.post('/api/v1/auth/login', user_service.login);

// Token refresh endpoint
router.post('/api/v1/auth/token', user_service.token);

// User logout → invalidate refresh token/session
router.delete('/api/v1/auth/logout', user_service.logout);

module.exports = router;
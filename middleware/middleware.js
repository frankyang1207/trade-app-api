const jwt = require('jsonwebtoken');
/**
 * Express middleware for authenticating requests using a Bearer JWT.
 * @function authenticateToken
 * @param {import('express').Request} request - Express request object
 * @param {import('express').Response} response - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 */

const authenticateToken = (request, response, next) => {
    // Extract the Authorization header (format: "Bearer <token>")
    const authHeader = request.headers['authorization'];

    // If the header exists, split by space and take the token part
    const token = authHeader && authHeader.split(' ')[1];
    
    // If no token is provided, return 401 Unauthorized
    if (!token) return response.status(401).json({ error: 'Missing Bearer token' });

    // Verify the token using the secret key
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, user) => {
        // If verification fails, return 403 Forbidden
        if (error) return response.status(403).json({ error: 'Invalid or expired token' });

        // If valid, attach the decoded payload to request.user
        request.user = user;

        // Proceed to the next middleware or route handler
        next();
    })
}

module.exports = {
    authenticateToken,
}
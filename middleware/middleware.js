const jwt = require('jsonwebtoken');

const authenticateToken = (request, response, next) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return response.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, user) => {
        if (error) return response.status(403).send(error.message);
        request.user = user;
        next();
    })
}

module.exports = {
    authenticateToken,
}
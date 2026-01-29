const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_KEY';

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    // .toLowerCase() lagane se 'ADMIN' aur 'admin' dono sahi mane jayenge
    if (req.user && req.user.role.toLowerCase() === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    
};

module.exports = {  authenticate, isAdmin};
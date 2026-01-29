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
        // Token ke andar ka saara data (id, role, etc.) req.user mein aa jayega
        req.user = decoded; 
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    // Ye console.log aapko Render ke logs mein bata dega ki token mein kya hai
    console.log("Debug Token User:", req.user);

    if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            error: 'Access denied. Admins only.',
            received_role: req.user ? req.user.role : "None"
        });
    }
};

module.exports = { authenticate, isAdmin };
module.exports = {  authenticate, isAdmin};
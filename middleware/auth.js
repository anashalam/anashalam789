const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_KEY';

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

   // Jahan login success hota hai wahan aisa hona chahiye:
const token = jwt.sign(
    { 
        id: user.id, 
        email: user.email, 
        role: user.role // 👈 Ye line hona MUST hai!
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    console.log("Token Data:", req.user); // 👈 Ye add karein
    
    if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            error: 'Access denied. Admins only.',
            receivedRole: req.user ? req.user.role : 'No Role Found' 
        });
    }
    
};

module.exports = {  authenticate, isAdmin};
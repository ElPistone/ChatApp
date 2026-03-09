const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔐 Token décodé:', decoded);
        
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ Erreur vérification token:', error);
        res.status(401).json({ message: 'Token invalide' });
    }
};
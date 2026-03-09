const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // Récupérer le token du header Authorization
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                message: 'Accès non autorisé. Veuillez vous authentifier.' 
            });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Ajouter les infos du user à la requête
        req.user = decoded;
        
        // Passer au prochain middleware/route
        next();
        
    } catch (error) {
        res.status(401).json({ 
            message: 'Authentification invalide ou expirée' 
        });
    }
};
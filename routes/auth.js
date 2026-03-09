const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Route d'inscription
router.post('/register', async (req, res) => {
    try {
        const { phoneNumber, password, name } = req.body;

        // LOG : Voir ce qui est reçu
        console.log('📝 Tentative d\'inscription:', {
            phoneNumber,
            name,
            passwordLength: password?.length
        });

        // Vérifier si tous les champs sont présents
        if (!phoneNumber || !password || !name) {
            return res.status(400).json({ 
                message: 'Tous les champs sont requis' 
            });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
            console.log('❌ Utilisateur existe déjà:', phoneNumber);
            return res.status(400).json({ 
                message: 'Ce numéro de téléphone est déjà utilisé' 
            });
        }

        // Hacher le mot de passe
        console.log('🔐 Hachage du mot de passe...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('✅ Mot de passe haché');

        // Créer le nouvel utilisateur
        const user = new User({
            phoneNumber,
            password: hashedPassword,
            name
        });

        await user.save();
        console.log('✅ Utilisateur créé avec ID:', user._id);

        // Créer le token
        const token = jwt.sign(
            { 
                userId: user._id,
                phoneNumber: user.phoneNumber,
                name: user.name 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token,
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                name: user.name,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({ 
            message: 'Erreur lors de l\'inscription' 
        });
    }
});
// Route de connexion
router.post('/login', async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        // LOG 1 : Voir ce qui est reçu
        console.log('📝 Tentative de connexion:', { 
            phoneNumber: phoneNumber, 
            passwordLength: password?.length 
        });

        // Vérifier si les champs sont présents
        if (!phoneNumber || !password) {
            console.log('❌ Champs manquants');
            return res.status(400).json({ 
                message: 'Numéro et mot de passe requis' 
            });
        }

        // LOG 2 : Chercher l'utilisateur
        console.log('🔍 Recherche utilisateur avec le numéro:', phoneNumber);
        const user = await User.findOne({ phoneNumber });
        
        if (!user) {
            console.log('❌ Utilisateur non trouvé');
            return res.status(401).json({ 
                message: 'Numéro ou mot de passe incorrect' 
            });
        }

        console.log('✅ Utilisateur trouvé:', {
            id: user._id,
            phoneNumber: user.phoneNumber,
            name: user.name
        });

        // LOG 3 : Vérifier le mot de passe
        console.log('🔐 Vérification du mot de passe...');
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('🔐 Résultat comparaison:', isMatch);

        if (!isMatch) {
            console.log('❌ Mot de passe incorrect');
            return res.status(401).json({ 
                message: 'Numéro ou mot de passe incorrect' 
            });
        }

        console.log('✅ Mot de passe correct, connexion réussie');

        // Mettre à jour le statut et lastSeen
        user.status = 'online';
        user.lastSeen = new Date();
        await user.save();

        // Créer le token
        const token = jwt.sign(
            { 
                userId: user._id,
                phoneNumber: user.phoneNumber,
                name: user.name 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Renvoyer les infos
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                name: user.name,
                avatar: user.avatar,
                status: user.status
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la connexion' 
        });
    }
});

// Route pour vérifier le token (utile au démarrage de l'app)
router.get('/verify', require('../middleware/auth'), async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json({ user });
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
});

module.exports = router;
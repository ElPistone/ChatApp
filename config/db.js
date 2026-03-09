const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connexion à MongoDB réussie !');
        
        // Gérer les événements de connexion
        mongoose.connection.on('error', (err) => {
            console.error('❌ Erreur de connexion à MongoDB:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ Déconnexion de MongoDB');
        });
        
    } catch (error) {
        console.error('❌ Erreur de connexion à MongoDB:', error.message);
        process.exit(1); // Arrête l'application si pas de DB
    }
};

module.exports = connectDB;
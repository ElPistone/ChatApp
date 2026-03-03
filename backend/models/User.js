const mongoose = require('mongoose');

// Schéma pour l'utilisateur
const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis !'],
        unique: true, // Pas deux fois le même numéro
        trim: true, // Enlève les espaces
        match: [/^[0-9+\-\s]+$/, 'Format de numéro invalide'] // Validation simple
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis !'],
        minlength: [10, 'Le mot de passe doit faire au moins 10 caractères (question de sécurité)!']
    },
    name: {
        type: String,
        required: [true, 'Le nom est obligatoire !'],
        trim: true
    },
    avatar: {
        type: String,
        default: null // URL de l'avatar (optionnel)
    },
    status: {
        type: String,
        enum: ['en ligne', 'hors ligne'],
        default: 'hors ligne'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

// On exporte le modèle pour l'utiliser ailleurs
module.exports = mongoose.model('User', userSchema);
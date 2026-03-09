const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: String, // On stocke les numéros de téléphone
        required: true
    }],
    lastMessage: {
        text: String,
        sender: String,
        timestamp: Date,
        type: {
            type: String,
            enum: ['texte', 'audio', 'video', 'fichier'],
            default: 'texte'
        }
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: new Map()
    }
}, {
    timestamps: true // Pour avoir updatedAt automatiquement
});

// Index pour rechercher rapidement les conversations d'un user
conversationSchema.index({ participants: 1 });

// Index composé unique pour éviter les doublons de conversations entre 2 personnes
conversationSchema.index({ participants: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
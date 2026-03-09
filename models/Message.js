const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['texte', 'audio', 'video', 'fichier'],
        required: true
    },
    content: {
        type: String, // Pour les messages texte, ou description pour les fichiers
        default: ''
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId, // Référence vers GridFS
        default: null
    },
    fileName: String,
    fileSize: Number,
    mimeType: String,
    status: {
        type: String,
        enum: ['envoyé', 'délivré', 'lu'],
        default: 'envoyé'
    },
    readBy: [{
        user: String,
        readAt: Date
    }],
    reactions: [{ // Réactions aux messages
        user: String,
        emoji: String
    }]
}, {
    timestamps: true
});

// Index pour retrouver rapidement les messages d'une conversation
messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
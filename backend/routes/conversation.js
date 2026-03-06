const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const conversationController = require('../controllers/ConversationController');

// Toutes les routes nécessitent d'être authentifié
router.use(auth);

// Routes pour les conversations
router.get('/', conversationController.getUserConversations);
router.get('/:conversationId/messages', conversationController.getConversationMessages);
router.post('/with/:targetUserId', conversationController.getOrCreateConversation);
router.post('/message', conversationController.sendMessage);

module.exports = router;
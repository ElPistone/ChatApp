const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Récupérer toutes les conversations d'un utilisateur
exports.getUserConversations = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Trouver toutes les conversations où l'utilisateur participe
        const conversations = await Conversation.find({
            participants: userId
        }).sort({ updatedAt: -1 }); // Plus récent en premier

        // Pour chaque conversation, récupérer les infos de l'autre participant
        const conversationsWithDetails = await Promise.all(
            conversations.map(async (conv) => {
                // Trouver l'autre participant (celui qui n'est pas l'utilisateur courant)
                const otherParticipantId = conv.participants.find(
                    p => p.toString() !== userId.toString()
                );

                // Récupérer les infos de l'autre utilisateur
                const otherUser = await User.findById(otherParticipantId)
                    .select('name phoneNumber avatar status lastSeen');

                // Récupérer le dernier message
                const lastMessage = await Message.findOne({
                    conversationId: conv._id
                }).sort({ createdAt: -1 });

                return {
                    _id: conv._id,
                    participant: otherUser,
                    lastMessage: lastMessage,
                    unreadCount: conv.unreadCount?.get(userId.toString()) || 0,
                    updatedAt: conv.updatedAt
                };
            })
        );

        res.json(conversationsWithDetails);

    } catch (error) {
        console.error('Erreur récupération conversations:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des conversations' 
        });
    }
};

// Créer ou récupérer une conversation avec un utilisateur
exports.getOrCreateConversation = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { targetUserId } = req.params;

        // Vérifier que l'utilisateur cible existe
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Chercher une conversation existante entre les deux
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, targetUserId] }
        });

        // Si pas de conversation, en créer une nouvelle
        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, targetUserId],
                unreadCount: new Map([
                    [userId.toString(), 0],
                    [targetUserId.toString(), 0]
                ])
            });
            await conversation.save();
        }

        res.json(conversation);

    } catch (error) {
        console.error('Erreur création conversation:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la création de la conversation' 
        });
    }
};

// Récupérer les messages d'une conversation
exports.getConversationMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Vérifier que l'utilisateur a accès à cette conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(403).json({ 
                message: 'Accès non autorisé à cette conversation' 
            });
        }

        // Récupérer les messages avec pagination
        const messages = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: 1 }); // Remettre dans l'ordre chronologique

        // Marquer les messages comme lus
        await Message.updateMany(
            { 
                conversationId, 
                'readBy.user': { $ne: userId },
                sender: { $ne: userId }
            },
            { 
                $addToSet: { 
                    readBy: { user: userId, readAt: new Date() } 
                },
                status: 'read'
            }
        );

        // Mettre à jour le compteur de messages non lus
        if (conversation.unreadCount) {
            conversation.unreadCount.set(userId.toString(), 0);
            await conversation.save();
        }

        res.json({
            messages,
            currentPage: parseInt(page),
            hasMore: messages.length === parseInt(limit)
        });

    } catch (error) {
        console.error('Erreur récupération messages:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des messages' 
        });
    }
};

// Envoyer un message (via HTTP, mais on utilisera surtout Socket.io)
exports.sendMessage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { conversationId, type, content, fileId, fileName, fileSize, mimeType } = req.body;

        // Vérifier que la conversation existe et que l'utilisateur y participe
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(403).json({ 
                message: 'Conversation non trouvée ou accès non autorisé' 
            });
        }

        // Créer le message
        const message = new Message({
            conversationId,
            sender: userId,
            type,
            content,
            fileId,
            fileName,
            fileSize,
            mimeType,
            readBy: [{ user: userId, readAt: new Date() }]
        });

        await message.save();

        // Mettre à jour la conversation
        conversation.lastMessage = {
            text: type === 'text' ? content : `[${type}]`,
            sender: userId,
            timestamp: new Date(),
            type
        };
        conversation.updatedAt = new Date();

        // Incrémenter le compteur de non-lus pour l'autre participant
        const otherParticipant = conversation.participants.find(
            p => p.toString() !== userId.toString()
        );
        const currentCount = conversation.unreadCount?.get(otherParticipant.toString()) || 0;
        conversation.unreadCount.set(otherParticipant.toString(), currentCount + 1);

        await conversation.save();

        // Peupler les informations de l'expéditeur
        await message.populate('sender', 'name phoneNumber avatar');

        res.status(201).json(message);

    } catch (error) {
        console.error('Erreur envoi message:', error);
        res.status(500).json({ 
            message: 'Erreur lors de l\'envoi du message' 
        });
    }
};
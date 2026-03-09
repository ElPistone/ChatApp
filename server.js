const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const User = require('./models/User');
const auth = require('./middleware/auth');

// Charger les variables d'environnement
dotenv.config();

// Connexion à MongoDB
connectDB();

// Initialiser Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.send('API de chat en ligne !');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/file'));
app.use('/api/conversations', require('./routes/conversation'));

// Route pour chercher des utilisateurs par numéro
app.get('/api/users/search/:phoneNumber', auth, async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const currentUserId = req.user.userId;
        
        console.log('🔍 RECHERCHE - Numéro recherché:', phoneNumber);
        
        // Nettoyer le numéro pour la recherche
        const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
        
        if (cleanNumber.length < 3) {
            return res.json([]);
        }
        
        // Chercher les utilisateurs dont le numéro contient la recherche
        const users = await User.find({
            phoneNumber: { $regex: cleanNumber, $options: 'i' },
            _id: { $ne: currentUserId }
        }).select('name phoneNumber avatar status lastSeen').limit(10);
        
        console.log('🔍 RECHERCHE - Utilisateurs trouvés:', users.length);
        
        res.json(users);
    } catch (error) {
        console.error('❌ RECHERCHE - Erreur:', error);
        res.status(500).json({ message: 'Erreur lors de la recherche' });
    }
});

// Route de test pour vérification
app.get('/api/protected', auth, (req, res) => {
    res.json({ 
        message: 'Accès à la route protégée réussi !', 
        user: req.user 
    });
});

// Route temporaire pour debug
app.get('/api/debug/conversations/:userId', auth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversation.find({
            participants: userId
        });
        
        res.json({
            count: conversations.length,
            conversations: conversations.map(c => ({
                id: c._id.toString(),
                participants: c.participants.map(p => p.toString())
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Créer le serveur HTTP
const server = http.createServer(app);

// Configurer Socket.io
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Gérer les connexions Socket.io
io.on('connection', (socket) => {
    console.log('🔵 Nouveau client connecté:', socket.id);
    
    // Authentification du socket
    socket.on('authenticate', (userId) => {
        console.log('🔐 Authentification socket - userId reçu:', userId);
        
        if (!userId) {
            console.log('❌ userId null ou undefined');
            return;
        }
        
        socket.userId = userId;
        socket.join(userId);
        console.log(`👤 Utilisateur ${userId} authentifié sur socket ${socket.id}`);
        
        // Mettre à jour le statut dans la DB
        User.findByIdAndUpdate(userId, { 
            status: 'online',
            lastSeen: new Date()
        }).then(() => {
            socket.broadcast.emit('userStatus', {
                userId: userId,
                status: 'online'
            });
        }).catch(err => {
            console.error('Erreur mise à jour statut:', err);
        });
    });

    // Rejoindre une conversation
    socket.on('joinConversation', (conversationId) => {
        if (!socket.userId) {
            console.log('❌ Tentative de rejoindre conversation sans authentification');
            return;
        }
        socket.join(`conversation:${conversationId}`);
        console.log(`👥 Utilisateur ${socket.userId} a rejoint la conversation ${conversationId}`);
    });
    
    // Quitter une conversation
    socket.on('leaveConversation', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`👋 Utilisateur ${socket.userId} a quitté la conversation ${conversationId}`);
    });
    
    // Envoyer un message
    socket.on('sendMessage', async (data) => {
        console.log('📥 MESSAGE REÇU:', data);
        console.log('📥 De l\'utilisateur:', socket.userId);
        
        try {
            const { conversationId, type, content, fileId, fileName, fileSize, mimeType } = data;
            const senderId = socket.userId;
            
            if (!senderId) {
                console.log('❌ Utilisateur non authentifié');
                socket.emit('error', { message: 'Vous devez être connecté' });
                return;
            }
            
            // Vérifier que la conversation existe
            const conversation = await Conversation.findById(conversationId);
            
            if (!conversation) {
                console.log('❌ Conversation non trouvée');
                socket.emit('error', { message: 'Conversation non trouvée' });
                return;
            }
            
            // Vérifier que l'utilisateur est participant
            if (!conversation.participants.includes(senderId)) {
                console.log('❌ Utilisateur non participant');
                socket.emit('error', { message: 'Vous n\'êtes pas participant à cette conversation' });
                return;
            }
            
            // Créer le message
            const message = new Message({
                conversationId,
                sender: senderId,
                type,
                content: content || '',
                fileId: fileId || null,
                fileName: fileName || null,
                fileSize: fileSize || null,
                mimeType: mimeType || null,
                status: 'envoyé',
                readBy: [{ user: senderId, readAt: new Date() }],
                createdAt: new Date()
            });
            
            await message.save();
            console.log('💾 Message sauvegardé:', message._id);
            
            // Récupérer l'utilisateur pour les infos du sender
            const sender = await User.findById(senderId).select('name');
            
            const messageData = {
                _id: message._id,
                conversationId: message.conversationId,
                sender: {
                    _id: senderId,
                    name: sender.name
                },
                type: message.type,
                content: message.content,
                fileId: message.fileId,
                fileName: message.fileName,
                fileSize: message.fileSize,
                mimeType: message.mimeType,
                status: message.status,
                readBy: message.readBy,
                createdAt: message.createdAt
            };
            
            // Émettre le message à la conversation
            console.log('📤 Émission du message à la conversation:', conversationId);
            io.to(`conversation:${conversationId}`).emit('newMessage', messageData);
            
            // Mettre à jour la dernière conversation
            conversation.lastMessage = {
                text: type === 'texte' ? content : `📎 ${fileName || 'fichier'}`,
                timestamp: new Date(),
                sender: senderId
            };
            conversation.updatedAt = new Date();
            
            // Incrémenter le compteur de non-lus pour l'autre participant
            const otherParticipant = conversation.participants.find(
                p => p.toString() !== senderId.toString()
            );
            
            if (otherParticipant) {
                const unreadMap = conversation.unreadCount || new Map();
                const currentCount = unreadMap.get(otherParticipant.toString()) || 0;
                unreadMap.set(otherParticipant.toString(), currentCount + 1);
                conversation.unreadCount = unreadMap;
            }
            
            await conversation.save();
            
            // Notifier l'autre participant
            if (otherParticipant) {
                io.to(otherParticipant.toString()).emit('conversationUpdated', {
                    conversationId,
                    lastMessage: messageData
                });
            }
            
        } catch (error) {
            console.error('❌ Erreur envoi message socket:', error);
            socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
        }
    });
    
    // Marquer les messages comme lus
    socket.on('markAsRead', async ({ conversationId }) => {
        try {
            const userId = socket.userId;
            
            if (!userId || !conversationId) return;
            
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
                    status: 'lu'
                }
            );
            
            // Mettre à jour le compteur
            const conversation = await Conversation.findById(conversationId);
            if (conversation && conversation.unreadCount) {
                conversation.unreadCount.set(userId.toString(), 0);
                await conversation.save();
            }
            
            // Notifier l'autre participant
            socket.to(`conversation:${conversationId}`).emit('messagesRead', {
                conversationId,
                userId
            });
            
        } catch (error) {
            console.error('Erreur marquage lecture:', error);
        }
    });
    
    // L'utilisateur tape...
    socket.on('typing', ({ conversationId, isTyping }) => {
        if (!socket.userId || !conversationId) return;
        
        socket.to(`conversation:${conversationId}`).emit('userTyping', {
            userId: socket.userId,
            conversationId,
            isTyping
        });
    });
    
    // Déconnexion
    socket.on('disconnect', async () => {
        console.log('🔴 Client déconnecté:', socket.id);
        if (socket.userId) {
            try {
                await User.findByIdAndUpdate(socket.userId, { 
                    status: 'offline',
                    lastSeen: new Date()
                });
                
                socket.broadcast.emit('userStatus', {
                    userId: socket.userId,
                    status: 'offline',
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Erreur mise à jour statut déconnexion:', error);
            }
        }
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📡 WebSocket prêt à l'adresse ws://localhost:${PORT}`);
});
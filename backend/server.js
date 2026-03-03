const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Charger les variables d'environnement
dotenv.config();

// Connexion à MongoDB
connectDB();

// Initialiser Express
const app = express();

// Middleware
app.use(cors()); // Permet au frontend de communiquer
app.use(express.json()); // Pour lire les JSON dans les requêtes
app.use(express.urlencoded({ extended: true })); // Pour lire les formulaires

// Servir les fichiers statiques 
app.use(express.static('public'));

// Routes 
app.get('/', (req, res) => {
    res.send('API de chat en ligne !');
});

// Créer le serveur HTTP
const server = http.createServer(app);

// Configurer Socket.io
const io = socketIO(server, {
    cors: {
        origin: "*", // En dev, on autorise tout
        methods: ["GET", "POST"]
    }
});

// Gérer les connexions Socket.io
io.on('connection', (socket) => {
    console.log('🔵 Nouveau client connecté:', socket.id);
    
    // Quand un utilisateur s'authentifie via socket
    socket.on('authenticate', (userId) => {
        socket.userId = userId;
        socket.join(userId); // Rejoindre une room avec son userId
        console.log(`👤 Utilisateur ${userId} authentifié sur socket ${socket.id}`);
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        console.log('🔴 Client déconnecté:', socket.id);
        if (socket.userId) {
            // Mettre à jour le statut offline dans la DB
            // On fera ça plus tard
        }
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📡 WebSocket prêt à l'adresse ws://localhost:${PORT}`);
});
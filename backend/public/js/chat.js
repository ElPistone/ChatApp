// Configuration
const API_URL = '';
const SOCKET_URL = window.location.origin;

// État de l'application
let currentUser = null;
let currentToken = null;
let currentConversation = null;
let conversations = [];
let socket = null;
let typingTimeout = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Vérifier si l'utilisateur est déjà connecté
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                currentToken = token;
                showChatInterface();
                initSocket();
                loadConversations();
            } else {
                localStorage.removeItem('token');
                showAuthInterface();
            }
        } catch (error) {
            console.error('Erreur vérification auth:', error);
            showAuthInterface();
        }
    } else {
        showAuthInterface();
    }
}

// Initialiser Socket.io
function initSocket() {
    console.log('🔌 Initialisation socket avec userId:', currentUser._id);
    
    if (socket) {
        socket.disconnect();
    }
    
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur WebSocket');
        socket.emit('authenticate', currentUser._id);
    });
    
    socket.on('newMessage', (message) => {
        console.log('📩 NOUVEAU MESSAGE REÇU:', message);
        handleNewMessage(message);
    });
    
    socket.on('userStatus', (data) => {
        handleUserStatus(data);
    });
    
    socket.on('userTyping', (data) => {
        handleUserTyping(data);
    });
    
    socket.on('messagesRead', (data) => {
        handleMessagesRead(data);
    });
    
    socket.on('conversationUpdated', (data) => {
        handleConversationUpdated(data);
    });
    
    socket.on('error', (error) => {
        console.error('❌ Erreur socket:', error);
        showToast(error.message, 'error');
    });
    
    socket.onAny((event, ...args) => {
        console.log('📡 Événement socket:', event, args);
    });
}


// Afficher l'interface d'authentification
function showAuthInterface() {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('chat-page').style.display = 'none';
}

// Afficher l'interface de chat
function showChatInterface() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('chat-page').style.display = 'flex';
    document.getElementById('current-user-name').textContent = currentUser.name;
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    // Auth
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('register-btn').addEventListener('click', register);
    
    // Chat
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('search-input').addEventListener('input', searchUsers);
    document.getElementById('message-input').addEventListener('input', handleTyping);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('attach-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', uploadFile);
}

// Auth functions
function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

async function login() {
    const phoneNumber = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    
    if (!phoneNumber || !password) {
        showToast('Veuillez remplir tous les champs', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentToken = data.token;
            localStorage.setItem('token', currentToken);
            
            console.log('👤 Utilisateur connecté:', currentUser); 
            
            showToast('Connexion réussie !', 'success');
            
            setTimeout(() => {
                showChatInterface();
                initSocket(); // Ici currentUser._id doit être défini
                loadConversations();
            }, 500);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur de connexion au serveur', 'error');
    }
}

async function register() {
    const name = document.getElementById('register-name').value;
    const phoneNumber = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phoneNumber, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAuthSuccess('Inscription réussie ! Vous pouvez vous connecter.');
            showLogin();
        } else {
            showAuthError(data.message);
        }
    } catch (error) {
        showAuthError('Erreur de connexion au serveur');
    }
}

function logout() {
    localStorage.removeItem('token');
    if (socket) {
        socket.disconnect();
    }
    currentUser = null;
    currentToken = null;
    currentConversation = null;
    showAuthInterface();
}

// Charger les conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            conversations = await response.json();
            displayConversations();
        }
    } catch (error) {
        console.error('Erreur chargement conversations:', error);
    }
}

// Afficher les conversations
function displayConversations() {
    const container = document.getElementById('conversations-list');
    container.innerHTML = '';
    
    conversations.forEach(conv => {
        const lastMessage = conv.lastMessage?.text || 'Aucun message';
        const time = conv.lastMessage?.timestamp 
            ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        
        const div = document.createElement('div');
        div.className = `conversation-item ${currentConversation?._id === conv._id ? 'active' : ''}`;
        div.onclick = () => selectConversation(conv);
        
        div.innerHTML = `
            <div class="conversation-avatar">${conv.participant.name.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.participant.name}</div>
                <div class="conversation-last-message">${lastMessage}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${time}</div>
                ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Sélectionner une conversation
async function selectConversation(conversation) {
    console.log('Sélection conversation:', conversation);
    console.log('ID conversation:', conversation._id);
    
    currentConversation = conversation;
    
    // Mettre à jour l'UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Afficher l'en-tête du chat
    document.getElementById('chat-header-name').textContent = conversation.participant.name;
    document.getElementById('chat-header-status').textContent = conversation.participant.status === 'online' ? 'En ligne' : 'Hors ligne';
    document.getElementById('chat-header-status').className = `chat-header-status ${conversation.participant.status}`;
    
    // Rejoindre la conversation via socket
    console.log('Rejoindre conversation avec ID:', conversation._id);
    socket.emit('joinConversation', conversation._id);
    
    // Charger les messages
    await loadMessages(conversation._id);
    
    // Activer l'input
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('attach-btn').disabled = false;
}

// Charger les messages d'une conversation
async function loadMessages(conversationId) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}/messages`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayMessages(data.messages);
            
            // Marquer comme lus
            socket.emit('markAsRead', { conversationId });
        }
    } catch (error) {
        console.error('Erreur chargement messages:', error);
    }
}

// Afficher les messages
function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageEl = createMessageElement(message);
        container.appendChild(messageEl);
    });
    
    container.scrollTop = container.scrollHeight;
}

// Créer un élément message
function createMessageElement(message) {
    console.log('Création élément message:', message);
    
    const div = document.createElement('div');
    div.className = `message ${message.sender._id === currentUser._id ? 'own' : ''}`;
    
    const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHtml = '';
    if (message.type === 'texte') {
        contentHtml = `<div class="message-text">${message.content}</div>`;
    } else {
        const fileIcon = getFileIcon(message.fileName || message.type);
        const fileSize = message.fileSize ? formatFileSize(message.fileSize) : '';
        
        contentHtml = `
            <div class="file-message">
                <div class="file-icon">${fileIcon}</div>
                <div class="file-info">
                    <div class="file-name">${message.fileName || message.type}</div>
                    ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                </div>
                <button class="download-btn" onclick="downloadFile('${message.fileId}', '${message.fileName}')">Télécharger</button>
            </div>
        `;
    }
    
    div.innerHTML = `
        <div class="message-content">
            ${message.sender._id !== currentUser._id ? `<div class="message-sender">${message.sender.name}</div>` : ''}
            ${contentHtml}
            <div class="message-time">${time}</div>
        </div>
    `;
    
    return div;
}

// Envoyer un message
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    console.log('📤 Tentative d\'envoi:', { content, currentConversation });
    
    if (!content || !currentConversation) {
        console.log('❌ Pas de contenu ou pas de conversation sélectionnée');
        return;
    }
    
    if (!socket || !socket.connected) {
        console.log('❌ Socket non connecté');
        showToast('Problème de connexion', 'error');
        return;
    }
    
    input.value = '';
    
    console.log('📤 Émission du message via socket');
    socket.emit('sendMessage', {
        conversationId: currentConversation._id,
        type: 'texte',
        content: content
    });
}


// Upload de fichier
async function uploadFile(event) {
    const file = event.target.files[0];
    if (!file || !currentConversation) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            socket.emit('sendMessage', {
                conversationId: currentConversation._id,
                type: getFileType(file.type),
                fileId: data.file.id,
                fileName: data.file.originalName,
                fileSize: data.file.size,
                mimeType: file.type
            });
        } else {
            showNotification('Erreur lors de l\'upload', 'error');
        }
    } catch (error) {
        console.error('Erreur upload:', error);
        showNotification('Erreur lors de l\'upload', 'error');
    }
    
    event.target.value = '';
}

// Télécharger un fichier
function downloadFile(fileId, fileName) {
    window.open(`/api/files/download/${fileId}?token=${currentToken}`, '_blank');
}

// Rechercher des utilisateurs
async function searchUsers() {
    const query = document.getElementById('search-input').value.trim();
    const resultsContainer = document.getElementById('search-results');
    
    console.log('🔍 Recherche frontend - Query:', query);
    
    if (query.length < 3) {
        console.log('🔍 Recherche frontend - Trop court, on cache les résultats');
        resultsContainer.style.display = 'none';
        return;
    }
    
    try {
        console.log('🔍 Recherche frontend - Envoi requête pour:', query);
        const response = await fetch(`/api/users/search/${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        console.log('🔍 Recherche frontend - Statut réponse:', response.status);
        
        if (response.ok) {
            const users = await response.json();
            console.log('🔍 Recherche frontend - Utilisateurs reçus:', users);
            displaySearchResults(users);
        } else {
            const error = await response.text();
            console.error('🔍 Recherche frontend - Erreur réponse:', error);
        }
    } catch (error) {
        console.error('🔍 Recherche frontend - Erreur fetch:', error);
    }
}

// Afficher les résultats de recherche
function displaySearchResults(users) {
    console.log('🔍 Affichage résultats - Nombre:', users.length);
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    if (users.length === 0) {
        console.log('🔍 Affichage résultats - Aucun utilisateur');
        // Optionnel: afficher un message "Aucun résultat"
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = 'Aucun utilisateur trouvé';
        container.appendChild(div);
        container.style.display = 'block';
        return;
    }
    
    users.forEach(user => {
        console.log('🔍 Affichage résultats - Utilisateur:', user.name, user.phoneNumber);
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.onclick = () => startConversationWith(user);
        div.innerHTML = `
            <div class="name">${user.name}</div>
            <div class="phone">${user.phoneNumber}</div>
        `;
        container.appendChild(div);
    });
    
    container.style.display = 'block';
}

// Afficher les résultats de recherche
function displaySearchResults(users) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.onclick = () => startConversationWith(user);
        div.innerHTML = `
            <div class="name">${user.name}</div>
            <div class="phone">${user.phoneNumber}</div>
        `;
        container.appendChild(div);
    });
    
    container.style.display = 'block';
}

// Démarrer une conversation avec un utilisateur
async function startConversationWith(user) {
    try {
        const response = await fetch(`/api/conversations/with/${user._id}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const conversation = await response.json();
            // Ajouter les infos du participant
            conversation.participant = user;
            
            // Ajouter à la liste ou sélectionner
            await loadConversations();
            
            // Trouver et sélectionner la nouvelle conversation
            const newConv = conversations.find(c => c._id === conversation._id);
            if (newConv) {
                selectConversation(newConv);
            }
        }
    } catch (error) {
        console.error('Erreur création conversation:', error);
    }
    
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-input').value = '';
}

// Gestion des nouveaux messages
function handleNewMessage(message) {
    console.log('📩 handleNewMessage appelé avec:', message);
    
    if (!message || !message.conversationId) {
        console.log('❌ Message invalide');
        return;
    }
    
    // Vérifier si le message est pour la conversation courante
    if (currentConversation && message.conversationId === currentConversation._id) {
        console.log('✅ Message pour la conversation courante');
        
        const container = document.getElementById('messages-container');
        const messageEl = createMessageElement(message);
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
        
        // Marquer comme lu
        socket.emit('markAsRead', { conversationId: currentConversation._id });
        
        // Mettre à jour le lastMessage de la conversation courante
        if (currentConversation) {
            currentConversation.lastMessage = {
                text: message.type === 'texte' ? message.content : `📎 ${message.fileName || 'fichier'}`,
                timestamp: message.createdAt,
                sender: message.sender._id
            };
        }
    } else {
        console.log('⏭️ Message pour une autre conversation');
    }
    
    // Mettre à jour la liste des conversations
    loadConversations();
}

function handleUserStatus(data) {
    if (currentConversation && currentConversation.participant._id === data.userId) {
        document.getElementById('chat-header-status').textContent = data.status === 'online' ? 'En ligne' : 'Hors ligne';
        document.getElementById('chat-header-status').className = `chat-header-status ${data.status}`;
    }
}

function handleUserTyping(data) {
    if (currentConversation && data.conversationId === currentConversation._id) {
        const indicator = document.getElementById('typing-indicator');
        indicator.style.display = data.isTyping ? 'block' : 'none';
    }
}

function handleMessagesRead(data) {
    if (currentConversation && data.conversationId === currentConversation._id) {
        // Mettre à jour l'UI des messages
    }
}

function handleConversationUpdated(data) {
    loadConversations();
}

function handleTyping() {
    if (!currentConversation) return;
    
    socket.emit('typing', {
        conversationId: currentConversation._id,
        isTyping: true
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            conversationId: currentConversation._id,
            isTyping: false
        });
    }, 1000);
}

// Utilitaires
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'jpg': '📷', 'jpeg': '📷', 'png': '📷', 'gif': '📷',
        'mp4': '🎥', 'mov': '🎥', 'avi': '🎥',
        'mp3': '🎵', 'wav': '🎵',
        'pdf': '📄', 'doc': '📄', 'docx': '📄',
        'zip': '📦', 'rar': '📦'
    };
    return icons[ext] || '📎';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileType(mimeType) {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
}
// Toast System
function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Icônes selon le type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Titres par défaut
    const titles = {
        success: 'Succès !',
        error: 'Erreur !',
        warning: 'Attention !',
        info: 'Information'
    };
    
    const toastTitle = title || titles[type];
    
    toast.innerHTML = `
        <i>${icons[type]}</i>
        <div class="toast-content">
            <div class="toast-title">${toastTitle}</div>
            <div class="toast-message">${message}</div>
        </div>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Auto-suppression après 3 secondes
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// Modal System
function showModal(options) {
    const {
        type = 'success',
        title = '',
        message = '',
        showConfirm = true,
        showCancel = false,
        confirmText = 'OK',
        cancelText = 'Annuler',
        onConfirm = () => {},
        onCancel = () => {}
    } = options;
    
    const container = document.getElementById('modal-container');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        question: '❓'
    };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon ${type}">${icons[type]}</div>
            <div class="modal-title">${title}</div>
            <div class="modal-message">${message}</div>
            <div class="modal-buttons">
                ${showCancel ? `<button class="modal-btn secondary" id="modal-cancel">${cancelText}</button>` : ''}
                ${showConfirm ? `<button class="modal-btn primary" id="modal-confirm">${confirmText}</button>` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = '';
    container.appendChild(modal);
    
    // Gestion des boutons
    if (showConfirm) {
        document.getElementById('modal-confirm').addEventListener('click', () => {
            modal.remove();
            onConfirm();
        });
    }
    
    if (showCancel) {
        document.getElementById('modal-cancel').addEventListener('click', () => {
            modal.remove();
            onCancel();
        });
    }
    
    // Fermer en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            onCancel();
        }
    });
}

// Mettre à jour les fonctions d'authentification
async function register() {
    const name = document.getElementById('register-name').value;
    const phoneNumber = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    
    // Validation basique
    if (!name || !phoneNumber || !password) {
        showToast('Tous les champs sont requis', 'warning');
        return;
    }
    
    if (password.length < 6) {
        showToast('Le mot de passe doit faire au moins 6 caractères', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phoneNumber, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Beau popup de succès
            showModal({
                type: 'success',
                title: 'Inscription réussie ! 🎉',
                message: 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
                showConfirm: true,
                showCancel: false,
                confirmText: 'Se connecter',
                onConfirm: () => {
                    showLogin(); // Bascule vers le formulaire de connexion
                    // Pré-remplir le numéro de téléphone
                    document.getElementById('login-phone').value = phoneNumber;
                }
            });
        } else {
            // Message d'erreur personnalisé pour utilisateur existant
            if (data.message.includes('déjà utilisé')) {
                showModal({
                    type: 'warning',
                    title: 'Compte existant',
                    message: 'Ce numéro de téléphone est déjà utilisé. Souhaitez-vous vous connecter ?',
                    showConfirm: true,
                    showCancel: true,
                    confirmText: 'Se connecter',
                    cancelText: 'Annuler',
                    onConfirm: () => {
                        showLogin();
                        document.getElementById('login-phone').value = phoneNumber;
                    }
                });
            } else {
                showToast(data.message, 'error');
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur de connexion au serveur', 'error');
    }
}

async function login() {
    const phoneNumber = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    
    if (!phoneNumber || !password) {
        showToast('Veuillez remplir tous les champs', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentToken = data.token;
            localStorage.setItem('token', currentToken);
            
            showToast('Connexion réussie !', 'success');
            
            // Petite attente pour voir le toast
            setTimeout(() => {
                showChatInterface();
                initSocket();
                loadConversations();
            }, 500);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur de connexion au serveur', 'error');
    }
}

// Mettre à jour showRegister et showLogin pour ajouter des animations
function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    
    // Animation simple
    const registerForm = document.getElementById('register-form');
    registerForm.style.animation = 'scaleIn 0.3s ease';
    setTimeout(() => {
        registerForm.style.animation = '';
    }, 300);
}

function showLogin() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    
    // Animation simple
    const loginForm = document.getElementById('login-form');
    loginForm.style.animation = 'scaleIn 0.3s ease';
    setTimeout(() => {
        loginForm.style.animation = '';
    }, 300);
}

function showNotification(message, type) {
    // À implémenter
    console.log(`${type}: ${message}`);
}

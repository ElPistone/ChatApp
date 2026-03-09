## ChatApp : Application de Messagerie en Temps Réel
<div align="center">
  
  🚀 **Version 1.0.0** | ⚡ **Socket.io** | 🔒 **JWT Auth** | 💬 **Chat Temps Réel**
  
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)]()
  [![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)]()
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)]()
  [![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)]()
  
</div>

## 📋 Description
Une application de messagerie instantanée complète développée avec Node.js, Express, MongoDB et Socket.io. Cette application permet aux utilisateurs de communiquer en temps réel via des messages texte, des fichiers, des images, des vidéos et de l'audio, avec un système de statuts de message (envoyé/délivré/lu) et une gestion des conversations privées.

## ✨ Fonctionnalités principales
- Authentification sécurisée : Inscription et connexion avec JWT
- Messagerie en temps réel : Échange instantané de messages via WebSocket
- Types de messages multiples : Texte, images, vidéos, audio, fichiers
- Statuts des messages : Système complet (✓ envoyé, ✓✓ délivré, ✓✓ bleu lu)
- Indicateur de frappe : Visualisation "en train d'écrire" en temps réel
- Statut en ligne : Affichage du statut des utilisateurs (en ligne/hors ligne)
- Recherche d'utilisateurs : Par numéro de téléphone
- Gestion des fichiers : Upload et téléchargement sécurisés via GridFS
- Accusés de lecture : Suivi des messages lus par les destinataires
- Interface responsive : Design adapté aux mobiles et desktop

## 🛠 Technologies utilisées
Backend
- Node.js - Environnement d'exécution JavaScript
- Express.js - Framework web
- Socket.io - Communication en temps réel
- MongoDB - Base de données NoSQL
- Mongoose - ODM pour MongoDB
- GridFS - Stockage de fichiers dans MongoDB
- JWT - Authentification par tokens
- Bcrypt - Hachage des mots de passe
- Multer - Gestion des uploads

Frontend
- HTML5 - Structure
- CSS3 - Styles et animations
- JavaScript (Vanilla) - Logique applicative
- Socket.io-client - Communication temps réel
- Boxicons - Icônes

## Outils de développement
- Nodemon - Redémarrage automatique du serveur
- Dotenv - Gestion des variables d'environnement
- CORS - Gestion des requêtes cross-origin

## 🚀 Installation
Prérequis
- Node.js (v14 ou supérieur)
- MongoDB (local ou Atlas)
- npm ou yarn
## Etapes d'installation 
- Cloner le projet
  ```
  git clone https://github.com/ElPistone/ChatApp.git
  ```
- Installer les dépendances
    ```
  npm install
  ```
- Configurer la variable d'environnement
- Lancer l'application
    ```
  npm run dev
  ```
## Auteur 
Mamadou Dian Diaby

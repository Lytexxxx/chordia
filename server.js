const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques
const staticPath = path.join(__dirname, 'static');
console.log('Serving static files from:', staticPath);
app.use('/static', express.static(staticPath));

// Servir le logo depuis la racine
app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'logo.png'));
});

// Stockage en mémoire pour la version locale
const users = {};
const servers = {};
const rooms = {};
const messages = {};
const friends = {};
const friendRequests = {};
const privateMessages = {};
const serverRoles = {};
const serverPermissions = {};
const serverInvites = {};
const loginLogFile = path.join(__dirname, 'logs-login.txt');
const serversFile = path.join(__dirname, 'servers.json');
const roomsFile = path.join(__dirname, 'rooms.json');
const messagesFile = path.join(__dirname, 'messages.json');
const friendsFile = path.join(__dirname, 'friends.json');
const friendRequestsFile = path.join(__dirname, 'friend_requests.json');
const privateMessagesFile = path.join(__dirname, 'private_messages.json');
const serverRolesFile = path.join(__dirname, 'server_roles.json');
const serverPermissionsFile = path.join(__dirname, 'server_permissions.json');
const serverInvitesFile = path.join(__dirname, 'server_invites.json');

// Charger les utilisateurs existants depuis le fichier
function loadUsersFromFile() {
    try {
        if (fs.existsSync(loginLogFile)) {
            const data = fs.readFileSync(loginLogFile, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const [username, displayname, password, timestamp, bio, avatarImage, bannerImage] = line.split('|');
                if (username && displayname && password) {
                    users[username] = {
                        username: username,
                        displayname: displayname,
                        password: password,
                        status: 'offline',
                        joinedAt: timestamp || new Date().toISOString(),
                        bio: bio || '',
                        avatarImage: avatarImage || null,
                        bannerImage: bannerImage || null
                    };
                }
            });
            console.log(`Chargé ${Object.keys(users).length} utilisateurs depuis logs-login`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

// Sauvegarder un utilisateur dans le fichier
function saveUserToFile(username, displayname, password, bio = '', avatarImage = null, bannerImage = null) {
    try {
        const timestamp = new Date().toISOString();
        const line = `${username}|${displayname}|${password}|${timestamp}|${bio}|${avatarImage || ''}|${bannerImage || ''}\n`;
        fs.appendFileSync(loginLogFile, line);
        console.log(`Utilisateur ${username} (${displayname}) enregistré dans logs-login`);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'utilisateur:', error);
    }
}

// Sauvegarder tous les utilisateurs dans le fichier
function saveUsersToFile() {
    try {
        const lines = Object.values(users).map(user => {
            return `${user.username}|${user.displayname}|${user.password}|${user.joinedAt || new Date().toISOString()}|${user.bio || ''}|${user.avatarImage || ''}|${user.bannerImage || ''}`;
        });
        fs.writeFileSync(loginLogFile, lines.join('\n') + '\n');
        console.log(`Sauvegardé ${Object.keys(users).length} utilisateurs dans logs-login`);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des utilisateurs:', error);
    }
}

// Charger les utilisateurs au démarrage
loadUsersFromFile();

// Charger les données au démarrage
loadServersFromFile();
loadRoomsFromFile();
loadMessagesFromFile();
loadFriendsFromFile();
loadFriendRequestsFromFile();
loadPrivateMessagesFromFile();
loadServerRolesFromFile();
loadServerPermissionsFromFile();
loadServerInvitesFromFile();

// Servir la page principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Requête de login reçue:', { username });
    
    if (!username || !password) {
        console.log('Nom d\'utilisateur ou mot de passe manquant');
        return res.status(400).json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }
    
    // Vérifier si l'utilisateur existe et si le mot de passe est correct
    if (!users[username]) {
        console.log('Utilisateur non trouvé:', username);
        return res.status(400).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
    }
    
    if (users[username].password !== password) {
        console.log('Mot de passe incorrect pour:', username);
        return res.status(400).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
    }
    
    // Mettre l'utilisateur en ligne
    users[username].status = 'online';
    
    console.log('Utilisateur connecté:', username);
    
    res.json({ success: true, user: users[username] });
});

// Register
app.post('/register', (req, res) => {
    const { username, displayname, password } = req.body;
    
    console.log('Requête d\'inscription reçue:', { username, displayname });
    
    if (!username || !displayname || !password) {
        console.log('Nom d\'utilisateur, pseudo ou mot de passe manquant');
        return res.status(400).json({ success: false, message: "Nom d'utilisateur, pseudo et mot de passe requis" });
    }
    
    // Vérifier si le nom d'utilisateur existe déjà
    if (users[username]) {
        console.log('Nom d\'utilisateur déjà pris:', username);
        return res.status(400).json({ success: false, message: "Ce nom d'utilisateur est déjà pris" });
    }
    
    // Créer le nouvel utilisateur
    users[username] = {
        username: username,
        displayname: displayname,
        password: password,
        status: 'online',
        joinedAt: new Date().toISOString()
    };
    
    console.log('Utilisateur créé:', users[username]);
    
    // Sauvegarder dans le fichier
    saveUserToFile(username, displayname, password);
    
    res.json({ success: true, user: users[username] });
});

// Obtenir la liste des utilisateurs
app.get('/users', (req, res) => {
    const usersList = Object.values(users).map(user => ({
        username: user.username,
        displayname: user.displayname,
        status: user.status,
        bio: user.bio || '',
        avatarImage: user.avatarImage || null,
        bannerImage: user.bannerImage || null
    }));
    res.json(usersList);
});

// Obtenir la liste des salons d'un serveur
app.get('/servers/:serverId/rooms', (req, res) => {
    const { serverId } = req.params;
    if (!servers[serverId]) {
        return res.json([]);
    }
    const serverRooms = servers[serverId].rooms.map(roomId => rooms[roomId]).filter(r => r);
    res.json(serverRooms);
});

// Obtenir la liste des salons
app.get('/rooms', (req, res) => {
    res.json(Object.values(rooms));
});

// Créer un serveur
app.post('/create_server', (req, res) => {
    const { name, creator } = req.body;
    
    if (!name || !creator) {
        return res.status(400).json({ success: false, message: "Nom et créateur requis" });
    }
    
    const serverId = String(Object.keys(servers).length + 1);
    servers[serverId] = {
        id: serverId,
        name: name,
        creator: creator,
        members: [creator],
        rooms: [],
        createdAt: new Date().toISOString()
    };
    
    // Créer un salon général par défaut
    const roomId = String(Object.keys(rooms).length + 1);
    rooms[roomId] = {
        id: roomId,
        serverId: serverId,
        name: 'général',
        creator: creator,
        members: [creator],
        type: 'text',
        createdAt: new Date().toISOString()
    };
    messages[roomId] = [];
    servers[serverId].rooms.push(roomId);
    
    saveServersToFile();
    saveRoomsToFile();
    
    res.json({ success: true, server: servers[serverId] });
});

// Obtenir la liste des serveurs
app.get('/servers', (req, res) => {
    // Recharger depuis le fichier pour s'assurer d'avoir les données les plus récentes
    loadServersFromFile();
    res.json(Object.values(servers));
});

// Créer un salon dans un serveur
app.post('/create_room', (req, res) => {
    const { name, creator, serverId, type } = req.body;
    
    if (!name || !creator || !serverId) {
        return res.status(400).json({ success: false, message: "Nom, créateur et serveur requis" });
    }
    
    if (!servers[serverId]) {
        return res.status(400).json({ success: false, message: "Serveur non trouvé" });
    }
    
    const roomId = String(Object.keys(rooms).length + 1);
    rooms[roomId] = {
        id: roomId,
        serverId: serverId,
        name: name,
        creator: creator,
        members: [creator],
        type: type || 'text',
        createdAt: new Date().toISOString()
    };
    messages[roomId] = [];
    servers[serverId].rooms.push(roomId);
    
    saveRoomsToFile();
    saveServersToFile();
    
    res.json({ success: true, room: rooms[roomId] });
});

// Mettre à jour le profil utilisateur
app.post('/update_profile', (req, res) => {
    const { username, displayname, bio, avatarImage, bannerImage } = req.body;

    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    if (displayname) {
        users[username].displayname = displayname;
    }
    if (bio !== undefined) {
        users[username].bio = bio;
    }
    if (avatarImage !== undefined) {
        users[username].avatarImage = avatarImage;
    }
    if (bannerImage !== undefined) {
        users[username].bannerImage = bannerImage;
    }

    // Mettre à jour le fichier logs-login.txt
    saveUsersToFile();

    res.json({ success: true, user: users[username] });
});

// Upload de bannière de profil (base64 pour Render)
app.post('/upload_banner', (req, res) => {
    const { username, bannerImage } = req.body;

    if (!username || !users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    if (!bannerImage) {
        return res.status(400).json({ success: false, message: "Aucune image de bannière fournie" });
    }

    // Valider que c'est une image base64
    if (!bannerImage.startsWith('data:image/')) {
        return res.status(400).json({ success: false, message: "Format d'image invalide" });
    }

    users[username].bannerImage = bannerImage;
    saveUsersToFile();

    res.json({ success: true, bannerUrl: bannerImage });
});

// Changer le mot de passe utilisateur
app.post('/change_password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    
    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }
    
    if (users[username].password !== currentPassword) {
        return res.status(400).json({ success: false, message: "Mot de passe actuel incorrect" });
    }
    
    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, message: "Le nouveau mot de passe doit contenir au moins 4 caractères" });
    }
    
    users[username].password = newPassword;
    
    // Mettre à jour le fichier logs-login.txt
    saveUsersToFile();
    
    res.json({ success: true, message: "Mot de passe changé avec succès" });
});

// Mettre à jour un utilisateur dans le fichier
function updateUserInFile(username) {
    try {
        if (!fs.existsSync(loginLogFile)) {
            return;
        }
        
        const data = fs.readFileSync(loginLogFile, 'utf8');
        const lines = data.split('\n').filter(line => line.trim());
        const updatedLines = lines.map(line => {
            const parts = line.split('|');
            if (parts[0] === username) {
                const [u, d, p, t, b, a, banner] = parts;
                return `${u}|${d}|${p}|${t}|${users[username].bio || ''}|${users[username].avatarImage || ''}|${users[username].bannerImage || ''}`;
            }
            return line;
        });
        
        fs.writeFileSync(loginLogFile, updatedLines.join('\n') + '\n');
        console.log(`Utilisateur ${username} mis à jour dans logs-login`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    }
}

// Charger les serveurs depuis le fichier
function loadServersFromFile() {
    try {
        if (fs.existsSync(serversFile)) {
            const data = fs.readFileSync(serversFile, 'utf8');
            const loadedServers = JSON.parse(data);
            Object.assign(servers, loadedServers);
            console.log(`Chargé ${Object.keys(servers).length} serveurs depuis servers.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des serveurs:', error);
    }
}

// Sauvegarder les serveurs dans le fichier
function saveServersToFile() {
    try {
        fs.writeFileSync(serversFile, JSON.stringify(servers, null, 2));
        console.log('Serveurs sauvegardés dans servers.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des serveurs:', error);
    }
}

// Charger les salons depuis le fichier
function loadRoomsFromFile() {
    try {
        if (fs.existsSync(roomsFile)) {
            const data = fs.readFileSync(roomsFile, 'utf8');
            const loadedRooms = JSON.parse(data);
            Object.assign(rooms, loadedRooms);
            console.log(`Chargé ${Object.keys(rooms).length} salons depuis rooms.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des salons:', error);
    }
}

// Sauvegarder les salons dans le fichier
function saveRoomsToFile() {
    try {
        fs.writeFileSync(roomsFile, JSON.stringify(rooms, null, 2));
        console.log('Salons sauvegardés dans rooms.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des salons:', error);
    }
}

// Charger les messages depuis le fichier
function loadMessagesFromFile() {
    try {
        if (fs.existsSync(messagesFile)) {
            const data = fs.readFileSync(messagesFile, 'utf8');
            const loadedMessages = JSON.parse(data);
            Object.assign(messages, loadedMessages);
            console.log(`Chargé ${Object.keys(messages).length} historiques de messages depuis messages.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
    }
}

// Sauvegarder les messages dans le fichier
function saveMessagesToFile() {
    try {
        fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
        console.log('Messages sauvegardés dans messages.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des messages:', error);
    }
}

// Charger les amis depuis le fichier
function loadFriendsFromFile() {
    try {
        if (fs.existsSync(friendsFile)) {
            const data = fs.readFileSync(friendsFile, 'utf8');
            const loadedFriends = JSON.parse(data);
            Object.assign(friends, loadedFriends);
            console.log(`Chargé ${Object.keys(friends).length} listes d'amis depuis friends.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des amis:', error);
    }
}

// Sauvegarder les amis dans le fichier
function saveFriendsToFile() {
    try {
        fs.writeFileSync(friendsFile, JSON.stringify(friends, null, 2));
        console.log('Amis sauvegardés dans friends.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des amis:', error);
    }
}

// Charger les demandes d'amis depuis le fichier
function loadFriendRequestsFromFile() {
    try {
        if (fs.existsSync(friendRequestsFile)) {
            const data = fs.readFileSync(friendRequestsFile, 'utf8');
            const loadedRequests = JSON.parse(data);
            Object.assign(friendRequests, loadedRequests);
            console.log(`Chargé ${Object.keys(friendRequests).length} demandes d'amis depuis friend_requests.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des demandes d\'amis:', error);
    }
}

// Sauvegarder les demandes d'amis dans le fichier
function saveFriendRequestsToFile() {
    try {
        fs.writeFileSync(friendRequestsFile, JSON.stringify(friendRequests, null, 2));
        console.log('Demandes d\'amis sauvegardées dans friend_requests.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des demandes d\'amis:', error);
    }
}

// Charger les messages privés depuis le fichier
function loadPrivateMessagesFromFile() {
    try {
        if (fs.existsSync(privateMessagesFile)) {
            const data = fs.readFileSync(privateMessagesFile, 'utf8');
            const loadedPrivateMessages = JSON.parse(data);
            Object.assign(privateMessages, loadedPrivateMessages);
            console.log(`Chargé ${Object.keys(privateMessages).length} conversations privées depuis private_messages.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des messages privés:', error);
    }
}

// Sauvegarder les messages privés dans le fichier
function savePrivateMessagesToFile() {
    try {
        fs.writeFileSync(privateMessagesFile, JSON.stringify(privateMessages, null, 2));
        console.log('Messages privés sauvegardés dans private_messages.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des messages privés:', error);
    }
}

// Charger les rôles de serveur depuis le fichier
function loadServerRolesFromFile() {
    try {
        if (fs.existsSync(serverRolesFile)) {
            const data = fs.readFileSync(serverRolesFile, 'utf8');
            const loadedRoles = JSON.parse(data);
            Object.assign(serverRoles, loadedRoles);
            console.log(`Chargé ${Object.keys(serverRoles).length} configurations de rôles depuis server_roles.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des rôles de serveur:', error);
    }
}

// Sauvegarder les rôles de serveur dans le fichier
function saveServerRolesToFile() {
    try {
        fs.writeFileSync(serverRolesFile, JSON.stringify(serverRoles, null, 2));
        console.log('Rôles de serveur sauvegardés dans server_roles.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des rôles de serveur:', error);
    }
}

// Charger les permissions de serveur depuis le fichier
function loadServerPermissionsFromFile() {
    try {
        if (fs.existsSync(serverPermissionsFile)) {
            const data = fs.readFileSync(serverPermissionsFile, 'utf8');
            const loadedPermissions = JSON.parse(data);
            Object.assign(serverPermissions, loadedPermissions);
            console.log(`Chargé ${Object.keys(serverPermissions).length} configurations de permissions depuis server_permissions.json`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des permissions de serveur:', error);
    }
}

// Sauvegarder les permissions de serveur dans le fichier
function saveServerPermissionsToFile() {
    try {
        fs.writeFileSync(serverPermissionsFile, JSON.stringify(serverPermissions, null, 2));
        console.log('Permissions de serveur sauvegardées dans server_permissions.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des permissions de serveur:', error);
    }
}

function loadServerInvitesFromFile() {
    try {
        if (fs.existsSync(serverInvitesFile)) {
            const data = fs.readFileSync(serverInvitesFile, 'utf8');
            const loadedInvites = JSON.parse(data);
            Object.assign(serverInvites, loadedInvites);
            console.log('Invitations de serveur chargées depuis server_invites.json');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des invitations de serveur:', error);
    }
}

function saveServerInvitesToFile() {
    try {
        fs.writeFileSync(serverInvitesFile, JSON.stringify(serverInvites, null, 2));
        console.log('Invitations de serveur sauvegardées dans server_invites.json');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des invitations de serveur:', error);
    }
}

// Obtenir les messages d'un salon
app.get('/rooms/:roomId/messages', (req, res) => {
    const { roomId } = req.params;
    if (!messages[roomId]) {
        return res.json([]);
    }
    res.json(messages[roomId]);
});

// Obtenir la liste d'amis d'un utilisateur
app.get('/friends/:username', (req, res) => {
    const { username } = req.params;
    if (!friends[username]) {
        friends[username] = [];
    }
    const friendList = friends[username].map(friendUsername => {
        const user = users[friendUsername];
        if (user) {
            return {
                username: user.username,
                displayname: user.displayname,
                status: user.status,
                bio: user.bio || '',
                avatarImage: user.avatarImage || null,
                bannerImage: user.bannerImage || null
            };
        }
        return null;
    }).filter(f => f !== null);
    res.json(friendList);
});

// Envoyer une demande d'ami
app.post('/friend_request', (req, res) => {
    const { from, to } = req.body;
    
    if (!from || !to) {
        return res.status(400).json({ success: false, message: "Expéditeur et destinataire requis" });
    }
    
    if (!users[from] || !users[to]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }
    
    if (from === to) {
        return res.status(400).json({ success: false, message: "Impossible de s'ajouter soi-même" });
    }
    
    // Vérifier s'ils sont déjà amis
    if (friends[from] && friends[from].includes(to)) {
        return res.status(400).json({ success: false, message: "Déjà amis" });
    }
    
    // Vérifier si une demande existe déjà
    if (!friendRequests[to]) {
        friendRequests[to] = [];
    }
    if (friendRequests[to].includes(from)) {
        return res.status(400).json({ success: false, message: "Demande déjà envoyée" });
    }
    
    friendRequests[to].push(from);
    saveFriendRequestsToFile();
    
    // Notifier le destinataire
    io.emit('friend_request_received', { from, to });
    
    res.json({ success: true });
});

// Obtenir les demandes d'amis d'un utilisateur
app.get('/friend_requests/:username', (req, res) => {
    const { username } = req.params;
    if (!friendRequests[username]) {
        friendRequests[username] = [];
    }
    const requests = friendRequests[username].map(requesterUsername => {
        const user = users[requesterUsername];
        if (user) {
            return {
                username: user.username,
                displayname: user.displayname,
                bio: user.bio || '',
                avatarImage: user.avatarImage || null
            };
        }
        return null;
    }).filter(r => r !== null);
    res.json(requests);
});

// Accepter une demande d'ami
app.post('/accept_friend', (req, res) => {
    const { username, friendUsername } = req.body;
    
    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }
    
    // Retirer la demande
    if (friendRequests[username]) {
        friendRequests[username] = friendRequests[username].filter(u => u !== friendUsername);
    }
    saveFriendRequestsToFile();
    
    // Ajouter aux amis des deux côtés
    if (!friends[username]) {
        friends[username] = [];
    }
    if (!friends[friendUsername]) {
        friends[friendUsername] = [];
    }
    
    if (!friends[username].includes(friendUsername)) {
        friends[username].push(friendUsername);
    }
    if (!friends[friendUsername].includes(username)) {
        friends[friendUsername].push(username);
    }
    
    saveFriendsToFile();
    
    // Notifier les deux utilisateurs
    io.emit('friend_accepted', { username, friendUsername });
    
    res.json({ success: true });
});

// Refuser une demande d'ami
app.post('/reject_friend', (req, res) => {
    const { username, friendUsername } = req.body;
    
    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }
    
    // Retirer la demande
    if (friendRequests[username]) {
        friendRequests[username] = friendRequests[username].filter(u => u !== friendUsername);
    }
    saveFriendRequestsToFile();
    
    res.json({ success: true });
});

// Supprimer un ami
app.post('/remove_friend', (req, res) => {
    const { username, friendUsername } = req.body;
    
    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }
    
    // Retirer des amis des deux côtés
    if (friends[username]) {
        friends[username] = friends[username].filter(u => u !== friendUsername);
    }
    if (friends[friendUsername]) {
        friends[friendUsername] = friends[friendUsername].filter(u => u !== username);
    }
    
    saveFriendsToFile();
    
    // Notifier les deux utilisateurs
    io.emit('friend_removed', { username, friendUsername });
    
    res.json({ success: true });
});

// Obtenir les messages privés entre deux utilisateurs
app.get('/private_messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    
    // Créer une clé unique pour la conversation (triée alphabétiquement)
    const conversationKey = [user1, user2].sort().join('_');
    
    if (!privateMessages[conversationKey]) {
        privateMessages[conversationKey] = [];
    }
    
    res.json(privateMessages[conversationKey]);
});

// Envoyer un message privé
app.post('/private_message', (req, res) => {
    const { from, to, message } = req.body;
    
    if (!from || !to || !message) {
        return res.status(400).json({ success: false, message: "Expéditeur, destinataire et message requis" });
    }
    
    // Créer une clé unique pour la conversation
    const conversationKey = [from, to].sort().join('_');
    
    if (!privateMessages[conversationKey]) {
        privateMessages[conversationKey] = [];
    }
    
    const msgData = {
        id: privateMessages[conversationKey].length + 1,
        from: from,
        to: to,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    privateMessages[conversationKey].push(msgData);
    savePrivateMessagesToFile();
    
    // Notifier les deux utilisateurs via socket
    io.emit('private_message', msgData);
    
    res.json({ success: true, message: msgData });
});

// Mettre à jour le nom d'un serveur
app.post('/update_server_name', (req, res) => {
    const { serverId, name } = req.body;
    
    if (!serverId || !name) {
        return res.status(400).json({ success: false, message: "ID du serveur et nom requis" });
    }
    
    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }
    
    servers[serverId].name = name;
    saveServersToFile();
    
    console.log(`Nom du serveur ${serverId} mis à jour: ${name}`);
    res.json({ success: true, server: servers[serverId] });
});

// Mettre à jour le logo d'un serveur
app.post('/update_server_logo', (req, res) => {
    const { serverId, logo } = req.body;
    
    if (!serverId) {
        return res.status(400).json({ success: false, message: "ID du serveur requis" });
    }
    
    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }
    
    servers[serverId].logo = logo || null;
    saveServersToFile();
    
    res.json({ success: true, server: servers[serverId] });
});

// Obtenir les rôles d'un serveur
app.get('/servers/:serverId/roles', (req, res) => {
    const { serverId } = req.params;
    
    if (!serverRoles[serverId]) {
        serverRoles[serverId] = [];
    }
    
    res.json(serverRoles[serverId]);
});

// Créer un rôle pour un serveur
app.post('/servers/:serverId/roles', (req, res) => {
    const { serverId } = req.params;
    const { name, color } = req.body;
    
    if (!serverId || !name) {
        return res.status(400).json({ success: false, message: "ID du serveur et nom du rôle requis" });
    }
    
    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }
    
    if (!serverRoles[serverId]) {
        serverRoles[serverId] = [];
    }
    
    const newRole = {
        id: String(Date.now()),
        name: name,
        color: color || '#5865f2',
        permissions: []
    };
    
    serverRoles[serverId].push(newRole);
    saveServerRolesToFile();
    
    res.json({ success: true, role: newRole });
});

// Supprimer un rôle d'un serveur
app.delete('/servers/:serverId/roles/:roleId', (req, res) => {
    const { serverId, roleId } = req.params;
    
    if (!serverRoles[serverId]) {
        return res.status(404).json({ success: false, message: "Rôles non trouvés" });
    }
    
    serverRoles[serverId] = serverRoles[serverId].filter(role => role.id !== roleId);
    saveServerRolesToFile();
    
    res.json({ success: true });
});

// Mettre à jour les permissions d'un rôle
app.post('/servers/:serverId/roles/:roleId/permissions', (req, res) => {
    const { serverId, roleId } = req.params;
    const { permissions } = req.body;
    
    if (!serverRoles[serverId]) {
        return res.status(404).json({ success: false, message: "Rôles non trouvés" });
    }
    
    const role = serverRoles[serverId].find(r => r.id === roleId);
    if (!role) {
        return res.status(404).json({ success: false, message: "Rôle non trouvé" });
    }
    
    role.permissions = permissions || [];
    saveServerRolesToFile();
    
    res.json({ success: true });
});

// Obtenir les invitations d'un serveur
app.get('/servers/:serverId/invites', (req, res) => {
    const { serverId } = req.params;
    
    if (!serverInvites[serverId]) {
        serverInvites[serverId] = [];
    }
    
    res.json({ success: true, invites: serverInvites[serverId] });
});

// Retirer une invitation d'un serveur
app.delete('/servers/:serverId/invites/:username', (req, res) => {
    const { serverId, username } = req.params;
    
    if (!serverInvites[serverId]) {
        return res.status(404).json({ success: false, message: "Invitations non trouvées" });
    }
    
    serverInvites[serverId] = serverInvites[serverId].filter(u => u !== username);
    saveServerInvitesToFile();
    
    res.json({ success: true, invites: serverInvites[serverId] });
});

// Obtenir la date de création d'un compte depuis logs-login.txt
app.post('/get_account_creation_date', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur requis" });
    }
    
    try {
        if (fs.existsSync(loginLogFile)) {
            const data = fs.readFileSync(loginLogFile, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const parts = line.split('|');
                if (parts[0] === username) {
                    const timestamp = parts[3];
                    if (timestamp) {
                        return res.json({ success: true, creationDate: timestamp });
                    }
                }
            }
        }
        
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    } catch (error) {
        console.error('Erreur lors de la récupération de la date de création:', error);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// Inviter un ami à un serveur
app.post('/servers/:serverId/invite', (req, res) => {
    const { serverId } = req.params;
    const { username } = req.body;
    
    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }
    
    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }
    
    if (!serverInvites[serverId]) {
        serverInvites[serverId] = [];
    }
    
    if (serverInvites[serverId].includes(username)) {
        return res.status(400).json({ success: false, message: "Utilisateur déjà invité" });
    }
    
    serverInvites[serverId].push(username);
    saveServerInvitesToFile();
    
    res.json({ success: true, invites: serverInvites[serverId] });
});

// Accepter une invitation à un serveur
app.post('/servers/:serverId/accept_invite', (req, res) => {
    const { serverId } = req.params;
    const { username } = req.body;
    
    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }
    
    if (!serverInvites[serverId] || !serverInvites[serverId].includes(username)) {
        return res.status(404).json({ success: false, message: "Invitation non trouvée" });
    }
    
    // Ajouter l'utilisateur au serveur
    if (!servers[serverId].members) {
        servers[serverId].members = [];
    }
    
    if (!servers[serverId].members.includes(username)) {
        servers[serverId].members.push(username);
        saveServersToFile();
    }
    
    // Retirer l'invitation
    serverInvites[serverId] = serverInvites[serverId].filter(u => u !== username);
    saveServerInvitesToFile();
    
    res.json({ success: true, server: servers[serverId] });
});

// Obtenir les invitations en attente pour un utilisateur
app.get('/users/:username/pending_invites', (req, res) => {
    const { username } = req.params;
    
    const pendingInvites = [];
    
    for (const serverId in serverInvites) {
        if (serverInvites[serverId].includes(username)) {
            pendingInvites.push({
                serverId: serverId,
                serverName: servers[serverId]?.name || 'Serveur inconnu'
            });
        }
    }
    
    res.json({ success: true, invites: pendingInvites });
});

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client déconnecté:', socket.id);
        
        // Retirer l'utilisateur des rooms et mettre son statut à offline
        for (const username in users) {
            if (users[username].socketId === socket.id) {
                users[username].status = 'offline';
                delete users[username].socketId;
                io.emit('user_status', { username: username, status: 'offline' });
            }
        }
    });
    
    socket.on('join', (data) => {
        const { username, room_id } = data;
        
        if (users[username]) {
            users[username].socketId = socket.id;
            users[username].status = 'online';
        }
        
        socket.join(room_id);
        
        if (rooms[room_id] && !rooms[room_id].members.includes(username)) {
            rooms[room_id].members.push(username);
            saveRoomsToFile();
        }
        
        io.to(room_id).emit('user_joined', { username: username, room_id: room_id });
        io.emit('user_status', { username: username, status: 'online' });
    });
    
    socket.on('leave', (data) => {
        const { username, room_id } = data;
        
        socket.leave(room_id);
        
        if (rooms[room_id]) {
            rooms[room_id].members = rooms[room_id].members.filter(m => m !== username);
            saveRoomsToFile();
        }
        
        io.to(room_id).emit('user_left', { username: username, room_id: room_id });
    });
    
    socket.on('send_message', (data) => {
        const { username, room_id, message } = data;
        
        if (!username || !room_id || !message) return;
        
        const msgData = {
            id: (messages[room_id]?.length || 0) + 1,
            username: username,
            message: message,
            room_id: room_id,
            timestamp: new Date().toISOString()
        };
        
        if (!messages[room_id]) {
            messages[room_id] = [];
        }
        
        messages[room_id].push(msgData);
        
        saveMessagesToFile();
        
        io.to(room_id).emit('new_message', msgData);
    });
    
    socket.on('typing', (data) => {
        const { username, room_id, is_typing } = data;
        
        socket.to(room_id).emit('user_typing', { username, is_typing });
    });
    
    socket.on('update_status', (data) => {
        const { username, status } = data;
        
        if (users[username]) {
            users[username].status = status;
            io.emit('user_status', { username: username, status: status });
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log('🎵 Chordia serveur démarré sur http://localhost:' + PORT);
});

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

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

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/chordia',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                displayname VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'offline',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                bio TEXT,
                avatar_image TEXT,
                banner_image TEXT
            );
        `);

        // Create servers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                creator VARCHAR(255) NOT NULL,
                logo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create rooms table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id VARCHAR(255) PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                creator VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create friends table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friends (
                username VARCHAR(255) NOT NULL,
                friend_username VARCHAR(255) NOT NULL,
                PRIMARY KEY (username, friend_username)
            );
        `);

        // Create friend_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                from_username VARCHAR(255) NOT NULL,
                to_username VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (from_username, to_username)
            );
        `);

        // Create private_messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS private_messages (
                id SERIAL PRIMARY KEY,
                from_username VARCHAR(255) NOT NULL,
                to_username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create server_roles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_roles (
                id VARCHAR(255) PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(50) DEFAULT '#5865f2',
                permissions TEXT[]
            );
        `);

        // Create server_permissions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_permissions (
                server_id VARCHAR(255) PRIMARY KEY,
                permissions JSON
            );
        `);

        // Create server_invites table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_invites (
                server_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (server_id, username)
            );
        `);

        // Create server_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_members (
                server_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (server_id, username)
            );
        `);

        // Create room_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_members (
                room_id VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                PRIMARY KEY (room_id, username)
            );
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Servir les fichiers statiques
const staticPath = path.join(__dirname, 'static');
console.log('Serving static files from:', staticPath);
app.use('/static', express.static(staticPath));

// Servir le logo depuis la racine
app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'logo.png'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stockage en mémoire pour la version locale (cache)
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

// Charger les utilisateurs depuis PostgreSQL
async function loadUsersFromDB() {
    try {
        const result = await pool.query('SELECT * FROM users');
        result.rows.forEach(row => {
            users[row.username] = {
                username: row.username,
                displayname: row.displayname,
                password: row.password,
                status: row.status,
                joinedAt: row.joined_at,
                bio: row.bio,
                avatarImage: row.avatar_image,
                bannerImage: row.banner_image
            };
        });
        console.log(`Chargé ${Object.keys(users).length} utilisateurs depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

// Charger les données au démarrage
async function loadAllData() {
    await loadUsersFromDB();
    await loadServersFromDB();
    await loadRoomsFromDB();
    await loadMessagesFromDB();
    await loadFriendsFromDB();
    await loadFriendRequestsFromDB();
    await loadPrivateMessagesFromDB();
    await loadServerRolesFromDB();
    await loadServerPermissionsFromDB();
    await loadServerInvitesFromDB();
}

// Charger les serveurs depuis PostgreSQL
async function loadServersFromDB() {
    try {
        const result = await pool.query('SELECT * FROM servers');
        result.rows.forEach(row => {
            servers[row.id] = {
                id: row.id,
                name: row.name,
                creator: row.creator,
                logo: row.logo,
                createdAt: row.created_at,
                members: [],
                rooms: []
            };
        });
        console.log(`Chargé ${Object.keys(servers).length} serveurs depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des serveurs:', error);
    }
}

// Charger les salons depuis PostgreSQL
async function loadRoomsFromDB() {
    try {
        const result = await pool.query('SELECT * FROM rooms');
        result.rows.forEach(row => {
            rooms[row.id] = {
                id: row.id,
                serverId: row.server_id,
                name: row.name,
                creator: row.creator,
                type: row.type,
                createdAt: row.created_at,
                members: []
            };
            if (servers[row.server_id]) {
                servers[row.server_id].rooms.push(row.id);
            }
        });
        console.log(`Chargé ${Object.keys(rooms).length} salons depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des salons:', error);
    }
}

// Charger les messages depuis PostgreSQL
async function loadMessagesFromDB() {
    try {
        const result = await pool.query('SELECT * FROM messages');
        result.rows.forEach(row => {
            if (!messages[row.room_id]) {
                messages[row.room_id] = [];
            }
            messages[row.room_id].push({
                id: row.id,
                username: row.username,
                message: row.message,
                timestamp: row.timestamp
            });
        });
        console.log(`Chargé ${Object.keys(messages).length} historiques de messages depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
    }
}

// Charger les amis depuis PostgreSQL
async function loadFriendsFromDB() {
    try {
        const result = await pool.query('SELECT * FROM friends');
        result.rows.forEach(row => {
            if (!friends[row.username]) {
                friends[row.username] = [];
            }
            friends[row.username].push(row.friend_username);
        });
        console.log(`Chargé ${Object.keys(friends).length} listes d'amis depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des amis:', error);
    }
}

// Charger les demandes d'amis depuis PostgreSQL
async function loadFriendRequestsFromDB() {
    try {
        const result = await pool.query('SELECT * FROM friend_requests');
        result.rows.forEach(row => {
            if (!friendRequests[row.to_username]) {
                friendRequests[row.to_username] = [];
            }
            friendRequests[row.to_username].push(row.from_username);
        });
        console.log(`Chargé ${Object.keys(friendRequests).length} demandes d'amis depuis PostgreSQL`);
    } catch (error) {
        console.error(`Erreur lors du chargement des demandes d'amis: ${error}`);
    }
}

// Charger les messages privés depuis PostgreSQL
async function loadPrivateMessagesFromDB() {
    try {
        const result = await pool.query('SELECT * FROM private_messages');
        result.rows.forEach(row => {
            const conversationKey = [row.from_username, row.to_username].sort().join('_');
            if (!privateMessages[conversationKey]) {
                privateMessages[conversationKey] = [];
            }
            privateMessages[conversationKey].push({
                id: row.id,
                from: row.from_username,
                to: row.to_username,
                message: row.message,
                timestamp: row.timestamp
            });
        });
        console.log(`Chargé ${Object.keys(privateMessages).length} conversations privées depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des messages privés:', error);
    }
}

// Charger les rôles de serveur depuis PostgreSQL
async function loadServerRolesFromDB() {
    try {
        const result = await pool.query('SELECT * FROM server_roles');
        result.rows.forEach(row => {
            if (!serverRoles[row.server_id]) {
                serverRoles[row.server_id] = [];
            }
            serverRoles[row.server_id].push({
                id: row.id,
                name: row.name,
                color: row.color,
                permissions: row.permissions
            });
        });
        console.log(`Chargé ${Object.keys(serverRoles).length} configurations de rôles depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des rôles de serveur:', error);
    }
}

// Charger les permissions de serveur depuis PostgreSQL
async function loadServerPermissionsFromDB() {
    try {
        const result = await pool.query('SELECT * FROM server_permissions');
        result.rows.forEach(row => {
            serverPermissions[row.server_id] = row.permissions;
        });
        console.log(`Chargé ${Object.keys(serverPermissions).length} configurations de permissions depuis PostgreSQL`);
    } catch (error) {
        console.error('Erreur lors du chargement des permissions de serveur:', error);
    }
}

// Charger les invitations de serveur depuis PostgreSQL
async function loadServerInvitesFromDB() {
    try {
        const result = await pool.query('SELECT * FROM server_invites');
        result.rows.forEach(row => {
            if (!serverInvites[row.server_id]) {
                serverInvites[row.server_id] = [];
            }
            serverInvites[row.server_id].push(row.username);
        });
        console.log('Invitations de serveur chargées depuis PostgreSQL');
    } catch (error) {
        console.error('Erreur lors du chargement des invitations de serveur:', error);
    }
}

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
app.post('/register', async (req, res) => {
    const { username, displayname, password } = req.body;

    console.log('Requête d\'inscription reçue:', { username, displayname });

    if (!username || !displayname || !password) {
        console.log('Nom d\'utilisateur, pseudo ou mot de passe manquant');
        return res.status(400).json({ success: false, message: "Nom d'utilisateur, pseudo et mot de passe requis" });
    }

    try {
        // Vérifier si le nom d'utilisateur existe déjà
        const existingUser = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            console.log('Nom d\'utilisateur déjà pris:', username);
            return res.status(400).json({ success: false, message: "Ce nom d'utilisateur est déjà pris" });
        }

        // Créer le nouvel utilisateur
        const result = await pool.query(
            'INSERT INTO users (username, displayname, password, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [username, displayname, password, 'online']
        );

        const newUser = {
            username: result.rows[0].username,
            displayname: result.rows[0].displayname,
            password: result.rows[0].password,
            status: result.rows[0].status,
            joinedAt: result.rows[0].joined_at,
            bio: result.rows[0].bio,
            avatarImage: result.rows[0].avatar_image,
            bannerImage: result.rows[0].banner_image
        };

        users[username] = newUser;
        console.log('Utilisateur créé:', newUser);

        res.json({ success: true, user: newUser });
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
    }
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
app.post('/create_server', async (req, res) => {
    const { name, creator } = req.body;

    if (!name || !creator) {
        return res.status(400).json({ success: false, message: "Nom et créateur requis" });
    }

    try {
        const serverId = String(Date.now());

        // Créer le serveur
        await pool.query(
            'INSERT INTO servers (id, name, creator) VALUES ($1, $2, $3)',
            [serverId, name, creator]
        );

        // Ajouter le créateur comme membre
        await pool.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [serverId, creator]
        );

        servers[serverId] = {
            id: serverId,
            name: name,
            creator: creator,
            members: [creator],
            rooms: [],
            createdAt: new Date().toISOString()
        };

        // Créer un salon général par défaut
        const roomId = String(Date.now() + 1);
        await pool.query(
            'INSERT INTO rooms (id, server_id, name, creator, type) VALUES ($1, $2, $3, $4, $5)',
            [roomId, serverId, 'général', creator, 'text']
        );

        // Ajouter le créateur comme membre du salon
        await pool.query(
            'INSERT INTO room_members (room_id, username) VALUES ($1, $2)',
            [roomId, creator]
        );

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

        res.json({ success: true, server: servers[serverId] });
    } catch (error) {
        console.error('Erreur lors de la création du serveur:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la création du serveur" });
    }
});

// Obtenir la liste des serveurs
app.get('/servers', (req, res) => {
    res.json(Object.values(servers));
});

// Créer un salon dans un serveur
app.post('/create_room', async (req, res) => {
    const { name, creator, serverId, type } = req.body;

    if (!name || !creator || !serverId) {
        return res.status(400).json({ success: false, message: "Nom, créateur et serveur requis" });
    }

    if (!servers[serverId]) {
        return res.status(400).json({ success: false, message: "Serveur non trouvé" });
    }

    try {
        const roomId = String(Date.now());

        await pool.query(
            'INSERT INTO rooms (id, server_id, name, creator, type) VALUES ($1, $2, $3, $4, $5)',
            [roomId, serverId, name, creator, type || 'text']
        );

        await pool.query(
            'INSERT INTO room_members (room_id, username) VALUES ($1, $2)',
            [roomId, creator]
        );

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

        res.json({ success: true, room: rooms[roomId] });
    } catch (error) {
        console.error('Erreur lors de la création du salon:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la création du salon" });
    }
});

// Mettre à jour le profil utilisateur
app.post('/update_profile', async (req, res) => {
    const { username, displayname, bio, avatarImage, bannerImage } = req.body;

    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    try {
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (displayname) {
            updates.push(`displayname = $${paramCount}`);
            values.push(displayname);
            paramCount++;
            users[username].displayname = displayname;
        }
        if (bio !== undefined) {
            updates.push(`bio = $${paramCount}`);
            values.push(bio);
            paramCount++;
            users[username].bio = bio;
        }
        if (avatarImage !== undefined) {
            updates.push(`avatar_image = $${paramCount}`);
            values.push(avatarImage);
            paramCount++;
            users[username].avatarImage = avatarImage;
        }
        if (bannerImage !== undefined) {
            updates.push(`banner_image = $${paramCount}`);
            values.push(bannerImage);
            paramCount++;
            users[username].bannerImage = bannerImage;
        }

        if (updates.length > 0) {
            values.push(username);
            const query = `UPDATE users SET ${updates.join(', ')} WHERE username = $${paramCount}`;
            await pool.query(query, values);
        }

        res.json({ success: true, user: users[username] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du profil" });
    }
});

// Upload de bannière de profil (base64 pour Render)
app.post('/upload_banner', async (req, res) => {
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

    try {
        await pool.query('UPDATE users SET banner_image = $1 WHERE username = $2', [bannerImage, username]);
        users[username].bannerImage = bannerImage;
        res.json({ success: true, bannerUrl: bannerImage });
    } catch (error) {
        console.error('Erreur lors de l\'upload de la bannière:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'upload de la bannière" });
    }
});

// Changer le mot de passe utilisateur
app.post('/change_password', async (req, res) => {
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

    try {
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newPassword, username]);
        users[username].password = newPassword;
        res.json({ success: true, message: "Mot de passe changé avec succès" });
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        res.status(500).json({ success: false, message: "Erreur lors du changement de mot de passe" });
    }
});


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
app.post('/friend_request', async (req, res) => {
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

    try {
        // Vérifier s'ils sont déjà amis
        const existingFriend = await pool.query(
            'SELECT * FROM friends WHERE username = $1 AND friend_username = $2',
            [from, to]
        );
        if (existingFriend.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Déjà amis" });
        }

        // Vérifier si une demande existe déjà
        const existingRequest = await pool.query(
            'SELECT * FROM friend_requests WHERE from_username = $1 AND to_username = $2',
            [from, to]
        );
        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Demande déjà envoyée" });
        }

        await pool.query(
            'INSERT INTO friend_requests (from_username, to_username) VALUES ($1, $2)',
            [from, to]
        );

        if (!friendRequests[to]) {
            friendRequests[to] = [];
        }
        friendRequests[to].push(from);

        // Notifier le destinataire
        io.emit('friend_request_received', { from, to });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la demande d\'ami:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'envoi de la demande d'ami" });
    }
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
app.post('/accept_friend', async (req, res) => {
    const { username, friendUsername } = req.body;

    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }

    try {
        // Retirer la demande
        await pool.query(
            'DELETE FROM friend_requests WHERE to_username = $1 AND from_username = $2',
            [username, friendUsername]
        );

        if (friendRequests[username]) {
            friendRequests[username] = friendRequests[username].filter(u => u !== friendUsername);
        }

        // Ajouter aux amis des deux côtés
        await pool.query(
            'INSERT INTO friends (username, friend_username) VALUES ($1, $2)',
            [username, friendUsername]
        );
        await pool.query(
            'INSERT INTO friends (username, friend_username) VALUES ($1, $2)',
            [friendUsername, username]
        );

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

        // Notifier les deux utilisateurs
        io.emit('friend_accepted', { username, friendUsername });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de la demande d\'ami:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'acceptation de la demande d'ami" });
    }
});

// Refuser une demande d'ami
app.post('/reject_friend', async (req, res) => {
    const { username, friendUsername } = req.body;

    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }

    try {
        await pool.query(
            'DELETE FROM friend_requests WHERE to_username = $1 AND from_username = $2',
            [username, friendUsername]
        );

        if (friendRequests[username]) {
            friendRequests[username] = friendRequests[username].filter(u => u !== friendUsername);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors du rejet de la demande d\'ami:', error);
        res.status(500).json({ success: false, message: "Erreur lors du rejet de la demande d'ami" });
    }
});

// Supprimer un ami
app.post('/remove_friend', async (req, res) => {
    const { username, friendUsername } = req.body;

    if (!username || !friendUsername) {
        return res.status(400).json({ success: false, message: "Utilisateurs requis" });
    }

    try {
        await pool.query(
            'DELETE FROM friends WHERE username = $1 AND friend_username = $2',
            [username, friendUsername]
        );
        await pool.query(
            'DELETE FROM friends WHERE username = $1 AND friend_username = $2',
            [friendUsername, username]
        );

        if (friends[username]) {
            friends[username] = friends[username].filter(u => u !== friendUsername);
        }
        if (friends[friendUsername]) {
            friends[friendUsername] = friends[friendUsername].filter(u => u !== username);
        }

        // Notifier les deux utilisateurs
        io.emit('friend_removed', { username, friendUsername });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'ami:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'ami" });
    }
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
app.post('/private_message', async (req, res) => {
    const { from, to, message } = req.body;

    if (!from || !to || !message) {
        return res.status(400).json({ success: false, message: "Expéditeur, destinataire et message requis" });
    }

    try {
        // Créer une clé unique pour la conversation
        const conversationKey = [from, to].sort().join('_');

        if (!privateMessages[conversationKey]) {
            privateMessages[conversationKey] = [];
        }

        const result = await pool.query(
            'INSERT INTO private_messages (from_username, to_username, message) VALUES ($1, $2, $3) RETURNING *',
            [from, to, message]
        );

        const msgData = {
            id: result.rows[0].id,
            from: result.rows[0].from_username,
            to: result.rows[0].to_username,
            message: result.rows[0].message,
            timestamp: result.rows[0].timestamp
        };

        privateMessages[conversationKey].push(msgData);

        // Notifier les deux utilisateurs via socket
        io.emit('private_message', msgData);

        res.json({ success: true, message: msgData });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message privé:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'envoi du message privé" });
    }
});

// Mettre à jour le nom d'un serveur
app.post('/update_server_name', async (req, res) => {
    const { serverId, name } = req.body;

    if (!serverId || !name) {
        return res.status(400).json({ success: false, message: "ID du serveur et nom requis" });
    }

    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }

    try {
        await pool.query('UPDATE servers SET name = $1 WHERE id = $2', [name, serverId]);
        servers[serverId].name = name;
        console.log(`Nom du serveur ${serverId} mis à jour: ${name}`);
        res.json({ success: true, server: servers[serverId] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du nom du serveur:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du nom du serveur" });
    }
});

// Mettre à jour le logo d'un serveur
app.post('/update_server_logo', async (req, res) => {
    const { serverId, logo } = req.body;

    if (!serverId) {
        return res.status(400).json({ success: false, message: "ID du serveur requis" });
    }

    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }

    try {
        await pool.query('UPDATE servers SET logo = $1 WHERE id = $2', [logo || null, serverId]);
        servers[serverId].logo = logo || null;
        res.json({ success: true, server: servers[serverId] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du logo du serveur:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour du logo du serveur" });
    }
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
app.post('/servers/:serverId/roles', async (req, res) => {
    const { serverId } = req.params;
    const { name, color } = req.body;

    if (!serverId || !name) {
        return res.status(400).json({ success: false, message: "ID du serveur et nom du rôle requis" });
    }

    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }

    try {
        if (!serverRoles[serverId]) {
            serverRoles[serverId] = [];
        }

        const newRole = {
            id: String(Date.now()),
            name: name,
            color: color || '#5865f2',
            permissions: []
        };

        await pool.query(
            'INSERT INTO server_roles (id, server_id, name, color, permissions) VALUES ($1, $2, $3, $4, $5)',
            [newRole.id, serverId, name, color || '#5865f2', []]
        );

        serverRoles[serverId].push(newRole);
        res.json({ success: true, role: newRole });
    } catch (error) {
        console.error('Erreur lors de la création du rôle:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la création du rôle" });
    }
});

// Supprimer un rôle d'un serveur
app.delete('/servers/:serverId/roles/:roleId', async (req, res) => {
    const { serverId, roleId } = req.params;

    if (!serverRoles[serverId]) {
        return res.status(404).json({ success: false, message: "Rôles non trouvés" });
    }

    try {
        await pool.query('DELETE FROM server_roles WHERE id = $1', [roleId]);
        serverRoles[serverId] = serverRoles[serverId].filter(role => role.id !== roleId);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la suppression du rôle:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la suppression du rôle" });
    }
});

// Mettre à jour les permissions d'un rôle
app.post('/servers/:serverId/roles/:roleId/permissions', async (req, res) => {
    const { serverId, roleId } = req.params;
    const { permissions } = req.body;

    if (!serverRoles[serverId]) {
        return res.status(404).json({ success: false, message: "Rôles non trouvés" });
    }

    const role = serverRoles[serverId].find(r => r.id === roleId);
    if (!role) {
        return res.status(404).json({ success: false, message: "Rôle non trouvé" });
    }

    try {
        await pool.query('UPDATE server_roles SET permissions = $1 WHERE id = $2', [permissions || [], roleId]);
        role.permissions = permissions || [];
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des permissions du rôle:', error);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour des permissions du rôle" });
    }
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
app.delete('/servers/:serverId/invites/:username', async (req, res) => {
    const { serverId, username } = req.params;

    if (!serverInvites[serverId]) {
        return res.status(404).json({ success: false, message: "Invitations non trouvées" });
    }

    try {
        await pool.query('DELETE FROM server_invites WHERE server_id = $1 AND username = $2', [serverId, username]);
        serverInvites[serverId] = serverInvites[serverId].filter(u => u !== username);
        res.json({ success: true, invites: serverInvites[serverId] });
    } catch (error) {
        console.error('Erreur lors du retrait de l\'invitation:', error);
        res.status(500).json({ success: false, message: "Erreur lors du retrait de l'invitation" });
    }
});

// Obtenir la date de création d'un compte depuis PostgreSQL
app.post('/get_account_creation_date', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: "Nom d'utilisateur requis" });
    }

    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    res.json({ success: true, joinedAt: users[username].joinedAt });
});

// Inviter un ami à un serveur
app.post('/servers/:serverId/invite', async (req, res) => {
    const { serverId } = req.params;
    const { username } = req.body;

    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }

    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    try {
        const result = await pool.query('SELECT * FROM server_invites WHERE server_id = $1 AND username = $2', [serverId, username]);
        if (result.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Utilisateur déjà invité" });
        }

        await pool.query(
            'INSERT INTO server_invites (server_id, username) VALUES ($1, $2)',
            [serverId, username]
        );

        // Notifier l'utilisateur invité
        io.emit('server_invite_received', { serverId, username });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de l\'invitation au serveur:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'invitation au serveur" });
    }
});

// Accepter une invitation à un serveur
app.post('/servers/:serverId/accept_invite', async (req, res) => {
    const { serverId } = req.params;
    const { username } = req.body;

    if (!servers[serverId]) {
        return res.status(404).json({ success: false, message: "Serveur non trouvé" });
    }

    if (!users[username]) {
        return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    try {
        // Retirer l'invitation
        await pool.query('DELETE FROM server_invites WHERE server_id = $1 AND username = $2', [serverId, username]);

        if (serverInvites[serverId]) {
            serverInvites[serverId] = serverInvites[serverId].filter(u => u !== username);
        }

        // Ajouter l'utilisateur au serveur
        await pool.query('INSERT INTO server_members (server_id, username) VALUES ($1, $2)', [serverId, username]);

        if (!servers[serverId].members.includes(username)) {
            servers[serverId].members.push(username);
        }

        // Ajouter l'utilisateur au salon général
        const generalRoomId = servers[serverId].rooms[0];
        if (generalRoomId && rooms[generalRoomId]) {
            await pool.query('INSERT INTO room_members (room_id, username) VALUES ($1, $2)', [generalRoomId, username]);

            if (!rooms[generalRoomId].members.includes(username)) {
                rooms[generalRoomId].members.push(username);
            }
        }

        res.json({ success: true, server: servers[serverId] });
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de l\'invitation:', error);
        res.status(500).json({ success: false, message: "Erreur lors de l'acceptation de l'invitation" });
    }
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

// Démarrage du serveur
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Loading data from database...');
        await loadAllData();
        console.log('Starting server...');
        server.listen(PORT, () => {
            console.log(`Serveur Chordia démarré sur le port ${PORT}`);
        });
    } catch (error) {
        console.error('Error during server startup:', error);
        console.log('Starting server anyway (some features may not work)...');
        server.listen(PORT, () => {
            console.log(`Serveur Chordia démarré sur le port ${PORT} (with errors)`);
        });
    }
}

startServer();

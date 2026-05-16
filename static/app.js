// Variables globales
let socket;
let currentUsername = '';
let currentDisplayname = '';
let currentRoomId = null;
let currentServerId = null;
let typingTimeout;
let currentPrivateChatUser = null;
let currentServerLogo = null;
let friendsData = {};
let selectedFile = null;
let selectedPrivateFile = null;

// WebRTC variables
let localStream = null;
let peerConnection = null;
let isCallActive = false;
let isMuted = false;
let isVideoEnabled = true;
const rtcServers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

// Charger les paramètres depuis localStorage
const savedSettings = localStorage.getItem('userSettings');
let userSettings = savedSettings ? JSON.parse(savedSettings) : {
    avatarColor: '#5865f2',
    status: 'online',
    theme: 'dark',
    bio: '',
    avatarImage: null,
    bannerImage: null
};
let users = {};
let servers = {};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Tabs
    document.getElementById('login-tab').addEventListener('click', () => {
        document.getElementById('login-tab').classList.add('active');
        document.getElementById('register-tab').classList.remove('active');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    });
    
    document.getElementById('register-tab').addEventListener('click', () => {
        document.getElementById('register-tab').classList.add('active');
        document.getElementById('login-tab').classList.remove('active');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
    });
    
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Création de salon textuel
    document.getElementById('add-channel-btn').addEventListener('click', () => {
        document.getElementById('create-room-modal').classList.remove('hidden');
    });
    
    // Création de salon vocal
    document.getElementById('add-voice-channel-btn').addEventListener('click', () => {
        const voiceChannelName = prompt('Nom du salon vocal:');
        if (voiceChannelName) {
            addVoiceChannel(voiceChannelName);
        }
    });
    
    document.getElementById('cancel-room-btn').addEventListener('click', () => {
        document.getElementById('create-room-modal').classList.add('hidden');
    });
    
    document.getElementById('create-room-form').addEventListener('submit', handleCreateRoom);
    
    // Paramètres
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('hidden');
        document.getElementById('settings-username').value = currentUsername;
        document.getElementById('settings-status').value = userSettings.status;
        document.getElementById('settings-theme').value = userSettings.theme;
        document.getElementById('settings-bio').value = userSettings.bio || '';
        document.getElementById('settings-avatar-text').textContent = currentDisplayname.charAt(0).toUpperCase();

        // Restaurer l'avatar si une photo a été uploadée
        if (userSettings.avatarImage) {
            const avatarPreview = document.getElementById('settings-avatar-preview');
            avatarPreview.style.backgroundImage = `url(${userSettings.avatarImage})`;
            avatarPreview.style.backgroundSize = 'cover';
            avatarPreview.style.backgroundPosition = 'center';
            document.getElementById('settings-avatar-text').style.display = 'none';
        }

        // Restaurer la bannière si une image a été uploadée
        if (userSettings.bannerImage) {
            const bannerPreview = document.getElementById('settings-banner-preview');
            bannerPreview.style.backgroundImage = `url(${userSettings.bannerImage})`;
            bannerPreview.style.backgroundSize = 'cover';
            bannerPreview.style.backgroundPosition = 'center';
        } else {
            const bannerPreview = document.getElementById('settings-banner-preview');
            bannerPreview.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }

        console.log('settings ouvert, bio:', userSettings.bio, 'avatarImage:', userSettings.avatarImage, 'bannerImage:', userSettings.bannerImage);
    });
    
    document.getElementById('settings-upload-avatar-btn').addEventListener('click', () => {
        document.getElementById('settings-avatar-input').click();
    });

    document.getElementById('settings-avatar-input').addEventListener('change', handleSettingsAvatarUpload);

    // Banner upload
    document.getElementById('settings-upload-banner-btn').addEventListener('click', () => {
        document.getElementById('settings-banner-input').click();
    });

    document.getElementById('settings-banner-input').addEventListener('change', handleSettingsBannerUpload);
    
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.add('hidden');
    });

    // Change password button
    document.getElementById('change-password-btn').addEventListener('click', handleChangePassword);
    
    document.getElementById('cancel-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.add('hidden');
    });
    
    document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);
    
    // Création de serveur
    document.getElementById('add-server-btn').addEventListener('click', () => {
        document.getElementById('create-server-modal').classList.remove('hidden');
    });
    
    document.getElementById('cancel-server-btn').addEventListener('click', () => {
        document.getElementById('create-server-modal').classList.add('hidden');
    });
    
    document.getElementById('create-server-form').addEventListener('submit', handleCreateServer);
    
    // Appels
    document.getElementById('call-btn').addEventListener('click', startCall);
    document.getElementById('video-btn').addEventListener('click', startVideoCall);
    document.getElementById('hangup-btn').addEventListener('click', endCall);
    document.getElementById('mute-btn').addEventListener('click', toggleMute);
    document.getElementById('toggle-video-btn').addEventListener('click', toggleVideo);
    
    // Messages
    document.getElementById('message-form').addEventListener('submit', handleSendMessage);

    // File attachment
    document.getElementById('attach-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    // Private file attachment
    document.getElementById('private-attach-btn').addEventListener('click', () => {
        document.getElementById('private-file-input').click();
    });

    document.getElementById('private-file-input').addEventListener('change', handlePrivateFileSelect);
    
    // Toggle members sidebar
    document.getElementById('members-toggle-btn').addEventListener('click', () => {
        document.getElementById('members-sidebar').classList.toggle('hidden');
    });
    
    // Profile modal
    document.getElementById('close-profile-btn').addEventListener('click', () => {
        document.getElementById('profile-modal').classList.add('hidden');
    });
    
    // Typing indicator
    document.getElementById('message-input').addEventListener('input', handleTyping);

    // Home button (logo) - main screen
    document.getElementById('home-btn-main').addEventListener('click', showHomeScreen);

    // Home button (logo) - home screen
    document.getElementById('home-btn-home').addEventListener('click', showHomeScreen);

    // Add friend form
    document.getElementById('add-friend-form').addEventListener('submit', handleAddFriend);

    // Private message form
    document.getElementById('private-message-form').addEventListener('submit', handleSendPrivateMessage);

    // Add server button in home screen
    document.getElementById('add-server-btn-home').addEventListener('click', () => {
        document.getElementById('create-server-modal').classList.remove('hidden');
    });

    // Server settings button
    document.getElementById('server-settings-btn').addEventListener('click', openServerSettings);

    // Server settings modal close/cancel/save buttons
    document.getElementById('close-server-settings-btn').addEventListener('click', () => {
        document.getElementById('server-settings-modal').classList.add('hidden');
    });

    document.getElementById('cancel-server-settings-btn').addEventListener('click', () => {
        document.getElementById('server-settings-modal').classList.add('hidden');
    });

    document.getElementById('save-server-settings-btn').addEventListener('click', saveServerSettings);

    // Server logo upload
    document.getElementById('upload-server-logo-btn').addEventListener('click', () => {
        document.getElementById('server-logo-input').click();
    });

    document.getElementById('server-logo-input').addEventListener('change', handleServerLogoUpload);

    // Add role button
    document.getElementById('add-role-btn').addEventListener('click', addRole);

    // Invite friend button
    document.getElementById('invite-friend-btn').addEventListener('click', inviteFriend);

    // Private chat calling buttons
    document.getElementById('private-call-btn').addEventListener('click', startPrivateCall);
    document.getElementById('private-video-btn').addEventListener('click', startPrivateVideoCall);

    // Profile sidebar
    document.getElementById('close-profile-sidebar').addEventListener('click', hideProfileSidebar);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    console.log('Tentative de connexion:', { username });
    
    if (!username || !password) {
        console.log('Nom d\'utilisateur ou mot de passe manquant');
        return;
    }
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        console.log('Réponse du serveur:', data);
        
        if (data.success) {
            currentUsername = username;
            currentDisplayname = data.user.displayname;
            initializeSocket();
            showMainScreen();
            loadRooms();
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        alert('Erreur lors de la connexion');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const displayname = document.getElementById('register-displayname').value.trim();
    const password = document.getElementById('register-password').value.trim();
    
    console.log('Tentative d\'inscription:', { username, displayname });
    
    if (!username || !displayname || !password) {
        console.log('Nom d\'utilisateur, pseudo ou mot de passe manquant');
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, displayname, password })
        });
        
        const data = await response.json();
        console.log('Réponse du serveur:', data);
        
        if (data.success) {
            alert('Inscription réussie! Connectez-vous maintenant.');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('login-tab').classList.add('active');
            document.getElementById('register-tab').classList.remove('active');
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        alert('Erreur lors de l\'inscription');
    }
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connecté au serveur');
    });
    
    socket.on('user_joined', (data) => {
        if (data.room_id === currentRoomId) {
            addSystemMessage(`${data.username} a rejoint le salon`);
        }
        loadUsers();
    });
    
    socket.on('user_left', (data) => {
        if (data.room_id === currentRoomId) {
            addSystemMessage(`${data.username} a quitté le salon`);
        }
        loadUsers();
    });
    
    socket.on('user_status', (data) => {
        const { username, status } = data;
        if (users[username]) {
            users[username].status = status;
            loadUsers();
        }
    });
    
    socket.on('user_profile_updated', (data) => {
        const { username, bio, avatarImage } = data;
        if (users[username]) {
            users[username].bio = bio;
            users[username].avatarImage = avatarImage;
            loadUsers();
        }
    });
    
    socket.on('new_message', (data) => {
        if (data.room_id === currentRoomId) {
            addMessage(data, true);
        }
    });

    socket.on('friend_request_received', (data) => {
        loadFriendRequests();
    });

    socket.on('friend_accepted', (data) => {
        loadFriends();
    });

    socket.on('friend_removed', (data) => {
        loadFriends();
    });

    socket.on('private_message', (data) => {
        if (currentPrivateChatUser && (data.from === currentPrivateChatUser || data.to === currentPrivateChatUser)) {
            addPrivateMessage(data, true);
        }
    });

    // WebRTC signaling
    socket.on('call_offer', async (data) => {
        const { offer, username, callerSocketId, type } = data;

        if (confirm(`${username} vous appelle (${type === 'video' ? 'vidéo' : 'audio'}). Accepter?`)) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === 'video'
                });
                localStream = stream;
                document.getElementById('local-video').srcObject = stream;

                document.getElementById('call-modal').classList.remove('hidden');
                document.getElementById('call-status').textContent = 'Appel en cours...';
                isCallActive = true;

                // Create peer connection
                peerConnection = new RTCPeerConnection(rtcServers);

                // Add local stream to peer connection
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice_candidate', {
                            candidate: event.candidate,
                            target: callerSocketId,
                            isPrivate: !!currentPrivateChatUser
                        });
                    }
                };

                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    document.getElementById('remote-video').srcObject = event.streams[0];
                };

                // Set remote description (offer)
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

                // Create answer
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                // Send answer
                socket.emit('call_answer', {
                    answer: answer,
                    callerSocketId: callerSocketId
                });
            } catch (error) {
                console.error('Erreur lors de la réponse à l\'appel:', error);
                alert('Impossible de répondre à l\'appel');
            }
        }
    });

    socket.on('call_answer', async (data) => {
        const { answer } = data;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice_candidate', async (data) => {
        const { candidate } = data;
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('call_ended', () => {
        endCall();
    });
}

function showMainScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('current-username-mini').textContent = currentDisplayname;
    document.getElementById('user-avatar-text').textContent = currentDisplayname.charAt(0).toUpperCase();
    
    // Charger les serveurs
    loadServers();
}

function showHomeScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    
    // Charger les amis et demandes
    loadFriends();
    loadFriendRequests();
    loadServersHome();
    
    // Mettre à jour l'avatar dans l'écran d'accueil
    document.getElementById('current-username-mini-home').textContent = currentDisplayname;
    document.getElementById('user-avatar-text-home').textContent = currentDisplayname.charAt(0).toUpperCase();
    if (userSettings.avatarImage) {
        const userAvatarHome = document.getElementById('user-avatar-home');
        userAvatarHome.style.backgroundImage = `url(${userSettings.avatarImage})`;
        userAvatarHome.style.backgroundSize = 'cover';
        userAvatarHome.style.backgroundPosition = 'center';
        document.getElementById('user-avatar-text-home').style.display = 'none';
    }
    
    // Afficher le formulaire d'ajout d'ami par défaut
    document.getElementById('private-chat-container').classList.add('hidden');
    document.getElementById('add-friend-container').classList.remove('hidden');
    document.getElementById('home-title').textContent = 'Amis';
    currentPrivateChatUser = null;
}

async function loadServers() {
    try {
        const response = await fetch('/servers');
        const serversData = await response.json();
        
        // Mettre à jour la variable globale servers
        serversData.forEach(server => {
            servers[server.id] = server;
        });
        
        const serverList = document.getElementById('server-list');
        serverList.innerHTML = '';
        
        serversData.forEach(server => {
            const serverIcon = document.createElement('div');
            serverIcon.className = 'server-icon';
            serverIcon.title = server.name;
            
            if (server.logo) {
                serverIcon.innerHTML = `<img src="${server.logo}" alt="${server.name}" class="server-logo-img">`;
            } else {
                serverIcon.innerHTML = `<span>${server.name.charAt(0).toUpperCase()}</span>`;
            }
            
            serverIcon.addEventListener('click', () => {
                selectServer(server);
            });
            serverList.appendChild(serverIcon);
        });

        // Also load in home screen
        loadServersHome();
    } catch (error) {
        console.error('Erreur lors du chargement des serveurs:', error);
    }
}

async function loadServersHome() {
    try {
        const response = await fetch('/servers');
        const serversData = await response.json();
        
        const serverListHome = document.getElementById('server-list-home');
        serverListHome.innerHTML = '';
        
        serversData.forEach(server => {
            const serverIcon = document.createElement('div');
            serverIcon.className = 'server-icon';
            serverIcon.title = server.name;
            
            if (server.logo) {
                serverIcon.innerHTML = `<img src="${server.logo}" alt="${server.name}" class="server-logo-img">`;
            } else {
                serverIcon.innerHTML = `<span>${server.name.charAt(0).toUpperCase()}</span>`;
            }
            
            serverIcon.addEventListener('click', () => {
                selectServer(server);
            });
            serverListHome.appendChild(serverIcon);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des serveurs (home):', error);
    }
}

async function selectServer(server) {
    currentServerId = server.id;
    
    // Si on est sur l'écran d'accueil, basculer vers l'écran principal
    if (!document.getElementById('home-screen').classList.contains('hidden')) {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
    }
    
    // Mettre à jour le nom du serveur affiché
    document.getElementById('server-name').textContent = server.name;
    
    // Charger les salons de ce serveur
    try {
        const response = await fetch(`/servers/${server.id}/rooms`);
        const roomsData = await response.json();
        
        const textChannelsList = document.getElementById('text-channels-list');
        const voiceChannelsList = document.getElementById('voice-channels-list');
        textChannelsList.innerHTML = '';
        voiceChannelsList.innerHTML = '';
        
        roomsData.forEach(room => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            channelElement.innerHTML = `
                <span class="channel-hash">${room.type === 'voice' ? '🔊' : '#'}</span>
                <span>${room.name}</span>
            `;
            channelElement.addEventListener('click', () => joinRoom(room));
            
            if (room.type === 'voice') {
                voiceChannelsList.appendChild(channelElement);
            } else {
                textChannelsList.appendChild(channelElement);
            }
        });
        
        // Rejoindre le premier salon textuel si disponible
        const firstTextRoom = roomsData.find(r => r.type === 'text');
        if (firstTextRoom) {
            joinRoom(firstTextRoom);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des salons du serveur:', error);
    }
}

async function loadRooms() {
    if (!currentServerId) return;
    
    try {
        const response = await fetch(`/servers/${currentServerId}/rooms`);
        const roomsData = await response.json();
        
        const textChannelsList = document.getElementById('text-channels-list');
        const voiceChannelsList = document.getElementById('voice-channels-list');
        textChannelsList.innerHTML = '';
        voiceChannelsList.innerHTML = '';
        
        roomsData.forEach(room => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            channelElement.innerHTML = `
                <span class="channel-hash">${room.type === 'voice' ? '🔊' : '#'}</span>
                <span>${room.name}</span>
            `;
            channelElement.addEventListener('click', () => joinRoom(room));
            
            if (room.type === 'voice') {
                voiceChannelsList.appendChild(channelElement);
            } else {
                textChannelsList.appendChild(channelElement);
            }
        });
    } catch (error) {
        console.error('Erreur lors du chargement des salons:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/users');
        const usersData = await response.json();
        
        // Mettre à jour la variable globale users
        const onlineMembersList = document.getElementById('online-members-list');
        const offlineMembersList = document.getElementById('offline-members-list');
        onlineMembersList.innerHTML = '';
        offlineMembersList.innerHTML = '';
        
        // Compter les membres en ligne et hors ligne
        let onlineCount = 0;
        let offlineCount = 0;
        
        usersData.forEach(user => {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-item';
            
            // Déterminer la couleur de statut
            let statusColor = '#747f8d'; // offline
            let statusEmoji = '⚫';
            let isOnline = false;
            
            if (user.status === 'online') {
                statusColor = '#3ba55c';
                statusEmoji = '🟢';
                isOnline = true;
                onlineCount++;
            } else if (user.status === 'idle') {
                statusColor = '#faa61a';
                statusEmoji = '🟡';
                isOnline = true;
                onlineCount++;
            } else if (user.status === 'dnd') {
                statusColor = '#ed4245';
                statusEmoji = '🔴';
                isOnline = true;
                onlineCount++;
            } else {
                offlineCount++;
            }
            
            // Appliquer la photo de profil de l'utilisateur concerné ou de l'utilisateur actuel si c'est le même
            let avatarStyle = `background: #5865f2`;
            let avatarText = `<span>${user.displayname.charAt(0).toUpperCase()}</span>`;
            const avatarImage = user.avatarImage || (user.username === currentUsername ? userSettings.avatarImage : null);
            if (avatarImage) {
                avatarStyle = `background-image: url(${avatarImage}); background-size: cover; background-position: center;`;
                avatarText = '';
            }
            
            memberElement.innerHTML = `
                <div class="member-avatar-container">
                    <div class="member-avatar" style="${avatarStyle}">
                        ${avatarText}
                    </div>
                    <div class="status-indicator" style="background: ${statusColor}"></div>
                </div>
                <div class="member-info">
                    <span class="member-name ${!isOnline ? 'offline' : ''}">${user.displayname}</span>
                    <span class="member-status">${statusEmoji} ${user.status}</span>
                </div>
            `;
            memberElement.addEventListener('click', () => showProfile(user));
            
            // Ajouter à la liste appropriée
            if (isOnline) {
                onlineMembersList.appendChild(memberElement);
            } else {
                offlineMembersList.appendChild(memberElement);
            }
            
            // Stocker les utilisateurs dans un objet global en préservant les données locales
            if (!users[user.username]) {
                users[user.username] = user;
            } else {
                // Conserver les données locales (bio, avatarImage) si elles existent
                users[user.username] = {
                    ...user,
                    bio: users[user.username].bio || user.bio,
                    avatarImage: users[user.username].avatarImage || user.avatarImage
                };
            }
        });
        
        // Mettre à jour les compteurs
        document.getElementById('online-count').textContent = onlineCount;
        document.getElementById('offline-count').textContent = offlineCount;
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

async function handleCreateRoom(e) {
    e.preventDefault();
    
    const roomName = document.getElementById('room-name-input').value.trim();
    
    if (!roomName) {
        alert('Nom du salon requis');
        return;
    }
    
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur d\'abord');
        return;
    }
    
    try {
        const response = await fetch('/create_room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: roomName, creator: currentUsername, serverId: currentServerId, type: 'text' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('create-room-modal').classList.add('hidden');
            document.getElementById('room-name-input').value = '';
            loadRooms();
            joinRoom(data.room);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de la création du salon:', error);
        alert('Erreur lors de la création du salon');
    }
}

function joinRoom(room) {
    // Quitter l'ancien salon si nécessaire
    if (currentRoomId) {
        socket.emit('leave', { username: currentUsername, room_id: currentRoomId });
    }
    
    currentRoomId = room.id;
    
    // Rejoindre le nouveau salon
    socket.emit('join', { username: currentUsername, room_id: room.id });
    
    // Mettre à jour l'UI
    document.getElementById('current-channel-name').textContent = room.name;
    document.getElementById('message-input').placeholder = `Envoyer un message dans #${room.name}`;
    
    // Mettre à jour la liste des channels
    loadRooms();
    
    // Charger les messages
    loadMessages(room.id);
}

async function loadMessages(roomId) {
    try {
        const response = await fetch(`/rooms/${roomId}/messages`);
        const messages = await response.json();
        
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        messages.forEach(msg => {
            addMessage(msg, false);
        });
        
        scrollToBottom();
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
    }
}

function addMessage(message, animate = true) {
    const messagesContainer = document.getElementById('messages-container');

    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    const time = new Date(message.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Récupérer le displayname si disponible
    const user = users[message.username];
    const displayName = user ? user.displayname : message.username;

    let messageContent = '';

    if (message.file) {
        // Handle file attachment
        const fileType = message.file.type;
        if (fileType.startsWith('image/')) {
            messageContent = `
                <div class="message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <img src="${message.file.data}" alt="${escapeHtml(message.file.name)}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 8px;">
                </div>
            `;
        } else if (fileType.startsWith('video/')) {
            messageContent = `
                <div class="message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <video src="${message.file.data}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 8px;"></video>
                </div>
            `;
        } else if (fileType.startsWith('audio/')) {
            messageContent = `
                <div class="message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <audio src="${message.file.data}" controls style="width: 100%; margin-top: 8px;"></audio>
                </div>
            `;
        } else {
            messageContent = `
                <div class="message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <a href="${message.file.data}" download="${escapeHtml(message.file.name)}" style="color: #5865f2; text-decoration: underline;">📎 ${escapeHtml(message.file.name)}</a>
                </div>
            `;
        }
    } else {
        messageContent = `<div class="message-text">${escapeHtml(message.message)}</div>`;
    }

    messageElement.innerHTML = `
        <div class="message-avatar">
            <span>${displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-username">${displayName}</span>
                <span class="message-time">${time}</span>
            </div>
            ${messageContent}
        </div>
    `;

    if (!animate) {
        messageElement.style.animation = 'none';
    }

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

function addSystemMessage(text) {
    const messagesContainer = document.getElementById('messages-container');
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.innerHTML = `
        <div class="message-content" style="background: rgba(255, 255, 255, 0.05); font-style: italic; color: #a0a0a0;">
            ${escapeHtml(text)}
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

function handleSendMessage(e) {
    e.preventDefault();
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (!message && !selectedFile) return;

    if (selectedFile) {
        // Send file
        sendFileMessage(message);
    } else {
        if (currentPrivateChatUser) {
            // Envoyer message privé
            sendPrivateMessage(currentPrivateChatUser, message);
        } else {
            // Envoyer message dans le salon
            socket.emit('send_message', {
                username: currentUsername,
                room_id: currentRoomId,
                message: message
            });
        }
    }

    messageInput.value = '';
    selectedFile = null;
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Le fichier est trop grand (max 10MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        selectedFile = {
            name: file.name,
            type: file.type,
            data: event.target.result
        };

        // Show preview in message input
        const messageInput = document.getElementById('message-input');
        messageInput.placeholder = `Fichier sélectionné: ${file.name}`;
    };
    reader.readAsDataURL(file);
}

function handlePrivateFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Le fichier est trop grand (max 10MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        selectedPrivateFile = {
            name: file.name,
            type: file.type,
            data: event.target.result
        };

        // Show preview in message input
        const messageInput = document.getElementById('private-message-input');
        messageInput.placeholder = `Fichier sélectionné: ${file.name}`;
    };
    reader.readAsDataURL(file);
}

async function sendFileMessage(textMessage) {
    if (!selectedFile) return;

    const messageData = {
        username: currentUsername,
        room_id: currentRoomId,
        message: textMessage || '',
        file: {
            name: selectedFile.name,
            type: selectedFile.type,
            data: selectedFile.data
        }
    };

    if (currentPrivateChatUser) {
        messageData.to = currentPrivateChatUser;
        await fetch('/private_message_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });
    } else {
        socket.emit('send_message', messageData);
    }
}

async function sendPrivateFileMessage(textMessage) {
    if (!selectedPrivateFile) return;

    const messageData = {
        from: currentUsername,
        to: currentPrivateChatUser,
        message: textMessage || '',
        file: {
            name: selectedPrivateFile.name,
            type: selectedPrivateFile.type,
            data: selectedPrivateFile.data
        }
    };

    await fetch('/private_message_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
    });
}

function handleTyping() {
    if (!currentRoomId) return;
    
    socket.emit('typing', {
        username: currentUsername,
        room_id: currentRoomId,
        is_typing: true
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            username: currentUsername,
            room_id: currentRoomId,
            is_typing: false
        });
    }, 1000);
}

function showTypingIndicator(username, isTyping) {
    const indicator = document.getElementById('typing-indicator');
    
    if (isTyping) {
        indicator.textContent = `${username} est en train d'écrire...`;
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function createDefaultRoom(serverName = 'général') {
    // Cette fonction n'est plus nécessaire car les serveurs créent automatiquement un salon général
    console.log('createDefaultRoom appelé avec:', serverName);
}

function handleLogout() {
    if (socket) {
        socket.disconnect();
    }
    
    currentUsername = '';
    currentDisplayname = '';
    currentRoomId = null;
    
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username-input').value = '';
    document.getElementById('displayname-input').value = '';
}

function handleSaveSettings() {
    const newUsername = document.getElementById('settings-username').value.trim();
    const newStatus = document.getElementById('settings-status').value;
    const newTheme = document.getElementById('settings-theme').value;
    const newBio = document.getElementById('settings-bio').value;
    
    if (newUsername && newUsername !== currentUsername) {
        // Mettre à jour le nom d'utilisateur (nécessite une implémentation backend)
        currentUsername = newUsername;
        document.getElementById('current-username-mini').textContent = currentUsername;
        document.getElementById('user-avatar-text').textContent = currentUsername.charAt(0).toUpperCase();
    }
    
    userSettings.status = newStatus;
    userSettings.theme = newTheme;
    userSettings.bio = newBio;
    // L'avatarImage est déjà sauvegardé dans userSettings lors de l'upload
    
    // Mettre à jour la bio et l'avatar de l'utilisateur actuel dans la liste des utilisateurs
    if (users[currentUsername]) {
        users[currentUsername].bio = newBio;
        users[currentUsername].avatarImage = userSettings.avatarImage;
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
    
    // Envoyer les mises à jour au backend
    fetch('/update_profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: currentUsername,
            bio: newBio,
            avatarImage: userSettings.avatarImage
        })
    }).then(response => response.json())
    .then(data => {
        console.log('Profil mis à jour sur le backend:', data);
    }).catch(error => {
        console.error('Erreur lors de la mise à jour du profil:', error);
    });
    
    // Appliquer les changements
    applySettings();
    
    document.getElementById('settings-modal').classList.add('hidden');
    
    console.log('handleSaveSettings: bio sauvegardée:', newBio, 'avatarImage:', userSettings.avatarImage);
}

function handleSettingsAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const avatarPreview = document.getElementById('settings-avatar-preview');
            avatarPreview.style.backgroundImage = `url(${event.target.result})`;
            avatarPreview.style.backgroundSize = 'cover';
            avatarPreview.style.backgroundPosition = 'center';
            document.getElementById('settings-avatar-text').style.display = 'none';
            userSettings.avatarImage = event.target.result;

            // Sauvegarder dans localStorage
            localStorage.setItem('userSettings', JSON.stringify(userSettings));

            // Mettre à jour l'avatar de l'utilisateur actuel dans la liste des utilisateurs
            if (users[currentUsername]) {
                users[currentUsername].avatarImage = event.target.result;
            }

            // Mettre à jour l'avatar en bas à gauche
            const userAvatar = document.getElementById('user-avatar');
            if (userAvatar) {
                userAvatar.style.backgroundImage = `url(${event.target.result})`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                document.getElementById('user-avatar-text').style.display = 'none';
            }

            // Envoyer la mise à jour au backend
            fetch('/update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUsername, avatarImage: event.target.result })
            });

            // Recharger la liste des utilisateurs pour appliquer la nouvelle photo
            loadUsers();
        };
        reader.readAsDataURL(file);
    }
}

function handleSettingsBannerUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // Valider le type de fichier
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            alert('Seuls les fichiers JPEG, JPG, PNG et GIF sont autorisés');
            return;
        }

        // Valider la taille du fichier (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('L\'image ne doit pas dépasser 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const bannerBase64 = event.target.result;

            fetch('/upload_banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUsername, bannerImage: bannerBase64 })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const bannerPreview = document.getElementById('settings-banner-preview');
                    bannerPreview.style.backgroundImage = `url(${data.bannerUrl})`;
                    bannerPreview.style.backgroundSize = 'cover';
                    bannerPreview.style.backgroundPosition = 'center';
                    userSettings.bannerImage = data.bannerUrl;

                    // Sauvegarder dans localStorage
                    localStorage.setItem('userSettings', JSON.stringify(userSettings));

                    // Mettre à jour la bannière de l'utilisateur actuel dans la liste des utilisateurs
                    if (users[currentUsername]) {
                        users[currentUsername].bannerImage = data.bannerUrl;
                    }

                    // Recharger la liste des utilisateurs pour appliquer la nouvelle bannière
                    loadUsers();
                } else {
                    alert('Erreur lors de l\'upload de la bannière: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Erreur lors de l\'upload de la bannière:', error);
                alert('Erreur lors de l\'upload de la bannière');
            });
        };
        reader.readAsDataURL(file);
    }
}

async function handleChangePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    if (!currentPassword || !newPassword) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    try {
        const response = await fetch('/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, currentPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Mot de passe changé avec succès');
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        alert('Erreur lors du changement de mot de passe');
    }
}

function applySettings() {
    // Appliquer la couleur de l'avatar
    document.querySelectorAll('.user-avatar, .member-avatar, .message-avatar').forEach(avatar => {
        avatar.style.background = userSettings.avatarColor;
    });
    
    // Appliquer le thème
    if (userSettings.theme === 'light') {
        document.body.style.background = '#ffffff';
        document.body.style.color = '#000000';
    } else {
        document.body.style.background = '#36393f';
        document.body.style.color = '#ffffff';
    }
    
    // Mettre à jour le statut
    if (socket) {
        socket.emit('update_status', {
            username: currentUsername,
            status: userSettings.status
        });
    }
}

async function handleCreateServer(e) {
    e.preventDefault();
    
    const serverName = document.getElementById('server-name-input').value.trim();
    
    if (!serverName) return;
    
    try {
        const response = await fetch('/create_server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: serverName, creator: currentUsername })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('create-server-modal').classList.add('hidden');
            document.getElementById('server-name-input').value = '';
            loadServers();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de la création du serveur:', error);
        alert('Erreur lors de la création du serveur');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addVoiceChannel(name) {
    const voiceChannelsList = document.getElementById('voice-channels-list');
    const voiceChannel = document.createElement('div');
    voiceChannel.className = 'channel-item';
    voiceChannel.innerHTML = `
        <span class="channel-hash">🔊</span>
        <span>${name}</span>
    `;
    voiceChannelsList.appendChild(voiceChannel);
}

function showProfile(user) {
    document.getElementById('profile-displayname').textContent = user.displayname;
    document.getElementById('profile-username').textContent = '@' + user.username;
    document.getElementById('profile-avatar-text').textContent = user.displayname.charAt(0).toUpperCase();

    // Afficher la bio de l'utilisateur concerné
    const bio = user.bio || '';
    const bioElement = document.getElementById('profile-bio');
    bioElement.textContent = bio || '';
    bioElement.style.display = bio ? 'block' : 'none';

    // Appliquer la photo de profil de l'utilisateur concerné
    const avatarImage = user.avatarImage || (user.username === currentUsername ? userSettings.avatarImage : null);
    if (avatarImage) {
        const profileAvatar = document.getElementById('profile-avatar');
        profileAvatar.style.backgroundImage = `url(${avatarImage})`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        document.getElementById('profile-avatar-text').style.display = 'none';
    } else {
        const profileAvatar = document.getElementById('profile-avatar');
        profileAvatar.style.backgroundImage = '';
        document.getElementById('profile-avatar-text').style.display = 'flex';
    }

    // Appliquer la bannière de profil de l'utilisateur concerné
    const bannerImage = user.bannerImage || (user.username === currentUsername ? userSettings.bannerImage : null);
    const profileBanner = document.getElementById('profile-modal-banner');
    if (bannerImage) {
        profileBanner.style.backgroundImage = `url(${bannerImage})`;
        profileBanner.style.backgroundSize = 'cover';
        profileBanner.style.backgroundPosition = 'center';
    } else {
        profileBanner.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    // Afficher le statut de l'utilisateur
    const status = user.status || 'offline';
    let statusColor = '#747f8d'; // offline
    let statusText = 'Hors ligne';
    if (status === 'online') {
        statusColor = '#3ba55c';
        statusText = 'En ligne';
    } else if (status === 'idle') {
        statusColor = '#faa61a';
        statusText = 'Inactif';
    } else if (status === 'dnd') {
        statusColor = '#ed4245';
        statusText = 'Ne pas déranger';
    }

    const statusIndicator = document.getElementById('profile-status-indicator');
    statusIndicator.style.background = statusColor;

    const statusTextElement = document.getElementById('profile-status-text');
    statusTextElement.textContent = statusText;
    statusTextElement.style.display = 'block';

    document.getElementById('profile-modal').classList.remove('hidden');

    console.log('showProfile appelé pour:', user.username, 'bio:', user.bio, 'avatarImage:', user.avatarImage, 'bannerImage:', user.bannerImage, 'status:', status);
}


// Fonctions WebRTC
async function startCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStream = stream;
        document.getElementById('local-video').srcObject = stream;

        document.getElementById('call-modal').classList.remove('hidden');
        document.getElementById('call-status').textContent = 'Appel vocal en cours...';
        isCallActive = true;

        // Create peer connection
        peerConnection = new RTCPeerConnection(rtcServers);

        // Add local stream to peer connection
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    candidate: event.candidate,
                    target: currentPrivateChatUser || currentRoomId,
                    isPrivate: !!currentPrivateChatUser
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
        };

        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send offer
        socket.emit('call_offer', {
            offer: offer,
            username: currentUsername,
            target: currentPrivateChatUser || currentRoomId,
            isPrivate: !!currentPrivateChatUser,
            type: 'audio'
        });
    } catch (error) {
        console.error('Erreur lors de l\'accès au microphone:', error);
        alert('Impossible d\'accéder au microphone');
    }
}

async function startVideoCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStream = stream;
        document.getElementById('local-video').srcObject = stream;

        document.getElementById('call-modal').classList.remove('hidden');
        document.getElementById('call-status').textContent = 'Appel vidéo en cours...';
        isCallActive = true;

        // Create peer connection
        peerConnection = new RTCPeerConnection(rtcServers);

        // Add local stream to peer connection
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    candidate: event.candidate,
                    target: currentPrivateChatUser || currentRoomId,
                    isPrivate: !!currentPrivateChatUser
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
        };

        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send offer
        socket.emit('call_offer', {
            offer: offer,
            username: currentUsername,
            target: currentPrivateChatUser || currentRoomId,
            isPrivate: !!currentPrivateChatUser,
            type: 'video'
        });
    } catch (error) {
        console.error('Erreur lors de l\'accès à la caméra:', error);
        alert('Impossible d\'accéder à la caméra');
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    document.getElementById('call-modal').classList.add('hidden');
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    isCallActive = false;
    
    // Notifier les autres utilisateurs
    socket.emit('call_ended', {
        username: currentUsername,
        room_id: currentRoomId
    });
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMuted = !audioTrack.enabled;
            document.getElementById('mute-btn').classList.toggle('muted', isMuted);
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoEnabled = videoTrack.enabled;
            document.getElementById('toggle-video-btn').classList.toggle('disabled', !isVideoEnabled);
        }
    }
}

async function loadFriends() {
    try {
        const response = await fetch(`/friends/${currentUsername}`);
        const friendsListData = await response.json();
        
        // Store friends data globally
        friendsData[currentUsername] = friendsListData.map(f => f.username);
        
        const friendsList = document.getElementById('friends-list');
        friendsList.innerHTML = '';
        
        friendsListData.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = 'friend-item';
            
            let statusColor = '#747f8d';
            let statusText = 'Hors ligne';
            if (friend.status === 'online') {
                statusColor = '#3ba55c';
                statusText = 'En ligne';
            } else if (friend.status === 'idle') {
                statusColor = '#faa61a';
                statusText = 'Inactif';
            } else if (friend.status === 'dnd') {
                statusColor = '#ed4245';
                statusText = 'Ne pas déranger';
            }
            
            let avatarStyle = `background: #5865f2`;
            let avatarText = `<span>${friend.displayname.charAt(0).toUpperCase()}</span>`;
            if (friend.avatarImage) {
                avatarStyle = `background-image: url(${friend.avatarImage}); background-size: cover; background-position: center;`;
                avatarText = '';
            }
            
            friendElement.innerHTML = `
                <div class="friend-avatar" style="${avatarStyle}">
                    ${avatarText}
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.displayname}</div>
                    <div class="friend-status">${statusText}</div>
                </div>
                <div class="friend-actions">
                    <button class="friend-action-btn" onclick="openPrivateChat('${friend.username}', '${friend.displayname}')" title="Message">💬</button>
                    <button class="friend-action-btn" onclick="removeFriend('${friend.username}')" title="Supprimer">🗑️</button>
                </div>
            `;
            friendsList.appendChild(friendElement);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des amis:', error);
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch(`/friend_requests/${currentUsername}`);
        const requestsData = await response.json();
        
        const requestsList = document.getElementById('friend-requests-list');
        requestsList.innerHTML = '';
        
        requestsData.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.className = 'friend-request-item';
            
            let avatarStyle = `background: #5865f2`;
            let avatarText = `<span>${request.displayname.charAt(0).toUpperCase()}</span>`;
            if (request.avatarImage) {
                avatarStyle = `background-image: url(${request.avatarImage}); background-size: cover; background-position: center;`;
                avatarText = '';
            }
            
            requestElement.innerHTML = `
                <div class="friend-avatar" style="${avatarStyle}">
                    ${avatarText}
                </div>
                <div class="friend-request-info">
                    <div class="friend-request-name">${request.displayname}</div>
                </div>
                <div class="friend-request-actions">
                    <button class="friend-request-btn accept" onclick="acceptFriend('${request.username}')">Accepter</button>
                    <button class="friend-request-btn reject" onclick="rejectFriend('${request.username}')">Refuser</button>
                </div>
            `;
            requestsList.appendChild(requestElement);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des demandes d\'amis:', error);
    }
}

async function handleAddFriend(e) {
    e.preventDefault();
    
    const friendUsername = document.getElementById('add-friend-username').value.trim();
    
    if (!friendUsername) {
        alert('Nom d\'utilisateur requis');
        return;
    }
    
    if (friendUsername === currentUsername) {
        alert('Impossible de s\'ajouter soi-même');
        return;
    }
    
    try {
        const response = await fetch('/friend_request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: currentUsername, to: friendUsername })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Demande d\'ami envoyée!');
            document.getElementById('add-friend-username').value = '';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la demande d\'ami:', error);
        alert('Erreur lors de l\'envoi de la demande d\'ami');
    }
}

async function acceptFriend(friendUsername) {
    try {
        const response = await fetch('/accept_friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, friendUsername })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadFriends();
            loadFriendRequests();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de l\'acceptation de l\'ami:', error);
    }
}

async function rejectFriend(friendUsername) {
    try {
        const response = await fetch('/reject_friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, friendUsername })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadFriendRequests();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors du refus de l\'ami:', error);
    }
}

async function removeFriend(friendUsername) {
    if (!confirm('Voulez-vous vraiment supprimer cet ami?')) {
        return;
    }
    
    try {
        const response = await fetch('/remove_friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, friendUsername })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadFriends();
            if (currentPrivateChatUser === friendUsername) {
                showHomeScreen();
            }
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'ami:', error);
    }
}

function openPrivateChat(friendUsername, friendDisplayname) {
    currentPrivateChatUser = friendUsername;
    
    document.getElementById('add-friend-container').classList.add('hidden');
    document.getElementById('private-chat-container').classList.remove('hidden');
    document.getElementById('home-title').textContent = friendDisplayname;
    
    loadPrivateMessages(friendUsername);
}

async function loadPrivateMessages(friendUsername) {
    try {
        const response = await fetch(`/private_messages/${currentUsername}/${friendUsername}`);
        const messages = await response.json();
        
        const messagesContainer = document.getElementById('private-messages-list');
        messagesContainer.innerHTML = '';
        
        messages.forEach(msg => {
            addPrivateMessage(msg, false);
        });
        
        scrollToPrivateBottom();
    } catch (error) {
        console.error('Erreur lors du chargement des messages privés:', error);
    }
}

function addPrivateMessage(message, animate = true) {
    const messagesContainer = document.getElementById('private-messages-list');

    const messageElement = document.createElement('div');
    messageElement.className = 'private-message';

    const time = new Date(message.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const isOwnMessage = message.from === currentUsername;
    const user = users[message.from] || users[message.to];
    const displayName = isOwnMessage ? currentDisplayname : (user ? user.displayname : message.from);

    let avatarStyle = `background: #5865f2`;
    let avatarText = `<span>${displayName.charAt(0).toUpperCase()}</span>`;
    const avatarImage = isOwnMessage ? userSettings.avatarImage : (user ? user.avatarImage : null);
    if (avatarImage) {
        avatarStyle = `background-image: url(${avatarImage}); background-size: cover; background-position: center;`;
        avatarText = '';
    }

    let messageContent = '';

    if (message.file) {
        // Handle file attachment
        const fileType = message.file.type;
        if (fileType.startsWith('image/')) {
            messageContent = `
                <div class="private-message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <img src="${message.file.data}" alt="${escapeHtml(message.file.name)}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 8px;">
                </div>
            `;
        } else if (fileType.startsWith('video/')) {
            messageContent = `
                <div class="private-message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <video src="${message.file.data}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 8px;"></video>
                </div>
            `;
        } else if (fileType.startsWith('audio/')) {
            messageContent = `
                <div class="private-message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <audio src="${message.file.data}" controls style="width: 100%; margin-top: 8px;"></audio>
                </div>
            `;
        } else {
            messageContent = `
                <div class="private-message-text">
                    ${message.message ? escapeHtml(message.message) + '<br>' : ''}
                    <a href="${message.file.data}" download="${escapeHtml(message.file.name)}" style="color: #5865f2; text-decoration: underline;">📎 ${escapeHtml(message.file.name)}</a>
                </div>
            `;
        }
    } else {
        messageContent = `<div class="private-message-text">${escapeHtml(message.message)}</div>`;
    }

    messageElement.innerHTML = `
        <div class="private-message-avatar" style="${avatarStyle}">
            ${avatarText}
        </div>
        <div class="private-message-content">
            <div class="private-message-header">
                <span class="private-message-username">${displayName}</span>
                <span class="private-message-time">${time}</span>
            </div>
            ${messageContent}
        </div>
    `;

    if (!animate) {
        messageElement.style.animation = 'none';
    }

    messagesContainer.appendChild(messageElement);
    scrollToPrivateBottom();
}

async function handleSendPrivateMessage(e) {
    e.preventDefault();

    const messageInput = document.getElementById('private-message-input');
    const message = messageInput.value.trim();

    if (!message && !selectedPrivateFile) return;

    try {
        if (selectedPrivateFile) {
            // Send file
            await sendPrivateFileMessage(message);
        } else {
            await sendPrivateMessage(currentPrivateChatUser, message);
        }

        messageInput.value = '';
        selectedPrivateFile = null;
        messageInput.placeholder = 'Envoyer un message privé...';
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message privé:', error);
    }
}

function scrollToPrivateBottom() {
    const messagesContainer = document.getElementById('private-messages-list');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function openServerSettings() {
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur');
        return;
    }
    
    const server = servers[currentServerId];
    
    document.getElementById('server-name-input').value = server.name || '';
    
    const logoPreview = document.getElementById('server-logo-preview');
    if (server.logo) {
        logoPreview.style.backgroundImage = `url(${server.logo})`;
        logoPreview.style.backgroundSize = 'cover';
        logoPreview.style.backgroundPosition = 'center';
        document.getElementById('server-logo-text').style.display = 'none';
    } else {
        logoPreview.style.backgroundImage = '';
        document.getElementById('server-logo-text').style.display = 'block';
        document.getElementById('server-logo-text').textContent = server.name.charAt(0).toUpperCase();
    }
    
    currentServerLogo = null;
    
    await loadServerRoles();
    await loadFriendsForInvite();
    await loadServerInvites();
    
    document.getElementById('server-settings-modal').classList.remove('hidden');
}

async function loadServerRoles() {
    try {
        const response = await fetch(`/servers/${currentServerId}/roles`);
        const rolesData = await response.json();
        
        const rolesList = document.getElementById('roles-list');
        rolesList.innerHTML = '';
        
        rolesData.forEach(role => {
            const roleElement = document.createElement('div');
            roleElement.className = 'role-item';
            roleElement.innerHTML = `
                <div class="role-color" style="background: ${role.color}"></div>
                <div class="role-name">${role.name}</div>
                <div class="role-actions">
                    <button class="role-action-btn" onclick="deleteRole('${role.id}')">🗑️</button>
                </div>
            `;
            rolesList.appendChild(roleElement);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des rôles:', error);
    }
}

async function saveServerSettings() {
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur');
        return;
    }
    
    const newName = document.getElementById('server-name-input').value.trim();
    
    if (newName) {
        try {
            const response = await fetch('/update_server_name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: currentServerId, name: newName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                servers[currentServerId] = data.server;
                // Mettre à jour le nom du serveur dans l'interface
                document.getElementById('server-name').textContent = data.server.name;
                console.log('Nom du serveur mis à jour:', data.server.name);
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du nom du serveur:', error);
        }
    }
    
    if (currentServerLogo !== null) {
        try {
            const response = await fetch('/update_server_logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: currentServerId, logo: currentServerLogo })
            });
            
            const data = await response.json();
            
            if (data.success) {
                servers[currentServerId] = data.server;
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du logo du serveur:', error);
        }
    }
    
    // Recharger les serveurs après toutes les mises à jour
    await loadServers();
    await loadServersHome();
    
    document.getElementById('server-settings-modal').classList.add('hidden');
}

function handleServerLogoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const logoPreview = document.getElementById('server-logo-preview');
            logoPreview.style.backgroundImage = `url(${event.target.result})`;
            logoPreview.style.backgroundSize = 'cover';
            logoPreview.style.backgroundPosition = 'center';
            document.getElementById('server-logo-text').style.display = 'none';
            currentServerLogo = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function addRole() {
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur');
        return;
    }
    
    const roleName = prompt('Nom du rôle:');
    if (!roleName) return;
    
    const roleColor = prompt('Couleur du rôle (hex):', '#5865f2') || '#5865f2';
    
    try {
        const response = await fetch(`/servers/${currentServerId}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: roleName, color: roleColor })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadServerRoles();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de la création du rôle:', error);
    }
}

async function deleteRole(roleId) {
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur');
        return;
    }
    
    fetch(`/servers/${currentServerId}/roles/${roleId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadServerRoles();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Erreur lors de la suppression du rôle:', error);
    });
}

async function loadFriendsForInvite() {
    try {
        const response = await fetch('/friends');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('invite-friend-select');
            select.innerHTML = '';
            
            // Obtenir les membres actuels du serveur
            let serverMembers = [];
            if (currentServerId && servers[currentServerId] && servers[currentServerId].members) {
                serverMembers = servers[currentServerId].members;
            }
            
            // Obtenir les invitations en attente depuis le backend
            let pendingInvites = [];
            if (currentServerId) {
                try {
                    const invitesResponse = await fetch(`/servers/${currentServerId}/invites`);
                    const invitesData = await invitesResponse.json();
                    if (invitesData.success) {
                        pendingInvites = invitesData.invites;
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement des invitations:', error);
                }
            }
            
            data.friends.forEach(friend => {
                // Ne pas afficher les amis qui sont déjà sur le serveur ou déjà invités
                if (serverMembers.includes(friend.username) || pendingInvites.includes(friend.username)) {
                    return;
                }
                
                const option = document.createElement('option');
                option.value = friend.username;
                option.textContent = friend.displayname || friend.username;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement des amis:', error);
    }
}

async function loadServerInvites() {
    if (!currentServerId) {
        return;
    }
    
    try {
        const response = await fetch(`/servers/${currentServerId}/invites`);
        const data = await response.json();
        
        if (data.success) {
            const invitesList = document.getElementById('invites-list');
            invitesList.innerHTML = '';
            
            data.invites.forEach(username => {
                const inviteItem = document.createElement('div');
                inviteItem.className = 'invite-item';
                inviteItem.innerHTML = `
                    <span class="invite-username">${username}</span>
                    <button class="remove-invite-btn" onclick="removeInvite('${username}')">Retirer</button>
                `;
                invitesList.appendChild(inviteItem);
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement des invitations:', error);
    }
}

async function inviteFriend() {
    if (!currentServerId) {
        alert('Veuillez sélectionner un serveur');
        return;
    }
    
    const username = document.getElementById('invite-friend-select').value;
    
    if (!username) {
        alert('Veuillez sélectionner un ami');
        return;
    }
    
    try {
        const response = await fetch(`/servers/${currentServerId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadServerInvites();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors de l\'invitation de l\'ami:', error);
    }
}

async function removeInvite(username) {
    if (!currentServerId) {
        return;
    }
    
    try {
        const response = await fetch(`/servers/${currentServerId}/invites/${username}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadServerInvites();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Erreur lors du retrait de l\'invitation:', error);
    }
}

// Profile Sidebar Functions
async function showProfileSidebar(user) {
    const sidebar = document.getElementById('profile-sidebar');
    const toolbar = document.getElementById('private-chat-toolbar');

    // Populate sidebar with user data
    document.getElementById('sidebar-profile-displayname').textContent = user.displayname;
    document.getElementById('sidebar-profile-username').textContent = '@' + user.username + '#' + user.username.substring(0, 4);
    document.getElementById('sidebar-profile-avatar-text').textContent = user.displayname.charAt(0).toUpperCase();

    // Apply avatar image if available
    const avatarImage = user.avatarImage || (user.username === currentUsername ? userSettings.avatarImage : null);
    if (avatarImage) {
        const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
        sidebarAvatar.style.backgroundImage = `url(${avatarImage})`;
        sidebarAvatar.style.backgroundSize = 'cover';
        sidebarAvatar.style.backgroundPosition = 'center';
        document.getElementById('sidebar-profile-avatar-text').style.display = 'none';
    } else {
        const sidebarAvatar = document.getElementById('sidebar-profile-avatar');
        sidebarAvatar.style.backgroundImage = '';
        document.getElementById('sidebar-profile-avatar-text').style.display = 'flex';
    }

    // Apply banner image if available
    const bannerImage = user.bannerImage || (user.username === currentUsername ? userSettings.bannerImage : null);
    const sidebarBanner = document.getElementById('sidebar-profile-banner');
    if (bannerImage) {
        sidebarBanner.style.backgroundImage = `url(${bannerImage})`;
        sidebarBanner.style.backgroundSize = 'cover';
        sidebarBanner.style.backgroundPosition = 'center';
    } else {
        sidebarBanner.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    // Set status indicator
    const status = user.status || 'offline';
    let statusColor = '#747f8d';
    if (status === 'online') {
        statusColor = '#3ba55c';
    } else if (status === 'idle') {
        statusColor = '#faa61a';
    } else if (status === 'dnd') {
        statusColor = '#ed4245';
    }
    document.getElementById('sidebar-profile-status-indicator').style.background = statusColor;

    // Get account creation date from logs-login.txt
    const accountCreationDate = await getAccountCreationDate(user.username);
    if (accountCreationDate) {
        const formattedDate = new Date(accountCreationDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        document.getElementById('sidebar-profile-joined').textContent = formattedDate;
    }

    // Calculate and set mutual servers with real names
    const mutualServers = await calculateMutualServers(user.username);
    document.getElementById('sidebar-profile-mutual-servers').textContent = mutualServers.length;

    // Calculate and set mutual friends (async)
    const mutualFriendsCount = await calculateMutualFriends(user.username);
    document.getElementById('sidebar-profile-mutual-friends').textContent = mutualFriendsCount;

    // Set friends since date (if they are friends)
    const friendsSinceDate = getFriendsSinceDate(user.username);
    document.getElementById('sidebar-profile-friends-since').textContent = friendsSinceDate;

    // Add badges
    addBadgesToSidebar(user);

    // Show sidebar and toolbar
    sidebar.classList.add('visible');
    toolbar.classList.add('visible');
}

async function getAccountCreationDate(username) {
    try {
        const response = await fetch('/get_account_creation_date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        if (data.success) {
            return data.creationDate;
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de la date de création du compte:', error);
    }
    return null;
}

async function calculateMutualServers(username) {
    const mutualServers = [];
    Object.values(servers).forEach(server => {
        if (server.members && server.members.includes(currentUsername) && server.members.includes(username)) {
            mutualServers.push(server.name);
        }
    });
    return mutualServers;
}

async function calculateMutualFriends(username) {
    let count = 0;
    
    try {
        // Load friends data for the other user
        const response = await fetch(`/friends/${username}`);
        const friendsListData = await response.json();
        const otherUserFriends = friendsListData.map(f => f.username);
        
        // Load current user's friends data
        const currentResponse = await fetch(`/friends/${currentUsername}`);
        const currentFriendsData = await currentResponse.json();
        const currentUserFriends = currentFriendsData.map(f => f.username);
        
        // Calculate mutual friends
        currentUserFriends.forEach(friend => {
            if (otherUserFriends.includes(friend)) {
                count++;
            }
        });
    } catch (error) {
        console.error('Erreur lors du calcul des amis en commun:', error);
    }
    
    return count;
}

function getFriendsSinceDate(username) {
    // This is a placeholder - in a real app, you'd store the friendship date
    // For now, return a random date if they are friends
    if (friendsData[currentUsername] && friendsData[currentUsername].includes(username)) {
        const randomDate = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        return randomDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
    return '-';
}

function addBadgesToSidebar(user) {
    const badgesContainer = document.getElementById('sidebar-profile-badges');
    badgesContainer.innerHTML = '';
    
    // Add some example badges based on user properties
    const badges = [];
    
    // Early adopter badge (for users who joined early)
    if (user.joinedAt) {
        const joinDate = new Date(user.joinedAt);
        const earlyDate = new Date('2024-01-01');
        if (joinDate < earlyDate) {
            badges.push({ icon: '🌟', title: 'Early Adopter' });
        }
    }
    
    // Online badge
    if (user.status === 'online') {
        badges.push({ icon: '🟢', title: 'En ligne' });
    }
    
    // Premium badge (placeholder - could be based on actual subscription)
    if (user.username === 'admin' || user.username === currentUsername) {
        badges.push({ icon: '💎', title: 'Premium' });
    }
    
    // Add badges to container
    badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'profile-sidebar-badge';
        badgeElement.title = badge.title;
        badgeElement.textContent = badge.icon;
        badgesContainer.appendChild(badgeElement);
    });
}

function hideProfileSidebar() {
    const sidebar = document.getElementById('profile-sidebar');
    const toolbar = document.getElementById('private-chat-toolbar');
    
    sidebar.classList.remove('visible');
    toolbar.classList.remove('visible');
}

// Private Calling Functions
async function startPrivateCall() {
    if (!currentPrivateChatUser) {
        alert('Veuillez sélectionner une conversation privée');
        return;
    }
    
    // Ask for microphone selection
    const deviceId = await selectMicrophone();
    if (!deviceId) {
        return;
    }
    
    try {
        const constraints = {
            audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
            video: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream;
        document.getElementById('local-video').srcObject = stream;
        
        document.getElementById('call-modal').classList.remove('hidden');
        document.getElementById('call-status').textContent = `Appel vocal avec ${users[currentPrivateChatUser]?.displayname || currentPrivateChatUser}...`;
        isCallActive = true;
        
        // Notify the other user via socket
        socket.emit('private_call_started', {
            from: currentUsername,
            to: currentPrivateChatUser,
            type: 'audio'
        });
    } catch (error) {
        console.error('Erreur lors de l\'accès au microphone:', error);
        alert('Impossible d\'accéder au microphone');
    }
}

async function startPrivateVideoCall() {
    if (!currentPrivateChatUser) {
        alert('Veuillez sélectionner une conversation privée');
        return;
    }
    
    // Ask for microphone selection
    const deviceId = await selectMicrophone();
    if (!deviceId) {
        return;
    }
    
    try {
        const constraints = {
            audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
            video: true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream;
        document.getElementById('local-video').srcObject = stream;
        
        document.getElementById('call-modal').classList.remove('hidden');
        document.getElementById('call-status').textContent = `Appel vidéo avec ${users[currentPrivateChatUser]?.displayname || currentPrivateChatUser}...`;
        isCallActive = true;
        
        // Notify the other user via socket
        socket.emit('private_call_started', {
            from: currentUsername,
            to: currentPrivateChatUser,
            type: 'video'
        });
    } catch (error) {
        console.error('Erreur lors de l\'accès à la caméra:', error);
        alert('Impossible d\'accéder à la caméra');
    }
}

async function selectMicrophone() {
    try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Get available microphones
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        if (audioInputs.length === 0) {
            alert('Aucun microphone détecté');
            return null;
        }
        
        if (audioInputs.length === 1) {
            return audioInputs[0].deviceId;
        }
        
        // Create selection dialog
        const dialog = document.createElement('div');
        dialog.className = 'mic-selection-modal';
        dialog.innerHTML = `
            <div class="mic-selection-content">
                <h3>Sélectionner un microphone</h3>
                <div class="mic-list"></div>
                <div class="mic-buttons">
                    <button class="mic-cancel-btn">Annuler</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const micList = dialog.querySelector('.mic-list');
        audioInputs.forEach((device, index) => {
            const micItem = document.createElement('div');
            micItem.className = 'mic-item';
            micItem.textContent = device.label || `Microphone ${index + 1}`;
            micItem.dataset.deviceId = device.deviceId;
            micList.appendChild(micItem);
        });
        
        return new Promise((resolve) => {
            dialog.querySelectorAll('.mic-item').forEach(item => {
                item.addEventListener('click', () => {
                    document.body.removeChild(dialog);
                    resolve(item.dataset.deviceId);
                });
            });
            
            dialog.querySelector('.mic-cancel-btn').addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(null);
            });
        });
    } catch (error) {
        console.error('Erreur lors de la sélection du microphone:', error);
        alert('Erreur lors de la sélection du microphone');
        return null;
    }
}

// Modify openPrivateChat to show profile sidebar
async function openPrivateChat(friendUsername, friendDisplayname) {
    currentPrivateChatUser = friendUsername;
    
    document.getElementById('add-friend-container').classList.add('hidden');
    document.getElementById('private-chat-container').classList.remove('hidden');
    document.getElementById('home-title').textContent = friendDisplayname;
    
    loadPrivateMessages(friendUsername);
    
    // Show profile sidebar with friend's data
    const user = users[friendUsername];
    if (user) {
        await showProfileSidebar(user);
    }
}

// ========================================
// GLOBAL VARIABLES AND STATE MANAGEMENT
// ========================================
let currentUsername = '';
let isTyping = false;
let typingTimeout = null;
let notificationsEnabled = false;
let lastMessageTime = 0;
let messagePollingInterval = null;
let typingUsers = new Set();
let connectionStatus = 'online';
let currentRoom = null;
let ws = null; // WebSocket connection
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// Emoji data
const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
    'Gestures': ['👍', '👎', '👌', '🤝', '👏', '🙏', '✊', '👊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👈', '👉', '👆', '👇', '☝️', '✋'],
    'Objects': ['💻', '📱', '⌚', '📷', '💡', '🔒', '🔑', '🎯', '🚀', '⭐', '🔥', '💎', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎮', '🎵']
};

// ========================================
// INITIALIZATION
// ========================================
window.onload = function() {
    try {
        // Apply mobile fixes first
        applyMobileFixes();
        
        if (window.location.pathname.includes('chat.html')) {
            initializeChatPage();
        } else {
            initializeLoginPage();
        }
        
        // Global keyboard shortcuts
        setupGlobalEventListeners();
    } catch (err) {
        showErrorOverlay('JavaScript Error: ' + err.message);
        console.error('JavaScript Error:', err);
    }
}

function applyMobileFixes() {
    // Force remove any blocking overlays
    setTimeout(() => {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.style.pointerEvents = 'none';
        }
    }, 100);
    
    // Apply mobile-friendly event listeners
    document.addEventListener('DOMContentLoaded', function() {
        const buttons = document.querySelectorAll('button, .login-btn, .feature, input, textarea');
        buttons.forEach(button => {
            button.style.pointerEvents = 'auto';
            button.style.touchAction = 'manipulation';
            if (button.tagName === 'BUTTON' || button.classList.contains('login-btn')) {
                button.style.minHeight = '44px';
            }
        });
        console.log('Mobile fixes applied to', buttons.length, 'elements');
    });
}

function setupGlobalEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
        const isMobile = window.innerWidth <= 768;
        
        // Emoji picker close on Escape
        if (e.key === 'Escape') {
            closeAllModals();
            return;
        }
        
        if (isInput || isMobile) return;
        
        // Ctrl+B sidebar toggle (desktop only)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
    });
}

function showErrorOverlay(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        background: #ffe0e0;
        color: #900;
        padding: 16px;
        font-family: monospace;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 9999;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
}

// ========================================
// WEBSOCKET CONNECTION MANAGEMENT
// ========================================
function connectWebSocket() {
    // Use dynamic host detection for better mobile compatibility
    const protocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
    const host = window.location.hostname || 'localhost';
    const port = '3002';
    
    // Try multiple connection protocols with dynamic host
    const protocols = [
        `${protocol}${host}:${port}`,
        `ws://${host}:${port}`,
        'ws://localhost:3002'
    ];
    
    let protocolIndex = 0;
    
    function tryConnect() {
        if (protocolIndex >= protocols.length) {
            console.log('WebSocket not available, using localStorage fallback');
            connectionStatus = 'offline';
            return null;
        }
        
        const url = protocols[protocolIndex];
        console.log(`Trying WebSocket connection to: ${url}`);
        
        try {
            const socket = new WebSocket(url);
            
            socket.onopen = function() {
                console.log('WebSocket connected successfully to:', url);
                connectionStatus = 'online';
                reconnectAttempts = 0;
                
                // Send connection confirmation
                socket.send(JSON.stringify({
                    type: 'ping',
                    timestamp: new Date().toISOString()
                }));
                
                // Join current room if exists
                if (currentRoom && currentUsername) {
                    socket.send(JSON.stringify({
                        type: 'join',
                        room: currentRoom,
                        username: currentUsername
                    }));
                }
            };
            
            socket.onerror = function(error) {
                console.log(`WebSocket connection failed to ${url}:`, error);
                protocolIndex++;
                if (protocolIndex < protocols.length) {
                    setTimeout(tryConnect, 500);
                }
            };
            
            socket.onclose = function(event) {
                console.log('WebSocket connection closed:', event.code, event.reason);
                connectionStatus = 'offline';
                
                // Try to reconnect with delay
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                    setTimeout(() => {
                        protocolIndex = 0;
                        tryConnect();
                    }, 3000 * reconnectAttempts);
                }
            };
            
            socket.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            return socket;
            
        } catch (error) {
            console.log(`Failed to create WebSocket for ${url}:`, error);
            protocolIndex++;
            if (protocolIndex < protocols.length) {
                setTimeout(tryConnect, 500);
            }
            return null;
        }
    }
    
    return tryConnect();
}

function handleWebSocketMessage(data) {
    console.log('Received WebSocket message:', data.type);
    
    switch (data.type) {
        case 'pong':
            console.log('WebSocket ping confirmed');
            break;
        case 'message':
            displayIncomingMessage(data);
            break;
        case 'user_joined':
        case 'user_left':
            updateOnlineUsers();
            break;
        case 'typing_start':
            handleRemoteTyping(data.username, true);
            break;
        case 'typing_stop':
            handleRemoteTyping(data.username, false);
            break;
    }
}

function displayIncomingMessage(messageData) {
    if (!messageData || !currentRoom) return;
    
    // Store message in localStorage
    const allMessages = getStoredData('chatMessages') || {};
    if (!allMessages[currentRoom]) {
        allMessages[currentRoom] = [];
    }
    
    allMessages[currentRoom].push({
        id: messageData.id,
        author: messageData.author,
        content: messageData.content,
        timestamp: messageData.timestamp,
        type: messageData.type || 'text'
    });
    
    storeData('chatMessages', allMessages);
    displayMessages();
}

function handleRemoteTyping(username, isTyping) {
    if (username === currentUsername) return;
    
    const typingData = getStoredData('typingUsers') || {};
    if (!typingData[currentRoom]) {
        typingData[currentRoom] = [];
    }
    
    if (isTyping) {
        if (!typingData[currentRoom].includes(username)) {
            typingData[currentRoom].push(username);
        }
    } else {
        typingData[currentRoom] = typingData[currentRoom].filter(user => user !== username);
    }
    
    storeData('typingUsers', typingData);
    updateTypingIndicator();
}

// ========================================
// LOGIN PAGE FUNCTIONALITY
// ========================================
function initializeLoginPage() {
    // Check if user is already logged in
    const username = getStoredData('chatUsername');
    if (username) {
        window.location.href = 'chat.html';
        return;
    }
    
    setupLoginEventListeners();
    
    // Add entrance animation
    setTimeout(() => {
        const loginCard = document.querySelector('.login-card');
        if (loginCard) loginCard.classList.add('animate-in');
    }, 100);
}

function setupLoginEventListeners() {
    const usernameInput = document.getElementById('username');
    const loginBtn = document.getElementById('login-btn');
    
    if (usernameInput) {
        // Make mobile-friendly
        usernameInput.style.pointerEvents = 'auto';
        usernameInput.style.touchAction = 'manipulation';
        
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinChat();
            }
        });
        
        usernameInput.addEventListener('input', function(e) {
            validateUsername(e.target.value);
        });
    }
    
    if (loginBtn) {
        // Make mobile-friendly
        loginBtn.style.pointerEvents = 'auto';
        loginBtn.style.touchAction = 'manipulation';
        loginBtn.style.minHeight = '44px';
        
        loginBtn.addEventListener('click', joinChat);
        
        // Add touch support for mobile
        loginBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            joinChat();
        });
    }
}

function validateUsername(username) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return true;
    
    // Clear previous errors
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
    
    if (username.length === 0) {
        return true;
    }
    
    if (username.length < 3) {
        showError('Username must be at least 3 characters long');
        return false;
    }
    
    if (username.length > 20) {
        showError('Username must be less than 20 characters');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showError('Username can only contain letters, numbers, and underscores');
        return false;
    }
    
    // Check if username is already taken
    const takenUsernames = getStoredData('takenUsernames') || [];
    if (takenUsernames.includes(username.toLowerCase())) {
        showError('Username is already taken');
        return false;
    }
    
    return true;
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function joinChat() {
    const usernameInput = document.getElementById('username');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (!usernameInput) return;
    
    const username = usernameInput.value.trim();
    
    if (!validateUsername(username)) {
        return;
    }
    
    if (username === '') {
        showError('Please enter a username');
        return;
    }
    
    // Show loading briefly
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    // Simulate loading delay
    setTimeout(() => {
        // Store username and mark as taken
        storeData('chatUsername', username);
        
        // Add to taken usernames
        let takenUsernames = getStoredData('takenUsernames') || [];
        if (!takenUsernames.includes(username.toLowerCase())) {
            takenUsernames.push(username.toLowerCase());
            storeData('takenUsernames', takenUsernames);
        }
        
        // Store login timestamp
        storeData('loginTime', new Date().toISOString());
        
        // Add user to online users
        addUserToOnlineList(username);
        
        // Hide loading
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        // Redirect to chat
        window.location.href = 'chat.html';
    }, 800);
}

// ========================================
// CHAT PAGE FUNCTIONALITY
// ========================================
function initializeChatPage() {
    checkAuth();
    setupChatApplication();
    setupChatEventListeners();
    loadInitialChatData();
    startRealTimeUpdates();
    
    // Initialize WebSocket connection
    ws = connectWebSocket();
}

function checkAuth() {
    const username = getStoredData('chatUsername');
    if (!username) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUsername = username;
    
    const usernameElement = document.getElementById('current-username');
    if (usernameElement) {
        usernameElement.textContent = username;
    }
    
    // Set user avatar initial
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.textContent = username.charAt(0).toUpperCase();
    }
}

function setupChatApplication() {
    // Initialize default rooms if they don't exist
    if (!getStoredData('chatRooms')) {
        const defaultRooms = [
            {
                id: 'general',
                name: 'General',
                description: 'General discussion for everyone',
                members: 0,
                createdBy: 'System',
                createdAt: new Date().toISOString()
            },
            {
                id: 'tech-talk',
                name: 'Tech Talk',
                description: 'Discuss technology, programming, and innovation',
                members: 0,
                createdBy: 'System',
                createdAt: new Date().toISOString()
            },
            {
                id: 'random',
                name: 'Random',
                description: 'Random conversations and fun discussions',
                members: 0,
                createdBy: 'System',
                createdAt: new Date().toISOString()
            }
        ];
        storeData('chatRooms', defaultRooms);
    }
    
    // Initialize messages if they don't exist
    if (!getStoredData('chatMessages')) {
        storeData('chatMessages', {});
    }
    
    // Initialize online users
    if (!getStoredData('onlineUsers')) {
        storeData('onlineUsers', []);
    }
    
    // Request notification permission
    requestNotificationPermission();
    
    loadRooms();
    loadOnlineUsers();
    populateEmojiPicker();
}

function setupChatEventListeners() {
    // Make all interactive elements mobile-friendly
    const allInteractiveElements = document.querySelectorAll('button, input, textarea, .btn');
    allInteractiveElements.forEach(element => {
        element.style.pointerEvents = 'auto';
        element.style.touchAction = 'manipulation';
        if (element.tagName === 'BUTTON') {
            element.style.minHeight = '44px';
        }
    });
    
    // --- Logout Button ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
        logoutBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // --- Send Button ---
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
        sendBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            sendMessage();
        });
    }
    
    // --- Message Input Events ---
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.style.pointerEvents = 'auto';
        messageInput.style.touchAction = 'manipulation';
        
        messageInput.addEventListener('keydown', handleMessageInput);
        messageInput.addEventListener('input', handleTypingIndicator);
        messageInput.addEventListener('input', updateCharacterCount);
        messageInput.addEventListener('input', autoResizeTextarea);
    }
    
    // --- Mobile menu toggle (FIXED VERSION) ---
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        // Clear any existing event listeners
        mobileMenuToggle.replaceWith(mobileMenuToggle.cloneNode(true));
        const newToggle = document.getElementById('mobile-menu-toggle');
        
        newToggle.style.pointerEvents = 'auto';
        newToggle.style.touchAction = 'manipulation';
        newToggle.style.minHeight = '44px';
        
        newToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('Mobile menu toggle clicked');
            toggleMobileMenu();
        });
        
        newToggle.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            e.preventDefault();
            console.log('Mobile menu toggle touched');
            toggleMobileMenu();
        });
    }
    
    // --- Notification Button ---
    const notificationBtn = document.getElementById('notification-toggle-btn');
    if (notificationBtn) {
        notificationBtn.onclick = toggleNotifications;
    }
    
    // --- Clear Chat Button ---
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.onclick = clearChat;
    }
    
    // --- Emoji Picker Events ---
    setupEmojiPickerEvents();
    
    // --- Modal Events ---
    setupModalEvents();
    
    // --- Format buttons ---
    setupFormatButtons();
}

// UPDATED MOBILE MENU FUNCTIONS
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    console.log('Toggle mobile menu - current state:', sidebar.classList.contains('open'));
    
    if (sidebar.classList.contains('open')) {
        // Close menu
        sidebar.classList.remove('open');
        document.removeEventListener('click', handleOutsideClick);
    } else {
        // Open menu
        sidebar.classList.add('open');
        
        // Add outside click handler after a short delay to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 200);
    }
}

function handleOutsideClick(e) {
    const sidebar = document.querySelector('.sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    
    // Don't close if clicking inside sidebar, on toggle button, or on interactive elements
    if (sidebar.contains(e.target) || 
        e.target === mobileMenuToggle || 
        e.target.closest('.mobile-menu-toggle') ||
        e.target.closest('.room-list-item') ||
        e.target.closest('button')) {
        return;
    }
    
    // Close sidebar
    sidebar.classList.remove('open');
    document.removeEventListener('click', handleOutsideClick);
}

function setupEmojiPickerEvents() {
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiToolbarBtn = document.getElementById('emoji-toolbar-btn');
    const emojiInputBtn = document.getElementById('emoji-input-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const emojiCloseBtn = document.getElementById('emoji-close-btn');
    
    const emojiButtons = [emojiBtn, emojiToolbarBtn, emojiInputBtn];
    
    emojiButtons.forEach(btn => {
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.touchAction = 'manipulation';
            
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleEmojiPicker();
            });
            
            btn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                e.preventDefault();
                toggleEmojiPicker();
            });
        }
    });
    
    if (emojiCloseBtn) {
        emojiCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideEmojiPicker();
        });
    }
    
    // Click outside to close emoji picker
    document.addEventListener('click', function(e) {
        if (!emojiPicker) return;
        if (emojiPicker.style.display !== 'none' && 
            !emojiPicker.contains(e.target) && 
            !emojiButtons.includes(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
}

function setupModalEvents() {
    // Create Room Modal
    const createRoomBtn = document.getElementById('create-room-btn');
    const closeModalBtn = document.getElementById('close-create-room-modal');
    const cancelModalBtn = document.getElementById('cancel-create-room-modal');
    const confirmBtn = document.getElementById('create-room-confirm');
    
    if (createRoomBtn) {
        createRoomBtn.onclick = showCreateRoomModal;
    }
    
    if (closeModalBtn) {
        closeModalBtn.onclick = hideCreateRoomModal;
    }
    
    if (cancelModalBtn) {
        cancelModalBtn.onclick = hideCreateRoomModal;
    }
    
    if (confirmBtn) {
        confirmBtn.onclick = createRoom;
    }
    
    // Delete Room Modal
    setupDeleteRoomModalEvents();
}

function setupDeleteRoomModalEvents() {
    const confirmDeleteBtn = document.getElementById('confirm-delete-room');
    const cancelDeleteBtn = document.getElementById('cancel-delete-room');
    const closeDeleteBtn = document.getElementById('close-delete-room-modal');
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = confirmDeleteRoom;
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = hideDeleteRoomModal;
    }
    
    if (closeDeleteBtn) {
        closeDeleteBtn.onclick = hideDeleteRoomModal;
    }
}

function setupFormatButtons() {
    // Bold button
    const boldBtn = document.getElementById('bold-btn');
    if (boldBtn) {
        boldBtn.onclick = () => insertFormatting('**', '**');
    }
    
    // Italic button
    const italicBtn = document.getElementById('italic-btn');
    if (italicBtn) {
        italicBtn.onclick = () => insertFormatting('*', '*');
    }
    
    // Code button
    const codeBtn = document.getElementById('code-btn');
    if (codeBtn) {
        codeBtn.onclick = () => insertFormatting('`', '`');
    }
}

function loadInitialChatData() {
    // Add current user to online users
    addUserToOnlineList(currentUsername);
    
    // Simulate loading animation
    setTimeout(() => {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.classList.add('loaded');
        }
    }, 500);
}

function startRealTimeUpdates() {
    // Update typing indicators and online users
    setInterval(() => {
        updateTypingIndicator();
        updateOnlineUsers();
    }, 2000);
}

// ========================================
// ROOM MANAGEMENT
// ========================================
function loadRooms() {
    const roomList = document.getElementById('room-list');
    const rooms = getStoredData('chatRooms') || [];
    
    if (!roomList) return;
    
    roomList.innerHTML = '';
    
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'room-list-item';
        li.setAttribute('data-room-id', room.id);
        
        // Make room clickable on mobile
        li.style.pointerEvents = 'auto';
        li.style.touchAction = 'manipulation';
        li.style.minHeight = '60px'; // Increased for mobile
        
        // Create room content
        li.innerHTML = `
            <div class="room-content">
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-description">${escapeHtml(room.description)}</div>
                <div class="room-meta">
                    <span>Created by ${escapeHtml(room.createdBy)}</span>
                    <span class="room-members">${room.members} members</span>
                </div>
            </div>
            ${room.createdBy !== 'System' ? `<button class="delete-room-btn" onclick="deleteRoom('${room.id}', event)"><i class="fas fa-trash"></i></button>` : ''}
        `;
        
        // UPDATED room click handlers
        li.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!e.target.classList.contains('delete-room-btn') && !e.target.closest('.delete-room-btn')) {
                console.log('Room clicked:', room.id);
                joinRoom(room.id);
                
                // Close mobile menu after room selection
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar && sidebar.classList.contains('open')) {
                        setTimeout(() => {
                            sidebar.classList.remove('open');
                            document.removeEventListener('click', handleOutsideClick);
                        }, 300);
                    }
                }
            }
        });
        
        // Add touch event for mobile
        li.addEventListener('touchstart', function(e) {
            if (!e.target.classList.contains('delete-room-btn') && !e.target.closest('.delete-room-btn')) {
                e.preventDefault();
                // Add visual feedback
                this.style.background = 'var(--bg-hover)';
                setTimeout(() => {
                    this.style.background = '';
                }, 150);
            }
        });
        
        li.addEventListener('touchend', function(e) {
            if (!e.target.classList.contains('delete-room-btn') && !e.target.closest('.delete-room-btn')) {
                e.preventDefault();
                console.log('Room touched:', room.id);
                joinRoom(room.id);
                
                // Close mobile menu after room selection
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar && sidebar.classList.contains('open')) {
                        setTimeout(() => {
                            sidebar.classList.remove('open');
                            document.removeEventListener('click', handleOutsideClick);
                        }, 300);
                    }
                }
            }
        });
        
        roomList.appendChild(li);
    });
    
    // Auto-join General room if no room is selected
    if (!currentRoom && rooms.length > 0) {
        joinRoom('general');
    }
}

function joinRoom(roomId) {
    if (currentRoom === roomId) return;
    
    currentRoom = roomId;
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return;
    
    // Update UI
    document.querySelectorAll('.room-list-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeRoom = document.querySelector(`[data-room-id="${roomId}"]`);
    if (activeRoom) {
        activeRoom.classList.add('active');
    }
    
    // Update room info
    const roomInfo = document.querySelector('.room-info h3');
    const roomMembers = document.querySelector('.room-members');
    
    if (roomInfo) {
        roomInfo.textContent = room.name;
    }
    
    if (roomMembers) {
        roomMembers.textContent = `${room.members} members online`;
    }
    
    // Send WebSocket join message
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'join',
            room: roomId,
            username: currentUsername
        }));
    }
    
    // Load and display messages
    displayMessages();
    
    // Update typing indicator
    updateTypingIndicator();
}

function createRoom() {
    const roomNameInput = document.getElementById('room-name-input');
    const roomDescInput = document.getElementById('room-desc-input');
    
    if (!roomNameInput || !roomDescInput) return;
    
    const roomName = roomNameInput.value.trim();
    const roomDesc = roomDescInput.value.trim();
    
    if (!roomName) {
        showError('Room name is required');
        return;
    }
    
    // Create new room
    const rooms = getStoredData('chatRooms') || [];
    const roomId = roomName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Check if room already exists
    if (rooms.find(r => r.id === roomId)) {
        showError('Room already exists');
        return;
    }
    
    const newRoom = {
        id: roomId,
        name: roomName,
        description: roomDesc || 'No description',
        members: 1,
        createdBy: currentUsername,
        createdAt: new Date().toISOString()
    };
    
    rooms.push(newRoom);
    storeData('chatRooms', rooms);
    
    // Initialize empty message list for new room
    const allMessages = getStoredData('chatMessages') || {};
    allMessages[roomId] = [];
    storeData('chatMessages', allMessages);
    
    // Reload rooms and join new room
    loadRooms();
    joinRoom(roomId);
    
    // Hide modal
    hideCreateRoomModal();
    
    // Clear form
    roomNameInput.value = '';
    roomDescInput.value = '';
    
    showNotification('Room created successfully!', 'success');
}

function deleteRoom(roomId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return;
    
    if (room.createdBy !== currentUsername) {
        showNotification('You can only delete rooms you created', 'error');
        return;
    }
    
    // Show delete confirmation modal
    showDeleteRoomModal(roomId, room.name);
}

function confirmDeleteRoom() {
    const roomIdToDelete = document.getElementById('delete-room-modal').getAttribute('data-room-id');
    
    if (!roomIdToDelete) return;
    
    // Remove room from rooms list
    let rooms = getStoredData('chatRooms') || [];
    rooms = rooms.filter(r => r.id !== roomIdToDelete);
    storeData('chatRooms', rooms);
    
    // Remove room messages
    const allMessages = getStoredData('chatMessages') || {};
    delete allMessages[roomIdToDelete];
    storeData('chatMessages', allMessages);
    
    // If we're in the deleted room, switch to General
    if (currentRoom === roomIdToDelete) {
        joinRoom('general');
    }
    
    // Reload rooms
    loadRooms();
    
    // Hide modal
    hideDeleteRoomModal();
    
    showNotification('Room deleted successfully', 'success');
}

// ========================================
// MESSAGE HANDLING
// ========================================
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    
    if (!messageInput || !currentRoom) return;
    
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    const message = {
        id: generateMessageId(),
        author: currentUsername,
        content: messageText,
        timestamp: new Date().toISOString(),
        type: 'text'
    };
    
    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'message',
            id: message.id,
            author: message.author,
            content: message.content,
            timestamp: message.timestamp,
            room: currentRoom
        }));
    } else {
        // Fallback to localStorage
        const allMessages = getStoredData('chatMessages') || {};
        if (!allMessages[currentRoom]) {
            allMessages[currentRoom] = [];
        }
        
        allMessages[currentRoom].push(message);
        storeData('chatMessages', allMessages);
        displayMessages();
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Stop typing indicator
    stopTyping();
    
    // Update character count
    updateCharacterCount();
}

function handleMessageInput(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function displayMessages() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer || !currentRoom) return;
    
    const allMessages = getStoredData('chatMessages') || {};
    const roomMessages = allMessages[currentRoom] || [];
    
    if (roomMessages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-comments"></i>
                <h3>Welcome to the chat room!</h3>
                <p>Start a conversation by sending your first message.</p>
            </div>
        `;
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    roomMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.author === currentUsername ? 'own' : ''}`;
        
        const time = new Date(message.timestamp);
        const timeString = formatMessageTime(time);
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-info">
                    <div class="message-avatar">${message.author.charAt(0).toUpperCase()}</div>
                    <span class="message-author">${escapeHtml(message.author)}</span>
                </div>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${formatMessageContent(message.content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    scrollToBottom();
}

function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
        // Today - show only time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // Other days - show date and time
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function formatMessageContent(content) {
    let formatted = escapeHtml(content);
    
    // Format bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Format italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Format code
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Format links with strict URL validation
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        if (/^(https?:\/\/|mailto:)/.test(url)) {
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
        }
        return escapeHtml(match);
    });
    
    // Auto-link URLs (http/https only)
    const urlRegex = /((https?:\/\/)[^\s]+)/g;
    formatted = formatted.replace(urlRegex, (url) => {
        if (/^(https?:\/\/)/.test(url)) {
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
        }
        return escapeHtml(url);
    });
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function clearChat() {
    if (!currentRoom) return;
    
    if (confirm('Are you sure you want to clear all messages in this room?')) {
        const allMessages = getStoredData('chatMessages') || {};
        allMessages[currentRoom] = [];
        storeData('chatMessages', allMessages);
        displayMessages();
        showNotification('Chat cleared', 'info');
    }
}

// ========================================
// TYPING INDICATOR
// ========================================
function handleTypingIndicator() {
    if (!currentRoom) return;
    
    if (!isTyping) {
        startTyping();
    }
    
    // Reset typing timeout
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 2000);
}

function startTyping() {
    isTyping = true;
    
    // Send typing start via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'typing_start',
            room: currentRoom,
            username: currentUsername
        }));
    }
    
    // Also update localStorage for fallback
    const typingData = getStoredData('typingUsers') || {};
    if (!typingData[currentRoom]) {
        typingData[currentRoom] = [];
    }
    
    if (!typingData[currentRoom].includes(currentUsername)) {
        typingData[currentRoom].push(currentUsername);
        storeData('typingUsers', typingData);
    }
}

function stopTyping() {
    isTyping = false;
    
    // Send typing stop via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'typing_stop',
            room: currentRoom,
            username: currentUsername
        }));
    }
    
    // Also update localStorage for fallback
    const typingData = getStoredData('typingUsers') || {};
    if (typingData[currentRoom]) {
        typingData[currentRoom] = typingData[currentRoom].filter(user => user !== currentUsername);
        storeData('typingUsers', typingData);
    }
}

function updateTypingIndicator() {
    if (!currentRoom) return;
    
    const typingIndicator = document.getElementById('typing-indicator');
    if (!typingIndicator) return;
    
    const typingData = getStoredData('typingUsers') || {};
    const roomTypingUsers = typingData[currentRoom] || [];
    
    // Filter out current user
    const otherUsersTyping = roomTypingUsers.filter(user => user !== currentUsername);
    
    if (otherUsersTyping.length > 0) {
        const typingText = formatTypingText(otherUsersTyping);
        const typingTextElement = typingIndicator.querySelector('.typing-text');
        if (typingTextElement) {
            typingTextElement.textContent = typingText;
        }
        
        typingIndicator.style.display = 'flex';
    } else {
        typingIndicator.style.display = 'none';
    }
}

function formatTypingText(users) {
    if (users.length === 1) {
        return `${users[0]} is typing...`;
    } else if (users.length === 2) {
        return `${users[0]} and ${users[1]} are typing...`;
    } else {
        return `${users.length} people are typing...`;
    }
}

// ========================================
// USER MANAGEMENT
// ========================================
function addUserToOnlineList(username) {
    const onlineUsers = getStoredData('onlineUsers') || [];
    
    if (!onlineUsers.find(user => user.username === username)) {
        onlineUsers.push({
            username: username,
            joinedAt: new Date().toISOString(),
            status: 'online'
        });
        storeData('onlineUsers', onlineUsers);
    }
}

function removeUserFromOnlineList(username) {
    const onlineUsers = getStoredData('onlineUsers') || [];
    const filteredUsers = onlineUsers.filter(user => user.username !== username);
    storeData('onlineUsers', filteredUsers);
}

function loadOnlineUsers() {
    const onlineUsers = getStoredData('onlineUsers') || [];
    const onlineUsersList = document.getElementById('online-users');
    const userCountElement = document.getElementById('user-count');
    
    if (!onlineUsersList) return;
    
    onlineUsersList.innerHTML = '';
    
    if (userCountElement) {
        userCountElement.textContent = onlineUsers.length;
    }
    
    onlineUsers.forEach(user => {
        const li = document.createElement('li');
        const initial = user.username.charAt(0).toUpperCase();
        
        li.innerHTML = `
            <div class="user-avatar">${initial}</div>
            <span class="user-name">${escapeHtml(user.username)}</span>
        `;
        
        onlineUsersList.appendChild(li);
    });
}

function updateOnlineUsers() {
    loadOnlineUsers();
}

// ========================================
// EMOJI PICKER
// ========================================
function populateEmojiPicker() {
    const emojiGrid = document.getElementById('emoji-grid');
    if (!emojiGrid) return;
    
    emojiGrid.innerHTML = '';
    
    // Add all emojis
    Object.values(emojiCategories).flat().forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.style.pointerEvents = 'auto';
        span.style.touchAction = 'manipulation';
        span.style.minHeight = '44px';
        span.style.minWidth = '44px';
        
        span.addEventListener('click', function() {
            insertEmoji(emoji);
        });
        
        span.addEventListener('touchstart', function(e) {
            e.preventDefault();
            insertEmoji(emoji);
        });
        
        emojiGrid.appendChild(span);
    });
}

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
        emojiPicker.style.display = 'block';
    } else {
        emojiPicker.style.display = 'none';
    }
}

function hideEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) {
        emojiPicker.style.display = 'none';
    }
}

function insertEmoji(emoji) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;
    
    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    
    messageInput.focus();
    hideEmojiPicker();
}

// ========================================
// MESSAGE FORMATTING
// ========================================
function insertFormatting(startTag, endTag) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const selectedText = messageInput.value.substring(start, end);
    
    const formattedText = startTag + selectedText + endTag;
    
    messageInput.value = messageInput.value.substring(0, start) + formattedText + messageInput.value.substring(end);
    
    // Set cursor position
    if (selectedText) {
        messageInput.selectionStart = start;
        messageInput.selectionEnd = start + formattedText.length;
    } else {
        messageInput.selectionStart = messageInput.selectionEnd = start + startTag.length;
    }
    
    messageInput.focus();
}

// ========================================
// UI UTILITIES
// ========================================
function updateCharacterCount() {
    const messageInput = document.getElementById('message-input');
    const characterCount = document.getElementById('character-count');
    
    if (!messageInput || !characterCount) return;
    
    const length = messageInput.value.length;
    const maxLength = 500;
    
    characterCount.textContent = `${length}/${maxLength}`;
    
    if (length > maxLength * 0.9) {
        characterCount.classList.add('warning');
    } else {
        characterCount.classList.remove('warning');
    }
    
    if (length >= maxLength) {
        characterCount.classList.add('error');
        messageInput.value = messageInput.value.substring(0, maxLength);
    } else {
        characterCount.classList.remove('error');
    }
}

function autoResizeTextarea() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.style.transform = sidebar.style.transform === 'translateX(-100%)' ? 'translateX(0)' : 'translateX(-100%)';
    }
}

function closeAllModals() {
    // Close emoji picker
    hideEmojiPicker();
    
    // Close any open modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// ========================================
// MODAL FUNCTIONS
// ========================================
function showCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showDeleteRoomModal(roomId, roomName) {
    const modal = document.getElementById('delete-room-modal');
    if (modal) {
        modal.setAttribute('data-room-id', roomId);
        const roomNameSpan = modal.querySelector('.delete-room-name');
        if (roomNameSpan) {
            roomNameSpan.textContent = roomName;
        }
        modal.style.display = 'flex';
    }
}

function hideDeleteRoomModal() {
    const modal = document.getElementById('delete-room-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.removeAttribute('data-room-id');
    }
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        showNotificationRequest();
    }
}

function showNotificationRequest() {
    const notification = document.createElement('div');
    notification.className = 'notification-request';
    notification.innerHTML = `
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        <div class="notification-content">
            <i class="fas fa-bell"></i>
            <div class="notification-text">
                <h4>Enable Notifications</h4>
                <p>Get notified when you receive new messages</p>
            </div>
        </div>
        <div class="notification-actions">
            <button onclick="enableNotifications(this)">Enable</button>
            <button onclick="this.parentElement.parentElement.remove()">Not Now</button>
        </div>
    `;
    
    // Make notification buttons mobile-friendly
    const buttons = notification.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.style.touchAction = 'manipulation';
        btn.style.minHeight = '44px';
    });
    
    document.body.appendChild(notification);
}

function enableNotifications(button) {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            notificationsEnabled = true;
            showNotification('Notifications enabled!', 'success');
        }
        button.parentElement.parentElement.remove();
    });
}

function toggleNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            notificationsEnabled = !notificationsEnabled;
            showNotification(notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled', 'info');
        } else {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    notificationsEnabled = true;
                    showNotification('Notifications enabled!', 'success');
                }
            });
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 12px 20px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-lg);
        backdrop-filter: blur(10px);
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        pointer-events: auto;
        touch-action: manipulation;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// ========================================
// LOGOUT FUNCTIONALITY
// ========================================
function logout() {
    // Remove user from online users
    removeUserFromOnlineList(currentUsername);
    
    // Clear stored username
    localStorage.removeItem('chatApp_chatUsername');
    
    // Close WebSocket connection
    if (ws) {
        ws.close();
    }
    
    // Redirect to login page
    window.location.href = 'index.html';
}

// ========================================
// STORAGE FUNCTIONS
// ========================================
function getStoredData(key) {
    try {
        const data = localStorage.getItem('chatApp_' + key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

function storeData(key, data) {
    try {
        localStorage.setItem('chatApp_' + key, JSON.stringify(data));
    } catch (error) {
        console.error('Error writing to localStorage:', error);
    }
}

// ========================================
// GLOBAL ERROR HANDLER
// ========================================
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showErrorOverlay('An error occurred: ' + e.message);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showErrorOverlay('Promise error: ' + e.reason);
});

console.log('ChatApp script loaded successfully - Mobile and WebSocket ready');

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

function setupGlobalEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        const isInput = document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' || 
             document.activeElement.isContentEditable);
        
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
        background: #ffe0e0; color: #900; padding: 16px; font-family: monospace;
        position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
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
        loginBtn.addEventListener('click', joinChat);
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
    
    if (!usernameInput || !loadingOverlay) return;
    
    const username = usernameInput.value.trim();
    
    if (!validateUsername(username)) {
        return;
    }
    
    if (username === '') {
        showError('Please enter a username');
        return;
    }
    
    // Show loading
    loadingOverlay.style.display = 'flex';
    
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
        
        // Redirect to chat
        window.location.href = 'chat.html';
    }, 1500);
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
    // --- Logout Button ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
    
    // --- Send Button ---
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
    }
    
    // --- Message Input Events ---
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keydown', handleMessageInput);
        messageInput.addEventListener('input', handleTypingIndicator);
        messageInput.addEventListener('input', updateCharacterCount);
        messageInput.addEventListener('input', autoResizeTextarea);
    }
    
    // --- Mobile menu toggle ---
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.onclick = toggleMobileMenu;
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

function setupEmojiPickerEvents() {
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiToolbarBtn = document.getElementById('emoji-toolbar-btn');
    const emojiInputBtn = document.getElementById('emoji-input-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    const emojiCloseBtn = document.getElementById('emoji-close-btn');
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPicker();
        });
    }
    
    if (emojiToolbarBtn) {
        emojiToolbarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPicker();
        });
    }
    
    if (emojiInputBtn) {
        emojiInputBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPicker();
        });
    }
    
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
            e.target !== emojiBtn && 
            e.target !== emojiToolbarBtn &&
            e.target !== emojiInputBtn) {
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
        
        // Create room content
        li.innerHTML = `
            <div class="room-content">
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-description">${escapeHtml(room.description)}</div>
                <div class="room-meta">
                    <span>${room.members} members</span>
                    <span>${formatDate(room.createdAt)}</span>
                </div>
            </div>
            ${room.createdBy === currentUsername ? 
                `<button class="delete-room-btn" onclick="showDeleteRoomModal('${room.id}')" title="Delete room">🗑️</button>` : 
                ''}
        `;
        
        li.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-room-btn')) {
                joinRoom(room.id);
            }
        });
        
        roomList.appendChild(li);
    });
}

function showCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'flex';
        const roomNameInput = document.getElementById('room-name');
        if (roomNameInput) {
            roomNameInput.focus();
        }
    }
}

function hideCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'none';
        // Clear form
        const roomNameInput = document.getElementById('room-name');
        const roomDescInput = document.getElementById('room-description');
        if (roomNameInput) roomNameInput.value = '';
        if (roomDescInput) roomDescInput.value = '';
    }
}

function createRoom() {
    const roomNameInput = document.getElementById('room-name');
    const roomDescInput = document.getElementById('room-description');
    
    if (!roomNameInput) return;
    
    const roomName = roomNameInput.value.trim();
    const roomDesc = roomDescInput ? roomDescInput.value.trim() : '';
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    const rooms = getStoredData('chatRooms') || [];
    const roomId = generateRoomId(roomName);
    
    // Check if room already exists
    if (rooms.find(r => r.id === roomId)) {
        alert('A room with this name already exists');
        return;
    }
    
    const newRoom = {
        id: roomId,
        name: roomName,
        description: roomDesc || 'A new chat room',
        members: 0,
        createdBy: currentUsername,
        createdAt: new Date().toISOString()
    };
    
    rooms.push(newRoom);
    storeData('chatRooms', rooms);
    
    // Refresh room list
    loadRooms();
    
    // Hide modal
    hideCreateRoomModal();
    
    // Join the new room
    joinRoom(roomId);
    
    // Show success message
    showNotification('Room created successfully!', 'success');
}

function showDeleteRoomModal(roomId) {
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return;
    
    const modal = document.getElementById('delete-room-modal');
    const roomNameSpan = document.getElementById('delete-room-name');
    
    if (modal && roomNameSpan) {
        roomNameSpan.textContent = room.name;
        modal.style.display = 'flex';
        modal.setAttribute('data-room-id', roomId);
    }
}

function hideDeleteRoomModal() {
    const modal = document.getElementById('delete-room-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.removeAttribute('data-room-id');
    }
}

function confirmDeleteRoom() {
    const modal = document.getElementById('delete-room-modal');
    const roomId = modal ? modal.getAttribute('data-room-id') : null;
    
    if (!roomId) return;
    
    deleteRoom(roomId);
    hideDeleteRoomModal();
}

function deleteRoom(roomId) {
    const rooms = getStoredData('chatRooms') || [];
    const updatedRooms = rooms.filter(room => room.id !== roomId);
    
    storeData('chatRooms', updatedRooms);
    
    // Delete messages for this room
    const allMessages = getStoredData('chatMessages') || {};
    delete allMessages[roomId];
    storeData('chatMessages', allMessages);
    
    // If current room was deleted, switch to general
    if (currentRoom === roomId) {
        const generalRoom = updatedRooms.find(r => r.id === 'general');
        if (generalRoom) {
            joinRoom('general');
        } else if (updatedRooms.length > 0) {
            joinRoom(updatedRooms[0].id);
        } else {
            currentRoom = null;
            displayMessages();
        }
    }
    
    loadRooms();
    showNotification('Room deleted successfully!', 'success');
}

function joinRoom(roomId) {
    if (!roomId) return;
    
    currentRoom = roomId;
    
    // Close previous WebSocket connection if any
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // Try to connect to WebSocket server (fallback to local storage)
    try {
        ws = new WebSocket('ws://localhost:3001');
        
        ws.onopen = () => {
            console.log('[WebSocket] Connection opened for room:', roomId);
            ws.send(JSON.stringify({ 
                type: 'join', 
                room: roomId,
                username: currentUsername 
            }));
        };
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'message') {
                displayIncomingMessage(msg);
            }
        };
        
        ws.onerror = () => {
            console.log('WebSocket not available, using localStorage fallback');
            ws = null;
        };
        
        ws.onclose = () => {
            console.log('WebSocket connection closed');
            ws = null;
        };
    } catch (error) {
        console.log('WebSocket not available, using localStorage fallback');
        ws = null;
    }
    
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return;
    
    // Update UI
    const currentRoomElement = document.getElementById('current-room');
    const roomMembersElement = document.getElementById('room-members');
    
    if (currentRoomElement) {
        currentRoomElement.textContent = room.name;
    }
    
    if (roomMembersElement) {
        roomMembersElement.textContent = `${room.members} members`;
    }
    
    // Update room selection in UI
    document.querySelectorAll('.room-list li').forEach(li => {
        li.classList.remove('active');
    });
    
    const activeRoom = document.querySelector(`[data-room-id="${roomId}"]`);
    if (activeRoom) {
        activeRoom.classList.add('active');
    }
    
    // Load messages for this room
    displayMessages();
    
    // Focus on message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.focus();
    }
}

function generateRoomId(roomName) {
    return roomName.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ========================================
// MESSAGE HANDLING
// ========================================
function handleMessageInput(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput || !currentRoom) return;
    
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    
    const message = {
        id: generateMessageId(),
        type: 'message',
        room: currentRoom,
        author: currentUsername,
        content: messageText,
        timestamp: new Date().toISOString()
    };
    
    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        // Fallback: store locally
        displayIncomingMessage(message);
    }
    
    // Clear input
    messageInput.value = '';
    updateCharacterCount();
    autoResizeTextarea();
    stopTyping();
}

function displayMessages() {
    if (!currentRoom) return;
    
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    const allMessages = getStoredData('chatMessages') || {};
    const roomMessages = allMessages[currentRoom] || [];
    
    // Clear existing messages
    messagesContainer.innerHTML = '';
    
    if (roomMessages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-comments"></i>
                <h3>Welcome to the chat!</h3>
                <p>Start a conversation by sending your first message.</p>
            </div>
        `;
        return;
    }
    
    roomMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    scrollToBottom();
}

function displayIncomingMessage(msg) {
    let allMessages = getStoredData('chatMessages') || {};
    
    if (!allMessages[msg.room]) {
        allMessages[msg.room] = [];
    }
    
    allMessages[msg.room].push(msg);
    storeData('chatMessages', allMessages);
    
    if (currentRoom === msg.room) {
        displayMessages();
        
        // Show notification if not from current user
        if (msg.author !== currentUsername && notificationsEnabled) {
            showDesktopNotification(msg.author, msg.content);
        }
    } else {
        // Update room with unread indicator
        updateUnreadIndicator(msg.room);
    }
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.author === currentUsername ? 'own' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const formattedContent = formatMessageContent(message.content);
    const timeString = formatMessageTime(message.timestamp);
    const authorInitial = message.author.charAt(0).toUpperCase();
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <div class="message-avatar">${authorInitial}</div>
                <span class="message-author">${escapeHtml(message.author)}</span>
            </div>
            <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    return messageDiv;
}

function formatMessageContent(content) {
    // Escape HTML first
    let formatted = escapeHtml(content);
    
    // Apply basic formatting (bold, italic, code)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>'); // Code
    
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
            <div class="user-status online">
                <i class="fas fa-circle"></i>
                Online
            </div>
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
    
    // Add all emojis from categories
    Object.values(emojiCategories).flat().forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.onclick = () => insertEmoji(emoji);
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
    if (messageInput) {
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(messageInput.selectionEnd);
        
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.selectionStart = messageInput.selectionEnd = cursorPos + emoji.length;
        
        messageInput.focus();
        updateCharacterCount();
    }
}

// ========================================
// FORMATTING FUNCTIONS
// ========================================
function insertFormatting(startTag, endTag) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const selectedText = messageInput.value.substring(start, end);
    const beforeText = messageInput.value.substring(0, start);
    const afterText = messageInput.value.substring(end);
    
    const newText = beforeText + startTag + selectedText + endTag + afterText;
    messageInput.value = newText;
    
    // Set cursor position
    const newPos = start + startTag.length + selectedText.length + endTag.length;
    messageInput.selectionStart = messageInput.selectionEnd = newPos;
    messageInput.focus();
    
    updateCharacterCount();
}

function updateCharacterCount() {
    const messageInput = document.getElementById('message-input');
    const characterCount = document.getElementById('character-count');
    
    if (messageInput && characterCount) {
        const length = messageInput.value.length;
        const maxLength = 1000;
        
        characterCount.textContent = `${length}/${maxLength}`;
        
        if (length > maxLength * 0.9) {
            characterCount.classList.add('warning');
        } else {
            characterCount.classList.remove('warning');
        }
        
        if (length > maxLength) {
            characterCount.classList.add('error');
            messageInput.value = messageInput.value.substring(0, maxLength);
        } else {
            characterCount.classList.remove('error');
        }
    }
}

function autoResizeTextarea() {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    }
}

// ========================================
// NOTIFICATIONS
// ========================================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        showNotificationPermissionRequest();
    } else if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        updateNotificationButton();
    }
}

function showNotificationPermissionRequest() {
    const notificationRequest = document.getElementById('notification-request');
    if (notificationRequest) {
        notificationRequest.style.display = 'block';
    }
}

function enableNotifications() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                updateNotificationButton();
                hideNotificationPermissionRequest();
                showNotification('Notifications enabled!', 'success');
            }
        });
    }
}

function dismissNotificationRequest() {
    hideNotificationPermissionRequest();
}

function hideNotificationPermissionRequest() {
    const notificationRequest = document.getElementById('notification-request');
    if (notificationRequest) {
        notificationRequest.style.display = 'none';
    }
}

function toggleNotifications() {
    if (Notification.permission === 'granted') {
        notificationsEnabled = !notificationsEnabled;
        updateNotificationButton();
        showNotification(
            notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled',
            'info'
        );
    } else {
        enableNotifications();
    }
}

function updateNotificationButton() {
    const notificationBtn = document.getElementById('notification-toggle-btn');
    if (notificationBtn) {
        const icon = notificationBtn.querySelector('i');
        if (icon) {
            icon.className = notificationsEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
        }
        notificationBtn.title = notificationsEnabled ? 'Disable notifications' : 'Enable notifications';
    }
}

function showDesktopNotification(author, message) {
    if (!notificationsEnabled || Notification.permission !== 'granted') return;
    
    const notification = new Notification(`${author} says:`, {
        body: message,
        icon: '/favicon.ico'
    });
    
    setTimeout(() => notification.close(), 5000);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: var(--bg-secondary); color: var(--text-primary);
        padding: 12px 20px; border-radius: 8px; border: 1px solid var(--border-color);
        box-shadow: var(--shadow-lg); backdrop-filter: blur(10px);
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// MOBILE & UI FUNCTIONS
// ========================================
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function closeAllModals() {
    // Close emoji picker
    hideEmojiPicker();
    
    // Close modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function getStoredData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

function storeData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error writing to localStorage:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString();
    }
}

function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

function updateUnreadIndicator(roomId) {
    const roomElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (roomElement && roomId !== currentRoom) {
        roomElement.classList.add('unread');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Remove user from online users
        removeUserFromOnlineList(currentUsername);
        
        // Clear current user data
        localStorage.removeItem('chatUsername');
        localStorage.removeItem('loginTime');
        
        // Close WebSocket connection
        if (ws) {
            ws.close();
            ws = null;
        }
        
        // Redirect to login
        window.location.href = 'index.html';
    }
}

// Prevent zoom on double tap
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Better form handling on mobile
const usernameInput = document.getElementById('username');
if (usernameInput) {
    usernameInput.addEventListener('focus', function() {
        // Scroll to input on focus (mobile keyboards)
        setTimeout(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
}

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: white; cursor: pointer;">&times;</button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Notification close functionality
function closeNotification() {
    const notification = document.getElementById('notification-request');
    if (notification) {
        notification.classList.add('closing');
        setTimeout(() => {
            notification.style.display = 'none';
            notification.classList.remove('closing');
        }, 300);
    }
}

function enableNotifications() {
    if ("Notification" in window) {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                showToast("Notifications enabled successfully!", "success");
            } else {
                showToast("Notifications denied.", "error");
            }
        });
    } else {
        showToast("This browser doesn't support notifications.", "error");
    }
    closeNotification();
}

// Show notification after page loads
window.addEventListener('load', function() {
    setTimeout(() => {
        const notification = document.getElementById('notification-request');
        if (notification) {
            notification.style.display = 'block';
        }
    }, 3000);
});

// Mobile detection and responsive fixes
function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
}

// Apply mobile class and fixes
if (isMobile()) {
    document.body.classList.add('mobile');
    
    // Fix input focus on mobile
    document.addEventListener('DOMContentLoaded', function() {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                setTimeout(() => {
                    this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    });
}

// Prevent zoom on double tap for mobile
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

let lastTouchEndMobile = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    toast.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; z-index: 10000; animation: slideInRight 0.3s ease-out; max-width: 300px; background: var(--bg-secondary); border: 1px solid var(--border-color); backdrop-filter: blur(10px);`;
    
    const colors = {
        success: 'var(--success-color)',
        error: 'var(--error-color)',
        info: 'var(--accent-color)',
        warning: 'var(--warning-color)'
    };
    
    toast.style.borderLeftColor = colors[type] || colors.info;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">&times;</button>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Handle sidebar toggle for mobile
function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (sidebar && isMobile()) {
        sidebar.classList.toggle('open');
        chatContainer.classList.toggle('sidebar-open');
    }
}

// Add mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileSidebar);
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(event) {
        if (isMobile()) {
            const sidebar = document.querySelector('.sidebar');
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            
            if (sidebar && sidebar.classList.contains('open') && 
                !sidebar.contains(event.target) && 
                !mobileToggle.contains(event.target)) {
                toggleMobileSidebar();
            }
        }
    });
});

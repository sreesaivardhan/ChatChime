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

// Emoji data
const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
    'Gestures': ['👍', '👎', '👌', '🤝', '👏', '🙏', '✊', '👊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👈', '👉', '👆', '👇', '☝️', '✋'],
    'Objects': ['💻', '📱', '⌚', '📷', '💡', '🔒', '🔑', '🎯', '🚀', '⭐', '🔥', '💎', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎮', '🎵']
};

// Initialize app on page load
window.onload = function() {
    // --- Create Room Modal Event Listeners ---
    document.addEventListener('DOMContentLoaded', function() {
        // Modal elements
        var createRoomModal = document.getElementById('create-room-modal');
        var openModalBtn = document.getElementById('create-room-btn');
        var closeModalBtn = document.getElementById('close-create-room-modal');
        var cancelModalBtn = document.getElementById('cancel-create-room-modal');
        var confirmBtn = document.getElementById('create-room-confirm');
        var roomNameInput = document.getElementById('room-name');
        var roomDescInput = document.getElementById('room-description');

        // Open modal
        if (openModalBtn) {
            openModalBtn.onclick = function(e) {
                e.preventDefault();
                if (createRoomModal) createRoomModal.style.display = 'flex';
                if (roomNameInput) roomNameInput.focus();
                console.log('[DEBUG] Open create room modal');
            };
        }
        // Close modal (X and Cancel)
        if (closeModalBtn) {
            closeModalBtn.onclick = function(e) {
                e.preventDefault();
                if (createRoomModal) createRoomModal.style.display = 'none';
                if (roomNameInput) roomNameInput.value = '';
                if (roomDescInput) roomDescInput.value = '';
                console.log('[DEBUG] Close create room modal (X)');
            };
        }
        if (cancelModalBtn) {
            cancelModalBtn.onclick = function(e) {
                e.preventDefault();
                if (createRoomModal) createRoomModal.style.display = 'none';
                if (roomNameInput) roomNameInput.value = '';
                if (roomDescInput) roomDescInput.value = '';
                console.log('[DEBUG] Close create room modal (Cancel)');
            };
        }
        // Confirm create room
        if (confirmBtn) {
            confirmBtn.onclick = function(e) {
                e.preventDefault();
                console.log('[DEBUG] Confirm create room');
                createRoom();
            };
        }
        // Keyboard support
        if (roomNameInput) {
            roomNameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    createRoom();
                }
            });
        }
        if (roomDescInput) {
            roomDescInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    createRoom();
                }
            });
        }
    });
    try {
        if (window.location.pathname.includes('chat.html')) {
            initializeChatPage();
        } else {
            initializeLoginPage();
        }
        // Mobile menu toggle
        var mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle && typeof toggleMobileMenu === 'function') {
            mobileMenuToggle.addEventListener('click', function(e) {
                console.log('[DEBUG] Mobile menu toggle button clicked');
                toggleMobileMenu();
            });
        }

        // --- Emoji Picker Button Events ---
        var emojiBtn = document.getElementById('emoji-btn');
        var emojiToolbarBtn = document.getElementById('emoji-toolbar-btn');
        var emojiPicker = document.getElementById('emoji-picker');
        var emojiCloseBtn = document.getElementById('emoji-close-btn');

        function showEmojiPicker() {
            if (emojiPicker) emojiPicker.style.display = 'block';
        }
        function hideEmojiPicker() {
            if (emojiPicker) emojiPicker.style.display = 'none';
        }
        function toggleEmojiPickerUI() {
            if (!emojiPicker) return;
            if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
                emojiPicker.style.display = 'block';
            } else {
                emojiPicker.style.display = 'none';
            }
        }
        if (emojiBtn) emojiBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPickerUI();
        });
        if (emojiToolbarBtn) emojiToolbarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleEmojiPickerUI();
        });
        if (emojiCloseBtn) emojiCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideEmojiPicker();
        });

        // Click outside to close emoji picker
        document.addEventListener('click', function(e) {
            if (!emojiPicker) return;
            if (
                emojiPicker.style.display !== 'none' &&
                !emojiPicker.contains(e.target) &&
                e.target !== emojiBtn &&
                e.target !== emojiToolbarBtn
            ) {
                emojiPicker.style.display = 'none';
            }
        });

        // Keyboard shortcut for sidebar toggle (Ctrl+B, desktop only)
        document.addEventListener('keydown', function(e) {
            // Emoji picker close on Escape
            if (e.key === 'Escape') {
                if (emojiPicker && emojiPicker.style.display !== 'none') {
                    emojiPicker.style.display = 'none';
                    return;
                }
            }

            // Ignore if focus is on input/textarea or if on mobile
            var isInput = document.activeElement && (
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable
            );
            var isMobile = window.innerWidth <= 768;
            if (isInput || isMobile) return;

            // Ctrl+B sidebar toggle
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                console.log('[DEBUG] Ctrl+B pressed for sidebar toggle');
                var sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('open');
                    console.log('[DEBUG] Sidebar classes after toggle:', sidebar.className);
                } else {
                    console.log('[DEBUG] Sidebar element not found!');
                }
            }
        });
    } catch (err) {
        // Log error to the page and console
        var errorDiv = document.createElement('div');
        errorDiv.style.background = '#ffe0e0';
        errorDiv.style.color = '#900';
        errorDiv.style.padding = '16px';
        errorDiv.style.fontFamily = 'monospace';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '0';
        errorDiv.style.left = '0';
        errorDiv.style.width = '100%';
        errorDiv.style.zIndex = 9999;
        errorDiv.innerText = 'JavaScript Error: ' + err.message;
        document.body.appendChild(errorDiv);
        console.error('JavaScript Error:', err);
    }
}


// Global chat state


// Global chat state
let currentRoom = null;
let ws = null; // WebSocket connection

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
        document.querySelector('.login-card').classList.add('animate-in');
    }, 100);
}

function setupLoginEventListeners() {
    const usernameInput = document.getElementById('username');
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
    setupChatEventListeners(); // Ensure event listeners are attached
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

// Enhanced for robust event attachment and debugging
function setupChatEventListeners() {
    // --- Logout Button ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }

    // --- Create Room Button ---
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
        createRoomBtn.onclick = showCreateRoomModal;
    }

    const createRoomConfirmBtn = document.getElementById('create-room-confirm');
if (createRoomConfirmBtn) {
    createRoomConfirmBtn.onclick = createRoom;
}

    // --- Send Button ---
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
    }

    // --- Emoji Buttons (header, toolbar, input, picker close) ---
    const emojiBtnIds = ['emoji-btn', 'emoji-toolbar-btn', 'emoji-input-btn', 'emoji-close-btn'];
    emojiBtnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.replaceWith(btn.cloneNode(true)); // Remove previous listeners
        }
    });
    emojiBtnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', toggleEmojiPicker);
            btn.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleEmojiPicker();
                }
            });
        }
    });

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

    // --- Notification permission events ---
    const enableNotificationsBtn = document.getElementById('enable-notifications');
    if (enableNotificationsBtn) {
        enableNotificationsBtn.onclick = enableNotifications;
    }
    const dismissNotificationsBtn = document.getElementById('dismiss-notifications');
    if (dismissNotificationsBtn) {
        dismissNotificationsBtn.onclick = dismissNotificationRequest;
    }

    // --- Delete Room Modal Buttons ---
    setupDeleteRoomModalEvents();
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
    // No polling needed for messages, only update online users and typing
    setInterval(() => {
        updateTypingIndicator();
        updateOnlineUsers();
    }, 2000);
}

// ========================================
// ROOM MANAGEMENT
// ========================================
// Enhanced for robust sidebar event attachment and debugging
function loadRooms() {
    const roomList = document.getElementById('room-list');
    const rooms = getStoredData('chatRooms') || [];
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'room-list-item';
        li.setAttribute('data-room-id', room.id);
    
        // Create a span for the room name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'room-name';
        nameSpan.textContent = room.name;
        li.appendChild(nameSpan);
    
        // Room delete button (only for creator)
        if (room.createdBy === currentUsername) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-room-btn';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.title = 'Delete room';
            delBtn.setAttribute('aria-label', `Delete room ${room.name}`);
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteRoom(room.id);
            };
            li.appendChild(delBtn);
        }
    
        li.addEventListener('click', () => {
            console.log('[Sidebar] Clicked room:', room.id);
            joinRoom(room.id);
        });
        roomList.appendChild(li);
    });
    // After updating room list, re-attach all sidebar event listeners
    setTimeout(() => {
        console.log('[Sidebar] Re-attaching event listeners after room list update');
        setupChatEventListeners();
    }, 0);
}

function joinRoom(roomId) {
    if (!roomId) {
        console.error('[joinRoom] Attempted to join undefined room!');
        return;
    }
    console.log('[joinRoom] Joining room:', roomId, 'currentUsername:', currentUsername);
    console.log('[joinRoom] ws before join:', ws);

    currentRoom = roomId;
    // Close previous WebSocket connection if any
    if (ws) {
        ws.close();
        ws = null;
    }
    // Connect to WebSocket server
    ws = new window.WebSocket('ws://localhost:3001');
    ws.onopen = () => {
        console.log('[WebSocket] Connection opened for room:', roomId);
        ws.send(JSON.stringify({ type: 'join', room: roomId }));
    };
    ws.onmessage = (event) => {
        console.log('[WebSocket] Message received:', event.data);
        const msg = JSON.parse(event.data);
        if (msg.type === 'message') {
            displayIncomingMessage(msg);
        }
    };
    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
    ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed for room:', roomId, event);
    };
    ws.onclose = () => {
        // Optionally handle disconnect
    };
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) return;
    
    // Update current room
    currentRoom = roomId;
    
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
    
    // Clear welcome message
    clearWelcomeMessage();
    
    // Focus on message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.focus();
    }
}

function showCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) {
        modal.style.display = 'flex';
        const roomNameInput = document.getElementById('room-name');
        if (roomNameInput) {
            roomNameInput.focus();
        }
        console.log('[DEBUG] showCreateRoomModal called');
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
        console.log('[DEBUG] hideCreateRoomModal called');
    }
}

function createRoom() {
    console.log('[DEBUG] createRoom called');
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

function generateRoomId(roomName) {
    return roomName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
    console.log('[sendMessage] Sending message, currentRoom:', currentRoom, 'currentUsername:', currentUsername);
    console.log('[sendMessage] ws:', ws, 'readyState:', ws ? ws.readyState : 'no ws');
    const messageInput = document.getElementById('message-input');
    if (!messageInput || !currentRoom) return;
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    const message = {
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
        console.log('[sendMessage] WebSocket not open, using fallback');
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
    console.log('[displayMessages] Displaying messages for room:', currentRoom);
    if (!currentRoom) return;
    const messagesContainer = document.getElementById('messages');
    console.log('[displayMessages] messagesContainer:', messagesContainer);
    if (!messagesContainer) {
        alert('No messages container found!');
        return;
    }
    const allMessages = getStoredData('chatMessages') || {};
    console.log('[displayMessages] allMessages:', allMessages);
    console.log('[displayMessages] currentRoom:', currentRoom);
    console.log('[displayMessages] chatMessages keys:', Object.keys(allMessages));
    const roomMessages = allMessages[currentRoom] || [];
    console.log('[displayMessages] roomMessages:', roomMessages);
    // Clear existing messages
    messagesContainer.innerHTML = '';
    if (roomMessages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="no-messages">
                <i class="fas fa-comments"></i>
                <h3>No messages yet</h3>
                <p>Be the first to start the conversation!</p>
            </div>
        `;

        return;
    }
    let renderedCount = 0;
    roomMessages.forEach(message => {
        console.log('[displayMessages] Rendering message:', message);
        const messageElement = createMessageElement(message);
        console.log('[displayMessages] Created element:', messageElement);
        messagesContainer.appendChild(messageElement);
        renderedCount++;
    });


    scrollToBottom();
}

// Real-time: add incoming message to localStorage and UI
function displayIncomingMessage(msg) {
    console.log('[displayIncomingMessage] Incoming message:', msg, 'currentRoom:', currentRoom, 'currentUsername:', currentUsername);
    let allMessages = getStoredData('chatMessages');
    if (!allMessages || typeof allMessages !== 'object' || Array.isArray(allMessages)) {
        allMessages = {};
    }
    if (!allMessages[msg.room]) allMessages[msg.room] = [];
    allMessages[msg.room].push(msg);
    storeData('chatMessages', allMessages);
    if (currentRoom === msg.room) displayMessages();
}



function createMessageElement(message) {
    console.log('[createMessageElement] Input message:', message);
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.author === currentUsername ? 'own' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Enhanced: Show sender and user-friendly timestamp clearly
    const formattedContent = formatMessageContent(message.content);
    const timeString = formatMessageTime(message.timestamp);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-author">${escapeHtml(message.author)}</span>
            <span class="message-time" title="${new Date(message.timestamp).toLocaleString()}">${timeString}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    console.log('[createMessageElement] Output element:', messageDiv);
    return messageDiv;
}

// Enhanced: Harden message rendering security and sanitize links
function formatMessageContent(content) {
    // Escape HTML first
    let formatted = escapeHtml(content);

    // Apply basic formatting (bold, italic, code)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>'); // Code

    // Format links with strict URL validation and rel attributes
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        if (/^(https?:\/\/|mailto:)/.test(url)) {
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
        }
        return escapeHtml(match); // If not a safe URL, escape
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

function clearWelcomeMessage() {
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
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
    // In real implementation, this would send to server
    // For now, we'll simulate by storing in localStorage
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
    
    // Filter out current user and get other users typing
    const otherUsersTyping = roomTypingUsers.filter(user => user !== currentUsername);
    
    if (otherUsersTyping.length > 0) {
        const typingText = formatTypingText(otherUsersTyping);
        typingIndicator.querySelector('.typing-text').textContent = typingText;
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

// Enhanced: Real-time user presence display
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
        li.innerHTML = `
            <div class="user-avatar ${user.online ? 'online' : ''}">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <span class="user-name">${escapeHtml(user.username)}</span>
            <span class="user-status ${user.online ? 'online' : 'offline'}">
                <i class="fas fa-circle"></i> ${user.online ? 'Online' : 'Offline'}
            </span>
        `;
        onlineUsersList.appendChild(li);
    });
}


function updateOnlineUsers() {
    loadOnlineUsers();
}

function handleUserLeaving() {
    removeUserFromOnlineList(currentUsername);
    stopTyping();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Remove user from online list
        removeUserFromOnlineList(currentUsername);
        
        // Clear user session
        removeStoredData('chatUsername');
        
        // Clear intervals
        if (messagePollingInterval) {
            clearInterval(messagePollingInterval);
        }
        
        // Redirect to login
        window.location.href = 'index.html';
    }
}

// ========================================
// EMOJI PICKER
// ========================================
function populateEmojiPicker() {
    const emojiGrid = document.getElementById('emoji-grid');
    if (!emojiGrid) return;
    
    emojiGrid.innerHTML = '';
    
    Object.entries(emojiCategories).forEach(([category, emojis]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'emoji-category';
        
        const categoryTitle = document.createElement('h5');
        categoryTitle.textContent = category;
        categoryTitle.className = 'emoji-category-title';
        categoryDiv.appendChild(categoryTitle);
        
        const emojiRow = document.createElement('div');
        emojiRow.className = 'emoji-row';
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.textContent = emoji;
            emojiBtn.className = 'emoji-item';
            emojiBtn.addEventListener('click', () => insertEmoji(emoji));
            emojiRow.appendChild(emojiBtn);
        });
        
        categoryDiv.appendChild(emojiRow);
        emojiGrid.appendChild(categoryDiv);
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

function insertEmoji(emoji) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(messageInput.selectionEnd);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    
    updateCharacterCount();
    autoResizeTextarea();
}

// ========================================
// FORMATTING FUNCTIONS
// ========================================
function insertFormat(startTag, endTag) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const selectedText = messageInput.value.substring(start, end);
    
    const replacement = startTag + selectedText + endTag;
    const textBefore = messageInput.value.substring(0, start);
    const textAfter = messageInput.value.substring(end);
    
    messageInput.value = textBefore + replacement + textAfter;
    messageInput.focus();
    
    // Set cursor position
    const newPos = start + startTag.length + selectedText.length + endTag.length;
    messageInput.setSelectionRange(newPos, newPos);
    
    updateCharacterCount();
}

// ========================================
// UI HELPER FUNCTIONS
// ========================================
function updateCharacterCount() {
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('char-count');
    
    if (messageInput && charCount) {
        charCount.textContent = messageInput.value.length;
        
        // Change color based on character count
        if (messageInput.value.length > 800) {
            charCount.style.color = 'var(--warning-color)';
        } else if (messageInput.value.length > 950) {
            charCount.style.color = 'var(--error-color)';
        } else {
            charCount.style.color = 'var(--text-muted)';
        }
    }
}

function autoResizeTextarea() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
        if (sidebar.classList.contains('mobile-open')) {
            if (overlay) overlay.style.display = 'block';
            sidebar.setAttribute('aria-modal', 'true');
            sidebar.focus();
        } else {
            if (overlay) overlay.style.display = 'none';
            sidebar.removeAttribute('aria-modal');
        }
    }
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            const notificationRequest = document.getElementById('notification-request');
            if (notificationRequest) {
                notificationRequest.style.display = 'block';
            }
        }, 3000);
    } else if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        updateNotificationButton();
    }
}

function enableNotifications() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                updateNotificationButton();
                showNotification('Notifications enabled!', 'success');
            }
            dismissNotificationRequest();
        });
    }
}

// Properly defined at top-level
function dismissNotificationRequest() {
    // Placeholder: Dismiss notification request UI
    const notificationRequest = document.getElementById('notification-request');
    if (notificationRequest) {
        notificationRequest.style.display = 'none';
    }
}

function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled;
    updateNotificationButton();
    
    if (notificationsEnabled) {
        showNotification('Notifications enabled', 'success');
    } else {
        showNotification('Notifications disabled', 'info');
    }
}

function updateNotificationButton() {
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
        const icon = notificationBtn.querySelector('i');
        if (icon) {
            icon.className = notificationsEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
        }
    }
}

function scheduleNotification(message) {
    // Simulate notification for other users
    if (Math.random() > 0.7) { // 30% chance to show notification
        setTimeout(() => {
            showBrowserNotification(`New message from ${message.author}`, message.content);
        }, 1000);
    }
}

function showBrowserNotification(title, body) {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body.substring(0, 100),
            icon: '/favicon.ico', // Add your icon path
            tag: 'chat-message'
        });
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification && notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification && notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) {
        return 'just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return time.toLocaleDateString();
    }
}

// Enhanced: User-friendly timestamp formatting
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        // Today: show only time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // Other days: show date and time
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's within the last week
    if ((now - date) < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${days[date.getDay()]} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Older messages
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ========================================
// STORAGE HELPER FUNCTIONS
// ========================================

function storeData(key, data) {
    try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
        return true;
    } catch (error) {
        console.error('Error storing data:', error);
        showNotification('Failed to save data', 'error');
        return false;
    }
}

function getStoredData(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Error retrieving data:', error);
        return null;
    }
}

function removeStoredData(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing data:', error);
        return false;
    }
}

// ========================================
// ENHANCED MOBILE MENU FUNCTIONALITY
// ========================================

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
        if (sidebar.classList.contains('mobile-open')) {
            if (overlay) overlay.style.display = 'block';
            sidebar.setAttribute('aria-modal', 'true');
            sidebar.focus();
        } else {
            if (overlay) overlay.style.display = 'none';
            sidebar.removeAttribute('aria-modal');
        }
    }
}

// Overlay click closes sidebar on mobile
const mobileOverlay = document.getElementById('mobile-overlay');
if (mobileOverlay) {
    mobileOverlay.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            toggleMobileMenu();
        }
    });
}

function createMobileOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.addEventListener('click', toggleMobileMenu);
    document.body.appendChild(overlay);
}

// ========================================
// ENHANCED MODAL MANAGEMENT
// ========================================

// Add keyboard support for modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Close emoji picker
        const emojiPicker = document.getElementById('emoji-picker');
        if (emojiPicker && emojiPicker.style.display !== 'none') {
            emojiPicker.style.display = 'none';
            return;
        }
        
        // Close create room modal
        const createRoomModal = document.getElementById('create-room-modal');
        if (createRoomModal && createRoomModal.style.display !== 'none') {
            hideCreateRoomModal();
            return;
        }
        
        // Close mobile menu
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            toggleMobileMenu();
            return;
        }
    }
});

// Enhanced create room modal with Enter key support
function enhanceCreateRoomModal() {
    const roomNameInput = document.getElementById('room-name');
    const roomDescInput = document.getElementById('room-description');
    
    if (roomNameInput) {
        roomNameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                createRoom();
            }
        });
    }
    
    if (roomDescInput) {
        roomDescInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                createRoom();
            }
        });
    }
}

// ========================================
// CONNECTION STATUS MANAGEMENT
// ========================================

function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusIndicator = document.querySelector('.user-status');
    
    if (statusIndicator) {
        statusIndicator.className = `user-status ${status}`;
        const statusText = statusIndicator.querySelector('span') || statusIndicator;
        const icon = statusIndicator.querySelector('i');
        
        switch (status) {
            case 'online':
                if (icon) icon.className = 'fas fa-circle';
                statusText.textContent = 'Online';
                break;
            case 'offline':
                if (icon) icon.className = 'fas fa-circle';
                statusText.textContent = 'Offline';
                break;
            case 'away':
                if (icon) icon.className = 'fas fa-clock';
                statusText.textContent = 'Away';
                break;
            case 'busy':
                if (icon) icon.className = 'fas fa-do-not-disturb';
                statusText.textContent = 'Busy';
                break;
        }
    }
}

function simulateConnectionStatus() {
    // Simulate occasional connection issues
    setInterval(() => {
        if (Math.random() < 0.05) { // 5% chance every interval
            updateConnectionStatus('offline');
            showNotification('Connection lost. Reconnecting...', 'warning');
            
            // Simulate reconnection after 2-5 seconds
            setTimeout(() => {
                updateConnectionStatus('online');
                showNotification('Connected!', 'success');
            }, Math.random() * 3000 + 2000);
        }
    }, 30000); // Check every 30 seconds
}

// ========================================
// ENHANCED ERROR HANDLING
// ========================================

function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let userMessage = 'An unexpected error occurred';
    
    if (error.name === 'QuotaExceededError') {
        userMessage = 'Storage quota exceeded. Please clear some data.';
    } else if (error.message.includes('localStorage')) {
        userMessage = 'Unable to save data. Please check your browser settings.';
    } else if (context.includes('network')) {
        userMessage = 'Network error. Please check your connection.';
    }
    
    showNotification(userMessage, 'error');
}

// Wrap critical functions with error handling
function safeExecute(fn, context = '') {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}

// ========================================
// MESSAGE ENHANCEMENTS
// ========================================

function deleteMessage(messageId) {
    if (!currentRoom || !messageId) return;
    
    if (confirm('Are you sure you want to delete this message?')) {
        const allMessages = getStoredData('chatMessages') || {};
        if (allMessages[currentRoom]) {
            allMessages[currentRoom] = allMessages[currentRoom].filter(msg => msg.id !== messageId);
            storeData('chatMessages', allMessages);
            displayMessages();
            showNotification('Message deleted', 'info');
        }
    }
}

function editMessage(messageId) {
    if (!currentRoom || !messageId) return;
    
    const allMessages = getStoredData('chatMessages') || {};
    const roomMessages = allMessages[currentRoom] || [];
    const message = roomMessages.find(msg => msg.id === messageId);
    
    if (!message || message.author !== currentUsername) {
        showNotification('You can only edit your own messages', 'warning');
        return;
    }
    
    const newContent = prompt('Edit your message:', message.content);
    if (newContent !== null && newContent.trim() !== '') {
        message.content = newContent.trim();
        message.edited = true;
        message.editedAt = new Date().toISOString();
        
        storeData('chatMessages', allMessages);
        displayMessages();
        showNotification('Message updated', 'success');
    }
}

// ========================================
// ROOM MANAGEMENT ENHANCEMENTS
// ========================================

let pendingDeleteRoomId = null;
function deleteRoom(roomId) {
    if (!roomId) return;
    const rooms = getStoredData('chatRooms') || [];
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.createdBy !== currentUsername) {
        showNotification('You can only delete rooms you created', 'warning');
        return;
    }
    // Show custom modal
    pendingDeleteRoomId = roomId;
    const modal = document.getElementById('delete-room-modal');
    const msg = document.getElementById('delete-room-message');
    if (modal && msg) {
        msg.textContent = `Are you sure you want to delete the room "${room.name}"? This action cannot be undone.`;
        modal.style.display = 'flex';
    }
}

// Modal event listeners
function setupDeleteRoomModalEvents() {
    const modal = document.getElementById('delete-room-modal');
    const closeBtn = document.getElementById('close-delete-room-modal');
    const cancelBtn = document.getElementById('cancel-delete-room');
    const confirmBtn = document.getElementById('confirm-delete-room');
    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) btn.onclick = () => { if (modal) modal.style.display = 'none'; pendingDeleteRoomId = null; };
    });
    if (confirmBtn) confirmBtn.onclick = () => {
        if (!pendingDeleteRoomId) return;
        const rooms = getStoredData('chatRooms') || [];
        const updatedRooms = rooms.filter(r => r.id !== pendingDeleteRoomId);
        storeData('chatRooms', updatedRooms);
        // Remove room messages
        const allMessages = getStoredData('chatMessages') || {};
        delete allMessages[pendingDeleteRoomId];
        storeData('chatMessages', allMessages);
        // If current room is deleted, clear selection
        if (currentRoom === pendingDeleteRoomId) {
            currentRoom = null;
            document.getElementById('current-room').textContent = 'Select a room to start chatting';
            document.getElementById('room-members').textContent = '0 members';
            document.getElementById('messages').innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to ChatApp!</h3>
                    <p>Select a room from the sidebar to start chatting with others.</p>
                </div>
            `;
        }
        if (modal) modal.style.display = 'none';
        loadRooms();
        showNotification('Room deleted successfully', 'success');
        pendingDeleteRoomId = null;
    };
}

// Call once on page load
setupDeleteRoomModalEvents();

// ========================================
// INITIALIZATION ENHANCEMENTS
// ========================================

// Add this to your initialization
function initializeEnhancements() {
    enhanceCreateRoomModal();
    simulateConnectionStatus();
    
    // Add double-click to edit messages
    document.addEventListener('dblclick', function(e) {
        const messageElement = e.target.closest('.message.own');
        if (messageElement) {
            const messageId = messageElement.getAttribute('data-message-id');
            if (messageId) {
                editMessage(messageId);
            }
        }
    });
    
    // Add right-click context menu for messages
    document.addEventListener('contextmenu', function(e) {
        const messageElement = e.target.closest('.message.own');
        if (messageElement) {
            e.preventDefault();
            const messageId = messageElement.getAttribute('data-message-id');
            showMessageContextMenu(e, messageId);
        }
    });
}

function showMessageContextMenu(event, messageId) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <button onclick="editMessage('${messageId}')">
            <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="deleteMessage('${messageId}')">
            <i class="fas fa-trash"></i> Delete
        </button>
    `;
    
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    contextMenu.style.zIndex = '1000';
    
    document.body.appendChild(contextMenu);
    
    // Remove context menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function removeContextMenu() {
            contextMenu.remove();
            document.removeEventListener('click', removeContextMenu);
        });
    }, 100);
}

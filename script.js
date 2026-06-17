// ============================================================
// ChatChime — Client Script  v2
// Stack  : plain JS + Socket.IO
// State  : server-driven; localStorage only for session + profile
// ============================================================

// ─── Global State ────────────────────────────────────────────
let socket           = null;
let currentUsername  = '';
let avatarColor      = '#b6f7c1';
let currentRoomId    = null;
let currentRoomName  = 'general';
let isTyping         = false;
let typingTimeout    = null;
let notificationsEnabled = false;

let cachedRooms     = [];
let cachedRoomUsers = [];
let typingUsers     = new Set();
let chatMessages    = [];

const AVATAR_COLORS = [
    '#b6f7c1','#7ec8e3','#f7b6d2','#f7deb6','#c4b6f7',
    '#f7f0b6','#b6d4f7','#f7c4b6','#b6f7ec','#deb6f7'
];

const emojiData = {
    'Smileys' : ['😀','😄','😆','😂','🙂','😉','😊','🥰','😍','🤩','😘','😎','🤓','😏','😒','🙄','😤','😠','😡','🥺'],
    'Gestures': ['👍','👎','👌','🤝','👏','🙏','✊','🤛','🤜','🤞','✌️','🤟','👈','👉','☝️','✋','🤚','🖐️','🖖','👋'],
    'Objects' : ['💻','📱','⌚','📷','💡','🔒','🔑','🎯','🚀','⭐','🔥','💎','🎉','🎊','🏆','🥇','🎮','🎵','📚','🛠️']
};

// ─── Entry Point ─────────────────────────────────────────────
window.onload = function () {
    try {
        const isChatPage = !!document.getElementById('messages');
        if (isChatPage) {
            initializeChatPage();
        } else {
            initializeLoginPage();
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllModals();
        });
    } catch (err) {
        showErrorBanner('JS Error: ' + err.message);
        console.error(err);
    }
};

function showErrorBanner(msg) {
    const d = document.createElement('div');
    d.style.cssText = 'background:#5c2828;color:#fecaca;padding:12px 16px;font-size:13px;position:fixed;top:0;left:0;right:0;z-index:99999;font-family:monospace;';
    d.textContent = msg;
    document.body.prepend(d);
}

// ─── LOGIN PAGE ───────────────────────────────────────────────
function initializeLoginPage() {
    if (document.getElementById('messages')) return; // safety

    const saved = localStorage.getItem('chatUsername');
    if (saved) { window.location.replace('chat.html'); return; }

    // Hide loading overlay immediately on login page
    const ov = document.getElementById('loading-overlay');
    if (ov) ov.style.display = 'none';

    const input  = document.getElementById('username');
    const btn    = document.getElementById('login-btn');
    if (input) {
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinChat(); });
        input.addEventListener('input',    (e) => validateUsername(e.target.value));
        setTimeout(() => input.focus(), 100);
    }
    if (btn) {
        btn.addEventListener('click', joinChat);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); joinChat(); });
    }

    setTimeout(() => {
        const card = document.querySelector('.login-card');
        if (card) card.classList.add('visible');
    }, 60);
}

function validateUsername(username) {
    const err = document.getElementById('error-message');
    if (!err) return true;
    err.textContent = '';
    if (!username) return true;
    if (username.length < 3)  { err.textContent = 'Minimum 3 characters'; return false; }
    if (username.length > 20) { err.textContent = 'Maximum 20 characters'; return false; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { err.textContent = 'Letters, numbers and _ only'; return false; }
    return true;
}

function joinChat() {
    const input   = document.getElementById('username');
    const overlay = document.getElementById('loading-overlay');
    if (!input) return;
    const username = input.value.trim();
    if (!validateUsername(username) || !username) {
        const err = document.getElementById('error-message');
        if (err) err.textContent = 'Please enter a valid username';
        return;
    }
    if (overlay) overlay.style.display = 'flex';
    setTimeout(() => {
        localStorage.setItem('chatUsername', username);
        window.location.href = 'chat.html';
    }, 500);
}

// ─── CHAT PAGE ────────────────────────────────────────────────
function initializeChatPage() {
    const username = localStorage.getItem('chatUsername');
    if (!username) { window.location.replace('index.html'); return; }

    currentUsername = username;
    avatarColor     = localStorage.getItem('avatarColor') || AVATAR_COLORS[0];

    updateProfileUI();
    setupChatListeners();
    populateEmojiGrid();
    connectSocket();

    setTimeout(() => {
        document.querySelector('.chat-layout')?.classList.add('loaded');
    }, 200);
}

function updateProfileUI() {
    const nameEls = document.querySelectorAll('#current-username');
    nameEls.forEach(el => el.textContent = currentUsername);

    // Update all avatars
    document.querySelectorAll('.avatar, #user-avatar-sidebar').forEach(av => {
        av.textContent    = currentUsername.charAt(0).toUpperCase();
        av.style.background = avatarColor;
        av.style.color      = isLightColor(avatarColor) ? '#1a1a1a' : '#fff';
    });

    // Update message avatars already rendered
    document.querySelectorAll('.msg-avatar').forEach(av => {
        if (av.dataset.author === currentUsername) {
            av.style.background = avatarColor;
            av.style.color = isLightColor(avatarColor) ? '#1a1a1a' : '#fff';
        }
    });
}

function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) > 155;
}

// ─── SOCKET ──────────────────────────────────────────────────
function connectSocket() {
    socket = io(window.BACKEND_URL || 'http://localhost:3001', {
        transports: ['websocket', 'polling']
    });

    socket.on('connect',       ()    => { setConnStatus('connected');    if (currentRoomId) rejoinRoom(); });
    socket.on('disconnect',    ()    => setConnStatus('disconnected'));
    socket.on('connect_error', ()    => setConnStatus('disconnected'));

    socket.on('room_list',      onRoomList);
    socket.on('join_confirmed', onJoinConfirmed);
    socket.on('message',        onMessage);
    socket.on('user_joined',    ({ username }) => sysMsg(`${username} joined`));
    socket.on('user_left',      ({ username }) => sysMsg(`${username} left`));
    socket.on('room_users',     ({ roomId, users }) => {
        if (roomId === currentRoomId) { cachedRoomUsers = users; renderOnlineUsers(); }
    });
    socket.on('typing_start',   ({ username }) => { typingUsers.add(username);    renderTypingBar(); });
    socket.on('typing_stop',    ({ username }) => { typingUsers.delete(username); renderTypingBar(); });
    socket.on('room_created',   ({ roomId })   => joinRoom(roomId));
    socket.on('room_deleted',   ({ roomId, redirectTo }) => {
        if (currentRoomId === roomId) {
            sysMsg('Room deleted — moving to General…');
            setTimeout(() => joinRoom(redirectTo || 'general'), 800);
        }
    });
    socket.on('error_msg', msg => toast(msg, 'error'));
}

function rejoinRoom() {
    socket.emit('join', { username: currentUsername, roomId: currentRoomId });
}

function setConnStatus(state) {
    const dot   = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    const sdot  = document.getElementById('sidebar-status-dot');
    const slbl  = document.getElementById('sidebar-status-label');

    if (dot)   dot.className   = `status-dot ${state}`;
    if (label) label.textContent = state === 'connected' ? 'Connected' : 'Disconnected';
    if (sdot)  sdot.className  = `status-dot ${state}`;
    if (slbl)  slbl.textContent = state === 'connected' ? 'Online' : 'Offline';
}

// ─── ROOMS ───────────────────────────────────────────────────
function onRoomList(rooms) {
    cachedRooms = rooms;
    renderRooms();
    if (!currentRoomId) joinRoom('general');
}

function onJoinConfirmed({ roomId, roomName }) {
    currentRoomId   = roomId;
    currentRoomName = roomName;
    chatMessages    = [];
    typingUsers.clear();

    const h = document.getElementById('current-room');
    if (h) h.textContent = roomName.toLowerCase();

    const mh = document.getElementById('mobile-room-title');
    if (mh) mh.textContent = roomName;

    const ph = document.getElementById('message-input');
    if (ph) ph.placeholder = `Message #${roomName.toLowerCase()}…`;

    renderRooms();
    renderTypingBar();
    renderMessages();
}

function joinRoom(roomId) {
    if (!socket?.connected) return;
    socket.emit('join', { username: currentUsername, roomId });
}

function renderRooms() {
    const list = document.getElementById('room-list');
    if (!list) return;
    list.innerHTML = '';
    cachedRooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'room-item' + (room.id === currentRoomId ? ' active' : '');
        const isOwner = room.createdBy === currentUsername && !room.isSystem;
        li.innerHTML = `
            <span class="room-hash">#</span>
            <div class="room-body">
                <span class="room-name">${escapeHtml(room.name)}</span>
                <span class="room-meta">${room.memberCount} online</span>
            </div>
            ${isOwner ? `<button class="icon-btn delete-btn" data-id="${room.id}" title="Delete room"><i class="fas fa-trash"></i></button>` : ''}
        `;
        li.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) return;
            joinRoom(room.id);
            closeSidebar();
        });
        const del = li.querySelector('.delete-btn');
        if (del) del.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteModal(room.id, room.name);
        });
        list.appendChild(li);
    });
}

// ─── MESSAGES ────────────────────────────────────────────────
function onMessage(msg) {
    chatMessages.push(msg);
    appendMessage(msg);

    if (notificationsEnabled && document.hidden) {
        new Notification(msg.author, { body: msg.content.slice(0, 100) });
    }
}

function renderMessages() {
    const c = document.getElementById('messages');
    if (!c) return;
    if (chatMessages.length === 0) {
        c.innerHTML = `<div class="empty-state"><i class="fas fa-hashtag"></i><p>No messages yet in <strong>#${escapeHtml(currentRoomName)}</strong></p></div>`;
        return;
    }
    c.innerHTML = '';
    chatMessages.forEach(msg => appendMessage(msg, false));
    scrollBottom();
}

function appendMessage(msg, scroll = true) {
    const c = document.getElementById('messages');
    if (!c) return;

    // Remove empty state if present
    const es = c.querySelector('.empty-state');
    if (es) es.remove();

    const isOwn = msg.author === currentUsername;
    const div   = document.createElement('div');
    div.className = `msg ${isOwn ? 'msg--own' : ''}`;

    const bgColor = isOwn ? avatarColor : stringToColor(msg.author);
    const fgColor = isLightColor(bgColor) ? '#1a1a1a' : '#fff';

    div.innerHTML = `
        <div class="msg-avatar" style="background:${bgColor};color:${fgColor}" data-author="${escapeHtml(msg.author)}">${msg.author.charAt(0).toUpperCase()}</div>
        <div class="msg-body">
            <div class="msg-meta">
                <span class="msg-author">${escapeHtml(msg.author)}</span>
                <span class="msg-time">${formatTime(new Date(msg.timestamp))}</span>
            </div>
            <div class="msg-text">${formatContent(msg.content)}</div>
        </div>
    `;
    c.appendChild(div);
    if (scroll) scrollBottom();
}

function sysMsg(text) {
    const c = document.getElementById('messages');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'msg-sys';
    d.innerHTML = `<i class="fas fa-circle-dot"></i> ${escapeHtml(text)}`;
    c.appendChild(d);
    scrollBottom();
}

function sendMessage() {
    const inp = document.getElementById('message-input');
    if (!inp || !currentRoomId || !socket) return;
    const content = inp.value.trim();
    if (!content) return;
    socket.emit('message', { content });
    inp.value = '';
    inp.style.height = 'auto';
    stopTyping();
    updateCharCount();
}

// ─── ONLINE USERS ─────────────────────────────────────────────
function renderOnlineUsers() {
    const list  = document.getElementById('online-users');
    const count = document.getElementById('user-count');
    const memEl = document.getElementById('room-members');
    if (!list) return;

    if (count) count.textContent = cachedRoomUsers.length;
    if (memEl) memEl.textContent = `${cachedRoomUsers.length} online`;

    list.innerHTML = '';
    cachedRoomUsers.forEach(uname => {
        const li = document.createElement('li');
        li.className = 'user-item';
        const bg  = uname === currentUsername ? avatarColor : stringToColor(uname);
        const fg  = isLightColor(bg) ? '#1a1a1a' : '#fff';
        li.innerHTML = `
            <div class="user-pip" style="background:${bg};color:${fg}">${uname.charAt(0).toUpperCase()}</div>
            <span>${escapeHtml(uname)}</span>
            ${uname === currentUsername ? '<span class="you-tag">you</span>' : ''}
        `;
        list.appendChild(li);
    });
}

// ─── TYPING ───────────────────────────────────────────────────
function handleTypingInput() {
    if (!isTyping) { isTyping = true; socket?.emit('typing_start'); }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 2000);
}

function stopTyping() {
    if (!isTyping) return;
    isTyping = false;
    socket?.emit('typing_stop');
}

function renderTypingBar() {
    const bar = document.getElementById('typing-indicator');
    if (!bar) return;
    const others = [...typingUsers].filter(u => u !== currentUsername);
    if (!others.length) { bar.style.display = 'none'; return; }
    const txt = others.length === 1 ? `${others[0]} is typing…`
              : others.length === 2 ? `${others[0]} and ${others[1]} are typing…`
              : `${others.length} people are typing…`;
    bar.querySelector('.typing-text').textContent = txt;
    bar.style.display = 'flex';
}

// ─── ROOM MODALS ─────────────────────────────────────────────
function createRoom() {
    const nameIn = document.getElementById('room-name-input');
    const descIn = document.getElementById('room-desc-input');
    const name   = nameIn?.value.trim();
    if (!name) { toast('Room name is required', 'error'); return; }
    socket.emit('create_room', { name, description: descIn?.value.trim() || '' });
    hideModal('create-room-modal');
    if (nameIn) nameIn.value = '';
    if (descIn) descIn.value = '';
}

let pendingDeleteId = null;

function showDeleteModal(roomId, roomName) {
    pendingDeleteId = roomId;
    const el = document.getElementById('delete-room-name');
    if (el) el.textContent = `#${roomName}`;
    showModal('delete-room-modal');
}

function confirmDelete() {
    if (!pendingDeleteId) return;
    socket.emit('delete_room', { roomId: pendingDeleteId });
    hideModal('delete-room-modal');
    pendingDeleteId = null;
}

// ─── PROFILE EDIT ─────────────────────────────────────────────
function showProfileModal() {
    const inp  = document.getElementById('profile-name-input');
    const grid = document.getElementById('avatar-colors');
    if (inp) inp.value = currentUsername;
    if (grid) {
        grid.innerHTML = '';
        AVATAR_COLORS.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'color-swatch' + (c === avatarColor ? ' selected' : '');
            btn.style.background = c;
            btn.title = c;
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                avatarColor = c;
            });
            grid.appendChild(btn);
        });
    }
    showModal('profile-modal');
}

function saveProfile() {
    const inp  = document.getElementById('profile-name-input');
    const name = inp?.value.trim();

    if (name && name !== currentUsername) {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
            toast('Invalid username format', 'error'); return;
        }
        // Disconnect old socket, update state, reconnect
        if (socket) socket.disconnect();
        localStorage.setItem('chatUsername', name);
        currentUsername = name;
    }
    localStorage.setItem('avatarColor', avatarColor);
    hideModal('profile-modal');
    updateProfileUI();
    renderOnlineUsers();
    renderMessages();
    if (socket && !socket.connected) connectSocket();
    else if (currentRoomId) rejoinRoom();
    toast('Profile updated', 'success');
}

// ─── EMOJI PICKER ─────────────────────────────────────────────
function populateEmojiGrid() {
    const grid = document.getElementById('emoji-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(emojiData).forEach(([cat, emojis]) => {
        const label = document.createElement('div');
        label.className = 'emoji-cat';
        label.textContent = cat;
        grid.appendChild(label);
        emojis.forEach(em => {
            const b = document.createElement('button');
            b.className = 'emoji-btn-item';
            b.textContent = em;
            b.addEventListener('click', () => insertEmoji(em));
            grid.appendChild(b);
        });
    });
}

function toggleEmojiPicker(anchorEl) {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    if (!picker.hidden) {
        picker.hidden = true;
        return;
    }
    // Position above the anchor or default bottom-right of input area
    if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        picker.style.left   = Math.min(rect.left, window.innerWidth - 300) + 'px';
        picker.style.right  = 'auto';
    } else {
        picker.style.bottom = '90px';
        picker.style.left   = '50%';
        picker.style.right  = 'auto';
        picker.style.transform = 'translateX(-50%)';
    }
    picker.hidden = false;
}

function hideEmojiPicker() {
    const p = document.getElementById('emoji-picker');
    if (p) p.hidden = true;
}

function insertEmoji(em) {
    const inp = document.getElementById('message-input');
    if (!inp) return;
    const s = inp.selectionStart, e = inp.selectionEnd;
    inp.value = inp.value.slice(0, s) + em + inp.value.slice(e);
    inp.selectionStart = inp.selectionEnd = s + em.length;
    inp.focus();
    hideEmojiPicker();
}

// ─── MOBILE SIDEBAR ───────────────────────────────────────────
function openSidebar() {
    const sb  = document.getElementById('sidebar');
    const ov  = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.add('open');
    if (ov) ov.classList.add('visible');
}

function closeSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('visible');
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb?.classList.contains('open')) closeSidebar();
    else openSidebar();
}

// ─── MODAL HELPERS ────────────────────────────────────────────
function showModal(id) {
    const m = document.getElementById(id);
    if (m) m.hidden = false;
}
function hideModal(id) {
    const m = document.getElementById(id);
    if (m) m.hidden = true;
}
function closeAllModals() {
    ['profile-modal','create-room-modal','delete-room-modal'].forEach(hideModal);
    hideEmojiPicker();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
function setupChatListeners() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', logout);

    // Send
    const sendBtn = document.getElementById('send-btn');
    sendBtn?.addEventListener('click', sendMessage);
    sendBtn?.addEventListener('touchstart', e => { e.preventDefault(); sendMessage(); });

    // Message input
    const inp = document.getElementById('message-input');
    if (inp) {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        inp.addEventListener('input',   () => { handleTypingInput(); updateCharCount(); autoResize(); });
    }

    // Mobile topbar
    document.getElementById('mobile-menu-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);

    // Mobile emoji btn (topbar)
    const mobileEmoji = document.getElementById('mobile-emoji-btn');
    mobileEmoji?.addEventListener('click', (e) => { e.stopPropagation(); toggleEmojiPicker(mobileEmoji); });

    // Emoji trigger in format bar (desktop)
    const emojiTrig = document.getElementById('emoji-trigger-btn');
    emojiTrig?.addEventListener('click', (e) => { e.stopPropagation(); toggleEmojiPicker(emojiTrig); });

    // Emoji close
    document.getElementById('emoji-close-btn')?.addEventListener('click', hideEmojiPicker);

    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('emoji-picker');
        if (!picker || picker.hidden) return;
        if (!picker.contains(e.target)
            && e.target.id !== 'emoji-trigger-btn'
            && !e.target.closest('#emoji-trigger-btn')
            && e.target.id !== 'mobile-emoji-btn'
            && !e.target.closest('#mobile-emoji-btn')) {
            picker.hidden = true;
        }
    });

    // Profile
    document.getElementById('edit-profile-btn')?.addEventListener('click', showProfileModal);
    document.getElementById('sidebar-profile')?.addEventListener('click', (e) => {
        if (!e.target.closest('.edit-profile-btn') && !e.target.closest('.sidebar-logout')) showProfileModal();
    });
    document.getElementById('close-profile-modal')?.addEventListener('click', () => hideModal('profile-modal'));
    document.getElementById('cancel-profile-modal')?.addEventListener('click', () => hideModal('profile-modal'));
    document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

    // Create room
    document.getElementById('create-room-btn')?.addEventListener('click', () => showModal('create-room-modal'));
    document.getElementById('close-create-room-modal')?.addEventListener('click', () => hideModal('create-room-modal'));
    document.getElementById('cancel-create-room-modal')?.addEventListener('click', () => hideModal('create-room-modal'));
    document.getElementById('create-room-confirm')?.addEventListener('click', createRoom);

    // Room name input → submit on Enter
    document.getElementById('room-name-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });

    // Delete room
    document.getElementById('close-delete-room-modal')?.addEventListener('click', () => hideModal('delete-room-modal'));
    document.getElementById('cancel-delete-room')?.addEventListener('click', () => hideModal('delete-room-modal'));
    document.getElementById('confirm-delete-room')?.addEventListener('click', confirmDelete);

    // Format buttons
    document.getElementById('bold-btn')?.addEventListener('click',   () => insertFormat('**','**'));
    document.getElementById('italic-btn')?.addEventListener('click', () => insertFormat('*','*'));
    document.getElementById('code-btn')?.addEventListener('click',   () => insertFormat('`','`'));

    // Clear chat
    document.getElementById('clear-chat-btn')?.addEventListener('click', clearChat);

    // Notification
    document.getElementById('notification-toggle-btn')?.addEventListener('click', toggleNotifications);

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
        bd.addEventListener('click', e => { if (e.target === bd) bd.hidden = true; });
    });
}

// ─── FORMAT / UTILS ──────────────────────────────────────────
function insertFormat(pre, suf) {
    const inp = document.getElementById('message-input');
    if (!inp) return;
    const s = inp.selectionStart, e = inp.selectionEnd;
    const sel = inp.value.slice(s, e);
    inp.value = inp.value.slice(0, s) + pre + sel + suf + inp.value.slice(e);
    inp.selectionStart = s + pre.length;
    inp.selectionEnd   = s + pre.length + sel.length;
    inp.focus();
}

function formatContent(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g,      '<em>$1</em>');
    out = out.replace(/`(.*?)`/g,        '<code>$1</code>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        (_, t, u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t)}</a>`);
    out = out.replace(/(https?:\/\/[^\s<]+)/g,
        u => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a>`);
    return out;
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
}

function formatTime(date) {
    const now  = new Date();
    const same = date.getFullYear() === now.getFullYear()
              && date.getMonth()    === now.getMonth()
              && date.getDate()     === now.getDate();
    return same
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
            + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stringToColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function updateCharCount() {
    const inp = document.getElementById('message-input');
    const cnt = document.getElementById('character-count');
    if (inp && cnt) cnt.textContent = `${inp.value.length} / 1000`;
}

function autoResize() {
    const inp = document.getElementById('message-input');
    if (!inp) return;
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
}

function scrollBottom() {
    const c = document.getElementById('messages');
    if (c) c.scrollTop = c.scrollHeight;
}

function logout() {
    socket?.disconnect();
    localStorage.removeItem('chatUsername');
    window.location.replace('index.html');
}

function clearChat() {
    if (!currentRoomId) return;
    if (confirm('Clear messages from your view?')) {
        chatMessages = [];
        renderMessages();
    }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        const b = document.getElementById('notification-request');
        if (b) b.hidden = false;
    }
}

function enableNotifications() {
    Notification.requestPermission().then(p => {
        notificationsEnabled = p === 'granted';
        closeNotification();
    });
}

function closeNotification() {
    const b = document.getElementById('notification-request');
    if (b) b.hidden = true;
}

function toggleNotifications() {
    if (!('Notification' in window)) { toast('Notifications not supported', 'error'); return; }
    if (notificationsEnabled) {
        notificationsEnabled = false;
        toast('Notifications off', 'info');
    } else {
        requestNotificationPermission();
    }
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = 'info') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--visible'));
    setTimeout(() => {
        t.classList.remove('toast--visible');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

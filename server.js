require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// ─── Environment & CORS Setup ─────────────────────────────────────────────────
let FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

if (!FRONTEND_ORIGIN) {
    if (isProduction) {
        console.error('FATAL ERROR: process.env.FRONTEND_ORIGIN is required in production. Please set it in your Render environment variables.');
        process.exit(1);
    } else {
        FRONTEND_ORIGIN = 'http://localhost:3000';
        console.warn(`[WARNING] FRONTEND_ORIGIN not set. Defaulting to ${FRONTEND_ORIGIN} for local development.`);
    }
}

// Enable CORS for Express HTTP endpoints
app.use(cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST']
}));

const io = new Server(httpServer, {
    cors: {
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

// ─── Server State ─────────────────────────────────────────────────────────────
// rooms: Map<roomId, { id, name, description, createdBy, isSystem }>
const rooms = new Map();

// socketMeta: Map<socketId, { username, roomId }>
const socketMeta = new Map();

// Default rooms (cannot be deleted)
const DEFAULT_ROOMS = [
    { id: 'general', name: 'General', description: 'General discussion for everyone', createdBy: 'System', isSystem: true },
    { id: 'tech-talk', name: 'Tech Talk', description: 'Discuss technology and programming', createdBy: 'System', isSystem: true },
    { id: 'random', name: 'Random', description: 'Random conversations and fun discussions', createdBy: 'System', isSystem: true }
];

DEFAULT_ROOMS.forEach(r => rooms.set(r.id, r));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRoomList() {
    return Array.from(rooms.values()).map(r => ({
        ...r,
        memberCount: getMemberCount(r.id)
    }));
}

function getMemberCount(roomId) {
    let count = 0;
    for (const meta of socketMeta.values()) {
        if (meta.roomId === roomId) count++;
    }
    return count;
}

function getRoomUsers(roomId) {
    const users = [];
    for (const [, meta] of socketMeta) {
        if (meta.roomId === roomId) users.push(meta.username);
    }
    return users;
}

function broadcastRoomList() {
    io.emit('room_list', getRoomList());
}

// ─── Health Endpoint ──────────────────────────────────────────────────────────
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connections: socketMeta.size,
        rooms: rooms.size
    });
});

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // Send full room list immediately on connect
    socket.emit('room_list', getRoomList());

    // ── Join / Switch Room ───────────────────────────────────────────────────
    socket.on('join', ({ username, roomId }) => {
        if (!username || !roomId) return;
        if (!rooms.has(roomId)) {
            socket.emit('error_msg', `Room "${roomId}" does not exist.`);
            return;
        }

        const prev = socketMeta.get(socket.id);

        const isNewOrDifferentName = !prev || prev.username.toLowerCase() !== username.toLowerCase();
        if (isNewOrDifferentName) {
            const isTaken = Array.from(socketMeta.values()).some(
                meta => meta.username.toLowerCase() === username.toLowerCase()
            );
            if (isTaken) {
                socket.emit('error_msg', 'Username is already taken. Please choose a different name.');
                return;
            }
        }

        // Leave previous room
        if (prev && prev.roomId) {
            socket.leave(prev.roomId);
            io.to(prev.roomId).emit('user_left', { username: prev.username, roomId: prev.roomId });
            io.to(prev.roomId).emit('room_users', { roomId: prev.roomId, users: getRoomUsers(prev.roomId) });
        }

        // Join new room
        socketMeta.set(socket.id, { username, roomId });
        socket.join(roomId);

        console.log(`[JOIN] ${username} → ${roomId}`);

        // Notify the room
        socket.to(roomId).emit('user_joined', { username, roomId });
        io.to(roomId).emit('room_users', { roomId, users: getRoomUsers(roomId) });

        // Confirm join to the caller
        socket.emit('join_confirmed', { roomId, roomName: rooms.get(roomId).name });

        // Push fresh room list (member counts changed)
        broadcastRoomList();
    });

    // ── Send Message ─────────────────────────────────────────────────────────
    socket.on('message', ({ content }) => {
        const meta = socketMeta.get(socket.id);
        if (!meta || !content || !content.trim()) return;

        const msg = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
            author: meta.username,
            content: content.trim().slice(0, 1000),
            roomId: meta.roomId,
            timestamp: new Date().toISOString()
        };

        console.log(`[MSG] ${meta.username} in ${meta.roomId}: ${msg.content.slice(0, 60)}`);
        io.to(meta.roomId).emit('message', msg);
    });

    // ── Typing ───────────────────────────────────────────────────────────────
    socket.on('typing_start', () => {
        const meta = socketMeta.get(socket.id);
        if (!meta) return;
        socket.to(meta.roomId).emit('typing_start', { username: meta.username });
    });

    socket.on('typing_stop', () => {
        const meta = socketMeta.get(socket.id);
        if (!meta) return;
        socket.to(meta.roomId).emit('typing_stop', { username: meta.username });
    });

    // ── Create Room ───────────────────────────────────────────────────────────
    socket.on('create_room', ({ name, description }) => {
        const meta = socketMeta.get(socket.id);
        if (!meta) return;
        if (!name || !name.trim()) {
            socket.emit('error_msg', 'Room name is required.');
            return;
        }

        const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        if (rooms.has(id)) {
            socket.emit('error_msg', 'A room with that name already exists.');
            return;
        }

        const newRoom = {
            id,
            name: name.trim().slice(0, 50),
            description: (description || '').trim().slice(0, 200) || 'No description',
            createdBy: meta.username,
            isSystem: false
        };

        rooms.set(id, newRoom);
        console.log(`[ROOM CREATED] ${id} by ${meta.username}`);

        broadcastRoomList();
        socket.emit('room_created', { roomId: id });
    });

    // ── Delete Room ───────────────────────────────────────────────────────────
    socket.on('delete_room', ({ roomId }) => {
        const meta = socketMeta.get(socket.id);
        if (!meta) return;

        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error_msg', 'Room not found.');
            return;
        }
        if (room.isSystem) {
            socket.emit('error_msg', 'System rooms cannot be deleted.');
            return;
        }
        if (room.createdBy !== meta.username) {
            socket.emit('error_msg', 'Only the room creator can delete it.');
            return;
        }

        rooms.delete(roomId);
        console.log(`[ROOM DELETED] ${roomId} by ${meta.username}`);

        // Move everyone in the deleted room to General
        io.to(roomId).emit('room_deleted', { roomId, redirectTo: 'general' });

        broadcastRoomList();
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const meta = socketMeta.get(socket.id);
        if (meta) {
            console.log(`[DISCONNECT] ${meta.username}`);
            if (meta.roomId) {
                io.to(meta.roomId).emit('user_left', { username: meta.username, roomId: meta.roomId });
                io.to(meta.roomId).emit('room_users', { roomId: meta.roomId, users: getRoomUsers(meta.roomId) });
            }
            socketMeta.delete(socket.id);
            broadcastRoomList();
        } else {
            console.log(`[DISCONNECT] ${socket.id} (no meta)`);
        }
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running on port ${PORT}`);
    console.log(`[SERVER] Health: http://localhost:${PORT}/health`);
    console.log(`[SERVER] CORS allowed origin: ${FRONTEND_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] Shutting down...');
    httpServer.close(() => process.exit(0));
});

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let rooms = {}; // { roomId: [ws, ...] }
let users = {}; // { ws: { username, room } }

wss.on('connection', function connection(ws) {
    console.log('[SERVER] New client connected');
    
    ws.on('message', function incoming(data) {
        try {
            const msg = JSON.parse(data.toString());
            
            switch (msg.type) {
                case 'join':
                    handleJoin(ws, msg);
                    break;
                case 'message':
                    handleMessage(ws, msg);
                    break;
                case 'typing_start':
                    handleTypingStart(ws, msg);
                    break;
                case 'typing_stop':
                    handleTypingStop(ws, msg);
                    break;
                default:
                    console.log('[SERVER] Unknown message type:', msg.type);
            }
        } catch (e) {
            console.error('[SERVER] Error parsing message:', e);
        }
    });

    ws.on('close', function() {
        handleDisconnect(ws);
    });

    ws.on('error', function(error) {
        console.error('[SERVER] WebSocket error:', error);
    });
});

function handleJoin(ws, msg) {
    const { room, username } = msg;
    
    // Remove from previous room
    if (users[ws] && users[ws].room) {
        leaveRoom(ws, users[ws].room);
    }
    
    // Join new room
    ws.room = room;
    users[ws] = { username: username || 'Anonymous', room: room };
    
    if (!rooms[room]) {
        rooms[room] = [];
    }
    
    rooms[room].push(ws);
    
    console.log(`[SERVER] ${users[ws].username} joined room: ${room}. Total: ${rooms[room].length}`);
    
    // Broadcast user joined message
    broadcastToRoom(room, {
        type: 'user_joined',
        username: users[ws].username,
        room: room,
        timestamp: new Date().toISOString()
    }, ws);
    
    // Send room info to user
    ws.send(JSON.stringify({
        type: 'room_joined',
        room: room,
        members: rooms[room].length
    }));
}

function handleMessage(ws, msg) {
    const user = users[ws];
    if (!user || !user.room) {
        console.log('[SERVER] Message from user not in room');
        return;
    }
    
    console.log(`[SERVER] Message in room ${user.room} from ${user.username}:`, msg.content);
    
    // Add server timestamp and user info
    const serverMsg = {
        ...msg,
        author: user.username,
        timestamp: new Date().toISOString(),
        id: generateMessageId()
    };
    
    // Broadcast to all in the room
    broadcastToRoom(user.room, serverMsg);
}

function handleTypingStart(ws, msg) {
    const user = users[ws];
    if (!user || !user.room) return;
    
    broadcastToRoom(user.room, {
        type: 'typing_start',
        username: user.username,
        room: user.room
    }, ws);
}

function handleTypingStop(ws, msg) {
    const user = users[ws];
    if (!user || !user.room) return;
    
    broadcastToRoom(user.room, {
        type: 'typing_stop',
        username: user.username,
        room: user.room
    }, ws);
}

function handleDisconnect(ws) {
    const user = users[ws];
    if (user) {
        console.log(`[SERVER] ${user.username} disconnected from room: ${user.room}`);
        
        leaveRoom(ws, user.room);
        
        // Broadcast user left message
        if (user.room && rooms[user.room]) {
            broadcastToRoom(user.room, {
                type: 'user_left',
                username: user.username,
                room: user.room,
                timestamp: new Date().toISOString()
            });
        }
        
        delete users[ws];
    }
}

function leaveRoom(ws, room) {
    if (rooms[room]) {
        rooms[room] = rooms[room].filter(client => client !== ws);
        
        if (rooms[room].length === 0) {
            delete rooms[room];
        }
    }
}

function broadcastToRoom(room, message, excludeWs = null) {
    if (rooms[room]) {
        rooms[room].forEach(client => {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(message));
                } catch (error) {
                    console.error('[SERVER] Error broadcasting message:', error);
                }
            }
        });
    }
}

function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Static file server and health check endpoint
server.on('request', (req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            connections: Object.keys(users).length,
            rooms: Object.keys(rooms).length 
        }));
        return;
    }
    
    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    const fullPath = path.join(__dirname, filePath);
    
    // Security check - prevent directory traversal
    if (!fullPath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        
        // Set content type based on file extension
        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.ico': 'image/x-icon',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif'
        };
        
        const contentType = contentTypes[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const PORT = process.env.PORT || 3002;
// Replace this line in your server.js:
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] WebSocket server running on port ${PORT}`);
    console.log(`[SERVER] Access from mobile: ws://[YOUR-IP]:${PORT}`);
    console.log(`[SERVER] Health check: http://[YOUR-IP]:${PORT}/health`);
});


// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] Shutting down gracefully...');
    server.close(() => {
        console.log('[SERVER] Server closed');
        process.exit(0);
    });
});

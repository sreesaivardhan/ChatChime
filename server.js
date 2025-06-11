const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

let rooms = {}; // { roomId: [ws, ...] }

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'join') {
        ws.room = msg.room;
        rooms[ws.room] = rooms[ws.room] || [];
        rooms[ws.room].push(ws);
      } else if (msg.type === 'message') {
        // Broadcast to all in the room
        if (rooms[ws.room]) {
          rooms[ws.room].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(msg));
            }
          });
        }
      }
    } catch (e) { }
  });

  ws.on('close', function() {
    // Remove from room
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room] = rooms[ws.room].filter(client => client !== ws);
    }
  });
});

console.log('WebSocket server running on ws://localhost:3001');

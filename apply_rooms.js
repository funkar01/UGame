const fs = require('fs');

try {
  let html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('id=\"room-id\"')) {
    html = html.replace('<div id=\"pc-instructions\"', '<div style=\"margin-bottom: 1.5rem; text-align: center;\">\\n            <label for=\"room-id\" style=\"color: white; font-weight: bold; display: block; margin-bottom: 0.5rem;\">Room ID (Optional)</label>\\n            <input type=\"text\" id=\"room-id\" placeholder=\"Enter Room ID to join...\" style=\"width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: rgba(0,0,0,0.5); color: white; font-size: 1rem; text-align: center; box-sizing: border-box;\">\\n          </div>\\n\\n          <div id=\"pc-instructions\"');
    fs.writeFileSync('index.html', html);
  }

  let main = fs.readFileSync('src/main.js', 'utf8');
  if (!main.includes('inputRoomId')) {
    main = main.replace('let selectedTeam = null;', 'let selectedTeam = null;\\n  const inputRoomId = document.getElementById(\\'room-id\\');');
    main = main.replace('gameInstance = new Game(gameCanvas, avatarDataUrl, selectedTeam, customAudioUrl);', 'gameInstance = new Game(gameCanvas, avatarDataUrl, selectedTeam, customAudioUrl, inputRoomId ? inputRoomId.value.trim() : \\'\\');');
    fs.writeFileSync('src/main.js', main);
  }

  let game = fs.readFileSync('src/game.js', 'utf8');
  if (!game.includes('this.roomId = roomId;')) {
    game = game.replace('constructor(canvas, playerFaceDataUrl, playerTeam, customAudioUrl) {', 'constructor(canvas, playerFaceDataUrl, playerTeam, customAudioUrl, roomId = \\'\\') {\\n    this.roomId = roomId;');
    game = game.replace('team: this.player.team', 'team: this.player.team,\\n        roomId: this.roomId');
    // Update live server URL to localhost for room support
    game = game.replace(/io\\('https:\\/\\/ugame-2er9\\.onrender\\.com'\\)/g, 'io(\\'http://localhost:3000\\')');
    
    // Hack to ensure the client filters players from other rooms!
    game = game.replace(/this\\.remotePlayers\\[id\\] = new RemotePlayer\\(p\\.x, p\\.y, p\\.faceDataUrl, p\\.team, p\\.health, p\\.isAlive\\);/g, 'if (!this.roomId || p.roomId === this.roomId) this.remotePlayers[id] = new RemotePlayer(p.x, p.y, p.faceDataUrl, p.team, p.health, p.isAlive);');
    game = game.replace(/this\\.remotePlayers\\[info\\.id\\] = new RemotePlayer\\(p\\.x, p\\.y, p\\.faceDataUrl, p\\.team, p\\.health, p\\.isAlive\\);/g, 'if (!this.roomId || p.roomId === this.roomId) this.remotePlayers[info.id] = new RemotePlayer(p.x, p.y, p.faceDataUrl, p.team, p.health, p.isAlive);');
    
    fs.writeFileSync('src/game.js', game);
  }

  const serverCode = \`const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const players = {};

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if (!data || !data.x || !data.y || !data.team) return;
    
    players[socket.id] = {
      x: data.x,
      y: data.y,
      faceDataUrl: data.faceDataUrl,
      team: data.team,
      roomId: data.roomId || 'global',
      health: 100,
      isAlive: true
    };
    
    const room = data.roomId || 'global';
    socket.join(room);
    
    const roomPlayers = {};
    for (const id in players) {
      if (players[id].roomId === room) {
        roomPlayers[id] = players[id];
      }
    }
    socket.emit('currentPlayers', roomPlayers);
    socket.to(room).emit('newPlayer', { id: socket.id, playerData: players[socket.id] });
  });

  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      
      const room = players[socket.id].roomId;
      socket.to(room).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('shoot', (data) => {
    if (players[socket.id]) {
      const room = players[socket.id].roomId;
      socket.to(room).emit('playerShot', {
        id: socket.id,
        x: data.x,
        y: data.y,
        dirX: data.dirX
      });
    }
  });

  socket.on('hitPlayer', (targetId) => {
    if (players[targetId] && players[targetId].isAlive) {
      players[targetId].health -= 10;
      const room = players[targetId].roomId;
      
      if (players[targetId].health <= 0) {
        players[targetId].health = 0;
        players[targetId].isAlive = false;
        
        io.to(room).emit('playerDied', targetId);
      } else {
        io.to(room).emit('playerHealthUpdate', { id: targetId, health: players[targetId].health });
      }
    }
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const room = players[socket.id].roomId;
      delete players[socket.id];
      socket.to(room).emit('playerDisconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(\\\`Local Server running with Room support on port \\\${PORT}\\\`);
});\`;

  fs.writeFileSync('server.js', serverCode);
  console.log('Successfully updated code and created server.js');
} catch (e) {
  console.error('Error applying fix:', e);
}

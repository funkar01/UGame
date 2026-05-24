import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

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
  socket.on('join', async (data) => {
    if (!data || data.x === undefined || data.y === undefined || !data.team) return;
    
    players[socket.id] = {
      x: data.x,
      y: data.y,
      faceDataUrl: data.faceDataUrl,
      team: data.team,
      roomId: data.roomId || 'global',
      health: 100,
      isAlive: true,
      customAudio: data.customAudio
    };
    
    const room = data.roomId || 'global';
    await socket.join(room);
    
    const roomPlayers = {};
    for (const id in players) {
      if (players[id].roomId === room) {
        roomPlayers[id] = players[id];
      }
    }
    socket.emit('currentPlayers', roomPlayers);
    socket.to(room).emit('newPlayer', { id: socket.id, playerData: players[socket.id] });
  });

  socket.on('move', (data) => {
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

  socket.on('suicide', () => {
    if (players[socket.id] && players[socket.id].isAlive) {
      players[socket.id].health = 0;
      players[socket.id].isAlive = false;
      const room = players[socket.id].roomId;
      io.to(room).emit('playerDied', socket.id);
    }
  });

  socket.on('expressEmotion', (data) => {
    console.log(`[Emote Server] Received expressEmotion from socket ${socket.id}: ${data ? data.emoji : 'undefined'}`);
    if (players[socket.id]) {
      const room = players[socket.id].roomId;
      console.log(`[Emote Server] Broadcasting playerExpressedEmotion to room: ${room}`);
      socket.to(room).emit('playerExpressedEmotion', {
        id: socket.id,
        emoji: data.emoji
      });
    } else {
      console.log(`[Emote Server] Warning: socket ${socket.id} not found in players registry!`);
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
  console.log(`Local Server running with Room support on port ${PORT}`);
});

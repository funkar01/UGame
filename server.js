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

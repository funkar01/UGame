import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const players = {};

function checkWinCondition() {
  const teams = { red: 0, blue: 0 };
  let totalPlayers = 0;
  
  for (let id in players) {
    totalPlayers++;
    if (players[id].isAlive) {
      teams[players[id].team]++;
    }
  }

  if (totalPlayers > 1) {
    if (teams.red === 0 && teams.blue > 0) {
      io.emit('gameOver', 'Blue Team Wins!');
    } else if (teams.blue === 0 && teams.red > 0) {
      io.emit('gameOver', 'Red Team Wins!');
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join', (data) => {
    players[socket.id] = {
      x: data.x,
      y: data.y,
      faceDataUrl: data.faceDataUrl,
      team: data.team,
      health: 100,
      isAlive: true
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', {
      id: socket.id,
      playerData: players[socket.id]
    });
  });

  socket.on('move', (data) => {
    if (players[socket.id] && players[socket.id].isAlive) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('shoot', (data) => {
    socket.broadcast.emit('playerShot', {
      id: socket.id,
      x: data.x,
      y: data.y,
      dirX: data.dirX
    });
  });

  socket.on('hitPlayer', (targetId) => {
    if (players[targetId] && players[targetId].isAlive) {
      players[targetId].health -= 10;
      if (players[targetId].health <= 0) {
        players[targetId].health = 0;
        players[targetId].isAlive = false;
        
        io.emit('playerDied', targetId);
        checkWinCondition();
      } else {
        io.emit('playerHealthUpdate', { id: targetId, health: players[targetId].health });
      }
    }
  });

  socket.on('suicide', () => {
    if (players[socket.id] && players[socket.id].isAlive) {
      players[socket.id].health = 0;
      players[socket.id].isAlive = false;
      io.emit('playerDied', socket.id);
      checkWinCondition();
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    checkWinCondition();
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Multiplayer server running on port ${PORT}`);
});

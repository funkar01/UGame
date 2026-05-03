import { Input } from './input.js';
import { Player } from './player.js';
import { GameMap } from './gameMap.js';
import { RemotePlayer } from './remotePlayer.js';
import { Bullet } from './bullet.js';
import { audio } from './audio.js';
import { io } from 'socket.io-client';

export class Game {
  constructor(canvas, avatarDataUrl, team) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.map = new GameMap();

    const spawnX = 80 + Math.floor(Math.random() * 60);
    this.player = new Player(spawnX, 100, avatarDataUrl, team);
    this.avatarDataUrl = avatarDataUrl;

    this.lastTime = 0;
    this.isRunning = false;

    // Networking
    this.socket = io('https://ugame-2er9.onrender.com');
    this.remotePlayers = {};
    this.lastSyncX = -1;
    this.lastSyncY = -1;

    // Combat
    this.bullets = [];
    this.fireRate = 0.25; // seconds between shots
    this.fireTimer = 0;
    this.isGameOver = false;
  }

  start() {
    this.isRunning = true;
    this.initNetwork();
    requestAnimationFrame((t) => this.loop(t));
  }

  initNetwork() {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      this.socket.emit('join', {
        x: this.player.x,
        y: this.player.y,
        faceDataUrl: this.avatarDataUrl,
        team: this.player.team
      });
    });

    this.socket.on('currentPlayers', (players) => {
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) {
          const p = players[id];
          this.remotePlayers[id] = new RemotePlayer(p.x, p.y, p.faceDataUrl, p.team, p.health, p.isAlive);
        }
      });
    });

    this.socket.on('newPlayer', (info) => {
      if (info.id !== this.socket.id) {
        const p = info.playerData;
        this.remotePlayers[info.id] = new RemotePlayer(p.x, p.y, p.faceDataUrl, p.team, p.health, p.isAlive);
      }
    });

    this.socket.on('playerMoved', (data) => {
      if (this.remotePlayers[data.id]) {
        this.remotePlayers[data.id].updateData(data);
      }
    });

    this.socket.on('playerShot', (data) => {
      this.bullets.push(new Bullet(data.x, data.y, data.dirX, data.id));
      audio.playShoot();
    });

    this.socket.on('playerHealthUpdate', (data) => {
      audio.playHit();
      if (data.id === this.socket.id) {
        this.player.health = data.health;
      } else if (this.remotePlayers[data.id]) {
        this.remotePlayers[data.id].health = data.health;
      }
    });

    this.socket.on('playerDied', (id) => {
      audio.playHit();
      if (id === this.socket.id) {
        this.player.isAlive = false;
      } else if (this.remotePlayers[id]) {
        this.remotePlayers[id].isAlive = false;
      }
    });

    this.socket.on('playerDisconnected', (id) => {
      if (this.remotePlayers[id]) {
        delete this.remotePlayers[id];
      }
    });

    this.socket.on('gameOver', (message) => {
      this.isGameOver = true;
      this.gameOverMessage = message;
      if (message.toLowerCase().includes(this.player.team)) {
        audio.playWin();
      } else {
        audio.playLose();
      }
    });
  }

  loop(timestamp) {
    if (!this.isRunning) return;
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.input.update(); // Update input state

    if (!this.isGameOver) {
      // Prevent massive delta times (e.g. from tab switching)
      if (dt > 0.1) dt = 0.1;

      // Fixed time step loop to prevent tunneling through the floor
      let timeAccumulated = dt;
      while (timeAccumulated > 0) {
        const step = Math.min(timeAccumulated, 0.016);
        this.update(step);
        timeAccumulated -= step;
      }
    }

    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.player.update(dt, this.input, this.map);

    if (this.player.isAlive && this.player.y > 600) {
      this.player.health = 0;
      this.player.isAlive = false;
      if (this.socket) this.socket.emit('suicide');
    }

    if (this.player.isAlive) {
      // Shooting logic
      if (this.fireTimer > 0) this.fireTimer -= dt;
      if (this.input.justPressed.shoot && this.fireTimer <= 0) {
        const dirX = this.player.facingRight ? 1 : -1;
        const bX = this.player.facingRight ? this.player.x + this.player.width : this.player.x - 12;
        const bY = this.player.y + this.player.headSize + 6;

        this.bullets.push(new Bullet(bX, bY, dirX, this.socket.id));
        this.socket.emit('shoot', { x: bX, y: bY, dirX: dirX });
        this.fireTimer = this.fireRate;
        this.input.justPressed.shoot = false; // Consume input
        audio.playShoot();
      }

      // Sync position
      if (this.socket && this.socket.connected) {
        const dx = Math.abs(this.player.x - this.lastSyncX);
        const dy = Math.abs(this.player.y - this.lastSyncY);
        if (dx > 1 || dy > 1) {
          this.socket.emit('move', { x: this.player.x, y: this.player.y });
          this.lastSyncX = this.player.x;
          this.lastSyncY = this.player.y;
        }
      }
    }

    // Update remote players
    Object.values(this.remotePlayers).forEach(rp => rp.update(dt));

    // Update bullets and check collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this.map);

      // Client-side hit detection (only check collisions for bullets WE fired)
      if (b.active && b.ownerId === this.socket.id) {
        for (let id in this.remotePlayers) {
          const rp = this.remotePlayers[id];
          if (rp.isAlive) {
            // Simple AABB collision
            if (b.x < rp.x + rp.width &&
              b.x + b.width > rp.x &&
              b.y < rp.y + rp.height &&
              b.y + b.height > rp.y) {

              b.active = false; // Destroy bullet on hit
              if (rp.team !== this.player.team) {
                this.socket.emit('hitPlayer', id); // Only damage enemies
              }
              break;
            }
          }
        }
      }

      if (!b.active) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.map.draw(this.ctx);

    Object.values(this.remotePlayers).forEach(rp => rp.draw(this.ctx));
    this.bullets.forEach(b => b.draw(this.ctx));

    this.player.draw(this.ctx);

    if (!this.player.isAlive && !this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = 'white';
      this.ctx.font = '48px Outfit, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("YOU DIED", this.canvas.width / 2, this.canvas.height / 2);
    }

    if (this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = this.gameOverMessage.includes('Red') ? '#ef4444' : '#3b82f6';
      this.ctx.font = '64px Outfit, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.gameOverMessage, this.canvas.width / 2, this.canvas.height / 2);
    }
  }
}

import { Input } from './input.js';
import { Player } from './player.js';
import { GameMap } from './gameMap.js';
import { RemotePlayer } from './remotePlayer.js';
import { Bullet } from './bullet.js';
import { audio } from './audio.js';

// socket.io-client is loaded globally from the CDN in index.html
const io = window.io;

export class Game {
  constructor(canvas, playerFaceDataUrl, playerTeam, customAudioUrl, roomId = '') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.map = new GameMap();
    this.roomId = roomId;

    const spawnX = 80 + Math.floor(Math.random() * 60);
    this.player = new Player(spawnX, 100, playerFaceDataUrl, playerTeam);
    this.avatarDataUrl = playerFaceDataUrl;

    this.lastTime = 0;
    this.isRunning = false;

    // Networking
    this.socket = null;
    this.remotePlayers = {};
    this.lastSyncX = -1;
    this.lastSyncY = -1;

    // Combat
    this.bullets = [];
    this.fireRate = 0.25; // seconds between shots
    this.fireTimer = 0;
    this.isGameOver = false;

    // New additions
    this.scoreRed = 0;
    this.scoreBlue = 0;
    this.particles = [];
    this.screenShake = 0;
    this.celebrationTimer = 0;
    this.winningTeam = null;

    this.customAudio = customAudioUrl;
    this.customAudioBuffer = null;
    if (this.customAudio) {
      audio.decodeAudio(this.customAudio).then(buf => {
        this.customAudioBuffer = buf;
      }).catch(err => {
        console.error("Error decoding local custom audio:", err);
      });
    }
  }

  emitJoin() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', {
        x: this.player.x,
        y: this.player.y,
        faceDataUrl: this.avatarDataUrl + '__' + (this.roomId || 'global'),
        team: this.player.team,
        roomId: this.roomId || 'global',
        customAudio: this.customAudio
      });
    }
  }

  start() {
    this.isRunning = true;
    this.initNetwork();
    requestAnimationFrame((t) => this.loop(t));
  }

  initNetwork() {
    let serverUrl = 'http://localhost:3000';
    if (window.location.hostname) {
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.hostname.endsWith('.local') || 
                      !window.location.hostname.includes('.') || 
                      /^(192\.168|10|172\.(1[6-9]|2[0-9]|3[0-1])|169\.254)\./.test(window.location.hostname);
      
      if (isLocal) {
        serverUrl = `http://${window.location.hostname}:3000`;
      } else {
        serverUrl = 'https://ugame-2er9.onrender.com';
      }
    }
    this.socket = io(serverUrl, {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      this.emitJoin();
    });

    this.socket.on('currentPlayers', (players) => {
      console.log('Socket: currentPlayers received:', players);
      Object.keys(players).forEach(id => {
        if (id !== this.socket.id) {
          const p = players[id];
          const faceParts = p.faceDataUrl.split('__');
          const cleanFaceUrl = faceParts[0];
          const pRoomId = faceParts[1] || p.roomId || 'global';
          const myRoomId = this.roomId || 'global';
          if (pRoomId === myRoomId) {
            const rp = new RemotePlayer(p.x, p.y, cleanFaceUrl, p.team, p.health, p.isAlive);
            this.remotePlayers[id] = rp;
            rp.customAudio = p.customAudio;
            rp.customAudioBuffer = null;
            if (p.customAudio) {
              audio.decodeAudio(p.customAudio).then(buf => {
                rp.customAudioBuffer = buf;
              }).catch(err => {
                console.error(`Error decoding remote player ${id} audio:`, err);
              });
            }
            console.log(`Socket: Added remote player ${id} in room ${pRoomId}`);
          } else {
            console.log(`Socket: Ignored player ${id} from different room: ${pRoomId}`);
          }
        }
      });
    });

    this.socket.on('newPlayer', (info) => {
      console.log('Socket: newPlayer received:', info);
      if (info.id !== this.socket.id) {
        const p = info.playerData;
        const faceParts = p.faceDataUrl.split('__');
        const cleanFaceUrl = faceParts[0];
        const pRoomId = faceParts[1] || p.roomId || 'global';
        const myRoomId = this.roomId || 'global';
        if (pRoomId === myRoomId) {
          const rp = new RemotePlayer(p.x, p.y, cleanFaceUrl, p.team, p.health, p.isAlive);
          this.remotePlayers[info.id] = rp;
          rp.customAudio = p.customAudio;
          rp.customAudioBuffer = null;
          if (p.customAudio) {
            audio.decodeAudio(p.customAudio).then(buf => {
              rp.customAudioBuffer = buf;
            }).catch(err => {
              console.error(`Error decoding remote player ${info.id} audio:`, err);
            });
          }
          console.log(`Socket: Added new remote player ${info.id} in room ${pRoomId}`);
        } else {
          console.log(`Socket: Ignored new player ${info.id} from different room: ${pRoomId}`);
        }
      }
    });

    this.socket.on('playerMoved', (data) => {
      if (this.remotePlayers[data.id]) {
        this.remotePlayers[data.id].updateData(data);
      }
    });

    this.socket.on('playerShot', (data) => {
      if (data.id === this.socket.id || this.remotePlayers[data.id]) {
        console.log('Socket: playerShot received:', data);
        this.bullets.push(new Bullet(data.x, data.y, data.dirX, data.id));
        audio.playShoot();
      }
    });

    this.socket.on('playerHealthUpdate', (data) => {
      if (data.id === this.socket.id) {
        if (this.customAudioBuffer) {
          audio.playAudioBuffer(this.customAudioBuffer);
        } else {
          audio.playCustomHitUrl(this.customAudio);
        }
        this.player.health = data.health;
        this.screenShake = 10;
        this.spawnParticles(this.player.x + 16, this.player.y + 24, '#ef4444');
      } else if (this.remotePlayers[data.id]) {
        const rp = this.remotePlayers[data.id];
        if (rp.customAudioBuffer) {
          audio.playAudioBuffer(rp.customAudioBuffer);
        } else {
          audio.playCustomHitUrl(rp.customAudio);
        }
        rp.health = data.health;
        this.spawnParticles(rp.x + 16, rp.y + 24, '#ef4444');
      }
    });

    this.socket.on('playerDied', (id) => {
      let diedTeam = null;
      if (id === this.socket.id) {
        if (this.customAudioBuffer) {
          audio.playAudioBuffer(this.customAudioBuffer);
        } else {
          audio.playCustomHitUrl(this.customAudio);
        }
        this.player.isAlive = false;
        diedTeam = this.player.team;
        this.screenShake = 20;
        this.spawnParticles(this.player.x + 16, this.player.y + 24, '#ef4444', 20);
      } else if (this.remotePlayers[id]) {
        const rp = this.remotePlayers[id];
        if (rp.customAudioBuffer) {
          audio.playAudioBuffer(rp.customAudioBuffer);
        } else {
          audio.playCustomHitUrl(rp.customAudio);
        }
        rp.isAlive = false;
        diedTeam = rp.team;
        this.spawnParticles(rp.x + 16, rp.y + 24, '#ef4444', 20);
      }

      if (diedTeam === 'red') this.scoreBlue++;
      else if (diedTeam === 'blue') this.scoreRed++;

      let redAlive = (this.player.team === 'red' && this.player.isAlive) ? 1 : 0;
      let blueAlive = (this.player.team === 'blue' && this.player.isAlive) ? 1 : 0;
      
      Object.values(this.remotePlayers).forEach(rp => {
        if (rp.isAlive) {
          if (rp.team === 'red') redAlive++;
          if (rp.team === 'blue') blueAlive++;
        }
      });

      if (redAlive === 0 && blueAlive > 0) {
        console.log('TRIGGERING GAME OVER - Blue Wins');
        try { this.triggerGameOver('Blue'); } catch(e) { console.error('GAME OVER ERROR:', e); }
      } else if (blueAlive === 0 && redAlive > 0) {
        console.log('TRIGGERING GAME OVER - Red Wins');
        try { this.triggerGameOver('Red'); } catch(e) { console.error('GAME OVER ERROR:', e); }
      }
    });

    this.socket.on('playerDisconnected', (id) => {
      if (this.remotePlayers[id]) {
        delete this.remotePlayers[id];
      }
    });

    this.socket.on('gameOver', (message) => {
      // Handled locally now via triggerGameOver
    });
  }

  triggerGameOver(winner) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    audio.stopBGM();
    
    this.celebrationTimer = 2.0;
    this.winningTeam = winner;
    this.bullets = []; // Clear current bullets to focus on celebration

    const isWinner = this.player.team.toLowerCase() === winner.toLowerCase();
    if (isWinner) {
      audio.playWin();
    } else {
      audio.playLose();
    }

    // Revive winning team and set to dance
    if (this.player.team.toLowerCase() === winner.toLowerCase()) {
      this.player.isAlive = true;
      this.player.health = 100;
      this.player.dancing = true;
      this.player.danceTime = 0;
    }
    
    Object.values(this.remotePlayers).forEach(rp => {
      if (rp.team.toLowerCase() === winner.toLowerCase()) {
        rp.isAlive = true;
        rp.health = 100;
        rp.dancing = true;
        rp.danceTime = 0;
      }
    });
  }

  showGameOverCard(winner) {
    const isWinner = this.player.team.toLowerCase() === winner.toLowerCase();
    this.gameOverMessage = isWinner ? 'Victory!' : 'Defeat';
    
    const overlay = document.getElementById('game-over-overlay');
    const card = document.getElementById('game-over-card');
    const image = document.getElementById('game-over-image');
    const text = document.getElementById('game-over-text');
    const subtitle = document.getElementById('game-over-subtitle');

    if (overlay && card && image && text && subtitle) {
      text.innerText = this.gameOverMessage;
      
      if (isWinner) {
        text.style.color = '#10b981';
        subtitle.innerText = `${winner} Team dominated the match.`;
        image.src = './assets/winner_card.png';
        card.style.background = 'rgba(16, 185, 129, 0.1)';
        card.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        card.style.boxShadow = '0 20px 40px rgba(16, 185, 129, 0.2)';
      } else {
        text.style.color = '#ef4444';
        subtitle.innerText = `${winner} Team won. Better luck next time.`;
        image.src = './assets/loser_card.png';
        card.style.background = 'rgba(239, 68, 68, 0.1)';
        card.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        card.style.boxShadow = '0 20px 40px rgba(239, 68, 68, 0.2)';
      }
      
      card.style.display = 'flex';
      overlay.classList.remove('hidden');
    }
  }

  spawnConfetti() {
    if (Math.random() < 0.25) {
      const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 100,
        vy: 150 + Math.random() * 150,
        life: 3.5,
        color: randomColor,
        isConfetti: true,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8
      });
    }
  }

  rematch() {
    // Keep scores to track round wins!
    this.player.health = 100;
    this.player.isAlive = true;
    this.player.dancing = false;
    this.player.x = 80 + Math.floor(Math.random() * 60);
    this.player.y = 100;
    this.bullets = [];
    this.particles = [];
    this.remotePlayers = {};
    this.isGameOver = false;
    this.celebrationTimer = 0;
    this.winningTeam = null;
    
    // Notify server we are respawning
    this.emitJoin();

    document.getElementById('game-over-overlay').classList.add('hidden');
    audio.stopBGM();
  }

  spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 1.0,
        color: color
      });
    }
  }

  loop(timestamp) {
    if (!this.isRunning) return;
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.input.update(); // Update input state

    // Always update visual things like particles and player dance even if game over
    if (this.isGameOver) {
      let timeAccumulated = dt;
      while (timeAccumulated > 0) {
        const step = Math.min(timeAccumulated, 0.016);
        this.player.update(step, this.input, this.map);
        Object.values(this.remotePlayers).forEach(rp => rp.update(step));
        this.updateParticles(step);
        
        if (this.celebrationTimer > 0) {
          this.celebrationTimer -= step;
          this.spawnConfetti();
          if (this.celebrationTimer <= 0) {
            this.showGameOverCard(this.winningTeam);
          }
        }
        
        timeAccumulated -= step;
      }
    } else {
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

    // Auto-respawn when falling off the map
    if (this.player.isAlive && this.player.y > 600) {
      this.player.health = 0;
      this.player.isAlive = false;
      if (this.socket) this.socket.emit('suicide');
      
      setTimeout(() => {
        if (!this.isGameOver) {
          this.player.health = 100;
          this.player.isAlive = true;
          this.player.x = 80 + Math.floor(Math.random() * 60);
          this.player.y = 100;
          this.player.velocityY = 0;
          // Let the server know we're back alive so others see us
          this.emitJoin();
        }
      }, 3000);
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
        this.screenShake = 5; // Add subtle camera shake on shoot
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
    this.updateParticles(dt);
  }

  updateParticles(dt) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      if (p.isConfetti) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx += Math.sin(p.y / 30 + p.x) * 15 * dt;
        p.rotation += p.rotationSpeed * dt;
        p.life -= dt * 0.28;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
      }
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.screenShake > 0) this.screenShake -= dt * 60;
  }

  draw() {
    this.ctx.save();
    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(dx, dy);
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.map.draw(this.ctx);

    Object.values(this.remotePlayers).forEach(rp => rp.draw(this.ctx));
    this.bullets.forEach(b => b.draw(this.ctx));

    this.particles.forEach(p => {
      if (p.isConfetti) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        this.ctx.fillRect(-6, -3, 12, 6);
        this.ctx.restore();
      } else {
        this.ctx.fillStyle = p.color || '#ef4444';
        this.ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        this.ctx.fillRect(p.x, p.y, 4, 4);
      }
    });
    this.ctx.globalAlpha = 1.0;

    this.player.draw(this.ctx);
    this.ctx.restore();

    // Draw Celebration Banner if in celebration window
    if (this.isGameOver && this.celebrationTimer > 0 && this.winningTeam) {
      this.ctx.save();
      // Draw background ribbon
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.fillRect(0, this.canvas.height / 2 - 70, this.canvas.width, 140);

      const teamColor = this.winningTeam.toLowerCase() === 'red' ? '#ef4444' : '#3b82f6';
      
      // Top and bottom borders for the banner
      this.ctx.fillStyle = teamColor;
      this.ctx.fillRect(0, this.canvas.height / 2 - 70, this.canvas.width, 4);
      this.ctx.fillRect(0, this.canvas.height / 2 + 66, this.canvas.width, 4);

      // Text setup
      this.ctx.font = '800 48px "Outfit", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Draw text shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillText(`${this.winningTeam.toUpperCase()} TEAM WINS!`, this.canvas.width / 2 + 3, this.canvas.height / 2 + 3);
      
      // Draw actual text with glow
      this.ctx.shadowColor = teamColor;
      this.ctx.shadowBlur = 15;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(`${this.winningTeam.toUpperCase()} TEAM WINS!`, this.canvas.width / 2, this.canvas.height / 2);
      
      this.ctx.restore();
    }

    // Update Scores HUD in HTML
    const redHud = document.getElementById('hud-score-red');
    const blueHud = document.getElementById('hud-score-blue');

    let redCount = (this.player.team === 'red' && this.player.isAlive) ? 1 : 0;
    let blueCount = (this.player.team === 'blue' && this.player.isAlive) ? 1 : 0;
    
    Object.values(this.remotePlayers).forEach(rp => {
      if (rp.isAlive) {
        if (rp.team === 'red') redCount++;
        if (rp.team === 'blue') blueCount++;
      }
    });

    if (redHud) redHud.innerText = `Red Players: ${redCount}`;
    if (blueHud) blueHud.innerText = `Blue Players: ${blueCount}`;

    if (!this.player.isAlive && !this.isGameOver) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = 'white';
      this.ctx.font = '48px Outfit, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("RESPAWNING...", this.canvas.width / 2, this.canvas.height / 2);
    }
  }
}

import { audio } from './audio.js';

export class Player {
  constructor(x, y, faceDataUrl, team) {
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 48;
    this.vx = 0;
    this.vy = 0;
    this.speed = 250;
    this.jumpForce = -450;
    this.grounded = false;

    // Double Jump
    this.jumpCount = 0;
    this.maxJumps = 2;

    // Combat
    this.team = team; // 'red' or 'blue'
    this.health = 100;
    this.facingRight = true;
    this.isAlive = true;

    this.faceImage = new Image();
    this.faceImage.src = faceDataUrl;
    this.headSize = 32;
    this.dancing = false;
    this.danceTime = 0;
  }

  update(dt, input, gameMap) {
    if (!this.isAlive) return;
    
    if (this.dancing) {
      this.danceTime += dt;
      return; // Stop normal logic if dancing
    }

    // Horizontal movement
    if (input.keys.left) {
      this.vx = -this.speed;
      this.facingRight = false;
    } else if (input.keys.right) {
      this.vx = this.speed;
      this.facingRight = true;
    } else {
      this.vx = 0;
    }

    // Double Jump logic
    if (this.grounded) {
      this.jumpCount = 0;
    }

    if (input.justPressed.jump && this.jumpCount < this.maxJumps) {
      this.vy = this.jumpForce;
      this.grounded = false;
      this.jumpCount++;
      input.justPressed.jump = false; // Consume input
      audio.playJump();
    }

    // Apply gravity
    this.vy += 1200 * dt;

    // Calculate intended position
    let nextX = this.x + this.vx * dt;
    let nextY = this.y + this.vy * dt;

    // Check collisions
    this.grounded = false;
    
    // Resolve X axis
    const collidedX = gameMap.checkCollision(nextX, this.y, this.width, this.height);
    if (collidedX) {
      this.vx = 0;
      if (this.x < collidedX.x) {
        nextX = collidedX.x - this.width;
      } else {
        nextX = collidedX.x + gameMap.tileSize;
      }
    }
    this.x = nextX;

    // Resolve Y axis
    const collidedY = gameMap.checkCollision(this.x, nextY, this.width, this.height);
    if (collidedY) {
      if (this.vy > 0) { // Falling down
        this.grounded = true;
        this.vy = 0;
        nextY = collidedY.y - this.height;
      } else if (this.vy < 0) { // Jumping up, hitting ceiling
        this.vy = 0;
        nextY = collidedY.y + gameMap.tileSize;
      }
    }
    this.y = nextY;
  }

  draw(ctx) {
    if (!this.isAlive) return;

    let drawY = this.y;
    let drawFacingRight = this.facingRight;
    
    if (this.dancing) {
      // Bounce effect
      drawY -= Math.abs(Math.sin(this.danceTime * 10)) * 20;
      // Flip left/right rapidly
      if (Math.floor(this.danceTime * 5) % 2 === 0) {
        drawFacingRight = !drawFacingRight;
      }
    }

    const bodyY = drawY + this.headSize;
    const bodyHeight = this.height - this.headSize;
    
    // Shirt (Team Color)
    ctx.fillStyle = this.team === 'red' ? '#ef4444' : '#3b82f6';
    ctx.fillRect(this.x + 4, bodyY, this.width - 8, bodyHeight / 2);
    
    // Overalls
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(this.x + 4, bodyY + bodyHeight / 2, this.width - 8, bodyHeight / 2);
    
    // Arms
    ctx.fillStyle = '#fca5a5';
    let armOffset = 0;
    if (this.dancing) armOffset = Math.sin(this.danceTime * 15) * 10;
    ctx.fillRect(this.x, bodyY + 2 - armOffset, 4, 10);
    ctx.fillRect(this.x + this.width - 4, bodyY + 2 + armOffset, 4, 10);

    // Gun
    ctx.fillStyle = '#334155';
    if (drawFacingRight) {
      ctx.fillRect(this.x + this.width - 4, bodyY + 6, 12, 4);
    } else {
      ctx.fillRect(this.x - 8, bodyY + 6, 12, 4);
    }

    // Shoes
    ctx.fillStyle = '#78350f';
    ctx.fillRect(this.x + 2, drawY + this.height - 4, 10, 4);
    ctx.fillRect(this.x + this.width - 12, drawY + this.height - 4, 10, 4);

    // Custom face
    if (this.faceImage.complete && this.faceImage.naturalWidth !== 0) {
      ctx.imageSmoothingEnabled = false;
      
      // Flip face if looking left
      if (!drawFacingRight) {
        ctx.save();
        ctx.translate(this.x + this.headSize / 2, drawY + this.headSize / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(this.faceImage, -this.headSize / 2, -this.headSize / 2, this.headSize, this.headSize);
        ctx.restore();
      } else {
        ctx.drawImage(this.faceImage, this.x, drawY, this.headSize, this.headSize);
      }
    } else {
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(this.x, drawY, this.headSize, this.headSize);
    }

    // Draw Health Bar
    const hpPercent = Math.max(0, this.health / 100);
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y - 10, this.width, 5);
    ctx.fillStyle = '#10b981'; // Green
    ctx.fillRect(this.x, this.y - 10, this.width * hpPercent, 5);

    // Draw Team Label
    ctx.fillStyle = 'white';
    ctx.font = '10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.team === 'red' ? 'TEAM RED' : 'TEAM BLUE', this.x + this.width / 2, this.y - 15);
  }
}

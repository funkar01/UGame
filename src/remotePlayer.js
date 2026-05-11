export class RemotePlayer {
  constructor(x, y, faceDataUrl, team, health = 100, isAlive = true) {
    this.x = x;
    this.y = y;
    this.width = 32;
    this.height = 48;

    this.team = team;
    this.health = health;
    this.isAlive = isAlive;
    this.facingRight = true;

    this.faceImage = new Image();
    this.faceImage.src = faceDataUrl;
    this.headSize = 32;

    this.targetX = x;
    this.targetY = y;
  }

  updateData(data) {
    if (data.x !== undefined) {
      if (data.x > this.targetX) this.facingRight = true;
      if (data.x < this.targetX) this.facingRight = false;
      this.targetX = data.x;
      this.targetY = data.y;
    }
    if (data.health !== undefined) this.health = data.health;
    if (data.isAlive !== undefined) this.isAlive = data.isAlive;
  }

  update(dt) {
    if (!this.isAlive) return;
    this.x += (this.targetX - this.x) * 15 * dt;
    this.y += (this.targetY - this.y) * 15 * dt;
  }

  draw(ctx) {
    if (!this.isAlive) return;

    const bodyY = this.y + this.headSize;
    const bodyHeight = this.height - this.headSize;
    
    // Shirt (Team Color)
    ctx.fillStyle = this.team === 'red' ? '#ef4444' : '#3b82f6';
    ctx.fillRect(this.x + 4, bodyY, this.width - 8, bodyHeight / 2);
    
    // Overalls
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.x + 4, bodyY + bodyHeight / 2, this.width - 8, bodyHeight / 2);
    
    // Arms
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(this.x, bodyY + 2, 4, 10);
    ctx.fillRect(this.x + this.width - 4, bodyY + 2, 4, 10);

    // Gun
    ctx.fillStyle = '#334155';
    if (this.facingRight) {
      ctx.fillRect(this.x + this.width - 4, bodyY + 6, 12, 4);
    } else {
      ctx.fillRect(this.x - 8, bodyY + 6, 12, 4);
    }

    // Shoes
    ctx.fillStyle = '#78350f';
    ctx.fillRect(this.x + 2, this.y + this.height - 4, 10, 4);
    ctx.fillRect(this.x + this.width - 12, this.y + this.height - 4, 10, 4);

    // Face
    if (this.faceImage.complete && this.faceImage.naturalWidth !== 0) {
      ctx.imageSmoothingEnabled = false;
      if (!this.facingRight) {
        ctx.save();
        ctx.translate(this.x + this.headSize / 2, this.y + this.headSize / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(this.faceImage, -this.headSize / 2, -this.headSize / 2, this.headSize, this.headSize);
        ctx.restore();
      } else {
        ctx.drawImage(this.faceImage, this.x, this.y, this.headSize, this.headSize);
      }
    } else {
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(this.x, this.y, this.headSize, this.headSize);
    }

    // Health Bar
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

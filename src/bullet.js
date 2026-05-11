export class Bullet {
  constructor(x, y, dirX, ownerId) {
    this.x = x;
    this.y = y;
    this.speed = 600;
    this.dirX = dirX; // 1 (right) or -1 (left)
    this.ownerId = ownerId;
    this.width = 12;
    this.height = 4;
    this.active = true;
  }

  update(dt, map) {
    if (!this.active) return;
    this.x += this.dirX * this.speed * dt;

    // Check map collision
    if (map.checkCollision(this.x, this.y, this.width, this.height)) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.fillStyle = '#fbbf24'; // Yellow/orange bullet
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

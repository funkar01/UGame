export class GameMap {
  constructor() {
    this.tileSize = 40;
    // 1: solid block, 0: empty
    this.level = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];
  }

  checkCollision(x, y, w, h) {
    const startCol = Math.floor(x / this.tileSize);
    const endCol = Math.floor((x + w - 0.1) / this.tileSize); // -0.1 to avoid edge snags
    const startRow = Math.floor(y / this.tileSize);
    const endRow = Math.floor((y + h - 0.1) / this.tileSize);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (this.isSolid(c, r)) {
          return {
            x: c * this.tileSize,
            y: r * this.tileSize,
            w: this.tileSize,
            h: this.tileSize
          };
        }
      }
    }
    return null;
  }

  isSolid(col, row) {
    if (row < 0 || row >= this.level.length || col < 0 || col >= this.level[0].length) {
      return true; // Screen boundaries are solid
    }
    return this.level[row][col] === 1;
  }

  draw(ctx) {
    for (let r = 0; r < this.level.length; r++) {
      for (let c = 0; c < this.level[r].length; c++) {
        if (this.level[r][c] === 1) {
          const x = c * this.tileSize;
          const y = r * this.tileSize;
          
          ctx.fillStyle = '#d97736'; // Brick color
          ctx.fillRect(x, y, this.tileSize, this.tileSize);
          
          ctx.strokeStyle = '#8a4012';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, this.tileSize, this.tileSize);
          
          // Simple brick pattern
          ctx.beginPath();
          ctx.moveTo(x, y + this.tileSize / 2);
          ctx.lineTo(x + this.tileSize, y + this.tileSize / 2);
          ctx.moveTo(x + this.tileSize / 2, y);
          ctx.lineTo(x + this.tileSize / 2, y + this.tileSize / 2);
          ctx.moveTo(x + this.tileSize / 4, y + this.tileSize / 2);
          ctx.lineTo(x + this.tileSize / 4, y + this.tileSize);
          ctx.moveTo(x + 3 * this.tileSize / 4, y + this.tileSize / 2);
          ctx.lineTo(x + 3 * this.tileSize / 4, y + this.tileSize);
          ctx.stroke();
        }
      }
    }
  }
}

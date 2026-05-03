export class Input {
  constructor() {
    this.keys = {
      left: false,
      right: false,
      jump: false,
      shoot: false
    };

    // To track keys that were just pressed this frame
    this.justPressed = {
      jump: false,
      shoot: false
    };

    // Track previous state to determine 'justPressed'
    this.prevKeys = {
      jump: false,
      shoot: false
    };

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  update() {
    // Determine justPressed for this frame
    this.justPressed.jump = this.keys.jump && !this.prevKeys.jump;
    this.justPressed.shoot = this.keys.shoot && !this.prevKeys.shoot;

    // Update prevKeys for next frame
    this.prevKeys.jump = this.keys.jump;
    this.prevKeys.shoot = this.keys.shoot;
  }

  handleKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.keys.jump = true;
    if (e.code === 'KeyF') this.keys.shoot = true;
  }

  handleKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') this.keys.jump = false;
    if (e.code === 'KeyF') this.keys.shoot = false;
  }
}

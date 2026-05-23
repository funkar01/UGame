export class AudioSystem {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.customHitBuffer = null;
    
    // Resume context on first user interaction
    const resume = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', resume);
      window.removeEventListener('touchstart', resume);
    };
    window.addEventListener('click', resume);
    window.addEventListener('touchstart', resume);
  }

  playCustomHitUrl(url) {
    if (!url) {
      this.playFunnyHit();
      return;
    }
    try {
      const a = new Audio(url);
      a.volume = 0.3;
      a.play().catch(e => {
        console.error("HTMLAudioElement play failed, trying AudioContext fallback:", e);
        this.playFunnyHit();
      });
    } catch(e) {
      console.error("HTMLAudioElement creation failed, trying AudioContext fallback:", e);
      this.playFunnyHit();
    }
  }

  async decodeAudio(urlOrBase64) {
    if (!urlOrBase64) return null;
    try {
      const response = await fetch(urlOrBase64);
      const arrayBuffer = await response.arrayBuffer();
      return await this.ctx.decodeAudioData(arrayBuffer);
    } catch(e) {
      console.error("Failed to decode audio data", e);
      return null;
    }
  }

  playAudioBuffer(buffer) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start();
    } else {
      this.playFunnyHit(); // Fallback
    }
  }

  async loadCustomHit(url) {
    if (!url) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.customHitBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    } catch(e) {
      console.error("Failed to load custom hit audio", e);
    }
  }

  playCustomHit() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.customHitBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.customHitBuffer;
      source.connect(this.ctx.destination);
      source.start();
    } else {
      this.playFunnyHit(); // Fallback
    }
  }

  playFunnyHit() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    // Funny boing sound
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playBGM() {
    if (this.bgmOsc) return; 
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();
    this.bgmOsc.type = 'triangle';
    
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 4;
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 100;
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmOsc.frequency);
    
    this.bgmOsc.frequency.value = 330; 
    
    this.bgmGain.gain.value = 0.05; 
    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.ctx.destination);
    
    this.bgmOsc.start();
    lfo.start();
    this.lfo = lfo; 
  }

  stopBGM() {
    if (this.bgmOsc) {
      this.bgmOsc.stop();
      if(this.lfo) this.lfo.stop();
      this.bgmOsc = null;
    }
  }

  playShoot() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playJump() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Classic jump upward sweep
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playHit() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playWin() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const notes = [400, 500, 600, 800];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.15);
      osc.stop(this.ctx.currentTime + i * 0.15 + 0.3);
    });
  }

  playLose() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const notes = [300, 250, 200];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.3 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.3);
      osc.stop(this.ctx.currentTime + i * 0.3 + 0.4);
    });
  }
}

export const audio = new AudioSystem();

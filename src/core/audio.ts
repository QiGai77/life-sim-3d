/**
 * Tiny WebAudio synth – every sound is generated, no asset files.
 */
class Synth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  private get ok() {
    return !!this.ctx && !!this.master && !this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, glideTo?: number, attack = 0.01) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  pop() {
    this.tone(520, 0.12, 'sine', 0.25, 0, 880);
  }
  drop() {
    this.tone(300, 0.14, 'sine', 0.22, 0, 160);
  }
  click() {
    this.tone(900, 0.06, 'triangle', 0.15);
    this.tone(600, 0.08, 'sine', 0.12, 0.02);
  }
  chime() {
    [1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12, i * 0.08));
  }
  success() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, i * 0.09));
  }
  unlock2() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.16, i * 0.1));
  }
  boing() {
    this.tone(220, 0.25, 'sine', 0.3, 0, 440);
  }
  gulp() {
    for (let i = 0; i < 5; i++) this.tone(180 + i * 15, 0.12, 'sine', 0.2, i * 0.45, 120);
  }
  chomp() {
    this.tone(260, 0.08, 'square', 0.06);
    this.tone(200, 0.1, 'square', 0.05, 0.12);
  }
  woof() {
    this.tone(330, 0.12, 'sawtooth', 0.08, 0, 200);
    this.tone(300, 0.12, 'sawtooth', 0.07, 0.18, 180);
  }
  /** giggle: quick rising chirps with vibrato */
  giggle() {
    if (!this.ok) return;
    const base = [620, 700, 660, 760, 720];
    base.forEach((f, i) => this.tone(f, 0.11, 'sine', 0.22, i * 0.11, f * 1.35, 0.005));
  }
  /** wail: wobbling sawtooth through a lowpass */
  cry() {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t);
    o.frequency.linearRampToValueAtTime(560, t + 0.35);
    o.frequency.linearRampToValueAtTime(500, t + 0.9);
    o.frequency.linearRampToValueAtTime(380, t + 1.4);
    lfo.frequency.value = 7;
    lfoG.gain.value = 18;
    lfo.connect(lfoG).connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.value = 1300;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.12);
    g.gain.setValueAtTime(0.12, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.6);
    lfo.stop(t + 1.6);
  }
  coo() {
    this.tone(500, 0.3, 'sine', 0.15, 0, 700);
  }
  /** soft music-box lullaby, scheduled from the game loop */
  updateMusic(dt: number) {
    if (!this.ok) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const notes = [
      784, 659, 784, 0, 659, 587, 523, 0, 587, 659, 784, 880, 784, 659, 587, 0,
      523, 587, 659, 0, 587, 523, 440, 0, 523, 587, 659, 523, 587, 0, 0, 0,
    ];
    const n = notes[this.musicStep % notes.length];
    if (n) {
      this.tone(n * 2, 0.9, 'sine', 0.035, 0, undefined, 0.005);
      this.tone(n * 4, 0.4, 'sine', 0.008, 0, undefined, 0.005);
    }
    this.musicStep++;
    this.musicTimer = 0.42;
  }
}

export const sfx = new Synth();

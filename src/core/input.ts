import { bus } from './events';

export type Action = 'grab' | 'throw' | 'mouth' | 'cry' | 'laugh' | 'board';

/**
 * Unified input: virtual joystick + drag-to-look on touch, pointer-lock + WASD on desktop.
 */
export class Input {
  move = { x: 0, y: 0 }; // x: right, y: forward
  look = { dx: 0, dy: 0 }; // accumulated radians since last consume
  isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  enabled = false;
  locked = false;

  private keys = new Set<string>();
  private joyId = -1;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private lookId = -1;
  private lookLast = { x: 0, y: 0 };
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private joyHome = { x: 0, y: 0 };

  constructor(private layer: HTMLElement, private canvas: HTMLCanvasElement) {
    this.joyBase = document.getElementById('joy')!;
    this.joyKnob = document.getElementById('joy-knob')!;

    layer.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = e.code;
      if (k === 'Tab') {
        e.preventDefault();
        bus.emit('action', 'board');
        return;
      }
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'KeyF') bus.emit('action', 'mouth');
      if (k === 'Space') {
        e.preventDefault();
        bus.emit('action', 'cry');
      }
      if (k === 'KeyR') bus.emit('action', 'laugh');
      if (k === 'KeyE') bus.emit('action', 'grab');
      if (k === 'KeyQ') bus.emit('action', 'throw');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas || document.pointerLockElement === this.layer;
      bus.emit('pointerlock', this.locked);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.look.dx += e.movementX * 0.0022;
      this.look.dy += e.movementY * 0.0022;
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked || !this.enabled) return;
      if (e.button === 0) bus.emit('action', 'grab');
      if (e.button === 2) bus.emit('action', 'throw');
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    this.layoutJoy();
    window.addEventListener('resize', () => this.layoutJoy());
  }

  private layoutJoy() {
    const r = this.joyBase.getBoundingClientRect();
    this.joyHome = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  requestLock() {
    if (this.isTouch) return;
    const el: any = this.layer;
    try {
      const p = el.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  private onDown(e: PointerEvent) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      if (!this.locked) this.requestLock();
      return;
    }
    e.preventDefault();
    const w = window.innerWidth;
    if (e.clientX < w * 0.42 && this.joyId < 0) {
      this.joyId = e.pointerId;
      this.layoutJoy();
      // re-centre the stick where the thumb lands (within reason)
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.style.transform = `translate(${e.clientX - this.joyHome.x}px, ${e.clientY - this.joyHome.y}px)`;
      this.joyBase.classList.add('active');
      this.updateJoy(e.clientX, e.clientY);
    } else if (this.lookId < 0) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onMove(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      this.updateJoy(e.clientX, e.clientY);
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      const s = 3.4 / Math.max(window.innerWidth, 1);
      this.look.dx += dx * s;
      this.look.dy += dy * s;
    }
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      this.joyId = -1;
      this.joyVec = { x: 0, y: 0 };
      this.joyKnob.style.transform = '';
      this.joyBase.style.transform = '';
      this.joyBase.classList.remove('active');
    }
    if (e.pointerId === this.lookId) this.lookId = -1;
  }

  private updateJoy(x: number, y: number) {
    const max = 46;
    let dx = x - this.joyOrigin.x, dy = y - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joyVec = { x: dx / max, y: -dy / max };
  }

  consumeLook() {
    const l = { ...this.look };
    this.look.dx = 0;
    this.look.dy = 0;
    return l;
  }

  update() {
    let x = this.joyVec.x, y = this.joyVec.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // dead zone
    if (len < 0.12) {
      x = 0;
      y = 0;
    }
    this.move.x = x;
    this.move.y = y;
  }
}

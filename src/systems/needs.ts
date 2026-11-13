import { bus, clamp } from '../core/events';

export type NeedKey = 'hunger' | 'sleep' | 'love' | 'curious';

export const NEED_INFO: Record<NeedKey, { label: string; decay: number }> = {
  hunger: { label: '饱腹', decay: 0.22 },
  sleep: { label: '睡眠', decay: 0.07 },
  love: { label: '亲密', decay: 0.13 },
  curious: { label: '好奇', decay: 0.04 },
};

/** The four needs shown as bubbles. 0..100, decaying slowly. */
export class Needs {
  v: Record<NeedKey, number> = { hunger: 34, sleep: 82, love: 58, curious: 22 };
  paused = false;

  add(k: NeedKey, amt: number) {
    this.v[k] = clamp(this.v[k] + amt, 0, 100);
    bus.emit('needs', this.v);
    if (amt > 0) bus.emit('needUp', k);
  }

  update(dt: number) {
    if (this.paused) return;
    (Object.keys(this.v) as NeedKey[]).forEach((k) => {
      this.v[k] = clamp(this.v[k] - NEED_INFO[k].decay * dt, 0, 100);
    });
    bus.emit('needs', this.v);
  }

  lowest(): NeedKey {
    return (Object.keys(this.v) as NeedKey[]).reduce((a, b) => (this.v[a] < this.v[b] ? a : b));
  }
}

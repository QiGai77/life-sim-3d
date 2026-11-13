type Handler = (payload?: any) => void;

/** Tiny event bus shared by systems and UI. */
export class EventBus {
  private map = new Map<string, Set<Handler>>();
  on(name: string, fn: Handler): () => void {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name)!.add(fn);
    return () => this.map.get(name)?.delete(fn);
  }
  emit(name: string, payload?: any) {
    this.map.get(name)?.forEach((fn) => fn(payload));
  }
}

export const bus = new EventBus();

/** Promise-based tweens / waits, advanced by the game loop. */
interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  resolve: () => void;
}

export class Tweens {
  private list: Tween[] = [];
  run(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      if (dur <= 0) {
        fn(1);
        resolve();
        return;
      }
      this.list.push({ t: 0, dur, fn, resolve });
    });
  }
  wait(dur: number): Promise<void> {
    return this.run(dur, () => {});
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.resolve();
      }
    }
  }
}

export const tweens = new Tweens();

export const ease = {
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  out: (k: number) => 1 - Math.pow(1 - k, 3),
  in: (k: number) => k * k * k,
  back: (k: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

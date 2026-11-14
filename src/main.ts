import './ui/style.css';
import { Game } from './core/game';
import { bus } from './core/events';
import { assets } from './core/assets';
import { initMaterials } from './world/lowpoly';

// block pinch-zoom / double-tap zoom / scrolling on mobile browsers
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement)?.closest?.('#board')) e.preventDefault(); }, { passive: false });

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const bar = document.getElementById('load-fill') as HTMLElement | null;
const btn = document.getElementById('start-btn') as HTMLButtonElement;
btn.disabled = true;

assets
  .load((k) => {
    if (bar) bar.style.width = `${Math.round(k * 100)}%`;
  })
  .then(() => {
    initMaterials(assets.tex);
    const game = new Game(canvas);
    game.loop();
    document.body.classList.add('loaded');
    btn.disabled = false;
    if (/debug/.test(location.search)) {
      (window as any).__game = game;
      (window as any).__bus = bus;
    }
  });

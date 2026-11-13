import './ui/style.css';
import { Game } from './core/game';
import { bus } from './core/events';

// block pinch-zoom / double-tap zoom / scrolling on mobile browsers
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement)?.closest?.('#board')) e.preventDefault(); }, { passive: false });

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const game = new Game(canvas);
game.loop();

if (/debug/.test(location.search)) {
  (window as any).__game = game;
  (window as any).__bus = bus;
}

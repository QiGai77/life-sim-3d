import * as THREE from 'three';
import { srand, rand } from './lowpoly';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat?: [number, number], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function drawMoon(g: CanvasRenderingContext2D, x: number, y: number, r: number, bg: string) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const prev = g.fillStyle;
  g.fillStyle = bg;
  g.beginPath();
  g.arc(x + r * 0.45, y - r * 0.2, r * 0.85, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = prev;
}

/** lavender nursery wallpaper with tiny stars & moons */
export function nurseryWallpaper(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const bg = '#bab3d4';
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  srand(7);
  for (let i = 0; i < 26; i++) {
    const x = rand() * 256, y = rand() * 256;
    g.fillStyle = ['rgba(255,240,220,0.55)', 'rgba(255,255,255,0.35)', 'rgba(250,215,160,0.5)'][i % 3];
    if (i % 4 === 0) drawMoon(g, x, y, 5, bg);
    else drawStar(g, x, y, 3 + rand() * 3, rand());
  }
  return tex(c, [3, 1.6]);
}

/** creamy living room wall with soft dotted pattern */
export function livingWallpaper(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f0dcc6';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = 'rgba(230,180,150,0.22)';
      g.beginPath();
      g.arc(x + ((y / 32) % 2) * 16 + 8, y + 8, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  return tex(c, [4, 2]);
}

/** warm wooden planks */
export function woodFloor(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const plankH = 64;
  srand(11);
  for (let row = 0; row < 512 / plankH; row++) {
    let x = -rand() * 200;
    while (x < 512) {
      const len = 160 + rand() * 180;
      const l = 0.9 + rand() * 0.16;
      const r = Math.round(196 * l), gg = Math.round(140 * l), b = Math.round(98 * l);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x, row * plankH, len, plankH);
      // grain
      g.strokeStyle = `rgba(120,70,40,0.10)`;
      g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const yy = row * plankH + 10 + rand() * (plankH - 20);
        g.beginPath();
        g.moveTo(x + 6, yy);
        g.bezierCurveTo(x + len * 0.3, yy + 4, x + len * 0.6, yy - 4, x + len - 6, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(90,50,30,0.35)';
      g.fillRect(x, row * plankH, 2, plankH);
      x += len;
    }
    g.fillStyle = 'rgba(90,50,30,0.35)';
    g.fillRect(0, row * plankH, 512, 2);
  }
  return tex(c, [3, 3]);
}

/** striped nursery rug (lavender-blue / cream like concept-04) */
export function stripedRug(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const cols = ['#eae3ef', '#8e93b5', '#eae3ef', '#a9aecb'];
  const w = 256 / 8;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = cols[i % 4];
    g.fillRect(i * w, 0, w, 256);
  }
  // knit noise
  srand(3);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.12})`;
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
    g.fillStyle = `rgba(60,50,90,${rand() * 0.08})`;
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return tex(c);
}

/** chunky pink/cream/blue living room rug like concept-02 */
export function livingRug(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 384);
  g.fillStyle = '#f6e9dc';
  g.fillRect(0, 0, 512, 384);
  srand(5);
  const blob = (color: string, x: number, y: number, s: number) => {
    g.fillStyle = color;
    // pixel-ish blocky blobs
    for (let i = 0; i < 26; i++) {
      const bx = x + (rand() - 0.5) * s * 2, by = y + (rand() - 0.5) * s;
      g.fillRect(Math.round(bx / 16) * 16, Math.round(by / 16) * 16, 32 + rand() * 32, 16 + rand() * 16);
    }
  };
  for (let i = 0; i < 9; i++) blob('#eab3b4', rand() * 512, rand() * 384, 60);
  for (let i = 0; i < 4; i++) blob('#a6b9cf', rand() * 512, 300 + rand() * 80, 70);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.18})`;
    g.fillRect(rand() * 512, rand() * 384, 2, 2);
  }
  // border
  g.strokeStyle = '#e7c9b5';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 374);
  return tex(c);
}

const blockPalette = ['#f2a7a0', '#9ec7e8', '#a8d5b5', '#f6d98a', '#c8b4e2', '#f4bf95'];
const letterCols = ['#d9534f', '#3f73c4', '#3d9a64', '#d18d14', '#7d5cc1', '#d16f2c'];

/** letter block face texture */
export function blockFace(letter: string, idx: number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f8ecd8';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = blockPalette[idx % blockPalette.length];
  g.fillRect(0, 0, 128, 14);
  g.fillRect(0, 114, 128, 14);
  g.fillRect(0, 0, 14, 128);
  g.fillRect(114, 0, 14, 128);
  g.fillStyle = letterCols[idx % letterCols.length];
  g.font = 'bold 82px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  return tex(c);
}

/** sky gradient for the window backdrop */
export function skyGradient(): THREE.CanvasTexture {
  const [c, g] = canvas(16, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8b85c4');
  gr.addColorStop(0.35, '#c8a6cf');
  gr.addColorStop(0.62, '#f3b7a6');
  gr.addColorStop(0.82, '#ffd9a8');
  gr.addColorStop(1, '#ffe9c4');
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 256);
  return tex(c);
}

/** friendly parent face decal (transparent background) */
export function parentFace(blink = false): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  // blush
  g.fillStyle = 'rgba(235,120,120,0.35)';
  g.beginPath();
  g.ellipse(70, 160, 24, 15, 0, 0, Math.PI * 2);
  g.ellipse(186, 160, 24, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#4a2f25';
  g.fillStyle = '#4a2f25';
  g.lineCap = 'round';
  // brows
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(62, 92);
  g.quadraticCurveTo(82, 82, 102, 90);
  g.moveTo(154, 90);
  g.quadraticCurveTo(174, 82, 194, 92);
  g.stroke();
  // eyes (happy arcs or dots)
  if (blink) {
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(68, 126);
    g.quadraticCurveTo(84, 114, 100, 126);
    g.moveTo(156, 126);
    g.quadraticCurveTo(172, 114, 188, 126);
    g.stroke();
  } else {
    g.beginPath();
    g.ellipse(84, 124, 9, 12, 0, 0, Math.PI * 2);
    g.ellipse(172, 124, 9, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(87, 119, 3, 0, Math.PI * 2);
    g.arc(175, 119, 3, 0, Math.PI * 2);
    g.fill();
  }
  // smile
  g.strokeStyle = '#7a3b30';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(100, 182);
  g.quadraticCurveTo(128, 210, 156, 182);
  g.stroke();
  return tex(c);
}

/** dog sleeping face: closed eyes + nose */
export function dogFace(awake: boolean): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#3a2418';
  g.fillStyle = '#3a2418';
  g.lineCap = 'round';
  g.lineWidth = 6;
  if (awake) {
    g.beginPath();
    g.arc(36, 52, 8, 0, Math.PI * 2);
    g.arc(92, 52, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(39, 49, 2.5, 0, Math.PI * 2);
    g.arc(95, 49, 2.5, 0, Math.PI * 2);
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(26, 52);
    g.quadraticCurveTo(36, 60, 46, 52);
    g.moveTo(82, 52);
    g.quadraticCurveTo(92, 60, 102, 52);
    g.stroke();
  }
  return tex(c);
}

/** "TOYS" label for the toy box */
export function toysLabel(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 160);
  g.fillStyle = '#e6c49b';
  g.fillRect(0, 0, 512, 160);
  const letters = ['T', 'O', 'Y', 'S'];
  const cols = ['#e05a4f', '#f2b134', '#5aa864', '#7b6cc8'];
  g.font = 'bold 120px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  letters.forEach((l, i) => {
    g.fillStyle = 'rgba(80,40,20,0.25)';
    g.fillText(l, 70 + i * 124 + 4, 88);
    g.fillStyle = cols[i];
    g.fillText(l, 70 + i * 124, 84);
  });
  return tex(c);
}

/** simple pastel landscape painting for frames */
export function painting(variant = 0): THREE.CanvasTexture {
  const [c, g] = canvas(256, 192);
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, variant ? '#f6d6c4' : '#cfe0ef');
  gr.addColorStop(1, variant ? '#f9eadc' : '#f4ecdf');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = variant ? '#d9a48c' : '#a9c2b5';
  g.beginPath();
  g.moveTo(0, 150);
  g.quadraticCurveTo(70, 80, 140, 140);
  g.quadraticCurveTo(200, 100, 256, 130);
  g.lineTo(256, 192);
  g.lineTo(0, 192);
  g.fill();
  g.fillStyle = variant ? '#bf8670' : '#86a99a';
  g.beginPath();
  g.moveTo(0, 175);
  g.quadraticCurveTo(110, 120, 256, 170);
  g.lineTo(256, 192);
  g.lineTo(0, 192);
  g.fill();
  g.fillStyle = variant ? '#fff3d6' : '#fffbe6';
  g.beginPath();
  g.arc(190, 55, 18, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}

/** soft round glow sprite */
export function glowSprite(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return tex(c, undefined, false);
}

export function heartSprite(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#ff7f9b';
  g.beginPath();
  g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10);
  g.bezierCurveTo(28, 10, 32, 16, 32, 20);
  g.bezierCurveTo(32, 16, 36, 10, 42, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 54);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.ellipse(22, 22, 6, 4, -0.6, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}

/** sheer patterned curtain */
export function curtainTex(color: string, pattern: string): THREE.CanvasTexture {
  const [c, g] = canvas(128, 256);
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = pattern;
  srand(21);
  for (let i = 0; i < 14; i++) drawStar(g, rand() * 128, rand() * 256, 4 + rand() * 3, rand());
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = 'rgba(0,0,0,0.04)';
    g.fillRect(x, 0, 6, 256);
  }
  return tex(c);
}

/** vertical alpha ramp used for sun beams */
export function beamTex(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,220,170,0.0)');
  gr.addColorStop(0.12, 'rgba(255,220,170,0.55)');
  gr.addColorStop(1, 'rgba(255,220,170,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 128);
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)');
  gx.addColorStop(0.2, 'rgba(0,0,0,0)');
  gx.addColorStop(0.8, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 128);
  return tex(c);
}

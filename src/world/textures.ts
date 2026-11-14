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

/** Realistic nursery wall: warm muted sage-linen plaster with subtle woven grasscloth micro-texture */
export function nurseryWallpaper(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#d5dcd0');
  gr.addColorStop(1, '#c8d1c2');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  srand(7);
  // woven linen / grasscloth horizontal & vertical micro threads
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 512, y = rand() * 512;
    g.fillStyle = rand() < 0.5 ? `rgba(255,252,245,${rand() * 0.08})` : `rgba(80,92,76,${rand() * 0.06})`;
    if (i % 3 === 0) g.fillRect(x, y, 6 + rand() * 14, 1);
    else g.fillRect(x, y, 1.5, 4 + rand() * 10);
  }
  // very faint botanical leaf motif
  g.strokeStyle = 'rgba(255,250,240,0.16)';
  g.lineWidth = 1.2;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = col * 128 + (row % 2) * 64 + 32;
      const cy = row * 128 + 64;
      g.beginPath();
      g.ellipse(cx - 5, cy, 3.5, 9, -0.4, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(cx + 5, cy, 3.5, 9, 0.4, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return tex(c, [3, 1.6]);
}

/** Realistic living room wall: warm architectural limestone/ivory plaster */
export function livingWallpaper(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#eee7dc');
  gr.addColorStop(1, '#e4dacb');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  srand(19);
  for (let i = 0; i < 40; i++) {
    const x = rand() * 512, y = rand() * 512, r = 40 + rand() * 80;
    const rg = g.createRadialGradient(x, y, 2, x, y, r);
    rg.addColorStop(0, rand() < 0.5 ? 'rgba(255,252,248,0.06)' : 'rgba(170,150,128,0.05)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${rand() * 0.05})` : `rgba(120,105,90,${rand() * 0.04})`;
    g.fillRect(rand() * 512, rand() * 512, 2, 2);
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
      const r = Math.round(188 * l), gg = Math.round(134 * l), b = Math.round(92 * l);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x, row * plankH, len, plankH);
      g.strokeStyle = `rgba(100,58,32,0.12)`;
      g.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        const yy = row * plankH + 8 + rand() * (plankH - 16);
        g.beginPath();
        g.moveTo(x + 4, yy);
        g.bezierCurveTo(x + len * 0.3, yy + 4, x + len * 0.6, yy - 4, x + len - 4, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(72,40,22,0.38)';
      g.fillRect(x, row * plankH, 2, plankH);
      x += len;
    }
    g.fillStyle = 'rgba(72,40,22,0.38)';
    g.fillRect(0, row * plankH, 512, 2);
  }
  return tex(c, [3, 3]);
}

/** Woven oatmeal & slate-sage nursery rug */
export function stripedRug(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#e7dfd3';
  g.fillRect(0, 0, 512, 512);
  const bands = [40, 110, 175, 256, 337, 402, 472];
  bands.forEach((y, idx) => {
    g.fillStyle = idx % 2 === 0 ? '#909e93' : '#c6b7a4';
    g.fillRect(18, y - 8, 476, 16);
  });
  srand(3);
  for (let i = 0; i < 16000; i++) {
    const a = rand() * 0.16;
    g.fillStyle = rand() < 0.5 ? `rgba(255,252,246,${a})` : `rgba(85,78,70,${a * 0.7})`;
    g.fillRect(rand() * 512, rand() * 512, 3, 2);
  }
  g.strokeStyle = '#d3c7b7';
  g.lineWidth = 16;
  g.strokeRect(8, 8, 496, 496);
  return tex(c);
}

/** Soft woven wool living-room rug with warm geometric accents */
export function livingRug(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 768);
  g.fillStyle = '#eee4d6';
  g.fillRect(0, 0, 1024, 768);
  srand(5);
  // subtle geometric woven diamonds & warm border bands
  g.strokeStyle = 'rgba(165, 112, 92, 0.28)';
  g.lineWidth = 8;
  for (let x = 128; x < 920; x += 192) {
    for (let y = 128; y < 680; y += 170) {
      g.beginPath();
      g.moveTo(x, y - 48);
      g.lineTo(x + 62, y);
      g.lineTo(x, y + 48);
      g.lineTo(x - 62, y);
      g.closePath();
      g.stroke();
    }
  }
  g.strokeStyle = 'rgba(116, 134, 146, 0.22)';
  g.lineWidth = 18;
  g.strokeRect(46, 46, 932, 676);
  // bouclé fibre noise
  for (let i = 0; i < 36000; i++) {
    const a = rand() * 0.2;
    g.fillStyle = rand() < 0.5 ? `rgba(255,252,248,${a})` : `rgba(105,82,66,${a * 0.5})`;
    g.fillRect(rand() * 1024, rand() * 768, 2.5, 2.5);
  }
  g.strokeStyle = '#d9cab7';
  g.lineWidth = 22;
  g.strokeRect(11, 11, 1002, 746);
  return tex(c);
}

/** Procedural dermal micro-pore & crease normal map for realistic baby & adult skin */
export function skinNormalTex(): THREE.CanvasTexture {
  const S = 256;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const h = new Float32Array(S * S);
  srand(99);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // fine intersecting skin micro-furrows + subtle pores
      const u = (x / S) * Math.PI * 2;
      const v = (y / S) * Math.PI * 2;
      const line1 = Math.sin(u * 14 + v * 9 + Math.sin(v * 5) * 0.8);
      const line2 = Math.sin(u * 11 - v * 13 + Math.cos(u * 4) * 0.7);
      const pore = rand() < 0.04 ? -0.9 : (rand() - 0.5) * 0.35;
      h[y * S + x] = (line1 + line2) * 0.25 + pore;
    }
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S, xp = (x + 1) % S;
      const ym = (y - 1 + S) % S, yp = (y + 1) % S;
      const dx = (h[y * S + xm] - h[y * S + xp]) * 0.35;
      const dy = (h[ym * S + x] - h[yp * S + x]) * 0.35;
      const nz = 1.0;
      const len = Math.hypot(dx, dy, nz);
      const k = (y * S + x) * 4;
      img.data[k] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      img.data[k + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      img.data[k + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, [3, 3], false);
}

/** ambient-occlusion style texture: darker toward the edges (used on uv1 of walls / floors) */
export function edgeAO(strengthX = 0.5, strengthY = 0.5, widthX = 0.06, widthY = 0.08, top = true): THREE.CanvasTexture {
  const S = 64;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = 1 - (y + 0.5) / S;
      const dx = Math.min(u, 1 - u), dyB = v, dyT = 1 - v;
      let ao = 1;
      ao *= 1 - strengthX * Math.exp(-dx / widthX);
      ao *= 1 - strengthY * Math.exp(-dyB / widthY);
      if (top) ao *= 1 - strengthY * 0.6 * Math.exp(-dyT / (widthY * 0.8));
      const k = (y * S + x) * 4;
      const val = Math.round(ao * 255);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = val;
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = tex(c, undefined, false);
  t.channel = 1;
  return t;
}

/** soft round contact shadow */
export function blobShadow(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c, undefined, false);
}

const blockPalette = ['#d88278', '#7ba4c7', '#84ad8c', '#dfb669', '#a593c2', '#d99e73'];
const letterCols = ['#8e352e', '#2d5580', '#2c6b42', '#8f5d10', '#543f85', '#8c471b'];

/** natural beechwood letter block face texture */
export function blockFace(letter: string, idx: number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#efe0c6';
  g.fillRect(0, 0, 128, 128);
  // subtle wood grain lines
  g.strokeStyle = 'rgba(130,90,50,0.08)';
  g.lineWidth = 2;
  for (let y = 8; y < 128; y += 14) {
    g.beginPath();
    g.moveTo(0, y);
    g.quadraticCurveTo(64, y + 3, 128, y);
    g.stroke();
  }
  g.fillStyle = blockPalette[idx % blockPalette.length];
  g.fillRect(0, 0, 128, 12);
  g.fillRect(0, 116, 128, 12);
  g.fillRect(0, 0, 12, 128);
  g.fillRect(116, 0, 12, 128);
  g.fillStyle = letterCols[idx % letterCols.length];
  g.font = /[\u4e00-\u9fff]/.test(letter) ? '76px WenKai, "PingFang SC", sans-serif' : 'bold 80px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 68);
  return tex(c);
}

/** Realistic natural afternoon sky gradient for window backdrop */
export function skyGradient(): THREE.CanvasTexture {
  const [c, g] = canvas(16, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5a8cc4');
  gr.addColorStop(0.35, '#8ab4dc');
  gr.addColorStop(0.68, '#cadcee');
  gr.addColorStop(0.88, '#ebe6da');
  gr.addColorStop(1, '#f5ecda');
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 256);
  return tex(c);
}

/** friendly parent face decal (transparent background) */
export function parentFace(blink = false): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(225,115,105,0.28)';
  g.beginPath();
  g.ellipse(70, 160, 24, 15, 0, 0, Math.PI * 2);
  g.ellipse(186, 160, 24, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#4a2f25';
  g.fillStyle = '#4a2f25';
  g.lineCap = 'round';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(62, 92);
  g.quadraticCurveTo(82, 82, 102, 90);
  g.moveTo(154, 90);
  g.quadraticCurveTo(174, 82, 194, 92);
  g.stroke();
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
  g.fillStyle = '#dec096';
  g.fillRect(0, 0, 512, 160);
  const letters = ['T', 'O', 'Y', 'S'];
  const cols = ['#b85046', '#c98e2c', '#4a8552', '#5b5696'];
  g.font = 'bold 116px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  letters.forEach((l, i) => {
    g.fillStyle = 'rgba(70,40,20,0.22)';
    g.fillText(l, 70 + i * 124 + 3, 86);
    g.fillStyle = cols[i];
    g.fillText(l, 70 + i * 124, 83);
  });
  return tex(c);
}

/** Richer atmospheric landscape / botanical oil painting for wall frames */
export function painting(variant = 0): THREE.CanvasTexture {
  const [c, g] = canvas(512, 384);
  const gr = g.createLinearGradient(0, 0, 0, 384);
  gr.addColorStop(0, variant ? '#e4bfa9' : '#9ebcd4');
  gr.addColorStop(0.55, variant ? '#f2decb' : '#dce6ec');
  gr.addColorStop(1, '#f4ede2');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 384);
  // soft sun glow
  const sg = g.createRadialGradient(380, 105, 8, 380, 105, 95);
  sg.addColorStop(0, 'rgba(255,246,214,0.95)');
  sg.addColorStop(0.35, 'rgba(255,226,178,0.45)');
  sg.addColorStop(1, 'rgba(255,226,178,0)');
  g.fillStyle = sg;
  g.fillRect(260, 0, 252, 240);
  // distant hills
  g.fillStyle = variant ? '#b59283' : '#859fa0';
  g.beginPath();
  g.moveTo(0, 270);
  g.quadraticCurveTo(140, 175, 290, 250);
  g.quadraticCurveTo(400, 195, 512, 240);
  g.lineTo(512, 384);
  g.lineTo(0, 384);
  g.fill();
  // midground meadow
  g.fillStyle = variant ? '#8a9976' : '#65856c';
  g.beginPath();
  g.moveTo(0, 325);
  g.quadraticCurveTo(220, 255, 512, 315);
  g.lineTo(512, 384);
  g.lineTo(0, 384);
  g.fill();
  // canvas weave texture
  srand(variant + 31);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,40,30,0.04)';
    g.fillRect(rand() * 512, rand() * 384, 3, 2);
  }
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
  g.fillStyle = '#e56f88';
  g.beginPath();
  g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10);
  g.bezierCurveTo(28, 10, 32, 16, 32, 20);
  g.bezierCurveTo(32, 16, 36, 10, 42, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 54);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(22, 22, 6, 4, -0.6, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}

/** Realistic woven linen curtain with subtle slubs and soft pleats */
export function curtainTex(color: string, pattern: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 512);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 512);
  srand(21);
  // fine linen weave
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(90,70,55,0.05)';
    if (i % 2 === 0) g.fillRect(rand() * 256, rand() * 512, 10 + rand() * 14, 1);
    else g.fillRect(rand() * 256, rand() * 512, 1, 10 + rand() * 18);
  }
  g.fillStyle = pattern;
  for (let i = 0; i < 8; i++) drawStar(g, rand() * 256, rand() * 512, 3 + rand() * 2, rand());
  for (let x = 0; x < 256; x += 24) {
    g.fillStyle = 'rgba(40,30,20,0.05)';
    g.fillRect(x, 0, 9, 512);
  }
  return tex(c);
}

/** vertical alpha ramp used for sun beams */
export function beamTex(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,235,205,0.0)');
  gr.addColorStop(0.14, 'rgba(255,235,205,0.48)');
  gr.addColorStop(1, 'rgba(255,235,205,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 128);
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)');
  gx.addColorStop(0.22, 'rgba(0,0,0,0)');
  gx.addColorStop(0.78, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 128);
  return tex(c);
}

/** fallback baby face texture (real 3D mirror now reflects the actual 3D baby head!) */
export function babyFace(expr: 'neutral' | 'laugh' | 'cry'): THREE.CanvasTexture {
  const [c, g] = canvas(256, 320);
  g.clearRect(0, 0, 256, 320);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = '#eceae4';
  g.beginPath();
  g.ellipse(128, 330, 120, 80, 0, Math.PI, 0);
  g.fill();
  const grad = g.createRadialGradient(110, 130, 20, 128, 160, 110);
  grad.addColorStop(0, '#fbdcc6');
  grad.addColorStop(1, '#efbfa2');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(128, 160, 96, 102, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3e2c22';
  g.strokeStyle = '#3e2c22';
  g.lineWidth = 6;
  if (expr === 'neutral') {
    g.beginPath();
    g.ellipse(90, 160, 10, 12, 0, 0, Math.PI * 2);
    g.ellipse(166, 160, 10, 12, 0, 0, Math.PI * 2);
    g.fill();
  } else if (expr === 'laugh') {
    g.beginPath();
    g.moveTo(74, 164);
    g.quadraticCurveTo(90, 146, 106, 164);
    g.moveTo(150, 164);
    g.quadraticCurveTo(166, 146, 182, 164);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(74, 156);
    g.quadraticCurveTo(90, 168, 106, 156);
    g.moveTo(150, 156);
    g.quadraticCurveTo(166, 168, 182, 156);
    g.stroke();
  }
  return tex(c);
}

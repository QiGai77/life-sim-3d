import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Builder, C, Mat, extrude, moonShape, starShape, rand, srand } from './lowpoly';
import * as T from './textures';

/* Shared primitive factories – v2 uses enough segments for smooth, believable shapes */
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const rbox = (w: number, h: number, d: number, r = 0.04, seg = 2) => new RoundedBoxGeometry(w, h, d, Math.max(3, seg + 1), r);
const ico = (r: number, _detail = 1) => new THREE.IcosahedronGeometry(r, r < 0.035 ? 2 : 3);
const cyl = (rt: number, rb: number, h: number, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, Math.max(16, seg * 2));
const cap = (r: number, len: number, seg = 6) => new THREE.CapsuleGeometry(r, len, 4, Math.max(12, seg * 2));

/* ================= NURSERY ================= */

export const CRIB = { W: 0.78, L: 1.32, rail: 0.92, mattress: 0.47 };

export function crib(): THREE.Mesh {
  const b = new Builder();
  const { W, L, rail } = CRIB;
  const wood = C.woodLight;
  const j = 0.004;
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.065, rail + 0.1, 0.065), wood, { pos: [(sx * W) / 2, (rail + 0.1) / 2, (sz * L) / 2], jitter: j });
    b.add(ico(0.045, 0), wood, { pos: [(sx * W) / 2, rail + 0.12, (sz * L) / 2], scale: [1, 0.7, 1] });
  }
  // long rails (along z)
  for (const sx of [-1, 1]) {
    b.add(box(0.075, 0.06, L), wood, { pos: [(sx * W) / 2, rail, 0], jitter: j });
    b.add(box(0.05, 0.05, L), C.wood, { pos: [(sx * W) / 2, 0.36, 0], jitter: j });
    const n = 12;
    for (let i = 1; i < n; i++) {
      const z = -L / 2 + (i * L) / n;
      b.add(box(0.032, rail - 0.38, 0.032), wood, { pos: [(sx * W) / 2, 0.36 + (rail - 0.36) / 2, z], jitter: 0.003, seed: i });
    }
  }
  // end panels (along x) – head & foot
  for (const sz of [-1, 1]) {
    b.add(box(W, 0.075, 0.07), wood, { pos: [0, rail + 0.04, (sz * L) / 2], jitter: j });
    b.add(box(W, 0.05, 0.05), C.wood, { pos: [0, 0.36, (sz * L) / 2], jitter: j });
    const n = 7;
    for (let i = 1; i < n; i++) {
      const x = -W / 2 + (i * W) / n;
      b.add(box(0.032, rail - 0.38, 0.032), wood, { pos: [x, 0.36 + (rail - 0.36) / 2, (sz * L) / 2], jitter: 0.003, seed: i + 30 });
    }
  }
  // base board + mattress + sheets
  b.add(box(W - 0.04, 0.05, L - 0.04), C.wood, { pos: [0, 0.37, 0] });
  b.add(rbox(W - 0.08, 0.1, L - 0.08, 0.035), '#eef0f8', { pos: [0, 0.43, 0], variation: 0.04, surf: 'fabric' });
  // pillow at head (-z)
  b.add(rbox(0.36, 0.06, 0.2, 0.03), '#e9e2f2', { pos: [-0.12, 0.5, -L / 2 + 0.2], rot: [0, 0.1, 0.06], surf: 'fabric' });
  // folded blanket (yellow, like concept-01)
  b.add(rbox(W - 0.12, 0.05, 0.42, 0.025), '#f4dc95', { pos: [0, 0.495, L / 2 - 0.3], rot: [0, 0, 0.03], jitter: 0.006, surf: 'fabric' });
  return b.mesh();
}

export function mobileArm(): THREE.Mesh {
  // pole rising from the back rail and curving over the crib
  const b = new Builder();
  b.add(cyl(0.018, 0.022, 0.85, 6), C.woodLight, { pos: [0, 0.425, 0] });
  b.add(cyl(0.016, 0.016, 0.58, 6), C.woodLight, { pos: [0.27, 0.835, 0], rot: [0, 0, Math.PI / 2 - 0.1] });
  b.add(ico(0.03, 0), C.peach, { pos: [0, 0.86, 0] });
  b.add(ico(0.026, 0), C.mint, { pos: [0.56, 0.8, 0] });
  b.add(cyl(0.004, 0.004, 0.07, 4), '#f5efe5', { pos: [0.56, 0.76, 0] });
  return b.mesh();
}

export interface MobileParts {
  hub: THREE.Group;
  ornaments: THREE.Group[];
}

/** hub that rotates: cross arms with hanging stars / moons */
export function mobileHub(): MobileParts {
  const hub = new THREE.Group();
  const b = new Builder();
  b.add(ico(0.03, 0), C.mint, {});
  for (let i = 0; i < 2; i++) b.add(cyl(0.008, 0.008, 0.46, 5), C.woodLight, { rot: [0, (i * Math.PI) / 2, Math.PI / 2] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.add(ico(0.016, 0), [C.peach, C.sky, C.yellow, C.mint][i], { pos: [Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23] });
  }
  const arms = b.mesh();
  hub.add(arms);

  const ornaments: THREE.Group[] = [];
  const specs: { kind: 'star' | 'moon'; col: string; a: number; r: number; len: number }[] = [
    { kind: 'star', col: '#8fb7e6', a: 0, r: 0.23, len: 0.16 },
    { kind: 'moon', col: '#f5d98b', a: Math.PI / 2, r: 0.23, len: 0.22 },
    { kind: 'star', col: '#f4b38f', a: Math.PI, r: 0.23, len: 0.27 },
    { kind: 'star', col: '#f6dc84', a: (Math.PI * 3) / 2, r: 0.23, len: 0.2 },
    { kind: 'moon', col: '#a7dcc7', a: Math.PI / 4, r: 0.0, len: 0.33 },
  ];
  specs.forEach((s, i) => {
    const holder = new THREE.Group();
    holder.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, s.len, 4), new THREE.MeshBasicMaterial({ color: '#fbf3e6' }));
    string.position.y = -s.len / 2;
    string.userData.noOutline = true;
    holder.add(string);
    const orn = new THREE.Group();
    const ob = new Builder();
    if (s.kind === 'star') ob.add(extrude(starShape(0.07, 0.032), 0.022, 0.01), s.col, { variation: 0.12 });
    else ob.add(extrude(moonShape(0.065), 0.026, 0.01), s.col, { variation: 0.12, rot: [0, 0, -0.3] });
    const m = ob.mesh(Mat.vcPastel);
    orn.add(m);
    orn.position.y = -s.len - 0.06;
    orn.userData.kind = s.kind;
    orn.userData.spin = 0.4 + i * 0.13;
    holder.add(orn);
    hub.add(holder);
    ornaments.push(orn);
  });
  return { hub, ornaments };
}

export function nightstand(): THREE.Mesh {
  const b = new Builder();
  const w = 0.5, h = 0.52, d = 0.4;
  b.add(rbox(w, h - 0.06, d, 0.02), C.woodLight, { pos: [0, 0.06 + (h - 0.06) / 2, 0], jitter: 0.004 });
  b.add(rbox(w + 0.03, 0.035, d + 0.03, 0.012), C.wood, { pos: [0, h + 0.012, 0] });
  for (let i = 0; i < 2; i++) {
    const y = 0.17 + i * 0.19;
    b.add(rbox(w - 0.07, 0.16, 0.03, 0.012), '#e6c49c', { pos: [0, y, d / 2 + 0.005] });
    b.add(ico(0.017, 0), C.woodDark, { pos: [0, y, d / 2 + 0.03] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(cyl(0.018, 0.012, 0.08, 5), C.woodDark, { pos: [sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05)], rot: [sz * 0.15, 0, -sx * 0.15] });
  return b.mesh();
}

export function pillLamp(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.07, 0.075, 0.035, 9), '#6d5a52', { pos: [0, 0.018, 0] });
  g.add(b.mesh());
  const shade = new Builder();
  shade.add(new THREE.CapsuleGeometry(0.062, 0.08, 3, 9), '#fff1c9', { pos: [0, 0.1, 0], variation: 0.03 });
  const sm = shade.mesh(Mat.vcGlow, false, false);
  g.add(sm);
  return g;
}

export function teddy(): THREE.Mesh {
  const b = new Builder('fur');
  const fur = C.bear, light = C.bearLight, dark = '#3b2a22';
  const j = 0.006;
  b.add(ico(0.11, 1), fur, { pos: [0, 0.13, 0], scale: [1, 1.12, 0.9], jitter: j });
  b.add(ico(0.072, 1), light, { pos: [0, 0.12, 0.07], scale: [1, 1.1, 0.5] });
  b.add(ico(0.096, 1), fur, { pos: [0, 0.32, 0.005], jitter: j, seed: 2 });
  for (const s of [-1, 1]) {
    b.add(ico(0.04, 1), fur, { pos: [s * 0.072, 0.4, -0.005], scale: [1, 1, 0.6] });
    b.add(ico(0.024, 0), light, { pos: [s * 0.072, 0.398, 0.012], scale: [1, 1, 0.4] });
    b.add(cap(0.034, 0.08), fur, { pos: [s * 0.115, 0.16, 0.03], rot: [0.5, 0, s * 0.75], jitter: 0.004 });
    b.add(cap(0.042, 0.06), fur, { pos: [s * 0.06, 0.045, 0.085], rot: [Math.PI / 2 - 0.2, 0, s * 0.15], jitter: 0.004 });
    b.add(ico(0.028, 0), light, { pos: [s * 0.062, 0.04, 0.15], scale: [1, 1, 0.4] });
    b.add(ico(0.015, 1), dark, { pos: [s * 0.042, 0.343, 0.085], scale: [1, 1.1, 0.7] , surf: 'plastic' });
  }
  b.add(ico(0.047, 1), light, { pos: [0, 0.3, 0.075], scale: [1, 0.78, 0.75] });
  b.add(ico(0.016, 0), dark, { pos: [0, 0.312, 0.11], scale: [1.2, 0.8, 1] , surf: 'plastic' });
  return b.mesh(Mat.vcSoft);
}

export function bunnyPlush(): THREE.Mesh {
  const b = new Builder('fur');
  const col = '#c9d6ef';
  b.add(ico(0.07, 1), col, { pos: [0, 0.07, 0], scale: [1, 1.1, 0.9] });
  b.add(ico(0.06, 1), col, { pos: [0, 0.18, 0] });
  for (const s of [-1, 1]) {
    b.add(cap(0.018, 0.08), col, { pos: [s * 0.025, 0.27, 0], rot: [0, 0, s * 0.2] });
    b.add(ico(0.008, 0), '#3b2a22', { pos: [s * 0.022, 0.19, 0.055] , surf: 'plastic' });
  }
  b.add(ico(0.008, 0), '#e58b95', { pos: [0, 0.175, 0.06] });
  return b.mesh(Mat.vcSoft);
}

export function dresser(color = '#efe6dc'): THREE.Mesh {
  const b = new Builder();
  const w = 0.95, h = 0.78, d = 0.45;
  b.add(rbox(w, h - 0.08, d, 0.02), color, { pos: [0, 0.08 + (h - 0.08) / 2, 0], jitter: 0.004 });
  b.add(rbox(w + 0.04, 0.035, d + 0.03, 0.012), C.woodLight, { pos: [0, h + 0.01, 0] });
  for (let i = 0; i < 3; i++) {
    const y = 0.2 + i * 0.21;
    b.add(rbox(w - 0.08, 0.18, 0.03, 0.012), '#f6efe7', { pos: [0, y, d / 2 + 0.005] });
    for (const s of [-1, 1]) b.add(ico(0.018, 0), C.woodLight, { pos: [s * 0.22, y, d / 2 + 0.03] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(cyl(0.02, 0.014, 0.09, 5), C.woodLight, { pos: [sx * (w / 2 - 0.05), 0.045, sz * (d / 2 - 0.05)] });
  return b.mesh();
}

export function wallShelf(w = 0.8): THREE.Mesh {
  const b = new Builder();
  b.add(box(w, 0.03, 0.2), C.woodLight, { pos: [0, 0, 0.1], jitter: 0.003 });
  for (const s of [-1, 1]) b.add(box(0.03, 0.12, 0.14), C.wood, { pos: [s * (w / 2 - 0.1), -0.07, 0.07], rot: [0, 0, 0] });
  return b.mesh();
}

export function beanbag(color = '#9fae8f'): THREE.Mesh {
  const b = new Builder();
  b.add(ico(0.42, 1), color, { pos: [0, 0.22, 0], scale: [1, 0.58, 0.95], jitter: 0.03, variation: 0.08 });
  b.add(ico(0.28, 1), color, { pos: [-0.12, 0.42, -0.1], scale: [1, 0.6, 0.9], jitter: 0.02, seed: 3 });
  return b.mesh(Mat.vcSoft);
}

export function basket(): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.2, 0.17, 0.26, 8), '#c8a77a', { pos: [0, 0.13, 0], jitter: 0.004 });
  b.add(cyl(0.21, 0.21, 0.03, 8), '#b08c5f', { pos: [0, 0.26, 0] });
  b.add(ico(0.1, 1), '#e9b7c3', { pos: [0.05, 0.3, 0], scale: [1, 0.7, 1] });
  b.add(ico(0.08, 1), '#bcd7ee', { pos: [-0.08, 0.31, 0.04], scale: [1, 0.7, 1] });
  return b.mesh();
}

/* ================= LIVING ROOM ================= */

export function sofa(color = C.peach): THREE.Mesh {
  const b = new Builder();
  const W = 2.0, D = 0.9;
  const j = 0.008;
  b.add(rbox(W, 0.28, D, 0.06), color, { pos: [0, 0.24, 0], jitter: j });
  // back
  b.add(rbox(W, 0.55, 0.24, 0.08), color, { pos: [0, 0.55, -D / 2 + 0.12], jitter: j, seed: 1 });
  // arms
  for (const s of [-1, 1]) b.add(rbox(0.24, 0.5, D, 0.09), color, { pos: [s * (W / 2 - 0.1), 0.4, 0], jitter: j, seed: 2 });
  // seat cushions
  for (const s of [-1, 1]) b.add(rbox(0.76, 0.16, 0.66, 0.06), '#f5b799', { pos: [s * 0.39, 0.45, 0.08], jitter: j, seed: 3 });
  // throw pillows
  b.add(rbox(0.42, 0.38, 0.13, 0.06), '#f4e5cc', { pos: [-0.52, 0.66, -0.2], rot: [-0.25, 0.15, 0.05], jitter: 0.01 });
  b.add(rbox(0.42, 0.38, 0.13, 0.06), '#a9c7ad', { pos: [-0.1, 0.66, -0.22], rot: [-0.25, -0.05, -0.04], jitter: 0.01 });
  b.add(rbox(0.38, 0.34, 0.12, 0.06), '#f2d6bd', { pos: [0.6, 0.65, -0.2], rot: [-0.25, -0.2, 0.06], jitter: 0.01 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(cyl(0.035, 0.025, 0.1, 6), C.woodDark, { pos: [sx * (W / 2 - 0.1), 0.05, sz * (D / 2 - 0.1)] });
  return b.mesh(Mat.vcSoft);
}

export function armchair(color = '#a9bb98'): THREE.Mesh {
  const b = new Builder();
  const W = 1.0, D = 0.9;
  const j = 0.008;
  b.add(rbox(W, 0.3, D, 0.06), color, { pos: [0, 0.26, 0], jitter: j });
  b.add(rbox(W - 0.1, 0.62, 0.24, 0.1), color, { pos: [0, 0.62, -D / 2 + 0.12], jitter: j });
  for (const s of [-1, 1]) b.add(rbox(0.22, 0.52, D, 0.1), color, { pos: [s * (W / 2 - 0.09), 0.44, 0], jitter: j });
  b.add(rbox(0.6, 0.15, 0.66, 0.06), '#b6c7a5', { pos: [0, 0.47, 0.08], jitter: j });
  b.add(rbox(0.44, 0.36, 0.13, 0.06), C.peach, { pos: [0, 0.7, -0.2], rot: [-0.3, 0.1, 0.05], jitter: 0.01 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(cyl(0.04, 0.028, 0.11, 6), C.wood, { pos: [sx * (W / 2 - 0.1), 0.055, sz * (D / 2 - 0.1)] });
  return b.mesh(Mat.vcSoft);
}

export function coffeeTable(): THREE.Mesh {
  const b = new Builder();
  const W = 1.15, D = 0.62, H = 0.46;
  b.add(rbox(W, 0.06, D, 0.02), C.wood, { pos: [0, H, 0], jitter: 0.004 });
  b.add(box(W - 0.1, 0.07, D - 0.1), C.woodDark, { pos: [0, H - 0.06, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(box(0.06, H - 0.03, 0.06), C.wood, { pos: [sx * (W / 2 - 0.07), (H - 0.03) / 2, sz * (D / 2 - 0.07)], jitter: 0.003 });
  // mug + books
  b.add(cyl(0.045, 0.04, 0.1, 8), '#e8e3dc', { pos: [0.3, H + 0.08, 0.05], surf: 'ceramic' });
  b.add(new THREE.TorusGeometry(0.025, 0.008, 8, 14), '#e8e3dc', { pos: [0.35, H + 0.08, 0.05], surf: 'ceramic' });
  b.add(box(0.28, 0.04, 0.2), '#7f9ac9', { pos: [-0.25, H + 0.05, -0.05], rot: [0, 0.2, 0] });
  b.add(box(0.25, 0.035, 0.18), '#e8c7a0', { pos: [-0.25, H + 0.088, -0.05], rot: [0, 0.05, 0] });
  return b.mesh();
}

export function toyBox(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  const W = 0.72, H = 0.48, D = 0.46;
  b.add(rbox(W, H, D, 0.02), '#e2c196', { pos: [0, H / 2, 0], jitter: 0.004 });
  b.add(rbox(W + 0.04, 0.05, D + 0.04, 0.015), '#6fb3b0', { pos: [0, H + 0.01, 0] });
  // toys peeking out
  b.add(box(0.12, 0.12, 0.12), '#e35d5b', { pos: [-0.18, H + 0.08, 0], rot: [0.2, 0.4, 0.1] });
  b.add(ico(0.07, 1), '#f2c14e', { pos: [0.05, H + 0.07, 0.04] });
  b.add(new THREE.ConeGeometry(0.07, 0.14, 4), '#6bb08a', { pos: [0.2, H + 0.08, -0.04], rot: [0.3, 0, 0.2] });
  g.add(b.mesh());
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.08, (W - 0.08) * 0.31),
    new THREE.MeshStandardMaterial({ map: T.toysLabel(), roughness: 0.9 }),
  );
  label.position.set(0, H * 0.55, D / 2 + 0.002);
  label.receiveShadow = true;
  g.add(label);
  return g;
}

export function ball(radius = 0.11): THREE.Mesh {
  const b = new Builder('plastic');
  const cols = [new THREE.Color('#e6514f'), new THREE.Color('#f5c64a'), new THREE.Color('#3f74cf'), new THREE.Color('#f5c64a')];
  b.add(ico(radius, 1), '#fff', {
    variation: 0.05,
    colorFn: (p) => {
      const a = Math.atan2(p.z, p.x) + Math.PI;
      if (Math.abs(p.y) > radius * 0.82) return new THREE.Color('#f7f1e6');
      return cols[Math.floor((a / (Math.PI * 2)) * 4) % 4];
    },
  });
  return b.mesh();
}

export function letterBlock(letter: string, idx: number, size = 0.1): THREE.Mesh {
  const geo = new RoundedBoxGeometry(size, size, size, 3, size * 0.1);
  const mats: THREE.Material[] = [];
  const letters = [letter, letter, String(idx + 1), String(idx + 1), letter, letter];
  for (let i = 0; i < 6; i++) mats.push(new THREE.MeshStandardMaterial({ map: T.blockFace(letters[i], idx), roughness: 0.55 }));
  const m = new THREE.Mesh(geo, mats);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface DogParts {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  tail: THREE.Group;
  faceMat: THREE.MeshBasicMaterial;
}

export function dog(): DogParts {
  const root = new THREE.Group();
  const coat = C.dog, light = C.dogLight;
  const b = new Builder('fur');
  const j = 0.012;
  b.add(ico(0.22, 1), coat, { pos: [0, 0.15, 0], scale: [1.55, 0.72, 0.95], jitter: j });
  b.add(ico(0.16, 1), light, { pos: [0.24, 0.15, 0.04], scale: [1, 0.85, 1], jitter: j, seed: 2 });
  // hind leg tucked
  b.add(ico(0.12, 1), coat, { pos: [-0.2, 0.1, 0.13], scale: [1.2, 0.7, 0.7], jitter: j, seed: 3 });
  // front paws stretched forward
  for (const s of [-1, 1]) {
    b.add(cap(0.045, 0.2), light, { pos: [0.42, 0.045, s * 0.08], rot: [0, 0, Math.PI / 2], jitter: 0.005 });
    b.add(ico(0.05, 0), light, { pos: [0.55, 0.04, s * 0.08], scale: [1.2, 0.7, 1] });
  }
  const body = b.mesh(Mat.vcSoft);
  root.add(body);

  const head = new THREE.Group();
  head.position.set(0.42, 0.13, 0);
  const hb = new Builder('fur');
  hb.add(ico(0.12, 1), coat, { pos: [0.02, 0.04, 0], scale: [1, 0.9, 0.95], jitter: 0.008 });
  hb.add(ico(0.07, 1), light, { pos: [0.13, 0.0, 0], scale: [1.2, 0.75, 0.85], jitter: 0.005 });
  hb.add(ico(0.025, 0), '#3a2418', { pos: [0.21, 0.02, 0], scale: [1, 0.8, 1.2] , surf: 'plastic' });
  for (const s of [-1, 1]) hb.add(ico(0.07, 1), '#d39c58', { pos: [-0.02, 0.0, s * 0.11], scale: [0.7, 1.3, 0.35], rot: [s * 0.3, 0, 0.2], jitter: 0.006 });
  const hm = hb.mesh(Mat.vcSoft);
  head.add(hm);
  const faceMat = new THREE.MeshBasicMaterial({ map: T.dogFace(false), transparent: true, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), faceMat);
  face.position.set(0.122, 0.07, 0);
  face.rotation.y = Math.PI / 2;
  face.userData.noOutline = true;
  head.add(face);
  head.rotation.z = -0.25; // resting
  root.add(head);

  const tail = new THREE.Group();
  tail.position.set(-0.32, 0.12, 0);
  const tb = new Builder('fur');
  tb.add(cap(0.035, 0.22), light, { pos: [-0.12, 0, 0], rot: [0, 0, Math.PI / 2], jitter: 0.004 });
  tail.add(tb.mesh(Mat.vcSoft));
  tail.rotation.y = 0.6;
  root.add(tail);
  return { root, body, head, tail, faceMat };
}

export function plant(scale = 1, potColor = C.pot): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.13, 0.1, 0.24, 8), potColor, { pos: [0, 0.12, 0], jitter: 0.003 });
  b.add(cyl(0.12, 0.12, 0.02, 8), '#6b4a36', { pos: [0, 0.235, 0] });
  srand(Math.floor(scale * 100));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const tilt = 0.35 + rand() * 0.5;
    const len = 0.3 + rand() * 0.18;
    b.add(new THREE.SphereGeometry(0.05, 10, 8), i % 2 ? C.leaf : C.leafDark, {
      pos: [Math.cos(a) * 0.06, 0.24 + len / 2 - 0.02, Math.sin(a) * 0.06],
      rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt],
      scale: [1, len / 0.1, 0.32],
      variation: 0.12,
    });
  }
  const m = b.mesh();
  m.scale.setScalar(scale);
  return m;
}

export function floorLamp(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.14, 0.16, 0.03, 8), C.woodDark, { pos: [0, 0.015, 0] });
  b.add(cyl(0.016, 0.016, 1.35, 6), C.woodDark, { pos: [0, 0.69, 0] });
  g.add(b.mesh());
  const s = new Builder();
  s.add(cyl(0.16, 0.24, 0.3, 9), '#ffe7c2', { pos: [0, 1.45, 0], variation: 0.04 });
  const shade = s.mesh(Mat.vcGlow, false, false);
  g.add(shade);
  return g;
}

export function bookshelf(): THREE.Mesh {
  const b = new Builder();
  const W = 0.9, H = 1.7, D = 0.32;
  b.add(box(0.04, H, D), C.wood, { pos: [-W / 2, H / 2, 0] });
  b.add(box(0.04, H, D), C.wood, { pos: [W / 2, H / 2, 0] });
  b.add(box(W, H, 0.02), C.woodDark, { pos: [0, H / 2, -D / 2] });
  srand(42);
  const bookCols = ['#e58b7a', '#7f9ac9', '#f2d07e', '#9cc3a6', '#c8a2d4', '#f0b48f', '#6f8fb8'];
  for (let i = 0; i < 5; i++) {
    const y = 0.04 + i * 0.4;
    b.add(box(W, 0.03, D), C.wood, { pos: [0, y, 0] });
    if (i === 4) continue;
    let x = -W / 2 + 0.05;
    while (x < W / 2 - 0.12) {
      const bw = 0.03 + rand() * 0.04, bh = 0.2 + rand() * 0.12;
      if (rand() < 0.12) {
        x += 0.1;
        continue;
      }
      b.add(box(bw, bh, D * 0.75), bookCols[Math.floor(rand() * bookCols.length)], { pos: [x + bw / 2, y + 0.015 + bh / 2, 0.02], rot: [0, 0, rand() < 0.1 ? 0.2 : 0] });
      x += bw + 0.004;
    }
  }
  return b.mesh();
}

export function sideboard(color = C.mint): THREE.Mesh {
  const b = new Builder();
  const W = 1.4, H = 0.82, D = 0.42;
  b.add(rbox(W, H - 0.1, D, 0.02), color, { pos: [0, 0.1 + (H - 0.1) / 2, 0], jitter: 0.004 });
  b.add(rbox(W + 0.04, 0.04, D + 0.03, 0.012), C.woodLight, { pos: [0, H + 0.01, 0] });
  for (let i = 0; i < 3; i++) {
    const x = -W / 3 + (i * W) / 3;
    b.add(rbox(W / 3 - 0.05, H - 0.2, 0.03, 0.015), '#b9dfcb', { pos: [x, 0.1 + (H - 0.1) / 2, D / 2 + 0.005] });
    b.add(ico(0.02, 0), '#d8b27a', { pos: [x + 0.15, 0.5, D / 2 + 0.03] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    b.add(cyl(0.022, 0.015, 0.1, 5), C.woodLight, { pos: [sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06)] });
  // vase + jar on top
  b.add(cyl(0.06, 0.08, 0.2, 7), '#f2ece2', { pos: [0.45, H + 0.11, 0], surf: 'ceramic' });
  b.add(ico(0.06, 1), '#efb3b8', { pos: [0.45, H + 0.26, 0], jitter: 0.008 });
  b.add(cyl(0.07, 0.07, 0.14, 7), '#f3d3a6', { pos: [-0.4, H + 0.08, 0.02] });
  return b.mesh();
}

export function sideTable(): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.3, 0.3, 0.04, 10), C.wood, { pos: [0, 0.6, 0], jitter: 0.004 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(box(0.04, 0.6, 0.04), C.wood, { pos: [Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18], rot: [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12] });
  }
  return b.mesh();
}

/* ================= WINDOW & OUTSIDE ================= */

export function windowFrame(w: number, h: number, depth = 0.16, color = '#f6efe6'): THREE.Mesh {
  const b = new Builder();
  const t = 0.06;
  b.add(box(w + t * 2, t, depth), color, { pos: [0, h / 2 + t / 2, 0] });
  b.add(box(w + t * 2 + 0.1, 0.05, depth + 0.12), color, { pos: [0, -h / 2 - 0.025, 0.04] }); // sill
  for (const s of [-1, 1]) b.add(box(t, h, depth), color, { pos: [s * (w / 2 + t / 2), 0, 0] });
  b.add(box(0.035, h, 0.04), color, { pos: [0, 0, 0] });
  b.add(box(w, 0.035, 0.04), color, { pos: [0, h * 0.18, 0] });
  return b.mesh();
}

export function curtain(w: number, h: number, color: string, pattern: string, opacity = 0.85): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 40, 4);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / w) * Math.PI * 5) * 0.04);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: T.curtainTex(color, pattern),
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    roughness: 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function tree(height = 3, seed = 1, col = C.leafDark): THREE.Mesh {
  const b = new Builder();
  srand(seed);
  b.add(cyl(0.08, 0.12, height * 0.45, 5), '#6e4b3a', { pos: [0, height * 0.22, 0] });
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const r = height * (0.22 + rand() * 0.1);
    b.add(new THREE.IcosahedronGeometry(r, 2), i % 2 ? col : '#5f8f74', {
      pos: [(rand() - 0.5) * height * 0.3, height * (0.5 + i * 0.13), (rand() - 0.5) * height * 0.3],
      jitter: r * 0.5,
      variation: 0.15,
      seed: seed * 10 + i,
    });
  }
  return b.mesh();
}

export function pineTree(height = 3, seed = 1): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.06, 0.09, height * 0.3, 5), '#6e4b3a', { pos: [0, height * 0.15, 0] });
  for (let i = 0; i < 3; i++) {
    const r = height * (0.3 - i * 0.07);
    b.add(new THREE.ConeGeometry(r, height * 0.4, 14), '#4f7a66', { pos: [0, height * (0.35 + i * 0.2), 0], jitter: r * 0.08, seed: seed + i, variation: 0.14 });
  }
  return b.mesh();
}

export function pictureFrame(w: number, h: number, variant: number): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  const t = 0.04;
  b.add(box(w + t * 2, t, 0.03), C.woodLight, { pos: [0, h / 2 + t / 2, 0] });
  b.add(box(w + t * 2, t, 0.03), C.woodLight, { pos: [0, -h / 2 - t / 2, 0] });
  for (const s of [-1, 1]) b.add(box(t, h, 0.03), C.woodLight, { pos: [s * (w / 2 + t / 2), 0, 0] });
  g.add(b.mesh());
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: T.painting(variant), roughness: 0.9 }));
  art.position.z = 0.005;
  g.add(art);
  return g;
}

export function babyBottle(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.032, 0.032, 0.12, 9), '#dfe6ef', { pos: [0, 0, 0], variation: 0.03, surf: 'ceramic' });
  b.add(cyl(0.036, 0.036, 0.025, 9), '#9fd0c0', { pos: [0, 0.07, 0] });
  b.add(new THREE.ConeGeometry(0.018, 0.045, 7), '#f2d0a4', { pos: [0, 0.1, 0] });
  g.add(b.mesh(Mat.vc, false, false));
  const milk = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#f1ebe0', roughness: 0.45 }));
  milk.position.y = -0.01;
  milk.name = 'milk';
  g.add(milk);
  return g;
}

/* ================= v2: easter-egg props ================= */

export function tissueBox(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.24, 0.1, 0.13, 0.015), '#bccbdb', { pos: [0, 0.05, 0] });
  b.add(rbox(0.14, 0.012, 0.05, 0.005), '#8fa3bb', { pos: [0, 0.101, 0] });
  // a few painted dots
  for (let i = 0; i < 5; i++) b.add(ico(0.008), '#f6efe4', { pos: [-0.09 + i * 0.045, 0.06, 0.066], scale: [1, 1, 0.3] });
  g.add(b.mesh());
  const tb = new Builder('fabric');
  tb.add(new THREE.SphereGeometry(0.04, 14, 10), '#ffffff', { pos: [0, 0.125, 0], scale: [1.1, 0.8, 0.45], rot: [0, 0, 0.3] });
  const tuft = tb.mesh(Mat.vcSoft);
  tuft.name = 'tuft';
  g.add(tuft);
  return g;
}

export function tissueSheet(): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(new THREE.IcosahedronGeometry(0.05, 2), '#fbfbfb', { scale: [1.2, 0.35, 1.0], jitter: 0.06, variation: 0.02 });
  return b.mesh(Mat.vcSoft);
}

export function remote(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(rbox(0.05, 0.022, 0.17, 0.01), '#5b5f6e', { pos: [0, 0.011, 0] });
  b.add(cyl(0.008, 0.008, 0.006, 8), '#e05a4f', { pos: [0, 0.024, -0.055] });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) b.add(cyl(0.006, 0.006, 0.005, 8), '#d9dce3', { pos: [-0.011 + c * 0.022, 0.024, -0.02 + r * 0.025] });
  g.add(b.mesh());
  return g;
}

export function tvSet(screen: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.86, 0.52, 0.06, 0.02), '#3b3d45', { pos: [0, 0.32, 0], surf: 'plastic' });
  b.add(cyl(0.02, 0.02, 0.06, 8), '#3b3d45', { pos: [0, 0.04, 0], surf: 'plastic' });
  b.add(rbox(0.28, 0.02, 0.14, 0.008), '#3b3d45', { pos: [0, 0.01, 0], surf: 'plastic' });
  g.add(b.mesh());
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.46),
    new THREE.MeshStandardMaterial({ map: screen, emissiveMap: screen, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, color: '#101114', roughness: 0.15, metalness: 0.1 }),
  );
  scr.position.set(0, 0.32, 0.031);
  scr.name = 'screen';
  g.add(scr);
  return g;
}

export function floorMirror(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  const w = 0.62, h = 0.86, t = 0.05;
  b.add(rbox(w + t * 2, t, 0.04, 0.012), C.woodLight, { pos: [0, h + t / 2, 0] });
  b.add(rbox(w + t * 2, t, 0.04, 0.012), C.woodLight, { pos: [0, t / 2, 0] });
  for (const s of [-1, 1]) b.add(rbox(t, h, 0.04, 0.012), C.woodLight, { pos: [s * (w / 2 + t / 2), t + h / 2 - t / 2, 0] });
  g.add(b.mesh());
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h - t), new THREE.MeshStandardMaterial({ color: '#dfe7ee', metalness: 1, roughness: 0.04, envMapIntensity: 1.2 }));
  glass.position.set(0, t + (h - t) / 2 - t / 2, 0.012);
  glass.name = 'glass';
  g.add(glass);
  return g;
}

export function musicBox(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.2, 0.11, 0.14, 0.012), '#e8a58c', { pos: [0, 0.055, 0] });
  b.add(rbox(0.21, 0.025, 0.15, 0.01), C.woodLight, { pos: [0, 0.12, 0] });
  b.add(cyl(0.008, 0.008, 0.05, 8), C.gold, { pos: [0.115, 0.06, 0], rot: [0, 0, Math.PI / 2], surf: 'ceramic' });
  b.add(rbox(0.012, 0.04, 0.012, 0.004), C.gold, { pos: [0.14, 0.075, 0], surf: 'ceramic' });
  g.add(b.mesh());
  const top = new THREE.Group();
  const tb = new Builder();
  tb.add(cyl(0.035, 0.035, 0.01, 16), '#f6efe4', { pos: [0, 0, 0] });
  tb.add(extrude(starShape(0.03, 0.013), 0.012, 0.004), C.yellow, { pos: [0, 0.04, 0], surf: 'plastic' });
  tb.add(cyl(0.003, 0.003, 0.03, 6), C.gold, { pos: [0, 0.02, 0] });
  top.add(tb.mesh());
  top.position.y = 0.138;
  top.name = 'spinner';
  g.add(top);
  return g;
}

export function rubberDuck(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(new THREE.SphereGeometry(0.045, 20, 14), '#f5cf4b', { pos: [0, 0.04, 0], scale: [1.25, 0.85, 1] });
  b.add(new THREE.SphereGeometry(0.03, 18, 12), '#f5cf4b', { pos: [0.035, 0.09, 0] });
  b.add(new THREE.SphereGeometry(0.014, 12, 8), '#e9824a', { pos: [0.064, 0.086, 0], scale: [1.4, 0.6, 1] });
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.0055, 8, 6), '#2a1d16', { pos: [0.052, 0.1, s * 0.017] });
  b.add(new THREE.SphereGeometry(0.02, 12, 8), '#f5cf4b', { pos: [-0.055, 0.06, 0], scale: [1, 0.6, 0.6], rot: [0, 0, 0.5] });
  g.add(b.mesh());
  return g;
}

export function rattle(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(new THREE.SphereGeometry(0.042, 20, 14), '#eab3a6', { pos: [0, 0.13, 0] });
  b.add(new THREE.TorusGeometry(0.044, 0.007, 8, 24), '#93a98a', { pos: [0, 0.13, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(cap(0.013, 0.085), '#dcae55', { pos: [0, 0.05, 0] });
  b.add(new THREE.SphereGeometry(0.02, 14, 10), '#bccbdb', { pos: [0, 0.0, 0] });
  g.add(b.mesh());
  return g;
}

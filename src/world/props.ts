import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Builder, C, Mat, extrude, moonShape, starShape, rand, srand } from './lowpoly';
import * as T from './textures';

/* Shared smooth primitive factories (v3 realistic proportions & high tessellation) */
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const rbox = (w: number, h: number, d: number, r = 0.04, seg = 3) => new RoundedBoxGeometry(w, h, d, Math.max(4, seg + 1), r);
const sph = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cap = (r: number, len: number, seg = 16) => new THREE.CapsuleGeometry(r, len, 6, seg);

/* ================= NURSERY ================= */

export const CRIB = { W: 0.78, L: 1.32, rail: 0.92, mattress: 0.47 };

export function crib(): THREE.Mesh {
  const b = new Builder();
  const { W, L, rail } = CRIB;
  const wood = C.woodLight;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      b.add(rbox(0.065, rail + 0.1, 0.065, 0.012), wood, { pos: [(sx * W) / 2, (rail + 0.1) / 2, (sz * L) / 2] });
      b.add(sph(0.042), wood, { pos: [(sx * W) / 2, rail + 0.115, (sz * L) / 2], scale: [1, 0.68, 1] });
    }
  for (const sx of [-1, 1]) {
    b.add(rbox(0.075, 0.06, L, 0.012), wood, { pos: [(sx * W) / 2, rail, 0] });
    b.add(rbox(0.05, 0.05, L, 0.01), C.wood, { pos: [(sx * W) / 2, 0.36, 0] });
    const n = 12;
    for (let i = 1; i < n; i++) {
      const z = -L / 2 + (i * L) / n;
      b.add(cyl(0.014, 0.014, rail - 0.38, 12), wood, { pos: [(sx * W) / 2, 0.36 + (rail - 0.36) / 2, z] });
    }
  }
  for (const sz of [-1, 1]) {
    b.add(rbox(W, 0.075, 0.07, 0.012), wood, { pos: [0, rail + 0.04, (sz * L) / 2] });
    b.add(rbox(W, 0.05, 0.05, 0.01), C.wood, { pos: [0, 0.36, (sz * L) / 2] });
    const n = 7;
    for (let i = 1; i < n; i++) {
      const x = -W / 2 + (i * W) / n;
      b.add(cyl(0.014, 0.014, rail - 0.38, 12), wood, { pos: [x, 0.36 + (rail - 0.36) / 2, (sz * L) / 2] });
    }
  }
  b.add(box(W - 0.04, 0.05, L - 0.04), C.wood, { pos: [0, 0.37, 0] });
  b.add(rbox(W - 0.08, 0.1, L - 0.08, 0.038), '#ebe8e0', { pos: [0, 0.43, 0], variation: 0.03, surf: 'fabric' });
  return b.mesh();
}

export function cribPillow(): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(rbox(0.32, 0.065, 0.19, 0.032), '#f2ede4', { pos: [0, 0.032, 0] });
  return b.mesh(Mat.vcSoft);
}

export function cribBlanket(): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(rbox(0.56, 0.045, 0.36, 0.022), '#e8cf8e', { pos: [0, 0.022, 0] });
  b.add(rbox(0.54, 0.018, 0.08, 0.008), '#f3ead9', { pos: [0, 0.042, -0.14] });
  return b.mesh(Mat.vcSoft);
}

export function pacifier(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(cyl(0.024, 0.024, 0.01, 20), '#93b2a4', { pos: [0, 0.005, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(sph(0.013, 16, 12), '#e8d9bd', { pos: [0, 0.018, 0.012], scale: [0.8, 0.8, 1.4] });
  b.add(new THREE.TorusGeometry(0.018, 0.004, 10, 20), '#f4efe6', { pos: [0, 0.005, -0.014], rot: [0.3, 0, 0] });
  g.add(b.mesh());
  return g;
}

export function mobileArm(): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.017, 0.021, 0.85, 16), C.woodLight, { pos: [0, 0.425, 0] });
  b.add(cyl(0.015, 0.015, 0.58, 16), C.woodLight, { pos: [0.27, 0.835, 0], rot: [0, 0, Math.PI / 2 - 0.1] });
  b.add(sph(0.028), C.brass, { pos: [0, 0.86, 0], surf: 'metal' });
  b.add(sph(0.024), C.mint, { pos: [0.56, 0.8, 0] });
  b.add(cyl(0.003, 0.003, 0.07, 8), '#e8e0d2', { pos: [0.56, 0.76, 0] });
  return b.mesh();
}

export interface MobileParts {
  hub: THREE.Group;
  ornaments: THREE.Group[];
}

export function mobileHub(): MobileParts {
  const hub = new THREE.Group();
  const b = new Builder();
  b.add(sph(0.028), C.wood, { surf: 'wood' });
  for (let i = 0; i < 2; i++) b.add(cyl(0.008, 0.008, 0.46, 12), C.woodLight, { rot: [0, (i * Math.PI) / 2, Math.PI / 2] });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.add(sph(0.015), C.brass, { pos: [Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23], surf: 'metal' });
  }
  hub.add(b.mesh());

  const ornaments: THREE.Group[] = [];
  const specs: { kind: 'star' | 'moon'; col: string; a: number; r: number; len: number }[] = [
    { kind: 'star', col: '#84a5c7', a: 0, r: 0.23, len: 0.16 },
    { kind: 'moon', col: '#e3c071', a: Math.PI / 2, r: 0.23, len: 0.22 },
    { kind: 'star', col: '#d89b7e', a: Math.PI, r: 0.23, len: 0.27 },
    { kind: 'star', col: '#e6c87a', a: (Math.PI * 3) / 2, r: 0.23, len: 0.2 },
    { kind: 'moon', col: '#90b3a2', a: Math.PI / 4, r: 0.0, len: 0.33 },
  ];
  specs.forEach((s, i) => {
    const holder = new THREE.Group();
    holder.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, s.len, 6), new THREE.MeshStandardMaterial({ color: '#ece5d8', roughness: 0.9 }));
    string.position.y = -s.len / 2;
    string.userData.noOutline = true;
    holder.add(string);
    const orn = new THREE.Group();
    const ob = new Builder('fabric');
    if (s.kind === 'star') ob.add(extrude(starShape(0.068, 0.032), 0.022, 0.01), s.col, { variation: 0.06, surf: 'fabric' });
    else ob.add(extrude(moonShape(0.064), 0.024, 0.01), s.col, { variation: 0.06, rot: [0, 0, -0.3], surf: 'fabric' });
    const m = ob.mesh(Mat.vcSoft);
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

export function nightstand(): { root: THREE.Group; drawers: THREE.Mesh[] } {
  const root = new THREE.Group();
  const b = new Builder();
  const w = 0.5, h = 0.52, d = 0.4;
  b.add(rbox(w, h - 0.06, d, 0.018), C.woodLight, { pos: [0, 0.06 + (h - 0.06) / 2, 0] });
  b.add(rbox(w + 0.03, 0.032, d + 0.03, 0.01), C.wood, { pos: [0, h + 0.012, 0] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(cyl(0.018, 0.012, 0.08, 12), C.woodDark, { pos: [sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05)], rot: [sz * 0.15, 0, -sx * 0.15] });
  root.add(b.mesh());

  const drawers: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const y = 0.17 + i * 0.19;
    const db = new Builder();
    // front face + recessed drawer box body so pulling it out looks real!
    db.add(rbox(w - 0.07, 0.16, 0.028, 0.01), '#dfbe95', { pos: [0, 0, d / 2 + 0.005] });
    db.add(box(w - 0.1, 0.12, d - 0.08), C.woodDark, { pos: [0, -0.01, 0.01] });
    db.add(sph(0.016), C.brass, { pos: [0, 0, d / 2 + 0.028], surf: 'metal' });
    const dm = db.mesh();
    dm.position.set(0, y, 0);
    dm.userData.baseZ = 0;
    root.add(dm);
    drawers.push(dm);
  }
  return { root, drawers };
}

export function pillLamp(): { root: THREE.Group; shadeMat: THREE.MeshStandardMaterial } {
  const root = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.07, 0.075, 0.035, 24), C.brass, { pos: [0, 0.018, 0], surf: 'metal' });
  b.add(cyl(0.065, 0.068, 0.008, 24), '#574a42', { pos: [0, 0.004, 0] });
  root.add(b.mesh());
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#f5ead6',
    roughness: 0.65,
    emissive: new THREE.Color('#ffbe73'),
    emissiveIntensity: 1.45,
  });
  const shade = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.08, 10, 24), shadeMat);
  shade.position.set(0, 0.1, 0);
  root.add(shade);
  return { root, shadeMat };
}

export function teddy(): THREE.Mesh {
  const b = new Builder('fur');
  const fur = C.bear, light = C.bearLight, dark = '#241a15';
  b.add(sph(0.11, 22, 16), fur, { pos: [0, 0.13, 0], scale: [1, 1.12, 0.9] });
  b.add(sph(0.072, 20, 14), light, { pos: [0, 0.12, 0.07], scale: [1, 1.1, 0.5] });
  b.add(sph(0.096, 22, 16), fur, { pos: [0, 0.32, 0.005] });
  for (const s of [-1, 1]) {
    b.add(sph(0.04, 16, 12), fur, { pos: [s * 0.072, 0.4, -0.005], scale: [1, 1, 0.6] });
    b.add(sph(0.024, 14, 10), light, { pos: [s * 0.072, 0.398, 0.012], scale: [1, 1, 0.4] });
    b.add(cap(0.034, 0.08), fur, { pos: [s * 0.115, 0.16, 0.03], rot: [0.5, 0, s * 0.75] });
    b.add(cap(0.042, 0.06), fur, { pos: [s * 0.06, 0.045, 0.085], rot: [Math.PI / 2 - 0.2, 0, s * 0.15] });
    b.add(sph(0.028, 14, 10), light, { pos: [s * 0.062, 0.04, 0.15], scale: [1, 1, 0.4] });
    b.add(sph(0.015, 14, 10), dark, { pos: [s * 0.042, 0.343, 0.085], scale: [1, 1.1, 0.7], surf: 'ceramic' });
  }
  b.add(sph(0.047, 18, 14), light, { pos: [0, 0.3, 0.075], scale: [1, 0.78, 0.75] });
  b.add(sph(0.016, 14, 10), dark, { pos: [0, 0.312, 0.11], scale: [1.2, 0.8, 1], surf: 'ceramic' });
  return b.mesh(Mat.vcSoft);
}

export function bunnyPlush(): THREE.Mesh {
  const b = new Builder('fur');
  const col = '#cfd6df';
  b.add(sph(0.07, 18, 14), col, { pos: [0, 0.07, 0], scale: [1, 1.1, 0.9] });
  b.add(sph(0.06, 18, 14), col, { pos: [0, 0.18, 0] });
  for (const s of [-1, 1]) {
    b.add(cap(0.018, 0.08), col, { pos: [s * 0.025, 0.27, 0], rot: [0, 0, s * 0.2] });
    b.add(sph(0.008, 10, 8), '#2a1d17', { pos: [s * 0.022, 0.19, 0.055], surf: 'ceramic' });
  }
  b.add(sph(0.008, 10, 8), '#d4868f', { pos: [0, 0.175, 0.06] });
  return b.mesh(Mat.vcSoft);
}

export function dresser(color = '#ece5da'): { root: THREE.Group; drawers: THREE.Mesh[] } {
  const root = new THREE.Group();
  const b = new Builder();
  const w = 0.95, h = 0.78, d = 0.45;
  b.add(rbox(w, h - 0.08, d, 0.016), color, { pos: [0, 0.08 + (h - 0.08) / 2, 0] });
  b.add(rbox(w + 0.04, 0.035, d + 0.03, 0.01), C.woodLight, { pos: [0, h + 0.01, 0] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(cyl(0.02, 0.014, 0.09, 12), C.woodLight, { pos: [sx * (w / 2 - 0.05), 0.045, sz * (d / 2 - 0.05)] });
  root.add(b.mesh());

  const drawers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const y = 0.2 + i * 0.21;
    const db = new Builder();
    db.add(rbox(w - 0.08, 0.18, 0.028, 0.01), '#f3ede3', { pos: [0, 0, d / 2 + 0.005] });
    db.add(box(w - 0.12, 0.13, d - 0.08), C.wood, { pos: [0, -0.01, 0.01] });
    // folded clothes inside drawer
    db.add(rbox(0.32, 0.05, 0.22, 0.02), ['#cfd9d2', '#e5cfc3', '#cbd5e0'][i], { pos: [-0.15, 0.03, 0.04], surf: 'fabric' });
    db.add(rbox(0.28, 0.05, 0.2, 0.02), '#efe6d8', { pos: [0.18, 0.03, 0.04], surf: 'fabric' });
    for (const s of [-1, 1]) db.add(sph(0.016), C.brass, { pos: [s * 0.22, 0, d / 2 + 0.028], surf: 'metal' });
    const dm = db.mesh();
    dm.position.set(0, y, 0);
    dm.userData.baseZ = 0;
    root.add(dm);
    drawers.push(dm);
  }
  return { root, drawers };
}

export function wallShelf(w = 0.8): THREE.Mesh {
  const b = new Builder();
  b.add(rbox(w, 0.03, 0.2, 0.008), C.woodLight, { pos: [0, 0, 0.1] });
  for (const s of [-1, 1]) b.add(rbox(0.028, 0.12, 0.14, 0.006), C.wood, { pos: [s * (w / 2 - 0.1), -0.07, 0.07] });
  return b.mesh();
}

export function beanbag(color = '#8b9980'): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(sph(0.42, 24, 16), color, { pos: [0, 0.22, 0], scale: [1, 0.56, 0.95], variation: 0.05 });
  b.add(sph(0.27, 20, 14), color, { pos: [-0.11, 0.4, -0.09], scale: [1, 0.58, 0.9], seed: 3 });
  return b.mesh(Mat.vcSoft);
}

export function basket(): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.2, 0.17, 0.26, 24), '#b9996d', { pos: [0, 0.13, 0] });
  b.add(cyl(0.21, 0.21, 0.03, 24), '#a38054', { pos: [0, 0.26, 0] });
  return b.mesh();
}

export function softClothBall(): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(sph(0.075, 20, 14), '#d89b96', { pos: [0, 0, 0] });
  return b.mesh(Mat.vcSoft);
}

/* ================= LIVING ROOM ================= */

export function sofa(color = '#d3987b'): { root: THREE.Group; frame: THREE.Mesh; pillows: THREE.Mesh[] } {
  const root = new THREE.Group();
  const b = new Builder('fabric');
  const W = 2.0, D = 0.9;
  b.add(rbox(W, 0.28, D, 0.05), color, { pos: [0, 0.24, 0] });
  b.add(rbox(W, 0.55, 0.24, 0.07), color, { pos: [0, 0.55, -D / 2 + 0.12] });
  for (const s of [-1, 1]) b.add(rbox(0.24, 0.5, D, 0.08), color, { pos: [s * (W / 2 - 0.1), 0.4, 0] });
  for (const s of [-1, 1]) b.add(rbox(0.76, 0.16, 0.66, 0.05), '#deaa90', { pos: [s * 0.39, 0.45, 0.08] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(cyl(0.035, 0.025, 0.1, 14), C.woodDark, { pos: [sx * (W / 2 - 0.1), 0.05, sz * (D / 2 - 0.1)], surf: 'wood' });
  const frame = b.mesh(Mat.vcSoft);
  root.add(frame);

  const pillowSpecs: { w: number; h: number; d: number; col: string; pos: [number, number, number]; rot: [number, number, number] }[] = [
    { w: 0.42, h: 0.38, d: 0.13, col: '#ece0cc', pos: [-0.52, 0.66, -0.2], rot: [-0.25, 0.15, 0.05] },
    { w: 0.42, h: 0.38, d: 0.13, col: '#95ab97', pos: [-0.1, 0.66, -0.22], rot: [-0.25, -0.05, -0.04] },
    { w: 0.38, h: 0.34, d: 0.12, col: '#e7ccb3', pos: [0.6, 0.65, -0.2], rot: [-0.25, -0.2, 0.06] },
  ];
  const pillows = pillowSpecs.map((p) => {
    const pb = new Builder('fabric');
    pb.add(rbox(p.w, p.h, p.d, 0.06), p.col, { pos: [0, 0, 0] });
    const pm = pb.mesh(Mat.vcSoft);
    pm.position.set(...p.pos);
    pm.rotation.set(...p.rot);
    root.add(pm);
    return pm;
  });

  return { root, frame, pillows };
}

export function armchair(color = '#8e9f84'): { root: THREE.Group; frame: THREE.Mesh; pillow: THREE.Mesh } {
  const root = new THREE.Group();
  const b = new Builder('fabric');
  const W = 1.0, D = 0.9;
  b.add(rbox(W, 0.3, D, 0.05), color, { pos: [0, 0.26, 0] });
  b.add(rbox(W - 0.1, 0.62, 0.24, 0.08), color, { pos: [0, 0.62, -D / 2 + 0.12] });
  for (const s of [-1, 1]) b.add(rbox(0.22, 0.52, D, 0.08), color, { pos: [s * (W / 2 - 0.09), 0.44, 0] });
  b.add(rbox(0.6, 0.15, 0.66, 0.05), '#9eb092', { pos: [0, 0.47, 0.08] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(cyl(0.04, 0.028, 0.11, 14), C.wood, { pos: [sx * (W / 2 - 0.1), 0.055, sz * (D / 2 - 0.1)], surf: 'wood' });
  const frame = b.mesh(Mat.vcSoft);
  root.add(frame);

  const pb = new Builder('fabric');
  pb.add(rbox(0.44, 0.36, 0.13, 0.06), C.peach, { pos: [0, 0, 0] });
  const pillow = pb.mesh(Mat.vcSoft);
  pillow.position.set(0, 0.7, -0.2);
  pillow.rotation.set(-0.3, 0.1, 0.05);
  root.add(pillow);

  return { root, frame, pillow };
}

export function coffeeTable(): THREE.Mesh {
  const b = new Builder();
  const W = 1.15, D = 0.62, H = 0.46;
  b.add(rbox(W, 0.055, D, 0.016), C.wood, { pos: [0, H, 0] });
  b.add(box(W - 0.1, 0.07, D - 0.1), C.woodDark, { pos: [0, H - 0.06, 0] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(rbox(0.055, H - 0.03, 0.055, 0.01), C.wood, { pos: [sx * (W / 2 - 0.07), (H - 0.03) / 2, sz * (D / 2 - 0.07)] });
  return b.mesh();
}

export function coffeeMug(): THREE.Mesh {
  const b = new Builder('ceramic');
  b.add(cyl(0.045, 0.04, 0.1, 20), '#eae4da', { pos: [0, 0.05, 0] });
  b.add(cyl(0.038, 0.038, 0.008, 16), '#6b4730', { pos: [0, 0.088, 0], surf: 'plastic' }); // warm coffee/tea surface
  b.add(new THREE.TorusGeometry(0.024, 0.007, 10, 18), '#eae4da', { pos: [0.048, 0.052, 0] });
  return b.mesh();
}

export function storyBook(color = '#6580aa'): THREE.Mesh {
  const b = new Builder();
  b.add(rbox(0.26, 0.032, 0.19, 0.006), color, { pos: [0, 0.016, 0], surf: 'fabric' });
  b.add(box(0.24, 0.024, 0.175), '#f3ece0', { pos: [0.006, 0.016, 0] });
  return b.mesh();
}

export function toyCar(): THREE.Mesh {
  const b = new Builder('wood');
  b.add(rbox(0.14, 0.04, 0.08, 0.012), '#c86452', { pos: [0, 0.032, 0], surf: 'paint' });
  b.add(rbox(0.07, 0.038, 0.072, 0.012), '#e8dfd0', { pos: [-0.01, 0.068, 0], surf: 'paint' });
  for (const sx of [-0.042, 0.042])
    for (const sz of [-0.042, 0.042])
      b.add(cyl(0.018, 0.018, 0.012, 16), '#3b3430', { pos: [sx, 0.018, sz], rot: [Math.PI / 2, 0, 0], surf: 'plastic' });
  return b.mesh();
}

export function toyBox(): { root: THREE.Group; lid: THREE.Group } {
  const root = new THREE.Group();
  const b = new Builder();
  const W = 0.72, H = 0.48, D = 0.46;
  b.add(rbox(W, H, D, 0.018), '#d9b88c', { pos: [0, H / 2, 0] });
  root.add(b.mesh());

  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  const lb = new Builder();
  lb.add(rbox(W + 0.04, 0.045, D + 0.04, 0.014), '#6c9d9a', { pos: [0, 0.012, D / 2] });
  lb.add(box(0.11, 0.11, 0.11), '#cb5a54', { pos: [-0.18, 0.07, D / 2], rot: [0.2, 0.4, 0.1] });
  lb.add(sph(0.065), '#dfb34d', { pos: [0.05, 0.065, D / 2 + 0.04] });
  lid.add(lb.mesh());
  root.add(lid);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.08, (W - 0.08) * 0.31),
    new THREE.MeshStandardMaterial({ map: T.toysLabel(), roughness: 0.88 }),
  );
  label.position.set(0, H * 0.55, D / 2 + 0.002);
  label.receiveShadow = true;
  root.add(label);
  return { root, lid };
}

export function ball(radius = 0.11): THREE.Mesh {
  const b = new Builder('plastic');
  const cols = [new THREE.Color('#cf4b47'), new THREE.Color('#e2b646'), new THREE.Color('#3b6ab8'), new THREE.Color('#e2b646')];
  b.add(sph(radius, 28, 20), '#fff', {
    variation: 0.03,
    colorFn: (p) => {
      const a = Math.atan2(p.z, p.x) + Math.PI;
      if (Math.abs(p.y) > radius * 0.82) return new THREE.Color('#f3ede2');
      return cols[Math.floor((a / (Math.PI * 2)) * 4) % 4];
    },
  });
  return b.mesh();
}

export function letterBlock(letter: string, idx: number, size = 0.1): THREE.Mesh {
  const geo = new RoundedBoxGeometry(size, size, size, 4, size * 0.09);
  const mats: THREE.Material[] = [];
  const letters = [letter, letter, String(idx + 1), String(idx + 1), letter, letter];
  for (let i = 0; i < 6; i++) mats.push(new THREE.MeshStandardMaterial({ map: T.blockFace(letters[i], idx), roughness: 0.5 }));
  const m = new THREE.Mesh(geo, mats);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function plant(scale = 1, potColor = C.pot): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.13, 0.1, 0.24, 24), potColor, { pos: [0, 0.12, 0], surf: 'ceramic' });
  b.add(cyl(0.12, 0.12, 0.02, 20), '#4e3525', { pos: [0, 0.235, 0] });
  srand(Math.floor(scale * 100));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rand() * 0.4;
    const tilt = 0.35 + rand() * 0.52;
    const len = 0.3 + rand() * 0.18;
    b.add(new THREE.SphereGeometry(0.052, 16, 12), i % 2 ? C.leaf : C.leafDark, {
      pos: [Math.cos(a) * 0.06, 0.24 + len / 2 - 0.02, Math.sin(a) * 0.06],
      rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt],
      scale: [1, len / 0.1, 0.28],
      variation: 0.1,
    });
  }
  const m = b.mesh();
  m.scale.setScalar(scale);
  return m;
}

export function floorLamp(): { root: THREE.Group; shadeMat: THREE.MeshStandardMaterial } {
  const root = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.14, 0.16, 0.03, 24), C.brass, { pos: [0, 0.015, 0], surf: 'metal' });
  b.add(cyl(0.015, 0.015, 1.35, 16), C.woodDark, { pos: [0, 0.69, 0] });
  root.add(b.mesh());
  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#f5ead8',
    roughness: 0.72,
    emissive: new THREE.Color('#ffd091'),
    emissiveIntensity: 1.5,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 28), shadeMat);
  shade.position.set(0, 1.45, 0);
  root.add(shade);
  return { root, shadeMat };
}

export function bookshelf(): THREE.Mesh {
  const b = new Builder();
  const W = 0.9, H = 1.7, D = 0.32;
  b.add(box(0.04, H, D), C.wood, { pos: [-W / 2, H / 2, 0] });
  b.add(box(0.04, H, D), C.wood, { pos: [W / 2, H / 2, 0] });
  b.add(box(W, H, 0.02), C.woodDark, { pos: [0, H / 2, -D / 2] });
  srand(42);
  const bookCols = ['#b96859', '#5f7ba3', '#cfb062', '#70987c', '#987ca6', '#c98b68', '#567396'];
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
      b.add(rbox(bw, bh, D * 0.75, 0.004), bookCols[Math.floor(rand() * bookCols.length)], {
        pos: [x + bw / 2, y + 0.015 + bh / 2, 0.02],
        rot: [0, 0, rand() < 0.1 ? 0.18 : 0],
        surf: 'fabric',
      });
      x += bw + 0.004;
    }
  }
  return b.mesh();
}

export function sideboard(color = C.mint): { root: THREE.Group; doors: THREE.Group[]; vase: THREE.Mesh; jar: THREE.Mesh } {
  const root = new THREE.Group();
  const b = new Builder();
  const W = 1.4, H = 0.82, D = 0.42;
  b.add(rbox(W, H - 0.1, D, 0.016), color, { pos: [0, 0.1 + (H - 0.1) / 2, 0] });
  b.add(rbox(W + 0.04, 0.038, D + 0.03, 0.01), C.woodLight, { pos: [0, H + 0.01, 0] });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.add(cyl(0.022, 0.015, 0.1, 12), C.woodLight, { pos: [sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06)] });
  root.add(b.mesh());

  const doors: THREE.Group[] = [];
  const dw = W / 3 - 0.05;
  for (let i = 0; i < 3; i++) {
    const x = -W / 3 + (i * W) / 3;
    const pivot = new THREE.Group();
    pivot.position.set(x - dw / 2, 0.1 + (H - 0.1) / 2, D / 2 + 0.005);
    const db = new Builder();
    db.add(rbox(dw, H - 0.2, 0.028, 0.012), '#9eb7a9', { pos: [dw / 2, 0, 0] });
    db.add(sph(0.018), C.brass, { pos: [dw - 0.06, 0.04, 0.024], surf: 'metal' });
    pivot.add(db.mesh());
    root.add(pivot);
    doors.push(pivot);
  }

  const vb = new Builder('ceramic');
  vb.add(cyl(0.06, 0.08, 0.2, 20), '#ece6dc', { pos: [0, 0.1, 0], surf: 'ceramic' });
  vb.add(sph(0.055, 16, 12), '#d89a9e', { pos: [0, 0.23, 0], surf: 'leaf' });
  const vase = vb.mesh();
  vase.position.set(0.45, H + 0.028, 0);
  root.add(vase);

  const jb = new Builder('ceramic');
  jb.add(cyl(0.07, 0.07, 0.14, 20), '#e7c69c', { pos: [0, 0.07, 0], surf: 'ceramic' });
  jb.add(cyl(0.074, 0.074, 0.02, 20), C.wood, { pos: [0, 0.145, 0], surf: 'wood' });
  const jar = jb.mesh();
  jar.position.set(-0.4, H + 0.028, 0.02);
  root.add(jar);

  return { root, doors, vase, jar };
}

export function sideTable(): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.3, 0.3, 0.036, 28), C.wood, { pos: [0, 0.6, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(cyl(0.022, 0.016, 0.6, 12), C.wood, { pos: [Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18], rot: [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12] });
  }
  return b.mesh();
}

/* ================= WINDOW & OUTSIDE ================= */

export function windowFrame(w: number, h: number, depth = 0.16, color = '#f3ece2'): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  const t = 0.06;
  b.add(box(w + t * 2, t, depth), color, { pos: [0, h / 2 + t / 2, 0] });
  b.add(rbox(w + t * 2 + 0.1, 0.05, depth + 0.12, 0.01), color, { pos: [0, -h / 2 - 0.025, 0.04] });
  for (const s of [-1, 1]) b.add(box(t, h, depth), color, { pos: [s * (w / 2 + t / 2), 0, 0] });
  b.add(box(0.035, h, 0.04), color, { pos: [0, 0, 0] });
  b.add(box(w, 0.035, 0.04), color, { pos: [0, h * 0.18, 0] });
  g.add(b.mesh());
  // Subtle physical window glass with realistic specular reflections
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshPhysicalMaterial({
      color: '#e8f3ff',
      roughness: 0.05,
      metalness: 0.05,
      transparent: true,
      opacity: 0.14,
      clearcoat: 1.0,
      envMapIntensity: 1.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glass.raycast = () => {};
  g.add(glass);
  return g;
}

export function curtain(w: number, h: number, color: string, pattern: string, opacity = 0.88): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 48, 4);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / w) * Math.PI * 6) * 0.038);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: T.curtainTex(color, pattern),
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    roughness: 0.94,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function tree(height = 3, seed = 1, col = C.leafDark): THREE.Mesh {
  const b = new Builder();
  srand(seed);
  b.add(cyl(0.08, 0.13, height * 0.48, 12), '#5c4132', { pos: [0, height * 0.24, 0], surf: 'wood' });
  const n = 5;
  for (let i = 0; i < n; i++) {
    const r = height * (0.2 + rand() * 0.08);
    b.add(new THREE.SphereGeometry(r, 16, 12), i % 2 ? col : '#4f7d59', {
      pos: [(rand() - 0.5) * height * 0.3, height * (0.48 + i * 0.1), (rand() - 0.5) * height * 0.3],
      scale: [1.1, 0.85, 1.1],
      variation: 0.12,
      seed: seed * 10 + i,
      surf: 'leaf',
    });
  }
  return b.mesh();
}

export function pineTree(height = 3, seed = 1): THREE.Mesh {
  const b = new Builder();
  b.add(cyl(0.06, 0.1, height * 0.32, 12), '#5c4132', { pos: [0, height * 0.16, 0], surf: 'wood' });
  for (let i = 0; i < 4; i++) {
    const r = height * (0.28 - i * 0.055);
    b.add(new THREE.ConeGeometry(r, height * 0.34, 18), '#3d634a', {
      pos: [0, height * (0.34 + i * 0.16), 0],
      seed: seed + i,
      variation: 0.1,
      surf: 'leaf',
    });
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
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: T.painting(variant), roughness: 0.65 }));
  art.position.z = 0.006;
  g.add(art);
  return g;
}

export function babyBottle(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(cyl(0.032, 0.032, 0.12, 20), '#dfe6ef', { pos: [0, 0, 0], variation: 0.02, surf: 'ceramic' });
  b.add(cyl(0.036, 0.036, 0.025, 20), '#89b8a8', { pos: [0, 0.07, 0] });
  b.add(new THREE.ConeGeometry(0.018, 0.045, 16), '#e6c294', { pos: [0, 0.1, 0], surf: 'plastic' });
  g.add(b.mesh(Mat.vc, false, false));
  const milk = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.35 }));
  milk.position.y = -0.01;
  milk.name = 'milk';
  g.add(milk);
  return g;
}

/* ================= easter-egg & interactive props ================= */

export function tissueBox(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.24, 0.1, 0.13, 0.014), '#a5b5c4', { pos: [0, 0.05, 0] });
  b.add(rbox(0.14, 0.012, 0.05, 0.005), '#7f93a6', { pos: [0, 0.101, 0] });
  g.add(b.mesh());
  const tb = new Builder('fabric');
  tb.add(sph(0.04, 16, 12), '#faf8f4', { pos: [0, 0.125, 0], scale: [1.1, 0.8, 0.45], rot: [0, 0, 0.3] });
  const tuft = tb.mesh(Mat.vcSoft);
  tuft.name = 'tuft';
  g.add(tuft);
  return g;
}

export function tissueSheet(): THREE.Mesh {
  const b = new Builder('fabric');
  b.add(sph(0.05, 14, 10), '#faf8f4', { scale: [1.2, 0.25, 1.0], variation: 0.02 });
  return b.mesh(Mat.vcSoft);
}

export function remote(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(rbox(0.05, 0.022, 0.17, 0.01), '#353840', { pos: [0, 0.011, 0] });
  b.add(cyl(0.008, 0.008, 0.006, 14), '#c94c42', { pos: [0, 0.024, -0.055] });
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++)
      b.add(cyl(0.006, 0.006, 0.005, 12), '#c9cdd4', { pos: [-0.011 + c * 0.022, 0.024, -0.02 + r * 0.025] });
  g.add(b.mesh());
  return g;
}

export function tvSet(screen: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.86, 0.52, 0.055, 0.016), '#272930', { pos: [0, 0.32, 0], surf: 'plastic' });
  b.add(cyl(0.02, 0.02, 0.06, 16), '#272930', { pos: [0, 0.04, 0], surf: 'metal' });
  b.add(rbox(0.28, 0.018, 0.14, 0.006), '#272930', { pos: [0, 0.01, 0], surf: 'metal' });
  g.add(b.mesh());
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.81, 0.46),
    new THREE.MeshPhysicalMaterial({
      map: screen,
      emissiveMap: screen,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0,
      color: '#101216',
      roughness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    }),
  );
  scr.position.set(0, 0.32, 0.029);
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
  return g;
}

export function musicBox(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  b.add(rbox(0.2, 0.11, 0.14, 0.012), '#cf8d76', { pos: [0, 0.055, 0] });
  b.add(rbox(0.21, 0.025, 0.15, 0.01), C.woodLight, { pos: [0, 0.12, 0] });
  b.add(cyl(0.008, 0.008, 0.05, 14), C.brass, { pos: [0.115, 0.06, 0], rot: [0, 0, Math.PI / 2], surf: 'metal' });
  b.add(rbox(0.012, 0.04, 0.012, 0.004), C.brass, { pos: [0.14, 0.075, 0], surf: 'metal' });
  g.add(b.mesh());
  const top = new THREE.Group();
  const tb = new Builder();
  tb.add(cyl(0.035, 0.035, 0.01, 20), '#f2ebe0', { pos: [0, 0, 0] });
  tb.add(extrude(starShape(0.03, 0.013), 0.012, 0.004), C.brass, { pos: [0, 0.04, 0], surf: 'metal' });
  tb.add(cyl(0.003, 0.003, 0.03, 10), C.brass, { pos: [0, 0.02, 0], surf: 'metal' });
  top.add(tb.mesh());
  top.position.y = 0.138;
  top.name = 'spinner';
  g.add(top);
  return g;
}

export function rubberDuck(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(sph(0.045, 22, 16), '#e5be45', { pos: [0, 0.04, 0], scale: [1.25, 0.85, 1] });
  b.add(sph(0.03, 20, 14), '#e5be45', { pos: [0.035, 0.09, 0] });
  b.add(sph(0.014, 14, 10), '#d87642', { pos: [0.064, 0.086, 0], scale: [1.4, 0.6, 1] });
  for (const s of [-1, 1]) b.add(sph(0.0055, 10, 8), '#231812', { pos: [0.052, 0.1, s * 0.017], surf: 'ceramic' });
  b.add(sph(0.02, 14, 10), '#e5be45', { pos: [-0.055, 0.06, 0], scale: [1, 0.6, 0.6], rot: [0, 0, 0.5] });
  g.add(b.mesh());
  return g;
}

export function rattle(): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder('plastic');
  b.add(sph(0.042, 22, 16), '#d99e90', { pos: [0, 0.13, 0] });
  b.add(new THREE.TorusGeometry(0.044, 0.007, 10, 28), '#869c7e', { pos: [0, 0.13, 0], rot: [Math.PI / 2, 0, 0] });
  b.add(cap(0.013, 0.085), C.wood, { pos: [0, 0.05, 0], surf: 'wood' });
  b.add(sph(0.02, 16, 12), '#9ab0bf', { pos: [0, 0.0, 0] });
  g.add(b.mesh());
  return g;
}

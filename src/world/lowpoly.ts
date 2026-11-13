import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Low-poly helpers.
 *
 * Every procedural model is assembled from three.js primitives that are
 *  - slightly jittered (coincident vertices move together, so meshes stay closed)
 *  - split into flat triangles with a tiny per-face colour variation
 *  - baked into one vertex-coloured geometry per object (one draw call)
 */

// deterministic hash → [0,1)
export function hash3(x: number, y: number, z: number, seed = 0): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

let rngState = 1234567;
export function srand(seed: number) {
  rngState = seed >>> 0 || 1;
}
export function rand(): number {
  // mulberry32
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function jitter(geo: THREE.BufferGeometry, amount: number, seed = 0): THREE.BufferGeometry {
  if (amount <= 0) return geo;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rx = Math.round(x * 1e4) / 1e4, ry = Math.round(y * 1e4) / 1e4, rz = Math.round(z * 1e4) / 1e4;
    pos.setXYZ(
      i,
      x + (hash3(rx, ry, rz, seed + 1) - 0.5) * 2 * amount,
      y + (hash3(rx, ry, rz, seed + 2) - 0.5) * 2 * amount,
      z + (hash3(rx, ry, rz, seed + 3) - 0.5) * 2 * amount,
    );
  }
  pos.needsUpdate = true;
  return geo;
}

export interface PaintOpts {
  jitter?: number;
  variation?: number; // per-face brightness variation
  seed?: number;
  /** optional per-vertex colour function (world/local position → colour) */
  colorFn?: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
}

const _c = new THREE.Color();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Flat-faceted, vertex-coloured copy of a geometry. Keeps only position/normal/color. */
export function paint(src: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PaintOpts = {}): THREE.BufferGeometry {
  let geo = src.index ? src.toNonIndexed() : src.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  jitter(geo, o.jitter ?? 0, o.seed ?? 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const variation = o.variation ?? 0.07;
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _d.fromBufferAttribute(pos, i + 2);
    _p.copy(_a).add(_b).add(_d).multiplyScalar(1 / 3);
    _n.subVectors(_d, _b).cross(_a.clone().sub(_b)).normalize();
    if (o.colorFn) _c.copy(o.colorFn(_p, _n));
    else _c.copy(base);
    const v = 1 + (hash3(_p.x * 13.1, _p.y * 7.7, _p.z * 5.3, (o.seed ?? 0) + 9) - 0.5) * 2 * variation;
    _c.multiplyScalar(v);
    for (let k = 0; k < 3; k++) {
      cols[(i + k) * 3] = _c.r;
      cols[(i + k) * 3 + 1] = _c.g;
      cols[(i + k) * 3 + 2] = _c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

export interface PartOpts extends PaintOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}

/** Collects painted parts and merges them into a single mesh. */
export class Builder {
  parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private t = new THREE.Vector3();

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts = {}): this {
    const g = paint(geo, color, o);
    this.e.set(...(o.rot ?? [0, 0, 0]));
    this.q.setFromEuler(this.e);
    const sc = o.scale ?? 1;
    if (typeof sc === 'number') this.s.set(sc, sc, sc);
    else this.s.set(...sc);
    this.t.set(...(o.pos ?? [0, 0, 0]));
    this.m.compose(this.t, this.q, this.s);
    g.applyMatrix4(this.m);
    this.parts.push(g);
    return this;
  }

  /** add an already painted geometry with a matrix */
  addPainted(g: THREE.BufferGeometry, matrix?: THREE.Matrix4): this {
    const c = g.clone();
    if (matrix) c.applyMatrix4(matrix);
    this.parts.push(c);
    return this;
  }

  geometry(): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.parts, false)!;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(mat: THREE.Material = Mat.vc, cast = true, receive = true): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(), mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

/** Shared materials */
export const Mat = {
  vc: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 }),
  vcSoft: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
  vcPastel: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 }),
  vcGlow: new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.6,
    emissive: new THREE.Color('#ffcf8a'),
    emissiveIntensity: 2.2,
  }),
};

// ---------- shape helpers ----------

export function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function moonShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  const seg = 8;
  const a0 = Math.PI / 3, a1 = (Math.PI * 5) / 3;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const cx = 0.45 * r;
  const ri = Math.hypot(0.5 * r - cx, 0.866 * r);
  const b0 = Math.atan2(-0.866 * r, 0.5 * r - cx) + Math.PI * 2;
  const b1 = Math.atan2(0.866 * r, 0.5 * r - cx);
  for (let i = 1; i < seg; i++) {
    const a = b0 + ((b1 - b0) * i) / seg;
    s.lineTo(cx + Math.cos(a) * ri, Math.sin(a) * ri);
  }
  s.closePath();
  return s;
}

export function extrude(shape: THREE.Shape, depth: number, bevel = 0.01): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  g.center();
  return g;
}

/** Remove the vertex-normal discontinuities so a hull can be inflated along smooth normals. */
export function hullGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', (src.getAttribute('position') as THREE.BufferAttribute).clone());
  if (src.index) g.setIndex(src.index.clone());
  const m = mergeVertices(g, 1e-3);
  m.computeVertexNormals();
  return m;
}

export const C = {
  // palette (soft pastels, matching the concept art)
  wood: '#c99566',
  woodLight: '#dcb284',
  woodDark: '#9b6a45',
  cream: '#f4e7d3',
  creamWarm: '#f1dcc0',
  white: '#fbf6ee',
  lavender: '#a99bc9',
  lavenderDeep: '#7f74a6',
  dusk: '#8f86b6',
  mint: '#a8d5bf',
  mintDeep: '#86bfa6',
  sage: '#a7b896',
  peach: '#f2a988',
  peachLight: '#f7c6aa',
  pink: '#efb3b8',
  rose: '#e58b95',
  sky: '#9cc6e8',
  blueGrey: '#8f9fbe',
  yellow: '#f6d77d',
  gold: '#e3b25e',
  dog: '#e5b56f',
  dogLight: '#f3d39c',
  bear: '#a8754f',
  bearLight: '#d4a77d',
  skin: '#fbd0b8',
  skinShade: '#f3bda3',
  sleeve: '#eef0f7',
  sweater: '#7f9ad6',
  hair: '#6e4632',
  pants: '#5d6a8a',
  leaf: '#7fae7e',
  leafDark: '#4f7d6a',
  pot: '#e7c6a9',
  red: '#e6595a',
  blue: '#4f7fd1',
};

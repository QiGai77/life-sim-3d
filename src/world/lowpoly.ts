import * as THREE from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural model helpers (v2: smooth PBR).
 *
 * Every procedural model is assembled from three.js primitives that are
 *  - smooth-shaded with creased normals (hard edges stay crisp, round things stay round)
 *  - vertex-coloured, tagged with a surface type (wood / fabric / fur / plastic …)
 *  - box-projected UVs so real CC0 detail maps (grain, velvet, fur) can be applied
 *  - baked into one geometry per object (one draw call)
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
  amount *= JITTER_SCALE;
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

/** v2: props are smooth now – the old low-poly jitter is mostly switched off. */
export const JITTER_SCALE = 0.15;

/** Surface types, stored per vertex in the `surf` attribute and resolved in one shared PBR shader. */
export const S = { paint: 0, wood: 1, fabric: 2, fur: 3, plastic: 4, ceramic: 5, leaf: 6, glow: 7 } as const;
export type SurfName = keyof typeof S;

export interface PaintOpts {
  jitter?: number;
  variation?: number; // colour variation (now smooth, low-frequency)
  seed?: number;
  /** optional per-face colour function (local position → colour) – keeps hard colour edges */
  colorFn?: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
  /** surface type; auto-detected from the colour when omitted */
  surf?: SurfName;
  /** crease angle for smooth normals (radians) */
  crease?: number;
}

const _c = new THREE.Color();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

const lowNoise = (x: number, y: number, z: number, s: number) =>
  (Math.sin(x * 6.1 + y * 2.3 + s) * Math.sin(z * 5.3 + x * 1.7 + s * 2.1) + Math.sin(y * 4.7 + z * 3.1 + s * 0.7) * 0.5) / 1.5;

/** Smooth-shaded (creased normals), vertex-coloured copy of a geometry. Keeps position/normal/color. */
export function paint(src: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PaintOpts = {}): THREE.BufferGeometry {
  let geo = src.index ? src.toNonIndexed() : src.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  jitter(geo, o.jitter ?? 0, o.seed ?? 0);
  geo = toCreasedNormals(geo, o.crease ?? 0.62);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const variation = (o.variation ?? 0.07) * 0.45;
  const seed = o.seed ?? 0;
  for (let i = 0; i < pos.count; i += 3) {
    if (o.colorFn) {
      _a.fromBufferAttribute(pos, i);
      _b.fromBufferAttribute(pos, i + 1);
      _d.fromBufferAttribute(pos, i + 2);
      _p.copy(_a).add(_b).add(_d).multiplyScalar(1 / 3);
      _n.subVectors(_d, _b).cross(_a.clone().sub(_b)).normalize();
      _c.copy(o.colorFn(_p, _n));
    }
    for (let k = 0; k < 3; k++) {
      if (!o.colorFn) _c.copy(base);
      _p.fromBufferAttribute(pos, i + k);
      const v = 1 + lowNoise(_p.x, _p.y, _p.z, seed) * variation;
      cols[(i + k) * 3] = _c.r * v;
      cols[(i + k) * 3 + 1] = _c.g * v;
      cols[(i + k) * 3 + 2] = _c.b * v;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

/** world-scale box projection UVs (per triangle, dominant axis) – drives the detail maps */
export function boxUV(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _d.fromBufferAttribute(pos, i + 2);
    _n.subVectors(_b, _a).cross(_p.subVectors(_d, _a));
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    for (let k = 0; k < 3; k++) {
      _p.fromBufferAttribute(pos, i + k);
      let u, v;
      if (ax >= ay && ax >= az) (u = _p.z), (v = _p.y);
      else if (ay >= az) (u = _p.x), (v = _p.z);
      else (u = _p.x), (v = _p.y);
      uv[(i + k) * 2] = u;
      uv[(i + k) * 2 + 1] = v;
    }
  }
  geo.setAttribute('buv', new THREE.BufferAttribute(uv, 2));
}

const WOODS = new Set(['#c99566', '#dcb284', '#9b6a45', '#e6c49c', '#c8a77a', '#b08c5f', '#6e4b3a', '#e2c196', '#d8b27a']);
const LEAVES = new Set(['#7fae7e', '#4f7d6a', '#5f8f74', '#4f7a66']);
function autoSurf(color: THREE.ColorRepresentation, fallback: number): number {
  if (typeof color === 'string') {
    const c = color.toLowerCase();
    if (WOODS.has(c)) return S.wood;
    if (LEAVES.has(c)) return S.leaf;
  }
  return fallback;
}

export interface PartOpts extends PaintOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}

/** Collects painted parts and merges them into a single mesh (one draw call). */
export class Builder {
  parts: THREE.BufferGeometry[] = [];
  /** default surface for parts without an explicit/auto-detected one */
  def: SurfName | null = null;
  constructor(def: SurfName | null = null) {
    this.def = def;
  }
  private surfs: (number | null)[] = [];
  private colors: THREE.ColorRepresentation[] = [];
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
    this.surfs.push(o.surf !== undefined ? S[o.surf] : null);
    this.colors.push(color);
    return this;
  }

  /** add an already painted geometry with a matrix */
  addPainted(g: THREE.BufferGeometry, matrix?: THREE.Matrix4): this {
    const c = g.clone();
    if (matrix) c.applyMatrix4(matrix);
    this.parts.push(c);
    this.surfs.push(null);
    this.colors.push('#ffffff');
    return this;
  }

  geometry(defaultSurf = 0): THREE.BufferGeometry {
    if (!this.parts.length) return new THREE.BufferGeometry();
    this.parts.forEach((p, i) => {
      const s = this.surfs[i] ?? autoSurf(this.colors[i], defaultSurf);
      p.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(p.getAttribute('position').count).fill(s), 1));
      if (!p.getAttribute('buv')) boxUV(p);
    });
    const g = mergeGeometries(this.parts, false)!;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(mat: THREE.Material = Mat.vc, cast = true, receive = true): THREE.Mesh {
    const def = this.def !== null ? S[this.def] : mat === Mat.vcSoft ? S.fabric : mat === Mat.vcGlow ? S.glow : mat === Mat.vcPastel ? S.plastic : S.paint;
    const mesh = new THREE.Mesh(this.geometry(def), mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

/* ---------------- shared PBR "surface" material ---------------- */

export interface DetailTex {
  woodGrain: THREE.Texture;
  oakNor: THREE.Texture;
  velvetNor: THREE.Texture;
  teddyNor: THREE.Texture;
  furDetail: THREE.Texture;
}

const SURF_VERT_PARS = /* glsl */ `
attribute float surf;
attribute vec2 buv;
varying float vSurf;
varying vec2 vBoxUv;
`;
const SURF_FRAG_PARS = /* glsl */ `
varying float vSurf;
varying vec2 vBoxUv;
uniform sampler2D tGrain, tOakN, tFabN, tFurN, tFurD;
uniform float uDetail;
vec3 surfPerturb(vec3 eye_pos, vec3 surf_norm, vec2 uv, vec3 mapN) {
  vec3 q0 = dFdx(eye_pos.xyz); vec3 q1 = dFdy(eye_pos.xyz);
  vec2 st0 = dFdx(uv.st); vec2 st1 = dFdy(uv.st);
  vec3 N = surf_norm;
  vec3 q1perp = cross(q1, N); vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = (det == 0.0) ? 0.0 : inversesqrt(det);
  return normalize(T * (mapN.x * scale) + B * (mapN.y * scale) + N * mapN.z);
}
`;

/** Patch a MeshStandardMaterial so that one draw call can be wood, fabric, fur, plastic… per vertex. */
export function surfaceMaterial(tex: DetailTex, params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, ...params });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tGrain = { value: tex.woodGrain };
    sh.uniforms.tOakN = { value: tex.oakNor };
    sh.uniforms.tFabN = { value: tex.velvetNor };
    sh.uniforms.tFurN = { value: tex.teddyNor };
    sh.uniforms.tFurD = { value: tex.furDetail };
    sh.uniforms.uDetail = { value: 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SURF_VERT_PARS)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vSurf = surf; vBoxUv = buv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURF_FRAG_PARS)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        int sType = int(vSurf + 0.5);
        float sRough = roughness; vec3 sN = vec3(0.0, 0.0, 1.0); float sSheen = 0.0; vec2 sUv = vBoxUv;
        if (sType == 1) {           // wood: real grain modulates the painted colour
          sUv = vBoxUv * vec2(0.7, 2.2);
          float g = texture2D(tGrain, sUv).r;
          diffuseColor.rgb *= mix(1.0, g * 1.12, 0.85);
          sN = texture2D(tOakN, sUv).xyz * 2.0 - 1.0; sN.xy *= 0.8;
          sRough = 0.52 + (1.0 - g) * 0.25;
        } else if (sType == 2) {    // fabric / velvet
          sUv = vBoxUv * 3.2;
          sN = texture2D(tFabN, sUv).xyz * 2.0 - 1.0; sN.xy *= 1.1;
          sRough = 0.92; sSheen = 0.22;
        } else if (sType == 3) {    // plush fur
          sUv = vBoxUv * 4.5;
          diffuseColor.rgb *= mix(1.0, texture2D(tFurD, sUv).r * 1.1, 0.7);
          sN = texture2D(tFurN, sUv).xyz * 2.0 - 1.0; sN.xy *= 1.4;
          sRough = 0.98; sSheen = 0.35;
        } else if (sType == 4) { sRough = 0.32; }
        else if (sType == 5) { sRough = 0.18; }
        else if (sType == 6) { sRough = 0.55; sSheen = 0.08; }
        else if (sType == 7) { sRough = 0.6; }
        else { sRough = roughness; }
        `,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sRough;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        if (sType >= 1 && sType <= 3) normal = surfPerturb(-vViewPosition, normal, sUv, normalize(mix(vec3(0.,0.,1.), sN, uDetail)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        if (sSheen > 0.0) { float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); totalEmissiveRadiance += diffuseColor.rgb * sSheen * fr * fr * fr * 0.55; }`,
      );
  };
  m.customProgramCacheKey = () => 'surf-v2' + (params.emissive ? '-e' : '');
  return m;
}

/** Shared materials – created once the detail textures are loaded (see initMaterials). */
export const Mat = {} as {
  vc: THREE.MeshStandardMaterial;
  vcSoft: THREE.MeshStandardMaterial;
  vcPastel: THREE.MeshStandardMaterial;
  vcGlow: THREE.MeshStandardMaterial;
};

export function initMaterials(tex: DetailTex) {
  Mat.vc = surfaceMaterial(tex);
  Mat.vcSoft = surfaceMaterial(tex, { roughness: 0.92 });
  Mat.vcPastel = surfaceMaterial(tex, { roughness: 0.4, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.05 });
  Mat.vcGlow = surfaceMaterial(tex, { roughness: 0.6, emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 2.0 });
}

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
    bevelSegments: 3,
    curveSegments: 10,
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

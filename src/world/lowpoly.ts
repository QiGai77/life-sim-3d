import * as THREE from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural model helpers (v3: realistic PBR surfaces & clean geometry).
 *
 * Every procedural model is assembled from smooth primitives that are
 *  - smooth-shaded with creased normals (crisp edges, smooth curves, zero cartoon jitter)
 *  - vertex-coloured, tagged with a surface type (wood / fabric / fur / plastic / ceramic / metal / leaf / glass)
 *  - box-projected UVs driving real CC0 detail normal/roughness/grain maps
 *  - baked into one geometry per object for high performance
 */

export function hash3(x: number, y: number, z: number, seed = 0): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

let rngState = 1234567;
export function srand(seed: number) {
  rngState = seed >>> 0 || 1;
}
export function rand(): number {
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

/** v3: clean architectural & realistic prop geometry (no low-poly jitter). */
export const JITTER_SCALE = 0;

/** Surface types, stored per vertex in the `surf` attribute and resolved in one shared PBR shader. */
export const S = { paint: 0, wood: 1, fabric: 2, fur: 3, plastic: 4, ceramic: 5, leaf: 6, glow: 7, metal: 8 } as const;
export type SurfName = keyof typeof S;

export interface PaintOpts {
  jitter?: number;
  variation?: number;
  seed?: number;
  colorFn?: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
  surf?: SurfName;
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

/** Smooth-shaded (creased normals), vertex-coloured copy of a geometry. */
export function paint(src: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PaintOpts = {}): THREE.BufferGeometry {
  let geo = src.index ? src.toNonIndexed() : src.clone();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  jitter(geo, o.jitter ?? 0, o.seed ?? 0);
  geo = toCreasedNormals(geo, o.crease ?? 0.68);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const variation = (o.variation ?? 0.05) * 0.35;
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

/** world-scale box projection UVs (per triangle, dominant axis) – drives detail maps */
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

const WOODS = new Set(['#c28e5c', '#d4aa7d', '#8c5d3c', '#dfc09a', '#bfa075', '#a37d53', '#5c3f2e', '#d9b88c', '#c9a26d', '#c99566', '#dcb284', '#9b6a45', '#e6c49c']);
const LEAVES = new Set(['#5e875c', '#3c6348', '#4f7d59', '#456f4d', '#7fae7e', '#4f7d6a', '#5f8f74', '#4f7a66']);
const METALS = new Set(['#c9a255', '#b89448', '#8d949d', '#b8bec6', '#d6b365']);
function autoSurf(color: THREE.ColorRepresentation, fallback: number): number {
  if (typeof color === 'string') {
    const c = color.toLowerCase();
    if (WOODS.has(c)) return S.wood;
    if (LEAVES.has(c)) return S.leaf;
    if (METALS.has(c)) return S.metal;
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

/** Patch a MeshStandardMaterial so one draw call supports realistic wood, fabric, fur, plastic, ceramic, foliage & brushed metal. */
export function surfaceMaterial(tex: DetailTex, params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0, envMapIntensity: 0.95, ...params });
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
        float sRough = roughness; float sMetal = metalness; vec3 sN = vec3(0.0, 0.0, 1.0); float sSheen = 0.0; vec2 sUv = vBoxUv;
        if (sType == 1) {           // natural satin wood: rich grain + specular roughness modulation
          sUv = vBoxUv * vec2(0.75, 2.4);
          float g = texture2D(tGrain, sUv).r;
          diffuseColor.rgb *= mix(0.88, g * 1.14, 0.85);
          sN = texture2D(tOakN, sUv).xyz * 2.0 - 1.0; sN.xy *= 0.95;
          sRough = 0.40 + (1.0 - g) * 0.26;
        } else if (sType == 2) {    // woven fabric / upholstery
          sUv = vBoxUv * 3.8;
          sN = texture2D(tFabN, sUv).xyz * 2.0 - 1.0; sN.xy *= 1.25;
          sRough = 0.94; sSheen = 0.20;
        } else if (sType == 3) {    // realistic plush fur
          sUv = vBoxUv * 5.0;
          diffuseColor.rgb *= mix(0.95, texture2D(tFurD, sUv).r * 1.08, 0.72);
          sN = texture2D(tFurN, sUv).xyz * 2.0 - 1.0; sN.xy *= 1.5;
          sRough = 0.98; sSheen = 0.30;
        } else if (sType == 4) {    // satin polymer / toy plastic
          sRough = 0.28;
        } else if (sType == 5) {    // glazed ceramic
          sRough = 0.14;
        } else if (sType == 6) {    // natural foliage with subtle waxy specular & subsurface tint
          sRough = 0.42; sSheen = 0.14;
        } else if (sType == 7) {    // warm lamp shade
          sRough = 0.72;
        } else if (sType == 8) {    // brushed brass / metal hardware
          sUv = vBoxUv * 4.0;
          sN = texture2D(tOakN, sUv).xyz * 2.0 - 1.0; sN.xy *= 0.35;
          sMetal = 0.88; sRough = 0.26;
        } else {                    // matte lacquer / painted wood
          sRough = 0.48;
        }
        `,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = sMetal;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        if (sType == 1 || sType == 2 || sType == 3 || sType == 8) normal = surfPerturb(-vViewPosition, normal, sUv, normalize(mix(vec3(0.,0.,1.), sN, uDetail)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        if (sSheen > 0.0) { float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); totalEmissiveRadiance += diffuseColor.rgb * sSheen * fr * fr * fr * 0.42; }`,
      );
  };
  m.customProgramCacheKey = () => 'surf-v3' + (params.emissive ? '-e' : '');
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
  Mat.vcSoft = surfaceMaterial(tex, { roughness: 0.94 });
  Mat.vcPastel = surfaceMaterial(tex, { roughness: 0.34 });
  Mat.vcGlow = surfaceMaterial(tex, { roughness: 0.68, emissive: new THREE.Color('#ffd394'), emissiveIntensity: 1.85 });
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
  const seg = 12;
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
    bevelSegments: 4,
    curveSegments: 16,
  });
  g.center();
  return g;
}

/** Remove vertex-normal discontinuities so outline hulls inflate cleanly. */
export function hullGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', (src.getAttribute('position') as THREE.BufferAttribute).clone());
  if (src.index) g.setIndex(src.index.clone());
  const m = mergeVertices(g, 1e-3);
  m.computeVertexNormals();
  return m;
}

export const C = {
  // v3 realistic interior palette (natural oaks, warm linen, muted sage, terracotta, brass)
  wood: '#c28e5c',
  woodLight: '#d4aa7d',
  woodDark: '#8c5d3c',
  cream: '#f2eadc',
  creamWarm: '#eadcc6',
  white: '#f8f4ec',
  lavender: '#9a93ae',
  lavenderDeep: '#766f8d',
  dusk: '#7e7898',
  mint: '#8da899',
  mintDeep: '#708d7d',
  sage: '#899b82',
  peach: '#d89b7e',
  peachLight: '#e5b398',
  pink: '#dfb0ae',
  rose: '#c87a7c',
  sky: '#88abc9',
  blueGrey: '#7a8ba3',
  yellow: '#e3be68',
  gold: '#c9a255',
  brass: '#c9a255',
  steel: '#b8bec6',
  dog: '#d9a45b',
  dogLight: '#edd09c',
  bear: '#966542',
  bearLight: '#c89b72',
  skin: '#f6c7af',
  skinShade: '#e8ad94',
  sleeve: '#eceae4',
  sweater: '#6f87b4',
  hair: '#5c3b2a',
  pants: '#4e5b75',
  leaf: '#5e875c',
  leafDark: '#3c6348',
  pot: '#d8b79b',
  red: '#d64c4a',
  blue: '#436db8',
};

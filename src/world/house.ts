import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import * as P from './props';
import * as T from './textures';
import { C } from './lowpoly';
import type { AABB, Interactable, Surface } from './types';
import { assets } from '../core/assets';
import { bus, damp, tweens, ease } from '../core/events';
import { sfx } from '../core/audio';
import { Dog } from './dog';

export const H = 2.6;
const _cA = new THREE.Color();
const _cB = new THREE.Color();

export const LAYOUT = {
  nursery: { minX: -5, maxX: 0, minZ: -2.5, maxZ: 2.5 },
  living: { minX: 0, maxX: 7, minZ: -3.5, maxZ: 3.5 },
  door: { z0: 0.4, z1: 1.4, h: 2.1 },
  crib: { x: -4.5, z: -0.6 },
  cribEye: new THREE.Vector3(-4.79, 0.98, -0.62),
  nurseryFloorStart: new THREE.Vector3(-2.7, 0, 0.55),
  nWindow: { x0: -3.25, x1: -1.95, y0: 0.75, y1: 2.1 },
  lWindow: { x0: 1.3, x1: 3.7, y0: 0.55, y1: 2.2 },
};

interface Hole {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

function wallFace(
  a: [number, number],
  b: [number, number],
  normal: THREE.Vector3,
  holes: Hole[],
  mat: THREE.Material,
  tile = 1.3,
): THREE.Mesh {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
  const us = new Set<number>([0, len]);
  holes.forEach((h) => {
    us.add(h.u0);
    us.add(h.u1);
  });
  const cuts = [...us].sort((x, y) => x - y);
  const pos: number[] = [], uv: number[] = [], uv1: number[] = [], nor: number[] = [];
  const quad = (u0: number, u1: number, v0: number, v1: number) => {
    const p = (u: number, v: number) => [a[0] + dir.x * u, v, a[1] + dir.y * u];
    const A = p(u0, v0), B = p(u1, v0), Cc = p(u1, v1), D = p(u0, v1);
    const e1 = new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const e2 = new THREE.Vector3(D[0] - A[0], D[1] - A[1], D[2] - A[2]);
    const flip = e1.clone().cross(e2).dot(normal) < 0;
    const tris = flip ? [A, D, Cc, A, Cc, B] : [A, B, Cc, A, Cc, D];
    const uvs = flip
      ? [[u0, v0], [u0, v1], [u1, v1], [u0, v0], [u1, v1], [u1, v0]]
      : [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    tris.forEach((t, i) => {
      pos.push(...t);
      uv.push(uvs[i][0] / tile, uvs[i][1] / tile);
      uv1.push(uvs[i][0] / len, uvs[i][1] / H);
      nor.push(normal.x, normal.y, normal.z);
    });
  };
  for (let i = 0; i < cuts.length - 1; i++) {
    const u0 = cuts[i], u1 = cuts[i + 1];
    if (u1 - u0 < 1e-4) continue;
    const mid = (u0 + u1) / 2;
    const blocking = holes.filter((h) => mid > h.u0 && mid < h.u1).sort((x, y) => x.v0 - y.v0);
    let v = 0;
    for (const h of blocking) {
      if (h.v0 > v) quad(u0, u1, v, h.v0);
      v = Math.max(v, h.v1);
    }
    if (v < H) quad(u0, u1, v, H);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.occluder = true;
  return m;
}

interface AnimSlide {
  obj: THREE.Object3D;
  axis: 'x' | 'z';
  base: number;
  offset: number;
  open: boolean;
  cur: number;
}
interface AnimSwing {
  obj: THREE.Object3D;
  axis: 'y' | 'x';
  angle: number;
  open: boolean;
  cur: number;
}
interface AnimCurtain {
  obj: THREE.Object3D;
  closedX: number;
  openX: number;
  open: boolean;
  cur: number;
}

export class House {
  root = new THREE.Group();
  colliders: AABB[] = [];
  surfaces: Surface[] = [];
  interactables: Interactable[] = [];
  mobileHub!: THREE.Group;
  ornaments: THREE.Group[] = [];
  dog!: Dog;
  sun!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  sky!: THREE.Mesh;
  lampLights: THREE.PointLight[] = [];
  lampStates: boolean[] = [true, true];
  lampMats: THREE.MeshStandardMaterial[] = [];
  tvLight!: THREE.PointLight;
  motes!: THREE.Points;
  beams: THREE.Mesh[] = [];
  occluders: THREE.Object3D[] = [];
  areaLights: THREE.RectAreaLight[] = [];

  private slides: AnimSlide[] = [];
  private swings: AnimSwing[] = [];
  private curtains: AnimCurtain[] = [];
  private nurseryCurtainOpen = [true, true];
  private livingCurtainOpen = [true, true];
  private dayK = 0;

  onMirrorRender: ((active: boolean) => void) | null = null;
  onClimbRequest: ((i: Interactable) => void) | null = null;

  constructor(private scene: THREE.Scene, private quality: 'high' | 'low') {
    scene.add(this.root);
    this.buildShell();
    this.buildOutside();
    this.buildNursery();
    this.buildLiving();
    this.buildLights();
    this.buildBeams();
    this.buildContactShadows();
    this.setDayPhase(0);
    this.root.traverse((o) => {
      if (o.userData.occluder) this.occluders.push(o);
      const m = o as THREE.Mesh;
      if (m.isMesh && m.castShadow && !(m as THREE.SkinnedMesh).isSkinnedMesh) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const ws = m.getWorldScale(new THREE.Vector3()).x;
        if ((m.geometry.boundingSphere?.radius ?? 1) * ws < 0.09) m.castShadow = false;
      }
    });
  }

  private place(o: THREE.Object3D, x: number, y: number, z: number, ry = 0) {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    this.root.add(o);
    return o;
  }

  private rugMat(map: THREE.Texture, w: number, d: number) {
    const n = assets.tex.rugNor.clone();
    n.repeat.set(w * 2.4, d * 2.4);
    return new THREE.MeshStandardMaterial({ map, normalMap: n, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.98, color: '#ffffff' });
  }

  private blobTex = T.blobShadow();
  blob(x: number, z: number, w: number, d: number, opacity = 0.5, y = 0.017, ry = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, color: '#241812', opacity, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    m.rotation.set(-Math.PI / 2, 0, ry);
    m.position.set(x, y, z);
    m.renderOrder = 1;
    m.raycast = () => {};
    this.root.add(m);
    return m;
  }

  private collide(cx: number, cz: number, hw: number, hd: number) {
    this.colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  }

  addI(i: Interactable) {
    i.obj.traverse((o) => (o.userData.interactable = i));
    this.interactables.push(i);
    return i;
  }

  private addSlideToggle(id: string, name: string, obj: THREE.Object3D, axis: 'x' | 'z', offset: number, onOpen?: () => void) {
    const base = obj.position[axis];
    const anim: AnimSlide = { obj, axis, base, offset, open: false, cur: 0 };
    this.slides.push(anim);
    const inter: Interactable = {
      id,
      name,
      kind: 'toggle',
      verb: '拉开',
      obj,
      bottom: 0,
      radius: 0.18,
      enabled: true,
      range: 1.5,
      onUse: () => {
        anim.open = !anim.open;
        inter.verb = anim.open ? '推上' : '拉开';
        sfx.drop();
        if (anim.open && onOpen) onOpen();
      },
    };
    return this.addI(inter);
  }

  private addSwingToggle(id: string, name: string, obj: THREE.Object3D, axis: 'y' | 'x', angle: number, openVerb = '打开', closeVerb = '关上', onOpen?: () => void) {
    const anim: AnimSwing = { obj, axis, angle, open: false, cur: 0 };
    this.swings.push(anim);
    const inter: Interactable = {
      id,
      name,
      kind: 'toggle',
      verb: openVerb,
      obj,
      bottom: 0,
      radius: 0.24,
      enabled: true,
      range: 1.6,
      onUse: () => {
        anim.open = !anim.open;
        inter.verb = anim.open ? closeVerb : openVerb;
        sfx.click();
        if (anim.open && onOpen) onOpen();
      },
    };
    return this.addI(inter);
  }

  private addFrameTap(id: string, name: string, obj: THREE.Object3D) {
    let crooked = false;
    const inter: Interactable = {
      id,
      name,
      kind: 'pet',
      verb: '拍一拍',
      obj,
      bottom: 0,
      radius: 0.25,
      enabled: true,
      range: 1.9,
      onUse: () => {
        crooked = !crooked;
        const target = crooked ? (Math.random() < 0.5 ? -0.14 : 0.14) : 0;
        const start = obj.rotation.z;
        sfx.bonk();
        tweens.run(0.28, (k) => (obj.rotation.z = THREE.MathUtils.lerp(start, target, ease.back(k))));
        inter.verb = crooked ? '扶正' : '拍一拍';
        bus.emit('babySpeech', crooked ? '画框歪啦～' : '摆正啦！');
      },
    };
    return this.addI(inter);
  }

  private addPlantTouch(id: string, obj: THREE.Object3D) {
    const baseRot = obj.rotation.clone();
    return this.addI({
      id,
      name: '盆栽绿植',
      kind: 'pet',
      verb: '摸叶子',
      obj,
      bottom: 0,
      radius: 0.24,
      enabled: true,
      range: 1.6,
      onUse: () => {
        sfx.tissue();
        tweens.run(0.65, (k) => {
          const w = Math.sin(k * Math.PI * 5) * Math.exp(-k * 2.5) * 0.1;
          obj.rotation.set(baseRot.x + w, baseRot.y, baseRot.z + w * 0.8);
        });
        bus.emit('babySpeech', '叶子沙沙响～');
      },
    });
  }

  /* ---------- walls, floors, ceilings ---------- */
  private buildShell() {
    const { nursery: N, living: L, door, nWindow: NW, lWindow: LW } = LAYOUT;
    const tx = assets.tex;
    const wallN = (rep: number) => {
      const t = tx.wallNor.clone();
      t.repeat.set(rep, rep);
      return t;
    };
    const wallAO = T.edgeAO(0.45, 0.55, 0.05, 0.075, true);
    const nurseryMat = new THREE.MeshStandardMaterial({
      map: T.nurseryWallpaper(),
      roughness: 0.9,
      normalMap: wallN(1.8),
      normalScale: new THREE.Vector2(0.7, 0.7),
      aoMap: wallAO,
      aoMapIntensity: 1.05,
      shadowSide: THREE.DoubleSide,
    });
    nurseryMat.map!.repeat.set(1, 1);
    const livingMat = new THREE.MeshStandardMaterial({
      map: T.livingWallpaper(),
      roughness: 0.9,
      normalMap: wallN(1.6),
      normalScale: new THREE.Vector2(0.68, 0.68),
      aoMap: wallAO,
      aoMapIntensity: 1.05,
      shadowSide: THREE.DoubleSide,
    });
    livingMat.map!.repeat.set(1, 1);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: '#f5efe6',
      roughness: 0.95,
      side: THREE.DoubleSide,
      aoMap: T.edgeAO(0.38, 0.38, 0.05, 0.05, true),
      aoMapIntensity: 1,
    });
    const floorAO = T.edgeAO(0.48, 0.48, 0.035, 0.035, true);

    this.root.add(wallFace([N.minX, N.minZ], [N.maxX, N.minZ], new THREE.Vector3(0, 0, 1), [{ u0: NW.x0 - N.minX, u1: NW.x1 - N.minX, v0: NW.y0, v1: NW.y1 }], nurseryMat));
    this.root.add(wallFace([N.minX, N.maxZ], [N.maxX, N.maxZ], new THREE.Vector3(0, 0, -1), [], nurseryMat));
    this.root.add(wallFace([N.minX, N.minZ], [N.minX, N.maxZ], new THREE.Vector3(1, 0, 0), [], nurseryMat));
    this.root.add(wallFace([0, N.minZ], [0, N.maxZ], new THREE.Vector3(-1, 0, 0), [{ u0: door.z0 - N.minZ, u1: door.z1 - N.minZ, v0: 0, v1: door.h }], nurseryMat));

    this.root.add(wallFace([L.minX, L.minZ], [L.maxX, L.minZ], new THREE.Vector3(0, 0, 1), [{ u0: LW.x0, u1: LW.x1, v0: LW.y0, v1: LW.y1 }], livingMat, 1.1));
    this.root.add(wallFace([L.minX, L.maxZ], [L.maxX, L.maxZ], new THREE.Vector3(0, 0, -1), [], livingMat, 1.1));
    this.root.add(wallFace([L.maxX, L.minZ], [L.maxX, L.maxZ], new THREE.Vector3(-1, 0, 0), [], livingMat, 1.1));
    this.root.add(wallFace([0.0, L.minZ], [0.0, L.maxZ], new THREE.Vector3(1, 0, 0), [{ u0: door.z0 - L.minZ, u1: door.z1 - L.minZ, v0: 0, v1: door.h }], livingMat, 1.1));

    const mkFloor = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      const rep = (t: THREE.Texture) => {
        const c = t.clone();
        c.repeat.set(w / 1.8, d / 1.8);
        return c;
      };
      const geo = new THREE.PlaneGeometry(w, d);
      geo.setAttribute('uv1', geo.getAttribute('uv').clone());
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          map: rep(tx.floorDiff),
          normalMap: rep(tx.floorNor),
          normalScale: new THREE.Vector2(1.1, 1.1),
          roughnessMap: rep(tx.floorRough),
          roughness: 0.85,
          color: '#faeadd',
          aoMap: floorAO,
          envMapIntensity: 1.0,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
      m.receiveShadow = true;
      this.root.add(m);
      const cg = new THREE.PlaneGeometry(w, d);
      cg.setAttribute('uv1', cg.getAttribute('uv').clone());
      const c = new THREE.Mesh(cg, ceilMat);
      c.rotation.x = Math.PI / 2;
      c.position.set((r.minX + r.maxX) / 2, H, (r.minZ + r.maxZ) / 2);
      c.castShadow = true;
      this.root.add(c);
    };
    mkFloor(N);
    mkFloor(L);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, door.z1 - door.z0), new THREE.MeshStandardMaterial({ color: C.woodDark, roughness: 0.65 }));
    strip.position.set(0, 0.005, (door.z0 + door.z1) / 2);
    strip.receiveShadow = true;
    this.root.add(strip);

    const trim = new THREE.MeshStandardMaterial({ color: '#f2ece1', roughness: 0.42 });
    const addTrim = (x: number, z: number, w: number, d: number, y: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trim);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.root.add(m);
    };
    const t = 0.025;
    for (const [r, skip] of [[N, 'east'], [L, 'west']] as const) {
      const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      for (const [y, h] of [[0.05, 0.1], [H - 0.04, 0.08]]) {
        addTrim(cx, r.minZ + t, w, t * 2, y, h);
        addTrim(cx, r.maxZ - t, w, t * 2, y, h);
        if (skip !== 'west') addTrim(r.minX + t, cz, t * 2, d, y, h);
        if (skip !== 'east') addTrim(r.maxX - t, cz, t * 2, d, y, h);
      }
    }

    const casing = new THREE.MeshStandardMaterial({ color: '#f2ece1', roughness: 0.42 });
    for (const s of [-1, 1]) {
      for (const z of [door.z0, door.z1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, door.h + 0.08, 0.08), casing);
        m.position.set(s * 0.02, (door.h + 0.08) / 2, z + (z === door.z0 ? -0.04 : 0.04));
        this.root.add(m);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, door.z1 - door.z0 + 0.16), casing);
      top.position.set(s * 0.02, door.h + 0.04, (door.z0 + door.z1) / 2);
      this.root.add(top);
    }
    const reveal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, door.z1 - door.z0), casing);
    reveal.position.set(0, door.h, (door.z0 + door.z1) / 2);
    this.root.add(reveal);

    const T2 = 0.1;
    this.colliders.push({ minX: N.minX - 1, maxX: N.maxX, minZ: N.minZ - 1, maxZ: N.minZ + 0.02 });
    this.colliders.push({ minX: N.minX - 1, maxX: N.maxX, minZ: N.maxZ - 0.02, maxZ: N.maxZ + 1 });
    this.colliders.push({ minX: N.minX - 1, maxX: N.minX + 0.02, minZ: N.minZ - 1, maxZ: N.maxZ + 1 });
    this.colliders.push({ minX: L.minX, maxX: L.maxX + 1, minZ: L.minZ - 1, maxZ: L.minZ + 0.02 });
    this.colliders.push({ minX: L.minX, maxX: L.maxX + 1, minZ: L.maxZ - 0.02, maxZ: L.maxZ + 1 });
    this.colliders.push({ minX: L.maxX - 0.02, maxX: L.maxX + 1, minZ: L.minZ - 1, maxZ: L.maxZ + 1 });
    this.colliders.push({ minX: -T2, maxX: T2, minZ: L.minZ - 1, maxZ: door.z0 });
    this.colliders.push({ minX: -T2, maxX: T2, minZ: door.z1, maxZ: L.maxZ + 1 });

    this.surfaces.push({ minX: -100, maxX: 100, minZ: -100, maxZ: 100, y: 0 });
  }

  /* ---------- outside: realistic daylight sky + smooth garden trees ---------- */
  private buildOutside() {
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 24),
      new THREE.MeshBasicMaterial({ map: T.skyGradient(), fog: false, color: new THREE.Color(1.08, 1.06, 1.04) }),
    );
    sky.position.set(1, 6.2, -18);
    this.root.add(sky);
    this.sky = sky;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ color: '#6b8356', roughness: 0.96 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1, -0.3, -12);
    ground.receiveShadow = true;
    this.root.add(ground);

    const trees: [number, number, number, number, boolean][] = [
      [-4.4, -7.5, 3.6, 1, false],
      [-1.0, -9.0, 4.4, 2, false],
      [-3.0, -11.5, 4.8, 3, true],
      [1.4, -8.0, 3.2, 4, true],
      [3.4, -9.5, 4.6, 5, false],
      [5.4, -8.0, 3.6, 6, true],
      [-6.5, -9.5, 5.0, 7, false],
      [7.5, -10, 5, 8, true],
      [0.5, -13.5, 6.4, 9, false],
      [-5.5, -14, 6.8, 10, true],
      [5.5, -14, 7, 11, false],
      [-2.2, -6.2, 1.9, 12, false],
    ];
    trees.forEach(([x, z, h, s, pine]) => {
      const t = pine ? P.pineTree(h, s) : P.tree(h, s);
      t.position.set(x, -0.3, z);
      t.castShadow = false;
      this.root.add(t);
    });
  }

  /* ---------- nursery ---------- */
  private buildNursery() {
    const { crib: cp, nWindow: NW } = LAYOUT;
    const crib = P.crib();
    this.place(crib, cp.x, 0, cp.z);
    const { W, L } = P.CRIB;
    this.collide(cp.x, cp.z, W / 2 + 0.03, L / 2 + 0.03);
    this.surfaces.push({ minX: cp.x - W / 2 + 0.06, maxX: cp.x + W / 2 - 0.06, minZ: cp.z - L / 2 + 0.06, maxZ: cp.z + L / 2 - 0.06, y: 0.48 });

    // Crib rail climb/stand interaction
    const cribStand: Interactable = {
      id: 'crib_stand',
      name: '婴儿床围栏',
      kind: 'climb',
      verb: '扶站',
      obj: crib,
      bottom: 0,
      radius: 0.7,
      enabled: true,
      range: 1.4,
      standAt: { x: cp.x + 0.62, z: cp.z, eye: 0.74, label: '婴儿床旁' },
    };
    cribStand.onUse = () => this.onClimbRequest?.(cribStand);
    this.addI(cribStand);

    // Crib pillow, blanket, pacifier (all holdable!)
    const pillow = P.cribPillow();
    this.place(pillow, cp.x - 0.12, 0.48, cp.z - L / 2 + 0.2, 0.1);
    this.addI({ id: 'crib_pillow', name: '小枕头', kind: 'hold', isSoft: true, obj: pillow, bottom: 0, radius: 0.16, enabled: true, holdPos: new THREE.Vector3(0, -0.24, -0.36), holdRot: new THREE.Euler(0.4, 0, 0) });

    const blanket = P.cribBlanket();
    this.place(blanket, cp.x, 0.48, cp.z + L / 2 - 0.3, 0);
    this.addI({ id: 'crib_blanket', name: '小被子', kind: 'hold', isSoft: true, obj: blanket, bottom: 0, radius: 0.2, enabled: true, holdPos: new THREE.Vector3(0, -0.28, -0.4), holdRot: new THREE.Euler(0.3, 0, 0) });

    const paci = P.pacifier();
    this.place(paci, cp.x - 0.22, 0.485, cp.z - 0.1, 0.5);
    this.addI({ id: 'pacifier', name: '安抚奶嘴', kind: 'hold', isPacifier: true, obj: paci, bottom: 0, radius: 0.06, enabled: true, holdPos: new THREE.Vector3(0.02, -0.14, -0.28), holdRot: new THREE.Euler(0.2, 0, 0) });

    // mobile
    const arm = P.mobileArm();
    this.place(arm, cp.x - W / 2 + 0.01, P.CRIB.rail, cp.z);
    const { hub, ornaments } = P.mobileHub();
    hub.position.set(cp.x - W / 2 + 0.01 + 0.56, P.CRIB.rail + 0.73, cp.z);
    this.root.add(hub);
    this.mobileHub = hub;
    this.ornaments = ornaments;
    ornaments.forEach((o, i) => {
      this.addI({
        id: `orn${i}`,
        name: o.userData.kind === 'star' ? '床铃星星' : '床铃月亮',
        kind: 'hold',
        obj: o,
        bottom: 0.06,
        radius: 0.07,
        isOrnament: true,
        enabled: true,
        holdPos: new THREE.Vector3(0.0, -0.15, -0.36),
        holdRot: new THREE.Euler(0, 0, 0),
      });
    });

    // teddy in the crib
    const teddy = P.teddy();
    this.place(teddy, cp.x + 0.2, 0.48, cp.z + 0.42, -0.9);
    this.addI({
      id: 'teddy',
      name: '泰迪熊',
      kind: 'hold',
      obj: teddy,
      bottom: 0,
      radius: 0.18,
      isTeddy: true,
      isSoft: true,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.4, -0.5),
      holdRot: new THREE.Euler(0.12, 0, 0),
    });

    // nightstand + interactive drawers + pill lamp
    const ns = P.nightstand();
    this.place(ns.root, -4.68, 0, 0.62, Math.PI / 2);
    this.collide(-4.68, 0.62, 0.22, 0.27);
    ns.drawers.forEach((d, idx) => this.addSlideToggle(`ns_drawer_${idx}`, idx === 0 ? '床头柜下抽屉' : '床头柜上抽屉', d, 'z', 0.2));

    const lamp = P.pillLamp();
    this.place(lamp.root, -4.7, 0.545, 0.6);
    const ll = new THREE.PointLight('#ffbd72', 2.4, 5.2, 1.5);
    ll.position.set(-4.62, 0.78, 0.62);
    this.root.add(ll);
    this.lampLights.push(ll);
    this.lampMats.push(lamp.shadeMat);
    const lampInter: Interactable = {
      id: 'lamp',
      name: '床头小夜灯',
      kind: 'toggle',
      verb: '关灯',
      obj: lamp.root,
      bottom: 0,
      radius: 0.15,
      enabled: true,
      range: 1.8,
      onUse: () => {
        this.lampStates[0] = !this.lampStates[0];
        lampInter.verb = this.lampStates[0] ? '关灯' : '开灯';
        sfx.click();
      },
    };
    this.addI(lampInter);

    // window frame + interactive curtains
    const ww = NW.x1 - NW.x0, wh = NW.y1 - NW.y0;
    const wf = P.windowFrame(ww, wh);
    this.place(wf, (NW.x0 + NW.x1) / 2, (NW.y0 + NW.y1) / 2, LAYOUT.nursery.minZ);
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? -1 : 1;
      const cu = P.curtain(0.58, 2.2, '#ebe4d6', 'rgba(205,180,150,0.35)', 0.88);
      const openX = (NW.x0 + NW.x1) / 2 + s * (ww / 2 + 0.18);
      const closedX = (NW.x0 + NW.x1) / 2 + s * (ww * 0.24);
      this.place(cu, openX, 1.32, LAYOUT.nursery.minZ + 0.14);
      const anim: AnimCurtain = { obj: cu, closedX, openX, open: true, cur: 1 };
      this.curtains.push(anim);
      const ci: Interactable = {
        id: `ncurtain_${si}`,
        name: '婴儿房窗帘',
        kind: 'toggle',
        verb: '拉上窗帘',
        obj: cu,
        bottom: 0,
        radius: 0.35,
        enabled: true,
        range: 2.2,
        onUse: () => {
          anim.open = !anim.open;
          this.nurseryCurtainOpen[si] = anim.open;
          ci.verb = anim.open ? '拉上窗帘' : '拉开窗帘';
          sfx.tissue();
        },
      };
      this.addI(ci);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, ww + 1.0, 10), new THREE.MeshStandardMaterial({ color: C.brass, metalness: 0.85, roughness: 0.25 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set((NW.x0 + NW.x1) / 2, 2.38, LAYOUT.nursery.minZ + 0.12);
    this.root.add(rod);
    this.lookable('nwindow', '窗外的风景', wf, 4.5);

    // woven nursery rug
    const rug = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.014, 1.8, 3, 0.006), this.rugMat(T.stripedRug(), 2.4, 1.8));
    rug.position.set(-2.4, 0.006, 0.6);
    rug.receiveShadow = true;
    this.root.add(rug);

    // dresser + 3 interactive drawers
    const dr = P.dresser();
    this.place(dr.root, -2.4, 0, 2.24, Math.PI);
    this.collide(-2.4, 2.24, 0.5, 0.25);
    dr.drawers.forEach((d, idx) => this.addSlideToggle(`dr_drawer_${idx}`, `衣柜第 ${idx + 1} 层抽屉`, d, 'z', 0.22));

    // shelves + holdable/touchable plush & plant
    const shelf = P.wallShelf(0.9);
    this.place(shelf, -0.02, 1.4, -1.35, -Math.PI / 2);
    const bunny = P.bunnyPlush();
    this.place(bunny, -0.12, 1.415, -1.15, -Math.PI / 2);
    this.addI({ id: 'shelf_bunny', name: '小兔玩偶', kind: 'hold', isSoft: true, obj: bunny, bottom: 0, radius: 0.12, enabled: true, holdPos: new THREE.Vector3(0, -0.22, -0.35), holdRot: new THREE.Euler(0.1, 0, 0) });
    const smallBear = P.teddy();
    smallBear.scale.setScalar(0.6);
    this.place(smallBear, -0.12, 1.415, -1.55, -Math.PI / 2);
    this.addI({ id: 'shelf_bear', name: '迷你小熊', kind: 'hold', isSoft: true, obj: smallBear, bottom: 0, radius: 0.12, enabled: true, holdPos: new THREE.Vector3(0, -0.24, -0.36), holdRot: new THREE.Euler(0.1, 0, 0) });

    const shelf2 = P.wallShelf(0.7);
    this.place(shelf2, -2.4, 1.45, 2.5, Math.PI);
    const pl = P.plant(0.55);
    this.place(pl, -2.6, 1.465, 2.38);
    this.addPlantTouch('shelf_plant', pl);
    const books = P.basket();
    books.scale.setScalar(0.5);
    this.place(books, -2.2, 1.465, 2.38);

    const pf = P.pictureFrame(0.5, 0.38, 1);
    this.place(pf, -0.01, 1.55, -0.35, -Math.PI / 2);
    this.addFrameTap('nframe', '婴儿房挂画', pf);

    // beanbag: climb/bounce!
    const bb = P.beanbag();
    this.place(bb, -0.85, 0, -1.75, 0.6);
    this.collide(-0.85, -1.75, 0.42, 0.4);
    const bbInter: Interactable = {
      id: 'beanbag',
      name: '懒人豆袋',
      kind: 'climb',
      verb: '扑上去跳',
      obj: bb,
      bottom: 0,
      radius: 0.45,
      enabled: true,
      range: 1.5,
      standAt: { x: -0.85, z: -1.75, eye: 0.72, label: '懒人豆袋' },
    };
    bbInter.onUse = () => this.onClimbRequest?.(bbInter);
    this.addI(bbInter);

    // basket + soft ball inside
    const bk = P.basket();
    this.place(bk, -0.55, 0, 2.05);
    this.collide(-0.55, 2.05, 0.22, 0.22);
    const sb = P.softClothBall();
    this.place(sb, -0.52, 0.28, 2.05);
    this.addI({
      id: 'cloth_ball',
      name: '软布球',
      kind: 'hold',
      isSoft: true,
      obj: sb,
      bottom: 0.075,
      radius: 0.09,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.17, -0.34),
      holdRot: new THREE.Euler(0, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    this.block('A', 0, -1.95, 0.2, 0.3);
    this.block('B', 1, -1.75, 0.45, -0.4);
  }

  private block(letter: string, idx: number, x: number, z: number, ry: number) {
    const s = 0.13;
    const m = P.letterBlock(letter, idx, s);
    this.place(m, x, s / 2 + 0.012, z, ry);
    m.userData.letter = letter;
    this.addI({
      id: `block${idx}`,
      name: `积木 ${letter}`,
      kind: 'hold',
      obj: m,
      bottom: s / 2,
      radius: 0.09,
      isBlock: true,
      enabled: true,
      holdPos: new THREE.Vector3(0.0, -0.17, -0.38),
      holdRot: new THREE.Euler(0.3, 0.5, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });
  }

  private lookable(id: string, name: string, obj: THREE.Object3D, range = 3.5) {
    this.addI({ id, name, kind: 'look', obj, bottom: 0, radius: 0.3, enabled: true, range });
  }

  /* ---------- living room ---------- */
  private buildLiving() {
    const { lWindow: LW } = LAYOUT;
    const rug = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.016, 2.8, 3, 0.007), this.rugMat(T.livingRug(), 3.6, 2.8));
    rug.position.set(4.0, 0.007, 0.3);
    rug.receiveShadow = true;
    this.root.add(rug);

    // Sofa + climb + 3 holdable throw pillows!
    const sofaParts = P.sofa();
    this.place(sofaParts.root, 6.4, 0, 0.2, -Math.PI / 2);
    this.collide(6.4, 0.2, 0.47, 1.02);
    const sofaInter: Interactable = {
      id: 'sofa',
      name: '客厅沙发',
      kind: 'climb',
      verb: '扶站看看',
      obj: sofaParts.frame,
      bottom: 0,
      radius: 0.9,
      enabled: true,
      range: 1.7,
      standAt: { x: 5.75, z: 0.2, eye: 0.78, label: '沙发扶手' },
    };
    sofaInter.onUse = () => this.onClimbRequest?.(sofaInter);
    this.addI(sofaInter);

    sofaParts.pillows.forEach((pm, idx) => {
      this.root.attach(pm);
      this.addI({
        id: `sofa_pillow_${idx}`,
        name: '沙发抱枕',
        kind: 'hold',
        isSoft: true,
        obj: pm,
        bottom: 0.08,
        radius: 0.2,
        enabled: true,
        holdPos: new THREE.Vector3(0, -0.26, -0.38),
        holdRot: new THREE.Euler(0.3, 0.2, 0),
        vel: new THREE.Vector3(),
        angVel: new THREE.Vector3(),
      });
    });

    // Armchair + climb + holdable pillow
    const armParts = P.armchair();
    this.place(armParts.root, 2.7, 0, -2.6, 0.45);
    this.collide(2.7, -2.6, 0.55, 0.55);
    const armInter: Interactable = {
      id: 'armchair',
      name: '单人沙发椅',
      kind: 'climb',
      verb: '扶站看看',
      obj: armParts.frame,
      bottom: 0,
      radius: 0.65,
      enabled: true,
      range: 1.6,
      standAt: { x: 2.95, z: -1.9, eye: 0.76, label: '单人椅旁' },
    };
    armInter.onUse = () => this.onClimbRequest?.(armInter);
    this.addI(armInter);

    this.root.attach(armParts.pillow);
    this.addI({
      id: 'arm_pillow',
      name: '小抱枕',
      kind: 'hold',
      isSoft: true,
      obj: armParts.pillow,
      bottom: 0.08,
      radius: 0.2,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.26, -0.38),
      holdRot: new THREE.Euler(0.3, 0.2, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    // Coffee table + holdable mug & 2 books
    const ct = P.coffeeTable();
    this.place(ct, 4.0, 0, 1.75);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.collide(4.0 + sx * 0.505, 1.75 + sz * 0.24, 0.04, 0.04);
    this.surfaces.push({ minX: 3.45, maxX: 4.55, minZ: 1.47, maxZ: 2.03, y: 0.49 });

    const mug = P.coffeeMug();
    this.place(mug, 4.3, 0.49, 1.8, 0.4);
    this.addI({
      id: 'mug',
      name: '陶瓷马克杯',
      kind: 'hold',
      isCeramic: true,
      obj: mug,
      bottom: 0,
      radius: 0.08,
      enabled: true,
      holdPos: new THREE.Vector3(0.03, -0.15, -0.3),
      holdRot: new THREE.Euler(0.1, -0.4, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    const bookA = P.storyBook('#5c79a3');
    this.place(bookA, 3.75, 0.49, 1.7, 0.2);
    this.addI({
      id: 'book_0',
      name: '精装故事书',
      kind: 'hold',
      isBook: true,
      obj: bookA,
      bottom: 0,
      radius: 0.14,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.18, -0.34),
      holdRot: new THREE.Euler(0.5, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    const bookB = P.storyBook('#c28a5b');
    this.place(bookB, 3.75, 0.522, 1.7, 0.05);
    this.addI({
      id: 'book_1',
      name: '图画绘本',
      kind: 'hold',
      isBook: true,
      obj: bookB,
      bottom: 0,
      radius: 0.14,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.18, -0.34),
      holdRot: new THREE.Euler(0.5, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    // Toy box (toggle open lid + pop out wooden toy car!)
    const tb = P.toyBox();
    this.place(tb.root, 2.3, 0, 3.15, Math.PI);
    this.collide(2.3, 3.15, 0.4, 0.27);
    const car = P.toyCar();
    this.place(car, 2.3, 0.3, 3.15, 0.4);
    const carInter = this.addI({
      id: 'toycar',
      name: '木头小汽车',
      kind: 'hold',
      obj: car,
      bottom: 0,
      radius: 0.09,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.16, -0.32),
      holdRot: new THREE.Euler(0.2, 0.7, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });
    let carPopped = false;
    this.addSwingToggle('toybox', '玩具箱', tb.lid, 'x', -1.25, '打开翻找', '盖上箱子', () => {
      if (!carPopped) {
        carPopped = true;
        const p0 = car.position.clone();
        const p1 = new THREE.Vector3(2.3, 0.015, 2.55);
        tweens.run(0.45, (k) => {
          car.position.lerpVectors(p0, p1, ease.out(k));
          car.position.y += Math.sin(k * Math.PI) * 0.35;
        });
        carInter.enabled = true;
        sfx.pop();
        bus.emit('babySpeech', '哇！翻出小汽车！');
      }
    });

    // Sideboard + 3 cabinet doors + holdable vase & jar
    const sb = P.sideboard();
    this.place(sb.root, 5.0, 0, 3.26, Math.PI);
    this.collide(5.0, 3.26, 0.72, 0.24);
    this.surfaces.push({ minX: 4.3, maxX: 5.7, minZ: 3.04, maxZ: 3.48, y: 0.85 });
    sb.doors.forEach((d, idx) => this.addSwingToggle(`sb_door_${idx}`, `餐边柜门 ${idx + 1}`, d, 'y', -1.35));

    this.root.attach(sb.vase);
    this.addI({
      id: 'vase',
      name: '花瓶',
      kind: 'hold',
      isCeramic: true,
      obj: sb.vase,
      bottom: 0,
      radius: 0.1,
      enabled: true,
      holdPos: new THREE.Vector3(0.02, -0.2, -0.34),
      holdRot: new THREE.Euler(0, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });
    this.root.attach(sb.jar);
    this.addI({
      id: 'jar',
      name: '小饼干罐',
      kind: 'hold',
      isCeramic: true,
      obj: sb.jar,
      bottom: 0,
      radius: 0.1,
      enabled: true,
      holdPos: new THREE.Vector3(0.02, -0.18, -0.32),
      holdRot: new THREE.Euler(0, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    // Bookshelf (interactive: shake/pull book)
    const bs = P.bookshelf();
    this.place(bs, 6.83, 0, -2.6, -Math.PI / 2);
    this.collide(6.83, -2.6, 0.18, 0.47);
    this.addI({
      id: 'books',
      name: '书架',
      kind: 'pet',
      verb: '拍书架',
      obj: bs,
      bottom: 0,
      radius: 0.45,
      enabled: true,
      range: 1.7,
      onUse: () => {
        sfx.drop();
        tweens.run(0.3, (k) => (bs.rotation.z = Math.sin(k * Math.PI * 3) * 0.025));
        bus.emit('babySpeech', '好多彩色的书呀～');
      },
    });

    // Floor lamp (toggleable!)
    const fl = P.floorLamp();
    this.place(fl.root, 6.6, 0, -1.55);
    this.collide(6.6, -1.55, 0.16, 0.16);
    const fll = new THREE.PointLight('#ffd09a', 2.8, 5.6, 1.5);
    fll.position.set(6.55, 1.35, -1.5);
    this.root.add(fll);
    this.lampLights.push(fll);
    this.lampMats.push(fl.shadeMat);
    const flInter: Interactable = {
      id: 'floorlamp',
      name: '客厅落地灯',
      kind: 'toggle',
      verb: '关灯',
      obj: fl.root,
      bottom: 0,
      radius: 0.22,
      enabled: true,
      range: 1.8,
      onUse: () => {
        this.lampStates[1] = !this.lampStates[1];
        flInter.verb = this.lampStates[1] ? '关灯' : '开灯';
        sfx.click();
      },
    };
    this.addI(flInter);

    // Side table & plants (all plants touchable!)
    const st = P.sideTable();
    this.place(st, 0.85, 0, -2.95);
    this.collide(0.85, -2.95, 0.3, 0.3);
    this.surfaces.push({ minX: 0.55, maxX: 1.15, minZ: -3.25, maxZ: -2.65, y: 0.62 });

    const p1 = P.plant(0.9);
    this.place(p1, 0.85, 0.62, -2.95);
    this.addPlantTouch('plant_0', p1);

    const p2 = P.plant(1.6, '#d8c0aa');
    this.place(p2, 6.6, 0, 2.95);
    this.collide(6.6, 2.95, 0.22, 0.22);
    this.addPlantTouch('plant_1', p2);

    const p3 = P.plant(1.2, '#cfa38c');
    this.place(p3, 4.3, 0, -3.15);
    this.collide(4.3, -3.15, 0.18, 0.18);
    this.addPlantTouch('plant_2', p3);

    const pf = P.pictureFrame(1.0, 0.62, 0);
    this.place(pf, 6.98, 1.55, 0.2, -Math.PI / 2);
    this.addFrameTap('lframe_0', '客厅风景画', pf);
    const pf2 = P.pictureFrame(0.5, 0.65, 1);
    this.place(pf2, 1.9, 1.5, 3.48, Math.PI);
    this.addFrameTap('lframe_1', '玄关挂画', pf2);

    // Big living room window + interactive curtains
    const ww = LW.x1 - LW.x0, wh = LW.y1 - LW.y0;
    const wf = P.windowFrame(ww, wh);
    this.place(wf, (LW.x0 + LW.x1) / 2, (LW.y0 + LW.y1) / 2, LAYOUT.living.minZ);
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? -1 : 1;
      const cu = P.curtain(0.55, 2.35, '#e2d2c3', 'rgba(255,245,230,0.3)', 0.94);
      const openX = (LW.x0 + LW.x1) / 2 + s * (ww / 2 + 0.22);
      const closedX = (LW.x0 + LW.x1) / 2 + s * (ww * 0.24);
      this.place(cu, openX, 1.3, LAYOUT.living.minZ + 0.14);
      const anim: AnimCurtain = { obj: cu, closedX, openX, open: true, cur: 1 };
      this.curtains.push(anim);
      const ci: Interactable = {
        id: `lcurtain_${si}`,
        name: '客厅窗帘',
        kind: 'toggle',
        verb: '拉上窗帘',
        obj: cu,
        bottom: 0,
        radius: 0.4,
        enabled: true,
        range: 2.3,
        onUse: () => {
          anim.open = !anim.open;
          this.livingCurtainOpen[si] = anim.open;
          ci.verb = anim.open ? '拉上窗帘' : '拉开窗帘';
          sfx.tissue();
        },
      };
      this.addI(ci);
    }
    this.lookable('lwindow', '大窗户', wf, 5);

    // Dog
    this.dog = new Dog();
    this.dog.place(5.15, -0.1, -1.32);
    this.root.add(this.dog.root);
    this.colliders.push(this.dog.collider);
    this.addI({ id: 'dog', name: '柴犬', kind: 'pet', verb: '摸摸', obj: this.dog.root, bottom: 0, radius: 0.4, enabled: true });

    // Ball
    const ball = P.ball(0.11);
    this.place(ball, 2.4, 0.11, 0.55);
    this.addI({
      id: 'ball',
      name: '皮球',
      kind: 'hold',
      obj: ball,
      bottom: 0.11,
      radius: 0.11,
      isBall: true,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.17, -0.36),
      holdRot: new THREE.Euler(0, 0, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    this.block('妈', 2, 3.05, 0.0, 0.2);
    this.block('爸', 3, 3.3, 0.45, -0.3);
    this.block('妈', 4, 2.95, 0.85, 0.6);
    this.block('宝', 5, 3.55, -0.25, 0.1);
    this.buildEggProps();
  }

  /* ---------- interactive & easter-egg props ---------- */
  tissueBox!: THREE.Group;
  tv!: THREE.Group;
  tvCanvas!: HTMLCanvasElement;
  tvTex!: THREE.CanvasTexture;
  tvOn = false;
  tvChannel = 0;
  mirror!: THREE.Group;
  mirrorReflector!: Reflector;
  mirrorFace!: THREE.Mesh;
  mirrorTex!: Record<'neutral' | 'laugh' | 'cry', THREE.Texture>;
  musicBox!: THREE.Group;

  cycleTV(fromButton = false) {
    if (!this.tvOn) {
      this.tvOn = true;
      sfx.tvOn();
    } else if (fromButton) {
      this.tvChannel = (this.tvChannel + 1) % 3;
      sfx.click();
      if (this.tvChannel === 0) {
        this.tvOn = false;
      }
    } else {
      this.tvChannel = (this.tvChannel + 1) % 3;
      if (this.tvChannel === 0) {
        this.tvOn = false;
        sfx.click();
      } else {
        sfx.tvOn();
      }
    }
    const chNames = ['小兔跳跳', '晚安星空', '汪汪冒险'];
    if (this.tvOn) bus.emit('tvSpeech', chNames[this.tvChannel]);
  }

  private buildEggProps() {
    this.tissueBox = P.tissueBox();
    this.place(this.tissueBox, -1.55, 0.012, 1.2, 0.4);
    this.addI({ id: 'tissue', name: '纸巾盒', kind: 'pet', verb: '抽一张', obj: this.tissueBox, bottom: 0, radius: 0.14, enabled: true });

    const rc = P.remote();
    this.place(rc, 2.1, 0.016, -0.5, 0.7);
    this.addI({
      id: 'remote',
      name: '遥控器',
      kind: 'hold',
      obj: rc,
      bottom: 0.0,
      radius: 0.08,
      enabled: true,
      holdPos: new THREE.Vector3(0.02, -0.16, -0.34),
      holdRot: new THREE.Euler(0.4, 0.3, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    this.tvCanvas = document.createElement('canvas');
    this.tvCanvas.width = 256;
    this.tvCanvas.height = 148;
    const g = this.tvCanvas.getContext('2d')!;
    g.fillStyle = '#111216';
    g.fillRect(0, 0, 256, 148);
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas);
    this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tv = P.tvSet(this.tvTex);
    this.place(this.tv, 5.05, 0.84, 3.24, Math.PI);

    this.tvLight = new THREE.PointLight('#8ab8e8', 0, 4.2, 1.5);
    this.tvLight.position.set(5.05, 1.15, 2.85);
    this.root.add(this.tvLight);

    const tvInter: Interactable = {
      id: 'tv',
      name: '客厅电视',
      kind: 'toggle',
      verb: '开/换台',
      obj: this.tv,
      bottom: 0,
      radius: 0.35,
      enabled: true,
      range: 1.8,
      onUse: () => this.cycleTV(true),
    };
    this.addI(tvInter);

    // Real 3D Reflector mirror in the nursery!
    this.mirror = P.floorMirror();
    this.place(this.mirror, -3.6, 0, 2.47, Math.PI);
    const refl = new Reflector(new THREE.PlaneGeometry(0.6, 0.8), {
      clipBias: 0.003,
      textureWidth: this.quality === 'high' ? 512 : 256,
      textureHeight: this.quality === 'high' ? 512 : 256,
      color: 0xd9dee3,
      multisample: this.quality === 'high' ? 2 : 0,
    });
    refl.position.set(0, 0.45, 0.02);
    refl.raycast = () => {};
    const origBefore = refl.onBeforeRender.bind(refl);
    refl.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      // skip mirror render when in living room for great performance
      if (camera.position.x > 0.25) return;
      this.onMirrorRender?.(true);
      origBefore(renderer, scene, camera, geometry, material, group);
      this.onMirrorRender?.(false);
    };
    this.mirror.add(refl);
    this.mirrorReflector = refl;

    // keep mirrorTex / mirrorFace reference for legacy mirror expression state tracking
    this.mirrorTex = { neutral: T.babyFace('neutral'), laugh: T.babyFace('laugh'), cry: T.babyFace('cry') };
    this.mirrorFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.325),
      new THREE.MeshBasicMaterial({ map: this.mirrorTex.neutral, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.mirrorFace.visible = false;
    this.mirror.add(this.mirrorFace);

    this.addI({
      id: 'mirror',
      name: '小镜子',
      kind: 'pet',
      verb: '照照镜子',
      obj: this.mirror,
      bottom: 0,
      radius: 0.32,
      enabled: true,
      range: 1.8,
      onUse: () => {
        sfx.coo();
        bus.emit('babySpeech', '镜子里的宝宝也在看我！');
      },
    });
    this.collide(-3.6, 2.47, 0.36, 0.06);

    this.musicBox = P.musicBox();
    this.place(this.musicBox, -2.95, 0.012, -2.05, 0.3);
    this.addI({ id: 'musicbox', name: '音乐盒', kind: 'pet', verb: '按一下', obj: this.musicBox, bottom: 0, radius: 0.13, enabled: true });

    const duck = P.rubberDuck();
    this.place(duck, 5.84, 0, -0.5, -2.4);
    this.addI({
      id: 'duck',
      name: '小黄鸭',
      kind: 'hold',
      obj: duck,
      bottom: 0.0,
      radius: 0.08,
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.18, -0.34),
      holdRot: new THREE.Euler(0.1, -1.4, 0),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });

    const rt = P.rattle();
    const cp = LAYOUT.crib;
    this.place(rt, cp.x + 0.25, 0.5, cp.z - 0.3, 0.4);
    rt.rotation.z = Math.PI / 2 - 0.2;
    this.addI({
      id: 'rattle',
      name: '摇铃',
      kind: 'hold',
      obj: rt,
      bottom: 0.02,
      radius: 0.09,
      enabled: true,
      holdPos: new THREE.Vector3(0.05, -0.12, -0.32),
      holdRot: new THREE.Euler(0.5, 0, -0.2),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });
    this.blob(-1.55, 1.2, 0.36, 0.26, 0.35, 0.02);
    this.blob(-2.95, -2.05, 0.32, 0.26, 0.35, 0.017);
  }

  private tvT = 0;
  private tvAcc = 0;
  updateTV(dt: number) {
    const mat = (this.tv.getObjectByName('screen') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    mat.emissiveIntensity = damp(mat.emissiveIntensity, this.tvOn ? 1.85 : 0, 6, dt);
    this.tvLight.intensity = damp(this.tvLight.intensity, this.tvOn ? 1.6 : 0, 6, dt);
    if (!this.tvOn) return;
    this.tvT += dt;
    this.tvAcc += dt;
    if (this.tvAcc < 1 / 12) return;
    this.tvAcc = 0;
    const g = this.tvCanvas.getContext('2d')!, t = this.tvT;
    if (this.tvChannel === 0) {
      this.tvLight.color.set('#a8d2eb');
      const sky = g.createLinearGradient(0, 0, 0, 148);
      sky.addColorStop(0, '#8fb8db');
      sky.addColorStop(1, '#e4edd2');
      g.fillStyle = sky;
      g.fillRect(0, 0, 256, 148);
      g.fillStyle = '#f2c94c';
      g.beginPath();
      g.arc(210, 30 + Math.sin(t * 2) * 4, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7bad6c';
      g.beginPath();
      g.ellipse(70, 160, 140, 50, 0, 0, Math.PI * 2);
      g.ellipse(220, 165, 120, 45, 0, 0, Math.PI * 2);
      g.fill();
      const x = ((t * 60) % 320) - 30, y = 104 - Math.abs(Math.sin(t * 6)) * 26;
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#4b3a2f';
      g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(x, y, 16, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(x + 13, y - 12, 9, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      for (const o of [-3, 4]) {
        g.beginPath();
        g.ellipse(x + 12 + o, y - 28, 3.5, 10, 0.15 * o, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#4b3a2f';
      g.beginPath();
      g.arc(x + 16, y - 13, 1.8, 0, Math.PI * 2);
      g.fill();
      g.font = '16px WenKai, sans-serif';
      g.fillText('CH1 · 小兔跳跳', 10, 24);
    } else if (this.tvChannel === 1) {
      this.tvLight.color.set('#7a8fd6');
      const sky = g.createLinearGradient(0, 0, 0, 148);
      sky.addColorStop(0, '#1f2b4d');
      sky.addColorStop(1, '#3e527a');
      g.fillStyle = sky;
      g.fillRect(0, 0, 256, 148);
      g.fillStyle = '#ffe59c';
      g.beginPath();
      g.arc(195, 42, 20, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(255,248,210,${0.4 + 0.5 * Math.sin(t * 3 + i)})`;
        g.beginPath();
        g.arc((i * 43 + 17) % 240, (i * 29 + 20) % 100, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#f5e9d6';
      g.font = '16px WenKai, sans-serif';
      g.fillText('CH2 · 晚安星空', 10, 24);
    } else {
      this.tvLight.color.set('#f0c27a');
      g.fillStyle = '#f7e5cc';
      g.fillRect(0, 0, 256, 148);
      g.fillStyle = '#d99a52';
      const bx = 128 + Math.sin(t * 3) * 55;
      g.beginPath();
      g.arc(bx, 88, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4b3a2f';
      g.font = '16px WenKai, sans-serif';
      g.fillText('CH3 · 汪汪大冒险', 10, 24);
    }
    this.tvTex.needsUpdate = true;
  }

  /* ---------- lights ---------- */
  private sunTarget = new THREE.Vector3(1.0, 0, 0);
  private buildLights() {
    RectAreaLightUniformsLib.init();

    const hemi = new THREE.HemisphereLight('#e8eff7', '#bfa892', 0.6);
    this.scene.add(hemi);
    this.hemi = hemi;

    // Realistic window sky portals (soft architectural daylight fill entering windows)
    const { nWindow: NW, lWindow: LW } = LAYOUT;
    if (this.quality === 'high') {
      const nPortal = new THREE.RectAreaLight('#d6e8ff', 2.8, NW.x1 - NW.x0, NW.y1 - NW.y0);
      nPortal.position.set((NW.x0 + NW.x1) / 2, (NW.y0 + NW.y1) / 2, LAYOUT.nursery.minZ + 0.08);
      nPortal.lookAt((NW.x0 + NW.x1) / 2, 0.4, 0.5);
      this.scene.add(nPortal);
      this.areaLights.push(nPortal);

      const lPortal = new THREE.RectAreaLight('#dcecff', 3.2, LW.x1 - LW.x0, LW.y1 - LW.y0);
      lPortal.position.set((LW.x0 + LW.x1) / 2, (LW.y0 + LW.y1) / 2, LAYOUT.living.minZ + 0.08);
      lPortal.lookAt((LW.x0 + LW.x1) / 2, 0.4, 0.8);
      this.scene.add(lPortal);
      this.areaLights.push(lPortal);
    }

    const sun = new THREE.DirectionalLight('#ffe4c2', 4.6);
    sun.position.copy(this.sunTarget).add(new THREE.Vector3(-1.4, 2.4, -3.6).multiplyScalar(4));
    sun.target.position.copy(this.sunTarget);
    sun.castShadow = true;
    const s = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -7.5;
    cam.right = 7.5;
    cam.top = 5.5;
    cam.bottom = -5.5;
    cam.near = 1;
    cam.far = 38;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = this.quality === 'high' ? 4.2 : 2.5;
    sun.shadow.blurSamples = 12;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  private buildContactShadows() {
    const c = LAYOUT.crib;
    this.blob(c.x, c.z, 1.15, 1.75, 0.58);
    this.blob(-4.68, 0.62, 0.75, 0.65, 0.48);
    this.blob(-2.4, 2.24, 1.35, 0.7, 0.48);
    this.blob(-0.85, -1.75, 1.15, 1.05, 0.52);
    this.blob(-0.55, 2.05, 0.6, 0.6, 0.48);
    this.blob(6.4, 0.2, 1.25, 2.4, 0.58);
    this.blob(2.7, -2.6, 1.35, 1.35, 0.52, 0.017, 0.45);
    this.blob(4.0, 1.75, 1.45, 0.95, 0.36, 0.02);
    this.blob(2.3, 3.15, 1.0, 0.7, 0.48);
    this.blob(5.0, 3.26, 1.7, 0.65, 0.48);
    this.blob(6.83, -2.6, 0.55, 1.2, 0.48);
    this.blob(6.6, -1.55, 0.5, 0.5, 0.44);
    this.blob(0.85, -2.95, 0.8, 0.8, 0.44);
    this.blob(6.6, 2.95, 0.55, 0.55, 0.44);
    this.blob(4.3, -3.15, 0.5, 0.5, 0.44);
  }

  setDayPhase(k: number) {
    this.dayK = k;
    const sun = this.sun;
    const elev = THREE.MathUtils.lerp(2.45, 1.12, k);
    sun.position.copy(this.sunTarget).add(new THREE.Vector3(-1.4 - k * 0.8, elev, -3.6).multiplyScalar(4));
    sun.color.lerpColors(_cA.set('#ffe5c4'), _cB.set('#ff9b59'), k);
    sun.intensity = THREE.MathUtils.lerp(4.6, 2.7, k);
    this.hemi.intensity = THREE.MathUtils.lerp(0.6, 0.38, k);
    this.hemi.color.lerpColors(_cA.set('#e8f0fa'), _cB.set('#d9c4de'), k);
    this.lampBase = THREE.MathUtils.lerp(0.9, 2.1, k);
    if (this.areaLights.length) {
      this.areaLights.forEach((al, idx) => {
        al.intensity = THREE.MathUtils.lerp(idx === 0 ? 2.8 : 3.2, 1.4, k);
        al.color.lerpColors(_cA.set('#d8eaff'), _cB.set('#f5c9b0'), k);
      });
    }
    if (this.sky) (this.sky.material as THREE.MeshBasicMaterial).color.lerpColors(_cA.setRGB(1.08, 1.06, 1.04), _cB.setRGB(1.02, 0.78, 0.74), k);
  }
  lampBase = 1;

  private buildBeams() {
    const dir = this.sun.target.position.clone().sub(this.sun.position).normalize();
    const beamMat = new THREE.MeshBasicMaterial({
      map: T.beamTex(),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const makeBeam = (x0: number, x1: number, y0: number, y1: number, z: number) => {
      const corners = [
        new THREE.Vector3(x0, y0, z), new THREE.Vector3(x1, y0, z),
        new THREE.Vector3(x1, y1, z), new THREE.Vector3(x0, y1, z),
      ];
      const far = corners.map((c) => c.clone().add(dir.clone().multiplyScalar(c.y / -dir.y)));
      const pos: number[] = [], uv: number[] = [];
      const face = (a: number, b: number) => {
        const A = corners[a], B = corners[b], Cc = far[b], D = far[a];
        pos.push(A.x, A.y, A.z, B.x, B.y, B.z, Cc.x, Cc.y, Cc.z, A.x, A.y, A.z, Cc.x, Cc.y, Cc.z, D.x, D.y, D.z);
        uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
      };
      face(0, 1);
      face(1, 2);
      face(2, 3);
      face(3, 0);
      const mA = corners[0].clone().lerp(corners[1], 0.5), mB = corners[3].clone().lerp(corners[2], 0.5);
      const mC = far[3].clone().lerp(far[2], 0.5), mD = far[0].clone().lerp(far[1], 0.5);
      pos.push(mA.x, mA.y, mA.z, mB.x, mB.y, mB.z, mC.x, mC.y, mC.z, mA.x, mA.y, mA.z, mC.x, mC.y, mC.z, mD.x, mD.y, mD.z);
      uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(g, beamMat.clone());
      m.renderOrder = 5;
      this.root.add(m);
      this.beams.push(m);
    };
    const { nWindow: NW, lWindow: LW } = LAYOUT;
    makeBeam(NW.x0 + 0.05, NW.x1 - 0.05, NW.y0 + 0.05, NW.y1 - 0.05, LAYOUT.nursery.minZ);
    makeBeam(LW.x0 + 0.05, LW.x1 - 0.05, LW.y0 + 0.05, LW.y1 - 0.05, LAYOUT.living.minZ);

    const n = 140;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const inN = i % 2 === 0;
      const W = inN ? NW : LW;
      const z0 = inN ? LAYOUT.nursery.minZ : LAYOUT.living.minZ;
      const t = Math.random();
      const p = new THREE.Vector3(THREE.MathUtils.lerp(W.x0, W.x1, Math.random()), THREE.MathUtils.lerp(W.y0, W.y1, Math.random()), z0);
      p.add(dir.clone().multiplyScalar(t * (p.y / -dir.y)));
      pos.set([p.x, p.y, p.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.014, map: T.glowSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe5be', opacity: 0.65 }),
    );
    this.motes.userData.base = pos.slice();
    this.root.add(this.motes);
  }

  update(t: number, dt: number) {
    this.mobileHub.rotation.y += dt * 0.25;
    this.ornaments.forEach((o) => {
      if (o.parent && o.parent.parent === this.mobileHub) o.rotation.y = Math.sin(t * o.userData.spin) * 1.2;
    });

    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = this.motes.userData.base as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.3 + i) * 0.05,
        base[i * 3 + 1] + Math.sin(t * 0.21 + i * 1.7) * 0.07,
        base[i * 3 + 2] + Math.cos(t * 0.25 + i * 0.7) * 0.05,
      );
    }
    pos.needsUpdate = true;

    // animate drawers, cabinet doors, curtains, and toggleable lamps
    for (const s of this.slides) {
      s.cur = damp(s.cur, s.open ? 1 : 0, 10, dt);
      s.obj.position[s.axis] = s.base + s.cur * s.offset;
    }
    for (const sw of this.swings) {
      sw.cur = damp(sw.cur, sw.open ? 1 : 0, 10, dt);
      sw.obj.rotation[sw.axis] = sw.cur * sw.angle;
    }
    for (const c of this.curtains) {
      c.cur = damp(c.cur, c.open ? 1 : 0, 8, dt);
      c.obj.position.x = THREE.MathUtils.lerp(c.closedX, c.openX, c.cur);
    }

    // lamp intensities & shade emissive
    this.lampLights.forEach((l, i) => {
      const target = this.lampStates[i] ? (i === 0 ? 2.4 : 2.8) * this.lampBase * (1 + Math.sin(t * 1.3 + i) * 0.025) : 0;
      l.intensity = damp(l.intensity, target, 10, dt);
      if (this.lampMats[i]) this.lampMats[i].emissiveIntensity = damp(this.lampMats[i].emissiveIntensity, this.lampStates[i] ? 1.45 : 0, 10, dt);
    });

    // sun beams respond to curtains being open/closed
    const nOpen = (this.nurseryCurtainOpen[0] ? 0.5 : 0.1) + (this.nurseryCurtainOpen[1] ? 0.5 : 0.1);
    const lOpen = (this.livingCurtainOpen[0] ? 0.5 : 0.1) + (this.livingCurtainOpen[1] ? 0.5 : 0.1);
    const baseOp = THREE.MathUtils.lerp(0.15, 0.25, this.dayK);
    if (this.beams[0]) (this.beams[0].material as THREE.MeshBasicMaterial).opacity = damp((this.beams[0].material as THREE.MeshBasicMaterial).opacity, baseOp * nOpen, 6, dt);
    if (this.beams[1]) (this.beams[1].material as THREE.MeshBasicMaterial).opacity = damp((this.beams[1].material as THREE.MeshBasicMaterial).opacity, baseOp * lOpen, 6, dt);
  }

  surfaceAt(x: number, z: number, maxY = 5): number {
    let y = 0;
    for (const s of this.surfaces) if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.y <= maxY && s.y > y) y = s.y;
    return y;
  }
}

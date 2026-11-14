import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as P from './props';
import * as T from './textures';
import { C } from './lowpoly';
import type { AABB, Interactable, Surface } from './types';
import { assets } from '../core/assets';
import { Dog } from './dog';

export const H = 2.6; // ceiling height
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

/** Interior wall face (plane strips around holes) with world-scaled UVs. */
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
    // decide winding so the face looks along `normal`
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

export class House {
  root = new THREE.Group();
  colliders: AABB[] = [];
  surfaces: Surface[] = [];
  interactables: Interactable[] = [];
  mobileHub!: THREE.Group;
  ornaments: THREE.Group[] = [];
  dog!: Dog;
  sun!: THREE.DirectionalLight;
  lampLights: THREE.PointLight[] = [];
  motes!: THREE.Points;
  beams: THREE.Mesh[] = [];
  occluders: THREE.Object3D[] = [];

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
    n.repeat.set(w * 2.2, d * 2.2);
    return new THREE.MeshStandardMaterial({ map, normalMap: n, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1, color: '#ffffff' });
  }

  private blobTex = T.blobShadow();
  /** soft contact shadow under furniture (cheap baked-AO substitute that also works on phones) */
  blob(x: number, z: number, w: number, d: number, opacity = 0.5, y = 0.017, ry = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, color: '#2a1a12', opacity, polygonOffset: true, polygonOffsetFactor: -2 }),
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

  private addI(i: Interactable) {
    i.obj.traverse((o) => (o.userData.interactable = i));
    this.interactables.push(i);
    return i;
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
    const wallAO = T.edgeAO(0.42, 0.5, 0.05, 0.07, true);
    const nurseryMat = new THREE.MeshStandardMaterial({ map: T.nurseryWallpaper(), roughness: 0.88, normalMap: wallN(1.6), normalScale: new THREE.Vector2(0.6, 0.6), aoMap: wallAO, aoMapIntensity: 1, shadowSide: THREE.DoubleSide });
    nurseryMat.map!.repeat.set(1, 1);
    const livingMat = new THREE.MeshStandardMaterial({ map: T.livingWallpaper(), roughness: 0.88, normalMap: wallN(1.4), normalScale: new THREE.Vector2(0.6, 0.6), aoMap: wallAO, aoMapIntensity: 1, shadowSide: THREE.DoubleSide });
    livingMat.map!.repeat.set(1, 1);
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#fbf4ea', roughness: 0.95, side: THREE.DoubleSide, aoMap: T.edgeAO(0.35, 0.35, 0.05, 0.05, true), aoMapIntensity: 1 });
    const floorAO = T.edgeAO(0.45, 0.45, 0.035, 0.035, true);

    // nursery walls
    this.root.add(wallFace([N.minX, N.minZ], [N.maxX, N.minZ], new THREE.Vector3(0, 0, 1), [{ u0: NW.x0 - N.minX, u1: NW.x1 - N.minX, v0: NW.y0, v1: NW.y1 }], nurseryMat));
    this.root.add(wallFace([N.minX, N.maxZ], [N.maxX, N.maxZ], new THREE.Vector3(0, 0, -1), [], nurseryMat));
    this.root.add(wallFace([N.minX, N.minZ], [N.minX, N.maxZ], new THREE.Vector3(1, 0, 0), [], nurseryMat));
    this.root.add(wallFace([0, N.minZ], [0, N.maxZ], new THREE.Vector3(-1, 0, 0), [{ u0: door.z0 - N.minZ, u1: door.z1 - N.minZ, v0: 0, v1: door.h }], nurseryMat));
    // living walls
    this.root.add(wallFace([L.minX, L.minZ], [L.maxX, L.minZ], new THREE.Vector3(0, 0, 1), [{ u0: LW.x0, u1: LW.x1, v0: LW.y0, v1: LW.y1 }], livingMat, 1.1));
    this.root.add(wallFace([L.minX, L.maxZ], [L.maxX, L.maxZ], new THREE.Vector3(0, 0, -1), [], livingMat, 1.1));
    this.root.add(wallFace([L.maxX, L.minZ], [L.maxX, L.maxZ], new THREE.Vector3(-1, 0, 0), [], livingMat, 1.1));
    this.root.add(wallFace([0.0, L.minZ], [0.0, L.maxZ], new THREE.Vector3(1, 0, 0), [{ u0: door.z0 - L.minZ, u1: door.z1 - L.minZ, v0: 0, v1: door.h }], livingMat, 1.1));

    // floors
    const mkFloor = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
      const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      const rep = (t: THREE.Texture) => {
        const c = t.clone();
        c.repeat.set(w / 1.9, d / 1.9);
        return c;
      };
      const geo = new THREE.PlaneGeometry(w, d);
      geo.setAttribute('uv1', geo.getAttribute('uv').clone());
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          map: rep(tx.floorDiff),
          normalMap: rep(tx.floorNor),
          roughnessMap: rep(tx.floorRough),
          roughness: 0.95,
          color: '#fff1e2',
          aoMap: floorAO,
          envMapIntensity: 0.9,
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
    // door threshold floor strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, door.z1 - door.z0), new THREE.MeshStandardMaterial({ color: C.woodDark, roughness: 0.8 }));
    strip.position.set(0, 0.005, (door.z0 + door.z1) / 2);
    strip.receiveShadow = true;
    this.root.add(strip);

    // skirting boards + crown moulding (merged per room)
    const trim = new THREE.MeshStandardMaterial({ color: '#f7f0e6', roughness: 0.45 });
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
    // door casing on both sides
    const casing = new THREE.MeshStandardMaterial({ color: '#f7f0e6', roughness: 0.45 });
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

    // collision walls (thick boxes outside each wall line)
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

  /* ---------- outside: sky + low-poly trees ---------- */
  private buildOutside() {
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 22),
      new THREE.MeshBasicMaterial({ map: T.skyGradient(), fog: false, color: new THREE.Color(1.25, 1.2, 1.15) }),
    );
    sky.position.set(1, 6, -18);
    this.root.add(sky);
    this.sky = sky;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ color: '#9db38a', roughness: 1, flatShading: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1, -0.3, -12);
    ground.receiveShadow = true;
    this.root.add(ground);
    // hedge just outside
    const trees: [number, number, number, number, boolean][] = [
      [-4.4, -7.5, 3.6, 1, false], [-1.0, -9.0, 4.4, 2, false], [-3.0, -11.5, 4.8, 3, true], [1.4, -8.0, 3.2, 4, true],
      [3.4, -9.5, 4.6, 5, false], [5.4, -8.0, 3.6, 6, true], [-6.5, -9.5, 5.0, 7, false], [7.5, -10, 5, 8, true],
      [0.5, -13.5, 6.4, 9, false], [-5.5, -14, 6.8, 10, true], [5.5, -14, 7, 11, false], [-2.2, -6.2, 1.8, 12, false],
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
      enabled: true,
      holdPos: new THREE.Vector3(0, -0.4, -0.5),
      holdRot: new THREE.Euler(0.12, 0, 0),
    });

    // nightstand + glowing pill lamp
    const ns = P.nightstand();
    this.place(ns, -4.68, 0, 0.62, Math.PI / 2);
    this.collide(-4.68, 0.62, 0.22, 0.27);
    const lamp = P.pillLamp();
    this.place(lamp, -4.7, 0.545, 0.6);
    const ll = new THREE.PointLight('#ffc27a', 2.2, 4.5, 1.6);
    ll.position.set(-4.62, 0.78, 0.62);
    this.root.add(ll);
    this.lampLights.push(ll);
    this.lookable('lamp', '小夜灯', lamp, 3);

    // window frame + sheer curtains
    const ww = NW.x1 - NW.x0, wh = NW.y1 - NW.y0;
    const wf = P.windowFrame(ww, wh);
    this.place(wf, (NW.x0 + NW.x1) / 2, (NW.y0 + NW.y1) / 2, LAYOUT.nursery.minZ);
    for (const s of [-1, 1]) {
      const cu = P.curtain(0.55, 2.2, '#f7efe2', 'rgba(240,190,140,0.55)', 0.8);
      this.place(cu, (NW.x0 + NW.x1) / 2 + s * (ww / 2 + 0.18), 1.32, LAYOUT.nursery.minZ + 0.14);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, ww + 1.0, 6), new THREE.MeshStandardMaterial({ color: C.woodLight }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set((NW.x0 + NW.x1) / 2, 2.38, LAYOUT.nursery.minZ + 0.12);
    this.root.add(rod);
    this.lookable('nwindow', '窗外的树', wf, 4.5);

    // striped rug
    const rug = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.014, 1.8, 2, 0.006), this.rugMat(T.stripedRug(), 2.4, 1.8));
    rug.position.set(-2.4, 0.006, 0.6);
    rug.receiveShadow = true;
    this.root.add(rug);

    // dresser + shelf + plush
    const dr = P.dresser();
    this.place(dr, -2.4, 0, 2.24, Math.PI);
    this.collide(-2.4, 2.24, 0.5, 0.25);
    const shelf = P.wallShelf(0.9);
    this.place(shelf, -0.02, 1.4, -1.35, -Math.PI / 2);
    const bunny = P.bunnyPlush();
    this.place(bunny, -0.12, 1.415, -1.15, -Math.PI / 2);
    const smallBear = P.teddy();
    smallBear.scale.setScalar(0.6);
    this.place(smallBear, -0.12, 1.415, -1.55, -Math.PI / 2);
    this.lookable('shelf', '架子上的小兔', bunny, 4);
    const shelf2 = P.wallShelf(0.7);
    this.place(shelf2, -2.4, 1.45, 2.5, Math.PI);
    const pl = P.plant(0.55);
    this.place(pl, -2.6, 1.465, 2.38);
    const books = P.basket();
    books.scale.setScalar(0.5);
    this.place(books, -2.2, 1.465, 2.38);
    // frame on east wall
    const pf = P.pictureFrame(0.5, 0.38, 1);
    this.place(pf, -0.01, 1.55, -0.35, -Math.PI / 2);

    // beanbag + basket
    const bb = P.beanbag();
    this.place(bb, -0.85, 0, -1.75, 0.6);
    this.collide(-0.85, -1.75, 0.42, 0.4);
    const bk = P.basket();
    this.place(bk, -0.55, 0, 2.05);
    this.collide(-0.55, 2.05, 0.22, 0.22);

    // two letter blocks on the rug
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
    });
  }

  private lookable(id: string, name: string, obj: THREE.Object3D, range = 3.5) {
    this.addI({ id, name, kind: 'look', obj, bottom: 0, radius: 0.3, enabled: true, range });
  }

  /* ---------- living room ---------- */
  private buildLiving() {
    const { lWindow: LW } = LAYOUT;
    // rug
    const rug = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.016, 2.8, 2, 0.007), this.rugMat(T.livingRug(), 3.6, 2.8));
    rug.position.set(4.0, 0.007, 0.3);
    rug.receiveShadow = true;
    this.root.add(rug);

    const sofa = P.sofa();
    this.place(sofa, 6.4, 0, 0.2, -Math.PI / 2);
    this.collide(6.4, 0.2, 0.47, 1.02);
    this.lookable('sofa', '软软的沙发', sofa, 3.5);
    const arm = P.armchair();
    this.place(arm, 2.7, 0, -2.6, 0.45);
    this.collide(2.7, -2.6, 0.55, 0.55);
    const ct = P.coffeeTable();
    this.place(ct, 4.0, 0, 1.75);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.collide(4.0 + sx * 0.505, 1.75 + sz * 0.24, 0.04, 0.04);
    this.surfaces.push({ minX: 3.45, maxX: 4.55, minZ: 1.47, maxZ: 2.03, y: 0.49 });

    const tb = P.toyBox();
    this.place(tb, 2.3, 0, 3.15, Math.PI);
    this.collide(2.3, 3.15, 0.4, 0.27);
    this.lookable('toybox', '玩具箱', tb, 3.5);

    const sb = P.sideboard();
    this.place(sb, 5.0, 0, 3.26, Math.PI);
    this.collide(5.0, 3.26, 0.72, 0.24);
    const bs = P.bookshelf();
    this.place(bs, 6.83, 0, -2.6, -Math.PI / 2);
    this.collide(6.83, -2.6, 0.18, 0.47);
    this.lookable('books', '好多书', bs, 4);
    const fl = P.floorLamp();
    this.place(fl, 6.6, 0, -1.55);
    this.collide(6.6, -1.55, 0.16, 0.16);
    const fll = new THREE.PointLight('#ffd09a', 2.6, 5, 1.5);
    fll.position.set(6.55, 1.35, -1.5);
    this.root.add(fll);
    this.lampLights.push(fll);

    const st = P.sideTable();
    this.place(st, 0.85, 0, -2.95);
    this.collide(0.85, -2.95, 0.3, 0.3);
    const p1 = P.plant(0.9);
    this.place(p1, 0.85, 0.62, -2.95);
    const p2 = P.plant(1.6, '#f2ddc8');
    this.place(p2, 6.6, 0, 2.95);
    this.collide(6.6, 2.95, 0.22, 0.22);
    this.lookable('plant', '绿绿的植物', p2, 3.5);
    const p3 = P.plant(1.2, '#e6b8a0');
    this.place(p3, 4.3, 0, -3.15);
    this.collide(4.3, -3.15, 0.18, 0.18);

    const pf = P.pictureFrame(1.0, 0.62, 0);
    this.place(pf, 6.98, 1.55, 0.2, -Math.PI / 2);
    const pf2 = P.pictureFrame(0.5, 0.65, 1);
    this.place(pf2, 1.9, 1.5, 3.48, Math.PI);

    // big window + peach curtains
    const ww = LW.x1 - LW.x0, wh = LW.y1 - LW.y0;
    const wf = P.windowFrame(ww, wh);
    this.place(wf, (LW.x0 + LW.x1) / 2, (LW.y0 + LW.y1) / 2, LAYOUT.living.minZ);
    for (const s of [-1, 1]) {
      const cu = P.curtain(0.5, 2.35, '#f3b49a', 'rgba(255,230,210,0.35)', 0.97);
      this.place(cu, (LW.x0 + LW.x1) / 2 + s * (ww / 2 + 0.22), 1.3, LAYOUT.living.minZ + 0.14);
    }
    this.lookable('lwindow', '大窗户', wf, 5);

    // dog (rigged CC0 Shiba)
    this.dog = new Dog();
    this.dog.place(5.15, -0.1, -1.32);
    this.root.add(this.dog.root);
    this.colliders.push(this.dog.collider);
    this.addI({ id: 'dog', name: '狗狗', kind: 'pet', obj: this.dog.root, bottom: 0, radius: 0.4, enabled: true });

    // ball
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
    });

    // letter blocks
    this.block('妈', 2, 3.05, 0.0, 0.2);
    this.block('爸', 3, 3.3, 0.45, -0.3);
    this.block('妈', 4, 2.95, 0.85, 0.6);
    this.block('宝', 5, 3.55, -0.25, 0.1);
    this.buildEggProps();
  }

  /* ---------- v2: easter-egg props ---------- */
  tissueBox!: THREE.Group;
  tv!: THREE.Group;
  tvCanvas!: HTMLCanvasElement;
  tvTex!: THREE.CanvasTexture;
  tvOn = false;
  mirror!: THREE.Group;
  mirrorFace!: THREE.Mesh;
  mirrorTex!: Record<'neutral' | 'laugh' | 'cry', THREE.Texture>;
  musicBox!: THREE.Group;
  private buildEggProps() {
    // tissue box on the nursery rug
    this.tissueBox = P.tissueBox();
    this.place(this.tissueBox, -1.55, 0.012, 1.2, 0.4);
    this.addI({ id: 'tissue', name: '纸巾盒', kind: 'pet', obj: this.tissueBox, bottom: 0, radius: 0.14, enabled: true });
    // remote control on the living-room rug
    const rc = P.remote();
    this.place(rc, 2.1, 0.016, -0.5, 0.7);
    this.addI({ id: 'remote', name: '遥控器', kind: 'hold', obj: rc, bottom: 0.0, radius: 0.08, enabled: true, holdPos: new THREE.Vector3(0.02, -0.16, -0.34), holdRot: new THREE.Euler(0.4, 0.3, 0) });
    // TV on the sideboard (screen is a live canvas)
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
    this.lookable('tv', '电视', this.tv, 5);
    // low floor mirror in the nursery
    this.mirror = P.floorMirror();
    this.place(this.mirror, -3.6, 0, 2.47, Math.PI);
    this.mirrorTex = { neutral: T.babyFace('neutral'), laugh: T.babyFace('laugh'), cry: T.babyFace('cry') };
    this.mirrorFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.325),
      new THREE.MeshBasicMaterial({ map: this.mirrorTex.neutral, transparent: true, opacity: 0, depthWrite: false, color: '#f3e9e2' }),
    );
    this.mirrorFace.position.set(0, 0.36, 0.02);
    this.mirrorFace.raycast = () => {};
    this.mirror.add(this.mirrorFace);
    this.lookable('mirror', '小镜子', this.mirror, 2.2);
    this.collide(-3.6, 2.47, 0.36, 0.06);
    // music box under the nursery window
    this.musicBox = P.musicBox();
    this.place(this.musicBox, -2.95, 0.012, -2.05, 0.3);
    this.addI({ id: 'musicbox', name: '音乐盒', kind: 'pet', obj: this.musicBox, bottom: 0, radius: 0.13, enabled: true });
    // rubber duck peeking out from under the sofa
    const duck = P.rubberDuck();
    this.place(duck, 5.84, 0, -0.5, -2.4);
    this.addI({ id: 'duck', name: '小黄鸭', kind: 'hold', obj: duck, bottom: 0.0, radius: 0.08, enabled: true, holdPos: new THREE.Vector3(0, -0.18, -0.34), holdRot: new THREE.Euler(0.1, -1.4, 0) });
    // rattle in the crib, by the pillow
    const rt = P.rattle();
    const cp = LAYOUT.crib;
    this.place(rt, cp.x - 0.18, 0.5, cp.z - 0.32, 0.4);
    rt.rotation.z = Math.PI / 2 - 0.2;
    this.addI({ id: 'rattle', name: '摇铃', kind: 'hold', obj: rt, bottom: 0.02, radius: 0.09, enabled: true, holdPos: new THREE.Vector3(0.05, -0.12, -0.32), holdRot: new THREE.Euler(0.5, 0, -0.2) });
    this.blob(-1.55, 1.2, 0.36, 0.26, 0.35, 0.02);
    this.blob(-2.95, -2.05, 0.32, 0.26, 0.35, 0.017);
  }

  /** little cartoon on the TV (drawn at ~12 fps while it's on) */
  private tvT = 0;
  private tvAcc = 0;
  updateTV(dt: number) {
    const mat = (this.tv.getObjectByName('screen') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, this.tvOn ? 1.25 : 0, 6, dt);
    if (!this.tvOn) return;
    this.tvT += dt;
    this.tvAcc += dt;
    if (this.tvAcc < 1 / 12) return;
    this.tvAcc = 0;
    const g = this.tvCanvas.getContext('2d')!, t = this.tvT;
    const sky = g.createLinearGradient(0, 0, 0, 148);
    sky.addColorStop(0, '#9fc6e6');
    sky.addColorStop(1, '#e9f2d8');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 148);
    g.fillStyle = '#f2c94c';
    g.beginPath();
    g.arc(210, 30 + Math.sin(t * 2) * 4, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8fbf7a';
    g.beginPath();
    g.ellipse(70, 160, 140, 50, 0, 0, Math.PI * 2);
    g.ellipse(220, 165, 120, 45, 0, 0, Math.PI * 2);
    g.fill();
    // hopping bunny
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
    g.font = '18px WenKai, sans-serif';
    g.fillText('小兔跳跳', 12, 26);
    this.tvTex.needsUpdate = true;
  }
  /* ---------- lights ---------- */
  hemi!: THREE.HemisphereLight;
  sky!: THREE.Mesh;
  private sunTarget = new THREE.Vector3(1.0, 0, 0);
  private buildLights() {
    // the HDR environment (set by the game) does most of the soft bounce now; the hemi only adds the pastel tint
    const hemi = new THREE.HemisphereLight('#f6eefc', '#e8cdb8', 0.55);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight('#ffd2a0', 4.2);
    sun.position.copy(this.sunTarget).add(new THREE.Vector3(-1.4, 2.4, -3.6).multiplyScalar(4));
    sun.target.position.copy(this.sunTarget);
    sun.castShadow = true;
    const s = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 6;
    cam.bottom = -6;
    cam.near = 1;
    cam.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = this.quality === 'high' ? 5 : 3;
    sun.shadow.blurSamples = 12;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  /** contact shadows under furniture – baked-AO look without an SSAO pass */
  private buildContactShadows() {
    const c = LAYOUT.crib;
    this.blob(c.x, c.z, 1.15, 1.75, 0.55);
    this.blob(-4.68, 0.62, 0.75, 0.65, 0.45);
    this.blob(-2.4, 2.24, 1.35, 0.7, 0.45);
    this.blob(-0.85, -1.75, 1.15, 1.05, 0.5);
    this.blob(-0.55, 2.05, 0.6, 0.6, 0.45);
    this.blob(6.4, 0.2, 1.25, 2.4, 0.55);
    this.blob(2.7, -2.6, 1.35, 1.35, 0.5, 0.017, 0.45);
    this.blob(4.0, 1.75, 1.45, 0.95, 0.35, 0.02);
    this.blob(2.3, 3.15, 1.0, 0.7, 0.45);
    this.blob(5.0, 3.26, 1.7, 0.65, 0.45);
    this.blob(6.83, -2.6, 0.55, 1.2, 0.45);
    this.blob(6.6, -1.55, 0.5, 0.5, 0.4);
    this.blob(0.85, -2.95, 0.8, 0.8, 0.4);
    this.blob(6.6, 2.95, 0.55, 0.55, 0.4);
    this.blob(4.3, -3.15, 0.5, 0.5, 0.4);
  }

  /**
   * Time of day 0 = warm afternoon → 1 = golden dusk. The sun drops and turns orange,
   * lamps warm up, the sky deepens. Driven slowly by the game over the demo.
   */
  setDayPhase(k: number) {
    const sun = this.sun;
    const elev = THREE.MathUtils.lerp(2.4, 1.15, k);
    sun.position.copy(this.sunTarget).add(new THREE.Vector3(-1.4 - k * 0.8, elev, -3.6).multiplyScalar(4));
    sun.color.lerpColors(_cA.set('#ffd6a6'), _cB.set('#ff9a5e'), k);
    sun.intensity = THREE.MathUtils.lerp(4.2, 2.6, k);
    this.hemi.intensity = THREE.MathUtils.lerp(0.55, 0.38, k);
    this.hemi.color.lerpColors(_cA.set('#f6eefc'), _cB.set('#d9c6ef'), k);
    this.lampBase = THREE.MathUtils.lerp(1.0, 1.9, k);
    if (this.sky) (this.sky.material as THREE.MeshBasicMaterial).color.lerpColors(_cA.setRGB(1.25, 1.2, 1.15), _cB.setRGB(1.05, 0.8, 0.85), k);
    for (const b of this.beams) (b.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.2, 0.3, k);
  }
  lampBase = 1;

  /* ---------- volumetric-ish sun beams + dust ---------- */
  private buildBeams() {
    const dir = this.sun.target.position.clone().sub(this.sun.position).normalize();
    const beamMat = new THREE.MeshBasicMaterial({
      map: T.beamTex(),
      transparent: true,
      opacity: 0.22,
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
      // a middle sheet for density
      const mA = corners[0].clone().lerp(corners[1], 0.5), mB = corners[3].clone().lerp(corners[2], 0.5);
      const mC = far[3].clone().lerp(far[2], 0.5), mD = far[0].clone().lerp(far[1], 0.5);
      pos.push(mA.x, mA.y, mA.z, mB.x, mB.y, mB.z, mC.x, mC.y, mC.z, mA.x, mA.y, mA.z, mC.x, mC.y, mC.z, mD.x, mD.y, mD.z);
      uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(g, beamMat);
      m.renderOrder = 5;
      this.root.add(m);
      this.beams.push(m);
    };
    const { nWindow: NW, lWindow: LW } = LAYOUT;
    makeBeam(NW.x0 + 0.05, NW.x1 - 0.05, NW.y0 + 0.05, NW.y1 - 0.05, LAYOUT.nursery.minZ);
    makeBeam(LW.x0 + 0.05, LW.x1 - 0.05, LW.y0 + 0.05, LW.y1 - 0.05, LAYOUT.living.minZ);

    // dust motes
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
      new THREE.PointsMaterial({ size: 0.018, map: T.glowSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe2b8', opacity: 0.8 }),
    );
    this.motes.userData.base = pos.slice();
    this.root.add(this.motes);
  }

  update(t: number, dt: number) {
    // mobile turns slowly, ornaments twirl
    this.mobileHub.rotation.y += dt * 0.25;
    this.ornaments.forEach((o) => {
      if (o.parent && o.parent.parent === this.mobileHub) o.rotation.y = Math.sin(t * o.userData.spin) * 1.2;
    });
    // dust drift
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
    // lamps breathe a little
    this.lampLights.forEach((l, i) => (l.intensity = (i === 0 ? 2.2 : 2.6) * this.lampBase * (1 + Math.sin(t * 1.3 + i) * 0.03)));
  }

  /** highest support surface below `maxY` at (x,z) */
  surfaceAt(x: number, z: number, maxY = 5): number {
    let y = 0;
    for (const s of this.surfaces) if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.y <= maxY && s.y > y) y = s.y;
    return y;
  }
}

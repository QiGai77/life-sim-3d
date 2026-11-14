import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assets } from '../core/assets';
import { damp } from '../core/events';

/**
 * A believable rigged human built from a CC0 Quaternius glTF (see docs/CREDITS.md):
 *  - flat-shaded source mesh is re-smoothed at load, PBR skin (sheen) / knit / hair materials
 *  - skeletal clips (Idle, Walk, Wave, Interact…) blended by an AnimationMixer
 *  - procedural layers on top: look-at (head + eyes follow the baby), kneel, cradle, dance,
 *    peek-a-boo, raspberry; morph-target blink and a painted mouth that smiles / laughs.
 */

export type Overlay = 'none' | 'hold' | 'dance' | 'peek' | 'reach' | 'tickle' | 'cheer';
export type Mouth = 'smile' | 'open' | 'o' | 'rasp' | 'neutral';

export interface HumanStyle {
  height: number;
  colors: Record<string, string>; // material name → colour
  knit?: string[]; // material names that get the knit normal map
  hair?: string[];
  skin?: string[];
  eyes?: string[];
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** rotate a bone around a WORLD axis (independent of the rig's local bone axes) */
export function rotWorld(bone: THREE.Object3D | undefined, axis: THREE.Vector3, angle: number) {
  if (!angle || !bone) return;
  const parent = bone.parent!;
  parent.getWorldQuaternion(_q2);
  _q.setFromAxisAngle(axis, angle);
  // local = parentInv * world * parent * local
  const inv = _q2.clone().invert();
  bone.quaternion.premultiply(inv.multiply(_q).multiply(_q2));
  bone.updateMatrixWorld(true);
}

function smoothNormals(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const idx = geo.index;
  const n = pos.count;
  const key = (i: number) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(i);
  }
  const acc = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3();
  const tri = (i0: number, i1: number, i2: number) => {
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    f.subVectors(c, b).cross(a.clone().sub(b)); // area weighted
    for (const i of [i0, i1, i2]) {
      acc[i * 3] += f.x;
      acc[i * 3 + 1] += f.y;
      acc[i * 3 + 2] += f.z;
    }
  };
  if (idx) for (let t = 0; t < idx.count; t += 3) tri(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  else for (let t = 0; t < n; t += 3) tri(t, t + 1, t + 2);
  const out = new Float32Array(n * 3);
  for (const g of groups.values()) {
    let x = 0, y = 0, z = 0;
    for (const i of g) {
      x += acc[i * 3];
      y += acc[i * 3 + 1];
      z += acc[i * 3 + 2];
    }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of g) {
      out[i * 3] = x / l;
      out[i * 3 + 1] = y / l;
      out[i * 3 + 2] = z / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

function mouthTexture(kind: Mouth): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const lip = '#b9575a';
  if (kind === 'smile' || kind === 'neutral') {
    g.strokeStyle = lip;
    g.lineWidth = 7;
    g.beginPath();
    if (kind === 'smile') {
      g.moveTo(34, 24);
      g.quadraticCurveTo(64, 50, 94, 24);
    } else {
      g.moveTo(42, 32);
      g.quadraticCurveTo(64, 38, 86, 32);
    }
    g.stroke();
  } else if (kind === 'open') {
    g.fillStyle = '#7a2e33';
    g.beginPath();
    g.moveTo(30, 20);
    g.quadraticCurveTo(64, 26, 98, 20);
    g.quadraticCurveTo(64, 70, 30, 20);
    g.fill();
    g.fillStyle = '#e37b7f';
    g.beginPath();
    g.ellipse(64, 40, 16, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fbf3ee';
    g.fillRect(44, 20, 40, 6);
  } else if (kind === 'o') {
    g.fillStyle = '#7a2e33';
    g.beginPath();
    g.ellipse(64, 32, 13, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = lip;
    g.lineWidth = 5;
    g.stroke();
  } else if (kind === 'rasp') {
    g.strokeStyle = lip;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(36, 28);
    g.quadraticCurveTo(64, 20, 92, 28);
    g.stroke();
    g.fillStyle = '#e46f7a';
    g.beginPath();
    g.ellipse(64, 38, 14, 11, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Human {
  root = new THREE.Group(); // positioned/rotated by the AI (faces +z)
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction> = {};
  bones: Record<string, THREE.Bone> = {};
  current = '';
  overlay: Overlay = 'none';
  mouth: Mouth = 'smile';
  lookTarget: THREE.Vector3 | null = null;
  kneel = 0; // target 0..1
  private kneelCur = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private ov: Record<Overlay, number> = { none: 0, hold: 0, dance: 0, peek: 0, reach: 0, tickle: 0, cheer: 0 };
  private eyes: THREE.SkinnedMesh[] = [];
  private blinkT = 2;
  private mouthMesh: THREE.Mesh | null = null;
  private mouthTex = new Map<Mouth, THREE.Texture>();
  private t = 0;
  private scale: number;
  private baseY = 0;
  ok = true;

  constructor(gltf: GLTF | null, style: HumanStyle) {
    if (!gltf) {
      // fallback (should not happen – everything is self-hosted)
      this.ok = false;
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 6, 16), new THREE.MeshStandardMaterial({ color: '#8aa3cf' }));
      m.position.y = 0.8;
      this.model = new THREE.Group();
      this.model.add(m);
      this.root.add(this.model);
      this.mixer = new THREE.AnimationMixer(this.model);
      this.scale = 1;
      return;
    }
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    const box = new THREE.Box3().setFromObject(this.model);
    this.scale = style.height / (box.max.y - box.min.y);
    this.model.scale.setScalar(this.scale);
    this.baseY = 0;

    const tex = assets.tex;
    const knit = tex.knitNor.clone();
    knit.repeat.set(6, 6);
    const mats = new Map<string, THREE.Material>();
    const makeMat = (name: string): THREE.Material => {
      if (mats.has(name)) return mats.get(name)!;
      const col = new THREE.Color(style.colors[name] ?? '#cccccc');
      let m: THREE.Material;
      if (style.skin?.includes(name)) {
        m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ff8f7a'), sheenRoughness: 0.5, envMapIntensity: 0.8 });
      } else if (style.hair?.includes(name)) {
        m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.45, sheen: 0.5, sheenColor: col.clone().offsetHSL(0, 0, 0.2), sheenRoughness: 0.35 });
      } else if (style.eyes?.includes(name)) {
        m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.15 });
      } else {
        m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.88, normalMap: style.knit?.includes(name) ? knit : null, normalScale: new THREE.Vector2(0.8, 0.8) });
      }
      m.name = name;
      mats.set(name, m);
      return m;
    };
    this.model.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) this.bones[b.name] = b;
      const sm = o as THREE.SkinnedMesh;
      if (sm.isMesh) {
        const src = sm.material as THREE.Material;
        sm.geometry = sm.geometry.clone();
        smoothNormals(sm.geometry);
        sm.material = makeMat(src.name);
        sm.castShadow = true;
        sm.receiveShadow = true;
        sm.frustumCulled = false;
        if (style.eyes?.includes(src.name)) this.eyes.push(sm);
      }
    });

    this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.play('Idle', 0);
    this.mixer.update(0.01);
    this.model.updateMatrixWorld(true);
    this.setupEyesAndMouth();
  }

  /** blink morph on the eye meshes + painted mouth on the head bone */
  private setupEyesAndMouth() {
    const head = this.bones['Head'];
    if (!head) return;
    const center = new THREE.Vector3();
    let count = 0;
    for (const e of this.eyes) {
      const pos = e.geometry.getAttribute('position');
      // cluster each eye by the sign of x (mesh space), squash vertically to its centre
      const sums: Record<string, { y: number; n: number }> = {};
      for (let i = 0; i < pos.count; i++) {
        const k = pos.getX(i) < 0 ? 'l' : 'r';
        (sums[k] ??= { y: 0, n: 0 }).y += pos.getY(i);
        sums[k].n++;
        e.getVertexPosition(i, _v);
        e.localToWorld(_v);
        center.add(_v);
        count++;
      }
      const d = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const s = sums[pos.getX(i) < 0 ? 'l' : 'r'];
        d[i * 3 + 1] = (s.y / s.n - pos.getY(i)) * 0.92;
      }
      e.geometry.morphAttributes.position = [new THREE.BufferAttribute(d, 3)];
      e.updateMorphTargets();
      e.morphTargetInfluences = [0];
    }
    if (!count) return;
    center.multiplyScalar(1 / count);
    // mouth: a little below and in front of the eyes
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(_q));
    const mouthW = center.clone().add(new THREE.Vector3(0, -0.062 * (this.scale / 0.91), 0)).addScaledVector(fwd, 0.012);
    for (const k of ['smile', 'open', 'o', 'rasp', 'neutral'] as Mouth[]) this.mouthTex.set(k, mouthTexture(k));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.025),
      new THREE.MeshStandardMaterial({ map: this.mouthTex.get('smile')!, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    head.add(m);
    head.updateMatrixWorld(true);
    m.position.copy(head.worldToLocal(mouthW.clone()));
    head.getWorldQuaternion(_q);
    m.quaternion.copy(_q.invert().multiply(this.root.getWorldQuaternion(_q2)));
    // the head bone carries the rig/model scale – undo so the decal keeps its metric size
    const ws = head.getWorldScale(new THREE.Vector3());
    m.scale.setScalar(1 / ws.x);
    m.renderOrder = 3;
    this.mouthMesh = m;
  }

  setMouth(k: Mouth) {
    if (this.mouth === k || !this.mouthMesh) return;
    this.mouth = k;
    (this.mouthMesh.material as THREE.MeshStandardMaterial).map = this.mouthTex.get(k)!;
  }

  play(name: string, fade = 0.25, once = false, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    if (this.current === name && !once) {
      a.timeScale = timeScale;
      return;
    }
    const prev = this.actions[this.current];
    a.reset();
    a.timeScale = timeScale;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (prev && prev !== a) a.crossFadeFrom(prev, fade, false);
    this.current = name;
  }

  get facing() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
  }

  headWorld(out = new THREE.Vector3()) {
    const h = this.bones['Head'];
    if (!h) return out.copy(this.root.position).setY(1.55);
    return h.getWorldPosition(out).add(_v.set(0, 0.08, 0));
  }

  private rest = new Map<THREE.Bone, THREE.Quaternion>();
  update(dt: number) {
    this.t += dt;
    // reset to rest pose first: bones without animation tracks would otherwise accumulate the procedural layer
    if (!this.rest.size) for (const b of Object.values(this.bones)) this.rest.set(b, b.quaternion.clone());
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.mixer.update(dt);
    if (!this.ok) return;
    this.model.updateMatrixWorld(true);
    const b = this.bones;
    const right = _v2.set(1, 0, 0).applyQuaternion(this.root.quaternion).clone();
    const up = new THREE.Vector3(0, 1, 0);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
    for (const k of Object.keys(this.ov) as Overlay[]) this.ov[k] = damp(this.ov[k], this.overlay === k ? 1 : 0, 6, dt);
    const o = this.ov;
    const t = this.t;

    // kneel / crouch
    this.kneelCur = damp(this.kneelCur, this.kneel, 5, dt);
    const k = this.kneelCur;
    this.model.position.y = this.baseY - k * 0.5;
    if (k > 0.001) {
      for (const s of ['L', 'R']) {
        const side = s === 'L' ? 1 : -1;
        rotWorld(b[`UpperLeg${s}`], right, -k * (s === 'L' ? 1.55 : 0.6));
        rotWorld(b[`LowerLeg${s}`], right, k * (s === 'L' ? 1.75 : 1.9));
        void side;
      }
      rotWorld(b['Abdomen'], right, k * 0.18);
    }

    // cradle the baby / reach down for it
    if (o.hold > 0.01 || o.reach > 0.01) {
      const w = o.hold, r = o.reach;
      for (const s of ['L', 'R']) {
        const side = s === 'L' ? 1 : -1;
        rotWorld(b[`UpperArm${s}`], right, -(w * 0.75 + r * 1.0));
        rotWorld(b[`UpperArm${s}`], fwd, side * -(w * 0.25 + r * 0.08));
        rotWorld(b[`LowerArm${s}`], right, -(w * 0.85 + r * 0.3));
        rotWorld(b[`LowerArm${s}`], up, -side * w * 1.05);
      }
      rotWorld(b['Chest'], right, r * 0.35);
    }
    // silly dance
    if (o.dance > 0.01) {
      const w = o.dance;
      rotWorld(b['Hips'], fwd, Math.sin(t * 9) * 0.18 * w);
      rotWorld(b['Chest'], fwd, -Math.sin(t * 9) * 0.25 * w);
      rotWorld(b['UpperArmL'], fwd, (1.9 + Math.sin(t * 18) * 0.5) * w);
      rotWorld(b['UpperArmR'], fwd, -(1.9 + Math.sin(t * 18 + 1.5) * 0.5) * w);
      rotWorld(b['LowerArmL'], fwd, Math.sin(t * 18) * 0.8 * w);
      rotWorld(b['LowerArmR'], fwd, -Math.sin(t * 18 + 1) * 0.8 * w);
      this.model.position.y += Math.abs(Math.sin(t * 9)) * 0.06 * w;
    }
    // cheer: both arms up
    if (o.cheer > 0.01) {
      const w = o.cheer;
      rotWorld(b['UpperArmL'], fwd, (2.3 + Math.sin(t * 8) * 0.2) * w);
      rotWorld(b['UpperArmR'], fwd, -(2.3 + Math.sin(t * 8) * 0.2) * w);
    }
    // peek-a-boo: hands over the face
    if (o.peek > 0.01) {
      const w = o.peek;
      for (const s of ['L', 'R']) {
        const side = s === 'L' ? 1 : -1;
        rotWorld(b[`UpperArm${s}`], right, -1.05 * w);
        rotWorld(b[`UpperArm${s}`], fwd, -side * 0.32 * w);
        rotWorld(b[`LowerArm${s}`], right, -1.95 * w);
        rotWorld(b[`LowerArm${s}`], up, -side * 0.25 * w);
      }
    }
    // tickle / raspberry: lean in
    if (o.tickle > 0.01) {
      rotWorld(b['Abdomen'], right, 0.35 * o.tickle);
      rotWorld(b['Chest'], right, 0.25 * o.tickle + Math.sin(t * 20) * 0.03 * o.tickle);
    }

    // look at the target (the baby) with neck + head
    let ty = 0, tp = 0;
    if (this.lookTarget && b['Head'] && o.peek < 0.5) {
      const hp = b['Head'].getWorldPosition(new THREE.Vector3());
      const d = this.lookTarget.clone().sub(hp);
      const local = d.clone().applyQuaternion(this.root.quaternion.clone().invert());
      ty = Math.atan2(local.x, local.z);
      tp = Math.atan2(-local.y, Math.hypot(local.x, local.z));
      ty = THREE.MathUtils.clamp(ty, -1.1, 1.1);
      tp = THREE.MathUtils.clamp(tp, -0.5, 0.75);
    }
    this.lookYaw = damp(this.lookYaw, ty, 5, dt);
    this.lookPitch = damp(this.lookPitch, tp, 5, dt);
    if (b['Neck'] && b['Head']) {
      rotWorld(b['Neck'], up, this.lookYaw * 0.4);
      rotWorld(b['Head'], up, this.lookYaw * 0.6);
      const r2 = new THREE.Vector3(1, 0, 0).applyQuaternion(b['Head'].getWorldQuaternion(new THREE.Quaternion()));
      rotWorld(b['Head'], r2.setY(0).normalize(), this.lookPitch * 0.8);
    }

    // blink
    this.blinkT -= dt;
    let bl = 0;
    if (this.blinkT < 0) {
      bl = Math.sin(Math.min(1, -this.blinkT / 0.16) * Math.PI);
      if (this.blinkT < -0.16) this.blinkT = 2 + Math.random() * 3.5;
    }
    if (this.overlay === 'peek') bl = 0;
    for (const e of this.eyes) if (e.morphTargetInfluences) e.morphTargetInfluences[0] = bl;
  }
}

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assets } from '../core/assets';
import { damp } from '../core/events';
import { rotWorld } from './human';
import type { AABB } from './types';

export type DogState = 'sleep' | 'awake' | 'walk' | 'run' | 'lick' | 'eat';

/**
 * The family Shiba (CC0 Quaternius, rigged + animated). Can sleep curled up (procedural pose
 * on top of the idle clip), wake up, wag, walk/gallop around (fetch), and lick the baby's face.
 */
export class Dog {
  root = new THREE.Group();
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction> = {};
  bones: Record<string, THREE.Bone> = {};
  current = '';
  state: DogState = 'sleep';
  pos = new THREE.Vector3();
  heading = 0;
  targetHeading = 0;
  collider: AABB = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  lookTarget: THREE.Vector3 | null = null;
  carry: THREE.Object3D | null = null;
  mouthAnchor = new THREE.Object3D();
  private sleepCur = 1;
  private wag = 0;
  private t = 0;
  private path: THREE.Vector3 | null = null;
  private speed = 0.6;
  private arrive: (() => void) | null = null;
  meshes: THREE.Mesh[] = [];
  private rest = new Map<THREE.Bone, THREE.Quaternion>();

  constructor() {
    const g = assets.gltf['shiba'];
    if (g) {
      this.model = SkeletonUtils.clone(g.scene);
      this.model.scale.setScalar(0.19);
      this.mixer = new THREE.AnimationMixer(this.model);
      for (const c of g.animations) this.actions[c.name] = this.mixer.clipAction(c);
      const mats = new Map<string, THREE.Material>();
      const fur = assets.tex.teddyNor.clone();
      fur.repeat.set(5, 5);
      this.model.traverse((o) => {
        const b = o as THREE.Bone;
        if (b.isBone) this.bones[b.name] = b;
        const m = o as THREE.SkinnedMesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
          this.meshes.push(m);
          const src = m.material as THREE.MeshStandardMaterial;
          let mat = mats.get(src.name);
          if (!mat) {
            const isFur = /Main/.test(src.name);
            mat = new THREE.MeshPhysicalMaterial({
              color: src.color.clone().multiplyScalar(src.name === 'Main' ? 1.02 : 1),
              roughness: isFur ? 0.9 : 0.25,
              sheen: isFur ? 0.8 : 0,
              sheenColor: new THREE.Color('#fff0dc'),
              sheenRoughness: 0.6,
              normalMap: isFur ? fur : null,
              normalScale: new THREE.Vector2(0.6, 0.6),
            });
            mat.name = src.name;
            mats.set(src.name, mat);
          }
          m.material = mat;
        }
      });
      // smooth the faceted low-poly look
      for (const m of this.meshes) smooth(m.geometry);
      this.bones['Head']?.add(this.mouthAnchor);
      this.mouthAnchor.position.set(0, 0.6, 1.35); // in bone space (scaled), refined at runtime
    } else {
      this.model = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.45, 6, 12), new THREE.MeshStandardMaterial({ color: '#e5b56f' }));
      this.model.rotation.x = Math.PI / 2;
      this.model.position.y = 0.16;
      this.mixer = new THREE.AnimationMixer(this.model);
    }
    this.root.add(this.model);
    this.play('Idle_2_HeadLow', 0);
  }

  play(name: string, fade = 0.3, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = timeScale;
    if (this.current === name) return;
    const prev = this.actions[this.current];
    a.reset().play();
    if (prev) a.crossFadeFrom(prev, fade, false);
    this.current = name;
  }

  place(x: number, z: number, heading: number) {
    this.pos.set(x, 0, z);
    this.heading = this.targetHeading = heading;
    this.sync();
  }

  goTo(target: THREE.Vector3, speed = 0.6): Promise<void> {
    this.path = target.clone().setY(0);
    this.speed = speed;
    return new Promise((res) => {
      if (this.arrive) this.arrive();
      this.arrive = res;
    });
  }

  face(p: THREE.Vector3) {
    this.targetHeading = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  get awake() {
    return this.state !== 'sleep';
  }

  mouthWorld(out = new THREE.Vector3()) {
    return this.mouthAnchor.getWorldPosition(out);
  }

  update(dt: number) {
    this.t += dt;
    if (this.path) {
      const d = new THREE.Vector3().subVectors(this.path, this.pos).setY(0);
      const dist = d.length();
      if (dist < 0.05) {
        this.path = null;
        const a = this.arrive;
        this.arrive = null;
        a?.();
      } else {
        d.normalize();
        this.pos.addScaledVector(d, Math.min(dist, this.speed * dt));
        this.targetHeading = Math.atan2(d.x, d.z);
      }
    }
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 6);

    const moving = !!this.path;
    if (moving) this.play(this.speed > 1.0 ? 'Gallop' : 'Walk', 0.2, this.speed > 1.0 ? 0.9 : this.speed / 0.55);
    else if (this.state === 'sleep') this.play('Idle_2_HeadLow', 0.6, 0.35);
    else if (this.state === 'lick') this.play('Attack', 0.15, 1.4);
    else if (this.state === 'eat') this.play('Eating', 0.3);
    else this.play('Idle', 0.3);
    if (!this.rest.size) for (const b of Object.values(this.bones)) this.rest.set(b, b.quaternion.clone());
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.mixer.update(dt);
    this.sync();
    this.model.updateMatrixWorld(true);

    // procedural layer: curled up sleep pose + tail wag
    const b = this.bones;
    if (!b['Body']) return;
    this.sleepCur = damp(this.sleepCur, this.state === 'sleep' && !moving ? 1 : 0, 3, dt);
    const s = this.sleepCur;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.quaternion);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
    this.model.position.y = -s * 0.2;
    if (s > 0.001) {
      for (const side of ['L', 'R']) {
        rotWorld(b[`FrontUpperLeg${side}`], right, s * 1.45);
        rotWorld(b[`FrontLowerLeg${side}`], right, -s * 0.2);
        rotWorld(b[`BackUpperLeg${side}`], right, -s * 1.2);
        rotWorld(b[`BackLowerLeg${side}`], right, s * 2.2);
      }
      rotWorld(b['Neck1'], right, s * 0.25);
      rotWorld(b['Head'], fwd, s * 0.25);
      // breathing
      this.model.position.y += Math.sin(this.t * 1.4) * 0.004 * s;
    }
    this.wag = damp(this.wag, this.awake ? 1 : 0.1, 3, dt);
    if (b['Tail1']) rotWorld(b['Tail1'], new THREE.Vector3(0, 1, 0), Math.sin(this.t * (this.awake ? 16 : 1.2)) * 0.55 * this.wag);
    if (this.lookTarget && b['Head'] && !moving && this.state !== 'sleep') {
      const hp = b['Head'].getWorldPosition(new THREE.Vector3());
      const local = this.lookTarget.clone().sub(hp).applyQuaternion(this.root.quaternion.clone().invert());
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      rotWorld(b['Neck1'], new THREE.Vector3(0, 1, 0), yaw * 0.5);
      rotWorld(b['Head'], new THREE.Vector3(0, 1, 0), yaw * 0.5);
    }
    if (this.carry) {
      this.carry.position.copy(this.mouthWorld(new THREE.Vector3()));
    }
  }

  private sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
    const hw = 0.3, hd = 0.3;
    this.collider.minX = this.pos.x - hw;
    this.collider.maxX = this.pos.x + hw;
    this.collider.minZ = this.pos.z - hd;
    this.collider.maxZ = this.pos.z + hd;
  }
}

function smooth(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const map = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    (map.get(k) ?? map.set(k, []).get(k)!).push(i);
  }
  geo.computeVertexNormals();
  const nor = geo.getAttribute('normal');
  const out = new Float32Array(n * 3);
  for (const g of map.values()) {
    let x = 0, y = 0, z = 0;
    for (const i of g) {
      x += nor.getX(i);
      y += nor.getY(i);
      z += nor.getZ(i);
    }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of g) out.set([x / l, y / l, z / l], i * 3);
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

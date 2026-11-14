import * as THREE from 'three';
import { C, paint } from '../world/lowpoly';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp } from '../core/events';

export type HandPose = 'idle' | 'crawl' | 'reach' | 'hold' | 'pet' | 'clap' | 'cry' | 'mouth' | 'bottle' | 'hug';

/**
 * v2 baby hand: one smooth skinned mesh per hand (1 draw call) with real finger bones,
 * so the chubby fingers can curl continuously when grabbing. Soft skin: physical material
 * with pink sheen + a warm "subsurface" wrap term.
 */
interface HandRig {
  mesh: THREE.SkinnedMesh;
  fingers: { prox: THREE.Bone; dist: THREE.Bone }[];
  thumb: { a: THREE.Bone; b: THREE.Bone };
}

let skinMat: THREE.MeshPhysicalMaterial | null = null;
function babySkin() {
  if (skinMat) return skinMat;
  skinMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.5,
    sheen: 0.8,
    sheenColor: new THREE.Color('#ffb4a0'),
    sheenRoughness: 0.45,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.9,
  });
  // cheap subsurface: light wraps around the terminator and picks up a warm red tint
  skinMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.20, 0.06, 0.04) * (0.6 + 0.4 * (1.0 - abs(dot(normal, normalize(vViewPosition)))));`,
    );
  };
  return skinMat;
}

function part(geo: THREE.BufferGeometry, color: string, bone: number, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1], variation = 0.03) {
  const g = paint(geo, color, { variation, crease: 1.2 });
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  g.applyMatrix4(m);
  const n = g.getAttribute('position').count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    si[i * 4] = bone;
    sw[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

/** Builds one chubby baby hand + forearm + sleeve. Fingers point -z, forearm runs +z, back of hand +y. */
function buildHand(side: 1 | -1): HandRig {
  const skin = C.skin;
  const parts: THREE.BufferGeometry[] = [];
  const bones: THREE.Bone[] = [];
  const root = new THREE.Bone();
  bones.push(root);
  const sph = (r: number) => new THREE.SphereGeometry(r, 20, 14);
  const capg = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 6, 14);
  // palm: soft, chubby, slightly cupped + a little fat pad
  parts.push(part(sph(0.04), skin, 0, [0, 0, 0], [0, 0, 0], [1.13, 0.56, 1.0]));
  parts.push(part(sph(0.03), skin, 0, [0, 0.003, -0.028], [0, 0, 0], [1.42, 0.62, 0.75]));
  parts.push(part(sph(0.022), C.skinShade, 0, [-0.03 * side, -0.012, 0.004], [0, 0, 0], [1, 0.7, 1.2]));
  // wrist crease + chubby forearm with a baby "bracelet" fold
  parts.push(part(sph(0.034), C.skinShade, 0, [0, -0.004, 0.042], [0, 0, 0], [1.1, 0.86, 0.6]));
  parts.push(part(capg(0.037, 0.13), skin, 0, [0, -0.006, 0.125], [Math.PI / 2, 0, 0]));
  parts.push(part(new THREE.CylinderGeometry(0.05, 0.052, 0.035, 24), '#fbfbff', 0, [0, -0.006, 0.2], [Math.PI / 2, 0, 0], [1, 1, 1], 0.02));
  parts.push(part(new THREE.CylinderGeometry(0.052, 0.06, 0.24, 24), C.sleeve, 0, [0, -0.006, 0.335], [Math.PI / 2, 0, 0], [1, 1, 1], 0.03));
  // fingers: two bones each
  const lens = [0.026, 0.035, 0.032, 0.023];
  const fingers: HandRig['fingers'] = [];
  for (let i = 0; i < 4; i++) {
    const k = i - 1.5;
    const len = lens[side === 1 ? i : 3 - i];
    const x = k * 0.0205 * side;
    const spread = k * 0.12 * side;
    const prox = new THREE.Bone();
    prox.position.set(x, 0.003, -0.05);
    prox.rotation.y = -spread;
    root.add(prox);
    const dist = new THREE.Bone();
    dist.position.set(0, 0, -len * 0.55);
    prox.add(dist);
    bones.push(prox, dist);
    const pi = bones.length - 2, di = bones.length - 1;
    // build in bone-aligned space then move into hand space via the bone's rest matrix
    const r = 0.0102;
    const mProx = new THREE.Matrix4().compose(prox.position, prox.quaternion, new THREE.Vector3(1, 1, 1));
    const gp = part(capg(r, len * 0.5), skin, pi, [0, 0, -len * 0.27], [Math.PI / 2, 0, 0]);
    gp.applyMatrix4(mProx);
    parts.push(gp);
    const mDist = mProx.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -len * 0.55));
    const gd = part(capg(r * 0.95, len * 0.45), skin, di, [0, 0, -len * 0.2], [Math.PI / 2, 0, 0]);
    gd.applyMatrix4(mDist);
    parts.push(gd);
    const gn = part(sph(0.0058), '#fde4d8', di, [0, r * 0.62, -len * 0.42], [0, 0, 0], [1, 0.35, 1.3], 0.01);
    gn.applyMatrix4(mDist);
    parts.push(gn);
    fingers.push({ prox, dist });
  }
  // thumb on the inner side
  const ta = new THREE.Bone();
  ta.position.set(-0.04 * side, -0.004, -0.012);
  ta.rotation.set(0, side * 0.75, side * 0.5);
  root.add(ta);
  const tb = new THREE.Bone();
  tb.position.set(0, 0, -0.02);
  ta.add(tb);
  bones.push(ta, tb);
  const mTa = new THREE.Matrix4().compose(ta.position, ta.quaternion, new THREE.Vector3(1, 1, 1));
  const g1 = part(capg(0.0125, 0.016), skin, bones.length - 2, [0, 0, -0.01], [Math.PI / 2, 0, 0]);
  g1.applyMatrix4(mTa);
  parts.push(g1);
  const g2 = part(capg(0.0115, 0.012), skin, bones.length - 1, [0, 0, -0.027], [Math.PI / 2, 0, 0]);
  g2.applyMatrix4(mTa);
  parts.push(g2);

  const geo = mergeGeometries(parts, false)!;
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(geo, babySkin());
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, fingers, thumb: { a: ta, b: tb } };
}

const _tq = new THREE.Quaternion();
const _ax = new THREE.Vector3();

interface Arm {
  root: THREE.Group;
  rig: HandRig;
  curl: number;
  thumbBase: THREE.Quaternion;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  tPos: THREE.Vector3;
  tRot: THREE.Euler;
}

/**
 * Two hands parented to the camera, blended between poses.
 */
export class Hands {
  group = new THREE.Group();
  arms: Arm[] = [];
  pose: HandPose = 'idle';
  reachTarget = new THREE.Vector3(0, 0, -0.4); // camera-space
  reachSide: 0 | 1 = 1;
  t = 0;
  crawlPhase = 0;
  crawlAmt = 0;
  poseTimer = 0;
  scale = 0.9;
  /** quick shake (rattle) */
  jiggle = 0;

  constructor(camera: THREE.Camera) {
    camera.add(this.group);
    for (const side of [-1, 1] as const) {
      const root = new THREE.Group();
      const rig = buildHand(side);
      root.add(rig.mesh);
      root.scale.setScalar(this.scale);
      this.group.add(root);
      this.arms.push({
        root, rig, curl: 0.15, thumbBase: rig.thumb.a.quaternion.clone(),
        pos: new THREE.Vector3(side * 0.14, -0.3, -0.25),
        rot: new THREE.Euler(),
        tPos: new THREE.Vector3(),
        tRot: new THREE.Euler(),
      });
    }
    this.group.traverse((o) => (o.renderOrder = 10));
  }

  setPose(p: HandPose, duration = 0) {
    this.pose = p;
    this.poseTimer = duration;
  }

  update(dt: number, crawl: number, moving: boolean) {
    this.t += dt;
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.pose = 'idle';
    }
    this.crawlAmt = damp(this.crawlAmt, crawl, 6, dt);
    this.jiggle = Math.max(0, this.jiggle - dt * 3);
    if (moving) this.crawlPhase += dt * 6.2;
    const t = this.t;
    this.arms.forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      let grip = false;
      const breathe = Math.sin(t * 1.6 + i) * 0.006;
      switch (this.pose) {
        case 'idle': {
          if (this.crawlAmt > 0.5) {
            // hands on the floor, alternating paddles
            const ph = this.crawlPhase + i * Math.PI;
            a.tPos.set(s * 0.14, -0.152 + Math.max(0, Math.sin(ph)) * 0.025, -0.33 - Math.cos(ph) * 0.04);
            a.tRot.set(-0.12, -s * 0.18, -s * 0.06);
          } else {
            // little hands raised in front, reaching for the world
            a.tPos.set(s * 0.155, -0.125 + breathe, -0.33);
            a.tRot.set(0.62, -s * 0.28, -s * 0.42);
          }
          break;
        }
        case 'reach': {
          const isReach = i === this.reachSide;
          if (isReach) {
            const tgt = this.reachTarget.clone();
            if (tgt.length() > 0.42) tgt.setLength(0.42);
            a.tPos.set(tgt.x + s * 0.02, tgt.y - 0.03, tgt.z + 0.05);
            a.tRot.set(0.9, -s * 0.1, -s * 0.1);
          } else {
            a.tPos.set(s * 0.15, -0.24, -0.27);
            a.tRot.set(0.5, -s * 0.2, -s * 0.25);
          }
          break;
        }
        case 'hold':
        case 'hug': {
          const hug = this.pose === 'hug';
          if (hug) {
            // wrap around the plush: fingers pointing inwards
            a.tPos.set(s * 0.11, -0.245 + breathe, -0.35);
            a.tRot.set(0.35, s * 1.1, s * 0.45);
          } else {
            a.tPos.set(s * 0.075, -0.2 + breathe, -0.3);
            a.tRot.set(0.35, s * 0.55, s * 0.55);
          }
          grip = true;
          break;
        }
        case 'bottle': {
          a.tPos.set(0.02 + s * 0.055, -0.13 + breathe, -0.24);
          a.tRot.set(0.9, s * 1.2, s * 0.4);
          grip = true;
          break;
        }
        case 'pet': {
          if (i === 1) {
            const pat = Math.abs(Math.sin(t * 9)) * 0.06;
            a.tPos.set(0.03, -0.24 + pat, -0.4);
            a.tRot.set(-0.2, 0, -0.1);
          } else {
            a.tPos.set(-0.16, -0.27, -0.27);
            a.tRot.set(0.2, 0.2, 0.2);
          }
          break;
        }
        case 'clap': {
          const c = (Math.sin(t * 16) + 1) / 2;
          a.tPos.set(s * (0.025 + c * 0.07), -0.17, -0.28);
          a.tRot.set(0.9, s * 1.25, 0);
          break;
        }
        case 'cry': {
          const w = Math.sin(t * 10 + i * 2) * 0.012;
          a.tPos.set(s * 0.065 + w, -0.06 + Math.cos(t * 10 + i) * 0.01, -0.17);
          a.tRot.set(1.1, s * 0.35, -s * 0.3);
          grip = true;
          break;
        }
        case 'mouth': {
          if (i === 1) {
            a.tPos.set(0.015, -0.11, -0.17);
            a.tRot.set(1.0, 0.35, 0.2);
            grip = true;
          } else {
            a.tPos.set(-0.15, -0.25, -0.27);
            a.tRot.set(0.5, 0.2, 0.25);
          }
          break;
        }
      }
      const k = this.pose === 'clap' || this.pose === 'pet' ? 22 : 10;
      a.pos.x = damp(a.pos.x, a.tPos.x, k, dt);
      a.pos.y = damp(a.pos.y, a.tPos.y, k, dt);
      a.pos.z = damp(a.pos.z, a.tPos.z, k, dt);
      _tq.setFromEuler(a.tRot);
      a.root.quaternion.slerp(_tq, 1 - Math.exp(-k * dt));
      a.root.position.copy(a.pos);
      if (this.jiggle > 0.01 && i === 1) a.root.position.x += Math.sin(t * 46) * 0.018 * this.jiggle;
      // continuous finger curl (relaxed babies keep their fingers a little bent)
      const target = grip ? (this.pose === 'bottle' ? 0.72 : this.pose === 'cry' ? 0.95 : 0.88) : this.pose === 'reach' && i === this.reachSide ? 0.05 : this.pose === 'pet' ? 0.25 : 0.2 + Math.sin(t * 0.9 + i) * 0.05;
      a.curl = damp(a.curl, target, grip ? 14 : 9, dt);
      const c = a.curl;
      a.rig.fingers.forEach((f, fi) => {
        const lag = 1 - fi * 0.06;
        f.prox.rotation.x = -c * 1.35 * lag;
        f.dist.rotation.x = -c * 1.55 * lag;
      });
      a.rig.thumb.a.quaternion.copy(a.thumbBase).multiply(_tq.setFromAxisAngle(_ax.set(1, 0, 0), -c * 0.7));
      a.rig.thumb.b.rotation.x = -c * 0.9;
    });
  }
}

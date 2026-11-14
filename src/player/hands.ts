import * as THREE from 'three';
import { C, paint, boxUV } from '../world/lowpoly';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp } from '../core/events';
import { assets } from '../core/assets';
import { skinNormalTex } from '../world/textures';

export type HandPose = 'idle' | 'crawl' | 'reach' | 'hold' | 'pet' | 'clap' | 'cry' | 'mouth' | 'bottle' | 'hug' | 'throw';

/**
 * v3 realistic baby hands:
 *  - Three separate PBR materials: dermal-textured SSS baby skin, glossy pearlescent nails,
 *    and woven knitted-cotton sleeve + ribbed cuff (no plastic skin shader on clothes).
 *  - Sculpted anatomical palm (thenar/hypothenar pads, knuckle bridge, wrist fold) +
 *    3-phalanx fingers (proximal/middle/distal) + 2-segment opposable thumb + wrist bone.
 *  - Subtle organic idle finger wiggling and dynamic grip sizing.
 */
interface HandRig {
  group: THREE.Group;
  skinMesh: THREE.SkinnedMesh;
  nailMesh: THREE.SkinnedMesh;
  sleeveMesh: THREE.SkinnedMesh;
  wrist: THREE.Bone;
  fingers: { prox: THREE.Bone; mid: THREE.Bone; dist: THREE.Bone }[];
  thumb: { a: THREE.Bone; b: THREE.Bone };
}

let skinMat: THREE.MeshPhysicalMaterial | null = null;
let nailMat: THREE.MeshPhysicalMaterial | null = null;
let sleeveMat: THREE.MeshStandardMaterial | null = null;
let skinNorm: THREE.CanvasTexture | null = null;

function ensureMats() {
  if (!skinNorm) {
    skinNorm = skinNormalTex();
    skinNorm.repeat.set(4, 4);
  }
  if (!skinMat) {
    skinMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0,
      normalMap: skinNorm,
      normalScale: new THREE.Vector2(0.26, 0.26),
      sheen: 0.72,
      sheenColor: new THREE.Color('#ffb5a0'),
      sheenRoughness: 0.42,
      clearcoat: 0.14,
      clearcoatRoughness: 0.52,
      envMapIntensity: 0.95,
    });
    skinMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float wrapRim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.24, 0.07, 0.045) * (0.55 + 0.45 * wrapRim);`,
      );
    };
  }
  if (!nailMat) {
    nailMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.16,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      sheen: 0.25,
      sheenColor: new THREE.Color('#fff4f0'),
      envMapIntensity: 1.1,
    });
  }
  if (!sleeveMat) {
    const kn = assets.tex.knitNor.clone();
    kn.repeat.set(6, 6);
    sleeveMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      normalMap: kn,
      normalScale: new THREE.Vector2(0.95, 0.95),
      envMapIntensity: 0.8,
    });
  }
}

function skinPart(
  geo: THREE.BufferGeometry,
  color: string,
  bone: number,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
  variation = 0.025,
) {
  const g = paint(geo, color, { variation, crease: 1.35 });
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
  boxUV(g);
  // copy buv into standard uv so normalMap samples cleanly
  g.setAttribute('uv', g.getAttribute('buv').clone());
  return g;
}

/** Builds one sculpted baby hand + wrist + forearm + knitted cotton sleeve. */
function buildHand(side: 1 | -1): HandRig {
  ensureMats();
  const skin = C.skin;
  const flush = '#ebb09b';
  const palmCol = '#f2bca6';
  const knuckleCol = '#efbaa4';

  const skinParts: THREE.BufferGeometry[] = [];
  const nailParts: THREE.BufferGeometry[] = [];
  const sleeveParts: THREE.BufferGeometry[] = [];
  const bones: THREE.Bone[] = [];

  // bone 0: forearm root; bone 1: wrist/palm
  const forearm = new THREE.Bone();
  const wrist = new THREE.Bone();
  wrist.position.set(0, 0, 0);
  forearm.add(wrist);
  bones.push(forearm, wrist);

  const sph = (r: number) => new THREE.SphereGeometry(r, 24, 16);
  const capg = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 8, 16);

  // Forearm & baby wrist crease (bound to forearm bone 0)
  skinParts.push(skinPart(capg(0.036, 0.125), skin, 0, [0, -0.005, 0.118], [Math.PI / 2, 0, 0]));
  skinParts.push(skinPart(sph(0.0345), C.skinShade, 0, [0, -0.004, 0.044], [0, 0, 0], [1.14, 0.84, 0.62]));
  skinParts.push(skinPart(sph(0.0325), flush, 0, [0, -0.006, 0.025], [0, 0, 0], [1.1, 0.82, 0.55]));

  // Knitted ribbed cuff & soft cotton sleeve (bound to forearm bone 0)
  sleeveParts.push(skinPart(new THREE.CylinderGeometry(0.045, 0.048, 0.038, 28), '#f3efe7', 0, [0, -0.005, 0.195], [Math.PI / 2, 0, 0], [1, 1, 1], 0.015));
  sleeveParts.push(skinPart(new THREE.TorusGeometry(0.046, 0.006, 10, 28), '#e8e2d7', 0, [0, -0.005, 0.178], [0, 0, 0], [1, 0.9, 1], 0.01));
  sleeveParts.push(skinPart(new THREE.CylinderGeometry(0.048, 0.058, 0.25, 28), C.sleeve, 0, [0, -0.005, 0.335], [Math.PI / 2, 0, 0], [1, 1, 1], 0.02));

  // Sculpted palm (bound to wrist bone 1)
  skinParts.push(skinPart(sph(0.04), skin, 1, [0, 0.001, -0.004], [0, 0, 0], [1.15, 0.54, 1.02]));
  // dorsal knuckle bridge
  skinParts.push(skinPart(sph(0.029), knuckleCol, 1, [0, 0.005, -0.034], [0, 0, 0], [1.44, 0.58, 0.68]));
  // palmar arch & thenar/hypothenar pads
  skinParts.push(skinPart(sph(0.025), palmCol, 1, [-0.025 * side, -0.012, -0.006], [0, 0.25 * side, 0], [0.95, 0.62, 1.2]));
  skinParts.push(skinPart(sph(0.021), palmCol, 1, [0.024 * side, -0.01, -0.012], [0, -0.15 * side, 0], [0.85, 0.58, 1.15]));

  // 4 fingers, each with 3 phalanx bones (prox, mid, dist)
  const lens = [0.028, 0.037, 0.034, 0.025];
  const radii = [0.0098, 0.0104, 0.0098, 0.0086];
  const fingers: HandRig['fingers'] = [];
  for (let i = 0; i < 4; i++) {
    const k = i - 1.5;
    const fi = side === 1 ? i : 3 - i;
    const len = lens[fi];
    const r = radii[fi];
    const x = k * 0.0205 * side;
    const spread = k * 0.11 * side;
    const archY = 0.004 - Math.abs(k) * 0.002;

    const prox = new THREE.Bone();
    prox.position.set(x, archY, -0.048);
    prox.rotation.y = -spread;
    wrist.add(prox);

    const mid = new THREE.Bone();
    mid.position.set(0, 0, -len * 0.42);
    prox.add(mid);

    const dist = new THREE.Bone();
    dist.position.set(0, 0, -len * 0.32);
    mid.add(dist);

    bones.push(prox, mid, dist);
    const pi = bones.length - 3, mi = bones.length - 2, di = bones.length - 1;

    const mProx = new THREE.Matrix4().compose(prox.position, prox.quaternion, new THREE.Vector3(1, 1, 1));
    const mMid = mProx.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -len * 0.42));
    const mDist = mMid.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -len * 0.32));

    // knuckle dimple/pad + proximal phalanx
    const gKnuck = skinPart(sph(r * 1.12), knuckleCol, pi, [0, 0.002, 0], [0, 0, 0], [1, 0.85, 1]);
    gKnuck.applyMatrix4(mProx);
    skinParts.push(gKnuck);

    const gp = skinPart(capg(r, len * 0.38), skin, pi, [0, 0, -len * 0.21], [Math.PI / 2, 0, 0]);
    gp.applyMatrix4(mProx);
    skinParts.push(gp);

    // middle phalanx
    const gm = skinPart(capg(r * 0.93, len * 0.28), skin, mi, [0, 0, -len * 0.16], [Math.PI / 2, 0, 0]);
    gm.applyMatrix4(mMid);
    skinParts.push(gm);

    // distal phalanx + soft pink fingertip pad
    const gd = skinPart(capg(r * 0.86, len * 0.22), flush, di, [0, 0, -len * 0.13], [Math.PI / 2, 0, 0]);
    gd.applyMatrix4(mDist);
    skinParts.push(gd);

    // fingernail (separate glossy nail material)
    const gn = skinPart(sph(r * 0.62), '#f8e3dc', di, [0, r * 0.68, -len * 0.22], [0, 0, 0], [0.95, 0.28, 1.25], 0.01);
    gn.applyMatrix4(mDist);
    nailParts.push(gn);

    fingers.push({ prox, mid, dist });
  }

  // Opposable thumb (2 bones)
  const ta = new THREE.Bone();
  ta.position.set(-0.041 * side, -0.006, -0.012);
  ta.rotation.set(0, side * 0.72, side * 0.52);
  wrist.add(ta);
  const tb = new THREE.Bone();
  tb.position.set(0, 0, -0.022);
  ta.add(tb);
  bones.push(ta, tb);
  const tai = bones.length - 2, tbi = bones.length - 1;

  const mTa = new THREE.Matrix4().compose(ta.position, ta.quaternion, new THREE.Vector3(1, 1, 1));
  const mTb = mTa.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.022));

  const g1 = skinPart(capg(0.0124, 0.018), skin, tai, [0, 0, -0.011], [Math.PI / 2, 0, 0]);
  g1.applyMatrix4(mTa);
  skinParts.push(g1);

  const g2 = skinPart(capg(0.011, 0.014), flush, tbi, [0, 0, -0.011], [Math.PI / 2, 0, 0]);
  g2.applyMatrix4(mTb);
  skinParts.push(g2);

  const gtn = skinPart(sph(0.0068), '#f8e3dc', tbi, [0, 0.0078, -0.016], [0, 0, 0], [0.95, 0.28, 1.25], 0.01);
  gtn.applyMatrix4(mTb);
  nailParts.push(gtn);

  const group = new THREE.Group();
  const skeleton = new THREE.Skeleton(bones);

  const mkSkinned = (parts: THREE.BufferGeometry[], mat: THREE.Material) => {
    const geo = mergeGeometries(parts, false)!;
    geo.computeBoundingSphere();
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.renderOrder = 10;
    return m;
  };

  const skinMesh = mkSkinned(skinParts, skinMat!);
  skinMesh.add(forearm);
  skinMesh.updateMatrixWorld(true);
  skinMesh.bind(skeleton);

  const nailMesh = mkSkinned(nailParts, nailMat!);
  nailMesh.bind(skeleton);

  const sleeveMesh = mkSkinned(sleeveParts, sleeveMat!);
  sleeveMesh.bind(skeleton);

  group.add(skinMesh, nailMesh, sleeveMesh);
  return { group, skinMesh, nailMesh, sleeveMesh, wrist, fingers, thumb: { a: ta, b: tb } };
}

const _tq = new THREE.Quaternion();
const _ax = new THREE.Vector3();

interface Arm {
  root: THREE.Group;
  rig: HandRig;
  curl: number;
  wristPitch: number;
  thumbBase: THREE.Quaternion;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  tPos: THREE.Vector3;
  tRot: THREE.Euler;
}

/**
 * Two realistic baby hands & arms parented to the camera, smoothly blended between poses.
 */
export class Hands {
  group = new THREE.Group();
  arms: Arm[] = [];
  pose: HandPose = 'idle';
  reachTarget = new THREE.Vector3(0, 0, -0.4);
  reachSide: 0 | 1 = 1;
  gripTightness = 0.85;
  t = 0;
  crawlPhase = 0;
  crawlAmt = 0;
  poseTimer = 0;
  scale = 0.9;
  jiggle = 0;

  constructor(camera: THREE.Camera) {
    camera.add(this.group);
    for (const side of [-1, 1] as const) {
      const root = new THREE.Group();
      const rig = buildHand(side);
      root.add(rig.group);
      root.scale.setScalar(this.scale);
      this.group.add(root);
      this.arms.push({
        root,
        rig,
        curl: 0.22,
        wristPitch: 0,
        thumbBase: rig.thumb.a.quaternion.clone(),
        pos: new THREE.Vector3(side * 0.14, -0.3, -0.25),
        rot: new THREE.Euler(),
        tPos: new THREE.Vector3(),
        tRot: new THREE.Euler(),
      });
    }
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
      let wristTarget = 0;
      const breathe = Math.sin(t * 1.6 + i * 0.7) * 0.0055;
      switch (this.pose) {
        case 'idle': {
          if (this.crawlAmt > 0.5) {
            const ph = this.crawlPhase + i * Math.PI;
            const lift = Math.max(0, Math.sin(ph));
            a.tPos.set(s * 0.145, -0.155 + lift * 0.028, -0.33 - Math.cos(ph) * 0.042);
            a.tRot.set(-0.14 + lift * 0.18, -s * 0.16, -s * 0.05);
            wristTarget = 0.28 - lift * 0.35;
          } else {
            a.tPos.set(s * 0.16, -0.13 + breathe, -0.335);
            a.tRot.set(0.6, -s * 0.28, -s * 0.42);
            wristTarget = Math.sin(t * 1.3 + i) * 0.08;
          }
          break;
        }
        case 'reach': {
          const isReach = i === this.reachSide;
          if (isReach) {
            const tgt = this.reachTarget.clone();
            if (tgt.length() > 0.42) tgt.setLength(0.42);
            a.tPos.set(tgt.x + s * 0.02, tgt.y - 0.03, tgt.z + 0.05);
            a.tRot.set(0.92, -s * 0.08, -s * 0.08);
            wristTarget = -0.12;
          } else {
            a.tPos.set(s * 0.155, -0.24, -0.27);
            a.tRot.set(0.48, -s * 0.2, -s * 0.25);
          }
          break;
        }
        case 'throw': {
          if (i === 1) {
            a.tPos.set(0.08, -0.08, -0.42);
            a.tRot.set(0.15, -0.12, -0.15);
            wristTarget = -0.35;
          } else {
            a.tPos.set(-0.15, -0.22, -0.28);
            a.tRot.set(0.5, 0.2, 0.25);
          }
          break;
        }
        case 'hold':
        case 'hug': {
          const hug = this.pose === 'hug';
          if (hug) {
            a.tPos.set(s * 0.11, -0.245 + breathe, -0.35);
            a.tRot.set(0.35, s * 1.1, s * 0.45);
          } else {
            a.tPos.set(s * 0.078, -0.2 + breathe, -0.3);
            a.tRot.set(0.36, s * 0.56, s * 0.55);
          }
          grip = true;
          wristTarget = 0.12;
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
            wristTarget = -0.22 + Math.sin(t * 9) * 0.15;
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
      const k = this.pose === 'clap' || this.pose === 'pet' || this.pose === 'throw' ? 22 : 10;
      a.pos.x = damp(a.pos.x, a.tPos.x, k, dt);
      a.pos.y = damp(a.pos.y, a.tPos.y, k, dt);
      a.pos.z = damp(a.pos.z, a.tPos.z, k, dt);
      _tq.setFromEuler(a.tRot);
      a.root.quaternion.slerp(_tq, 1 - Math.exp(-k * dt));
      a.root.position.copy(a.pos);
      if (this.jiggle > 0.01 && i === 1) a.root.position.x += Math.sin(t * 46) * 0.018 * this.jiggle;

      a.wristPitch = damp(a.wristPitch, wristTarget, 10, dt);
      a.rig.wrist.rotation.x = a.wristPitch;

      const target = grip
        ? this.pose === 'bottle'
          ? 0.72
          : this.pose === 'cry'
            ? 0.96
            : this.gripTightness
        : this.pose === 'reach' && i === this.reachSide
          ? 0.04
          : this.pose === 'throw' && i === 1
            ? 0.03
            : this.pose === 'pet'
              ? 0.22
              : 0.24 + Math.sin(t * 1.1 + i) * 0.05;
      a.curl = damp(a.curl, target, grip ? 14 : 9, dt);
      const c = a.curl;
      a.rig.fingers.forEach((f, fi) => {
        const idx = i === 1 ? fi : 3 - fi;
        const wiggle = grip ? 0 : Math.sin(t * 2.1 + idx * 0.9 + i * 2) * 0.045;
        const fc = Math.max(0, c + wiggle + idx * 0.035);
        f.prox.rotation.x = -fc * 1.18;
        f.mid.rotation.x = -fc * 1.32;
        f.dist.rotation.x = -fc * 0.95;
      });
      a.rig.thumb.a.quaternion.copy(a.thumbBase).multiply(_tq.setFromAxisAngle(_ax.set(1, 0, 0), -c * 0.65));
      a.rig.thumb.b.rotation.x = -c * 0.88;
    });
  }
}

import * as THREE from 'three';
import { Builder, C, Mat } from '../world/lowpoly';
import { damp } from '../core/events';

export type HandPose = 'idle' | 'crawl' | 'reach' | 'hold' | 'pet' | 'clap' | 'cry' | 'mouth' | 'bottle' | 'hug';

const ico = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cap = (r: number, l: number, s = 6) => new THREE.CapsuleGeometry(r, l, 2, s);
const cyl = (a: number, b: number, h: number, s = 8) => new THREE.CylinderGeometry(a, b, h, s);

/** Builds one chubby low-poly baby hand + forearm + pale sleeve. Fingers point -z, forearm runs +z. */
function buildHand(side: 1 | -1, grip: boolean): THREE.Mesh {
  const b = new Builder();
  const skin = C.skin;
  const v = 0.035;
  // palm (chubby, slightly cupped)
  b.add(new THREE.IcosahedronGeometry(0.04, 2), skin, { pos: [0, 0, 0], scale: [1.12, 0.55, 1.0], variation: v });
  b.add(new THREE.IcosahedronGeometry(0.028, 1), skin, { pos: [0, 0.004, -0.03], scale: [1.45, 0.6, 0.7], variation: v });
  // fingers: separate stubby digits in a little fan
  const lens = [0.024, 0.034, 0.031, 0.022];
  for (let i = 0; i < 4; i++) {
    const k = i - 1.5;
    const len = lens[side === 1 ? i : 3 - i];
    const x = k * 0.0205 * side;
    if (grip) {
      b.add(cap(0.0108, len * 0.5, 7), skin, { pos: [x, -0.016, -0.046], rot: [Math.PI / 2 + 1.35, 0, 0], variation: v });
    } else {
      const spread = k * 0.16 * side;
      b.add(cap(0.0098, len, 7), skin, {
        pos: [x - Math.sin(spread) * 0.018, 0.003, -0.056 - len * 0.5],
        rot: [Math.PI / 2 + 0.08, 0, spread],
        variation: v,
      });
      // tiny nail tip highlight
      b.add(new THREE.IcosahedronGeometry(0.006, 0), '#fde3d6', { pos: [x - Math.sin(spread) * 0.03, 0.009, -0.06 - len * 1.0], scale: [1, 0.4, 1] });
    }
  }
  // thumb (inner side)
  b.add(cap(0.012, 0.022, 7), skin, {
    pos: [-0.048 * side, -0.003, -0.016],
    rot: grip ? [1.2, 0, -0.9 * side] : [1.4, 0, -0.85 * side],
    variation: v,
  });
  // wrist crease + chubby forearm
  b.add(new THREE.IcosahedronGeometry(0.033, 1), C.skinShade, { pos: [0, -0.004, 0.042], scale: [1.08, 0.85, 0.65], variation: v });
  b.add(cap(0.037, 0.13, 9), skin, { pos: [0, -0.006, 0.125], rot: [Math.PI / 2, 0, 0], variation: v });
  // pale cuffed sleeve
  b.add(cyl(0.05, 0.052, 0.035, 10), '#fbfbff', { pos: [0, -0.006, 0.2], rot: [Math.PI / 2, 0, 0], variation: 0.03 });
  b.add(cyl(0.052, 0.06, 0.24, 10), C.sleeve, { pos: [0, -0.006, 0.335], rot: [Math.PI / 2, 0, 0], jitter: 0.003, variation: 0.04 });
  return b.mesh(Mat.vcSoft, false, true);
}

const _tq = new THREE.Quaternion();

interface Arm {
  root: THREE.Group;
  open: THREE.Mesh;
  grip: THREE.Mesh;
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

  constructor(camera: THREE.Camera) {
    camera.add(this.group);
    for (const side of [-1, 1] as const) {
      const root = new THREE.Group();
      const open = buildHand(side, false);
      const grip = buildHand(side, true);
      grip.visible = false;
      root.add(open, grip);
      root.scale.setScalar(this.scale);
      this.group.add(root);
      this.arms.push({
        root, open, grip,
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
      a.open.visible = !grip;
      a.grip.visible = grip;
    });
  }
}

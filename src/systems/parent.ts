import * as THREE from 'three';
import { buildParent, type ParentRig } from '../world/parentModel';
import { damp } from '../core/events';

const IDLE_SPOTS = [
  new THREE.Vector3(2.2, 0, 1.6),
  new THREE.Vector3(4.9, 0, -1.6),
  new THREE.Vector3(5.1, 0, 2.55),
  new THREE.Vector3(1.6, 0, -1.2),
];
const DOOR_L = new THREE.Vector3(0.75, 0, 0.9);
const DOOR_N = new THREE.Vector3(-0.75, 0, 0.9);

/**
 * Parent AI – a tiny state machine:
 * wander → (hears a cry) → walk over → caring action (scripted by the game) → wander.
 */
export class Parent {
  rig: ParentRig;
  pos = new THREE.Vector3(4.9, 0, -1.6);
  heading = -Math.PI / 2;
  targetHeading = -Math.PI / 2;
  path: THREE.Vector3[] = [];
  speed = 1.25;
  busy = false;
  walkPhase = 0;
  idleTimer = 4;
  pose: 'none' | 'hold' | 'wave' | 'reach' = 'none';
  private arrive: (() => void) | null = null;
  private blinkT = 2;
  private t = 0;

  constructor(scene: THREE.Scene) {
    this.rig = buildParent();
    scene.add(this.rig.root);
    this.sync();
  }

  get walking() {
    return this.path.length > 0;
  }

  room(p: THREE.Vector3) {
    return p.x < 0 ? 'nursery' : 'living';
  }

  goTo(target: THREE.Vector3): Promise<void> {
    const path: THREE.Vector3[] = [];
    const from = this.room(this.pos), to = this.room(target);
    if (from !== to) {
      if (from === 'living') path.push(DOOR_L.clone(), DOOR_N.clone());
      else path.push(DOOR_N.clone(), DOOR_L.clone());
    }
    path.push(target.clone().setY(0));
    this.path = path;
    return new Promise((res) => {
      if (this.arrive) this.arrive();
      this.arrive = res;
    });
  }

  face(p: THREE.Vector3) {
    this.targetHeading = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  teleport(p: THREE.Vector3, heading: number) {
    this.pos.copy(p).setY(0);
    this.heading = this.targetHeading = heading;
    this.path = [];
    this.sync();
  }

  update(dt: number) {
    this.t += dt;
    if (this.path.length) {
      const tgt = this.path[0];
      const d = new THREE.Vector3().subVectors(tgt, this.pos).setY(0);
      const dist = d.length();
      if (dist < 0.06) {
        this.path.shift();
        if (!this.path.length && this.arrive) {
          const a = this.arrive;
          this.arrive = null;
          a();
        }
      } else {
        d.normalize();
        const step = Math.min(dist, this.speed * dt);
        this.pos.addScaledVector(d, step);
        this.targetHeading = Math.atan2(d.x, d.z);
        this.walkPhase += dt * 7.5;
      }
    } else if (!this.busy) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 6 + Math.random() * 6;
        const spot = IDLE_SPOTS[Math.floor(Math.random() * IDLE_SPOTS.length)];
        if (spot.distanceTo(this.pos) > 0.5) this.goTo(spot);
      }
    }
    // turn smoothly
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 8);

    // animation
    const r = this.rig;
    const walking = this.path.length > 0;
    const sw = walking ? Math.sin(this.walkPhase) : 0;
    r.legL.rotation.x = damp(r.legL.rotation.x, sw * 0.5, 12, dt);
    r.legR.rotation.x = damp(r.legR.rotation.x, -sw * 0.5, 12, dt);
    let aL = -sw * 0.4, aR = sw * 0.4, zL = 0.08, zR = -0.08;
    if (this.pose === 'hold') {
      aL = aR = -1.15;
      zL = -0.25;
      zR = 0.25;
    } else if (this.pose === 'reach') {
      aL = aR = -0.9;
      zL = -0.1;
      zR = 0.1;
    } else if (this.pose === 'wave') {
      aR = -2.7 + Math.sin(this.t * 10) * 0.25;
      zR = -0.35 + Math.sin(this.t * 10) * 0.25;
    }
    r.armL.rotation.x = damp(r.armL.rotation.x, aL, 10, dt);
    r.armR.rotation.x = damp(r.armR.rotation.x, aR, 10, dt);
    r.armL.rotation.z = damp(r.armL.rotation.z, zL, 10, dt);
    r.armR.rotation.z = damp(r.armR.rotation.z, zR, 10, dt);
    r.body.position.y = walking ? Math.abs(Math.cos(this.walkPhase)) * 0.025 : Math.sin(this.t * 1.5) * 0.004;
    r.head.rotation.z = Math.sin(this.t * 0.8) * 0.05;

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      r.faceMat.map = r.faceBlink;
      if (this.blinkT < -0.14) {
        r.faceMat.map = r.faceOpen;
        this.blinkT = 2 + Math.random() * 3;
      }
    }
    this.sync();
  }

  private sync() {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.heading;
  }

  headWorld(out = new THREE.Vector3()) {
    return this.rig.head.getWorldPosition(out);
  }
}

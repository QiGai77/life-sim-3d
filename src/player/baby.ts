import * as THREE from 'three';
import { clamp, damp } from '../core/events';
import type { AABB } from '../world/types';

export type BabyMode = 'crib' | 'floor' | 'scripted';

/**
 * The baby's head: low eye height, wobbly crawl bob and a limited look range
 * that opens up as the baby grows.
 */
export class Baby {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3(); // feet/body position (y = 0 on floor) – eye adds on top
  eye = 0.4;
  yaw = 0;
  pitch = 0;
  roll = 0;
  mode: BabyMode = 'crib';
  yawCenter = 0;
  yawRange = Math.PI; // ± range around yawCenter
  pitchMin = -0.9;
  pitchMax = 1.25;
  speed = 0.62;
  radius = 0.2;
  canCrawl = false;
  moving = 0; // 0..1 crawl intensity
  bobPhase = 0;
  shake = 0;
  bump = 0;
  /** extra camera roll / tilt for scripted moments (toppling over, dog licks) */
  tilt = 0;
  private velocity = new THREE.Vector2();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.03, 60);
    this.camera.rotation.order = 'YXZ';
  }

  setCrib(eye: THREE.Vector3, yaw: number) {
    this.mode = 'crib';
    this.pos.set(eye.x, 0, eye.z);
    this.eye = eye.y;
    this.yaw = yaw;
    this.yawCenter = yaw;
    this.yawRange = 1.45;
    this.pitchMin = -0.75;
    this.pitchMax = 1.2;
  }

  setFloor(p: THREE.Vector3, yaw: number) {
    this.mode = 'floor';
    this.pos.set(p.x, 0, p.z);
    this.eye = 0.4;
    this.yaw = yaw;
    this.pitch = -0.05;
    this.yawRange = Math.PI;
    this.pitchMin = -0.95;
    this.pitchMax = 1.0;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  look(dx: number, dy: number) {
    if (this.mode === 'scripted') return;
    this.yaw -= dx;
    this.pitch -= dy;
    if (this.yawRange < Math.PI) {
      let d = this.yaw - this.yawCenter;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // soft limit: the neck can only turn so far
      d = clamp(d, -this.yawRange, this.yawRange);
      this.yaw = this.yawCenter + d;
    }
    this.pitch = clamp(this.pitch, this.pitchMin, this.pitchMax);
  }

  update(dt: number, move: { x: number; y: number }, colliders: AABB[], t: number) {
    if (this.mode === 'floor' && this.canCrawl) {
      const f = this.forward();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const tx = (f.x * move.y + r.x * move.x) * this.speed;
      const tz = (f.z * move.y + r.z * move.x) * this.speed;
      this.velocity.x = damp(this.velocity.x, tx, 6, dt);
      this.velocity.y = damp(this.velocity.y, tz, 6, dt);
      this.pos.x += this.velocity.x * dt;
      this.pos.z += this.velocity.y * dt;
      const px = this.pos.x, pz = this.pos.z;
      this.resolve(colliders);
      const pushed = Math.hypot(this.pos.x - px, this.pos.z - pz);
      const sp = this.velocity.length() / this.speed;
      // crawled head-first into furniture at speed → report a bump (the game makes the baby topple)
      if (pushed > 0.0035 && sp > 0.75) {
        this.bump = sp;
        this.velocity.multiplyScalar(-0.4);
      }
      this.moving = damp(this.moving, Math.min(1, sp), 8, dt);
      this.bobPhase += dt * (2.0 + sp * 5.5);
    } else {
      this.moving = damp(this.moving, 0, 8, dt);
      this.bobPhase += dt * 1.2;
    }
    if (this.mode !== 'scripted') {
      const bob = Math.sin(this.bobPhase * 2) * 0.022 * this.moving;
      const breathe = Math.sin(t * 1.6) * 0.004;
      const sway = Math.sin(this.bobPhase) * 0.035 * this.moving;
      this.roll = damp(this.roll, sway, 6, dt);
      const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      this.shake = Math.max(0, this.shake - dt * 0.05);
      this.camera.position.set(this.pos.x, this.eye + bob + breathe + sh, this.pos.z);
      this.camera.rotation.set(this.pitch + Math.sin(this.bobPhase * 2 + 0.6) * 0.012 * this.moving + sh, this.yaw, this.roll + this.tilt);
    }
  }

  resolve(colliders: AABB[]) {
    const r = this.radius;
    for (let it = 0; it < 3; it++) {
      for (const b of colliders) {
        const cx = clamp(this.pos.x, b.minX, b.maxX);
        const cz = clamp(this.pos.z, b.minZ, b.maxZ);
        let dx = this.pos.x - cx, dz = this.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-8) {
            // centre inside the box: push out along the smallest axis
            const pushes = [b.maxX - this.pos.x, this.pos.x - b.minX, b.maxZ - this.pos.z, this.pos.z - b.minZ];
            const m = Math.min(...pushes);
            if (m === pushes[0]) this.pos.x = b.maxX + r;
            else if (m === pushes[1]) this.pos.x = b.minX - r;
            else if (m === pushes[2]) this.pos.z = b.maxZ + r;
            else this.pos.z = b.minZ - r;
          } else {
            const d = Math.sqrt(d2);
            dx /= d;
            dz /= d;
            this.pos.x = cx + dx * r;
            this.pos.z = cz + dz * r;
          }
        }
      }
    }
  }
}

import * as THREE from 'three';
import { clamp, damp } from '../core/events';
import { C, paint, Builder, Mat } from '../world/lowpoly';
import type { AABB } from '../world/types';
import { assets } from '../core/assets';
import { skinNormalTex } from '../world/textures';

export type BabyMode = 'crib' | 'floor' | 'stand' | 'scripted';

/**
 * 3D Baby body & mirror avatar:
 *  - Lower onesie torso + chubby legs + knitted socks are visible when the player looks down.
 *  - The 3D head is hidden for the main camera, and shown during Reflector mirror passes
 *    so looking into the nursery mirror shows a real 3D baby reacting with expressions!
 */
export class BabyAvatar {
  root = new THREE.Group();
  headGroup = new THREE.Group();
  leftLeg = new THREE.Group();
  rightLeg = new THREE.Group();
  private mouthSmile!: THREE.Mesh;
  private mouthOpen!: THREE.Mesh;
  private eyesNormal: THREE.Mesh[] = [];
  private eyesHappy: THREE.Mesh[] = [];
  private expr: 'neutral' | 'laugh' | 'cry' = 'neutral';
  private exprTimer = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);

    const sn = skinNormalTex();
    sn.repeat.set(3, 3);
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: '#f5c7af',
      roughness: 0.48,
      normalMap: sn,
      normalScale: new THREE.Vector2(0.22, 0.22),
      sheen: 0.7,
      sheenColor: new THREE.Color('#ffb5a0'),
      clearcoat: 0.12,
    });
    const kn = assets.tex.knitNor.clone();
    kn.repeat.set(5, 5);
    const onesieMat = new THREE.MeshStandardMaterial({
      color: '#eceae4',
      roughness: 0.9,
      normalMap: kn,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });
    const sockMat = new THREE.MeshStandardMaterial({
      color: '#c98e72',
      roughness: 0.92,
      normalMap: kn,
      normalScale: new THREE.Vector2(0.9, 0.9),
    });

    // Onesie torso (sits behind/below the camera so looking down shows your tummy)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.15, 8, 18), onesieMat);
    torso.position.set(0, 0.18, 0.08);
    torso.rotation.x = 0.25;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.root.add(torso);

    // Chubby legs & little socks extending slightly forward when seated/lying or trailing when crawling
    const mkLeg = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.075, 0.11, 0.05);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.11, 6, 14), onesieMat);
      thigh.rotation.x = Math.PI / 2 - 0.15;
      thigh.position.set(0, -0.02, -0.08);
      thigh.castShadow = true;
      const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.08, 6, 14), skinMat);
      calf.rotation.x = Math.PI / 2 - 0.25;
      calf.position.set(0, -0.045, -0.18);
      const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.039, 0.055, 6, 14), sockMat);
      sock.rotation.x = Math.PI / 2 - 0.1;
      sock.position.set(0, -0.06, -0.245);
      g.add(thigh, calf, sock);
      return g;
    };
    this.leftLeg = mkLeg(-1);
    this.rightLeg = mkLeg(1);
    this.root.add(this.leftLeg, this.rightLeg);

    // 3D Baby Head (visible ONLY in the mirror reflection!)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 20), skinMat);
    skull.scale.set(1.0, 1.04, 1.02);
    this.headGroup.add(skull);

    // Chubby cheeks
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), skinMat);
      cheek.position.set(s * 0.052, -0.02, -0.072);
      this.headGroup.add(cheek);
      // Ears
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), skinMat);
      ear.scale.set(0.45, 1, 0.85);
      ear.position.set(s * 0.102, -0.005, 0.01);
      this.headGroup.add(ear);
    }

    // Soft baby hair tuft on crown
    const hairMat = new THREE.MeshPhysicalMaterial({ color: '#6b4733', roughness: 0.55, sheen: 0.45, sheenColor: new THREE.Color('#9c735b') });
    for (let i = 0; i < 6; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.032 - i * 0.002, 12, 10), hairMat);
      tuft.scale.set(1.2, 0.65, 1.1);
      tuft.position.set((i - 2.5) * 0.024, 0.092 - Math.abs(i - 2.5) * 0.006, -0.02 + (i % 2) * 0.018);
      this.headGroup.add(tuft);
    }

    // Glossy eyes + happy curved eyelids
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#241711', roughness: 0.06, clearcoat: 1.0 });
    const lidMat = new THREE.MeshStandardMaterial({ color: '#472f24', roughness: 0.6 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 12), eyeMat);
      eye.position.set(s * 0.036, 0.006, -0.094);
      this.headGroup.add(eye);
      this.eyesNormal.push(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      glint.position.set(s * 0.039, 0.011, -0.105);
      this.headGroup.add(glint);

      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0032, 6, 12, Math.PI), lidMat);
      arc.position.set(s * 0.036, 0.004, -0.098);
      arc.visible = false;
      this.headGroup.add(arc);
      this.eyesHappy.push(arc);
    }

    // Tiny button nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), skinMat);
    nose.position.set(0, -0.01, -0.104);
    this.headGroup.add(nose);

    // Mouths (neutral smile vs open laugh/cry)
    const lipMat = new THREE.MeshStandardMaterial({ color: '#c46f6a', roughness: 0.45 });
    this.mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 6, 12, Math.PI), lipMat);
    this.mouthSmile.rotation.z = Math.PI;
    this.mouthSmile.position.set(0, -0.032, -0.095);
    this.headGroup.add(this.mouthSmile);

    this.mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshStandardMaterial({ color: '#8f3b3b', roughness: 0.4 }));
    this.mouthOpen.scale.set(1.1, 0.9, 0.5);
    this.mouthOpen.position.set(0, -0.04, -0.093);
    this.mouthOpen.visible = false;
    this.headGroup.add(this.mouthOpen);

    // keep unused imports harmlessly typed if needed
    void C; void paint; void Builder; void Mat;

    this.headGroup.visible = false;
    this.root.add(this.headGroup);
  }

  setExpr(e: 'neutral' | 'laugh' | 'cry', dur = 2.0) {
    this.expr = e;
    this.exprTimer = dur;
    const happy = e === 'laugh';
    const open = e === 'laugh' || e === 'cry';
    this.eyesNormal.forEach((m) => (m.visible = !happy));
    this.eyesHappy.forEach((m) => (m.visible = happy));
    this.mouthSmile.visible = !open;
    this.mouthOpen.visible = open;
  }

  setHeadVisible(v: boolean) {
    this.headGroup.visible = v;
  }

  update(dt: number, baby: Baby, t: number) {
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0 && this.expr !== 'neutral') this.setExpr('neutral', 0);
    }
    const camPos = baby.camera.position;
    this.root.position.set(camPos.x, Math.max(0, camPos.y - 0.34), camPos.z);
    this.root.rotation.y = baby.yaw;

    // Position the head right at the camera head spot (visible in mirrors!)
    this.headGroup.position.set(0, camPos.y - this.root.position.y, 0);
    this.headGroup.rotation.set(baby.pitch * 0.75, 0, baby.roll + baby.tilt);

    // Show legs only in floor/crib mode when not in cutscene
    const showBody = baby.mode !== 'scripted';
    this.leftLeg.visible = showBody;
    this.rightLeg.visible = showBody;

    // Kick/crawl legs organically
    const kick = baby.mode === 'crib' ? Math.sin(t * 2.4) * 0.14 : Math.sin(baby.bobPhase) * 0.25 * baby.moving;
    const kick2 = baby.mode === 'crib' ? Math.cos(t * 2.1) * 0.14 : -kick;
    this.leftLeg.rotation.x = baby.mode === 'stand' ? -0.9 : kick;
    this.rightLeg.rotation.x = baby.mode === 'stand' ? -0.9 : kick2;
  }
}

/**
 * The baby's head & locomotion: low eye height, wobbly crawl bob, crib / floor / stand-up modes.
 */
export class Baby {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3();
  eye = 0.4;
  yaw = 0;
  pitch = 0;
  roll = 0;
  mode: BabyMode = 'crib';
  yawCenter = 0;
  yawRange = Math.PI;
  pitchMin = -0.95;
  pitchMax = 1.25;
  speed = 0.68;
  radius = 0.2;
  canCrawl = false;
  moving = 0;
  bobPhase = 0;
  shake = 0;
  bump = 0;
  tilt = 0;
  /** standing support anchor (when pulling up to stand by sofa/crib/chair) */
  standBasePos = new THREE.Vector3();
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
    // Higher freedom: baby can look almost all the way around in the crib!
    this.yawRange = Math.PI * 0.92;
    this.pitchMin = -0.88;
    this.pitchMax = 1.25;
  }

  setFloor(p: THREE.Vector3, yaw: number) {
    this.mode = 'floor';
    this.pos.set(p.x, 0, p.z);
    this.eye = 0.4;
    this.yaw = yaw;
    this.pitch = -0.05;
    this.yawRange = Math.PI;
    this.pitchMin = -1.05;
    this.pitchMax = 1.15;
  }

  setStand(p: THREE.Vector3, eyeHeight: number) {
    this.mode = 'stand';
    this.pos.set(p.x, 0, p.z);
    this.standBasePos.copy(this.pos);
    this.eye = eyeHeight;
    this.yawRange = Math.PI;
    this.pitchMin = -1.1;
    this.pitchMax = 1.1;
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
      this.velocity.x = damp(this.velocity.x, tx, 7, dt);
      this.velocity.y = damp(this.velocity.y, tz, 7, dt);
      this.pos.x += this.velocity.x * dt;
      this.pos.z += this.velocity.y * dt;
      const px = this.pos.x, pz = this.pos.z;
      this.resolve(colliders);
      const pushed = Math.hypot(this.pos.x - px, this.pos.z - pz);
      const sp = this.velocity.length() / this.speed;
      if (pushed > 0.0035 && sp > 0.78) {
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
      const bob = Math.sin(this.bobPhase * 2) * 0.02 * this.moving;
      const breathe = Math.sin(t * 1.6) * 0.004;
      const sway = this.mode === 'stand' ? Math.sin(t * 2.1) * 0.015 : Math.sin(this.bobPhase) * 0.032 * this.moving;
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

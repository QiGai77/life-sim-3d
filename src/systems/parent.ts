import * as THREE from 'three';
import { Human, type HumanStyle, type Overlay } from '../world/human';
import { assets } from '../core/assets';

const DOOR_L = new THREE.Vector3(0.75, 0, 0.9);
const DOOR_N = new THREE.Vector3(-0.75, 0, 0.9);

export const MOM_STYLE: HumanStyle = {
  height: 1.66,
  colors: { Skin: '#f1c7a9', White: '#8ea6cf', Grey: '#9a8577', Hair_Blond: '#5b3a2a', Hair_Brown: '#3b2519', Brown: '#22150f', Orange: '#e8dcc8' },
  knit: ['White'],
  hair: ['Hair_Blond', 'Hair_Brown'],
  skin: ['Skin'],
  eyes: ['Brown'],
};
export const DAD_STYLE: HumanStyle = {
  height: 1.78,
  colors: { Skin: '#e9bf9f', Skin_Darker: '#d9a988', White: '#f1ece4', LightBlue: '#56657f', Red_Dark: '#c47556', LightBrown: '#9fb391', Eyebrows: '#2c1d14', Hair: '#2f2118', Eye: '#1d130e' },
  knit: ['LightBrown'],
  hair: ['Hair', 'Eyebrows'],
  skin: ['Skin', 'Skin_Darker'],
  eyes: ['Eye'],
};

/**
 * Parent AI – a tiny state machine driving a rigged Human:
 * wander → (hears a cry) → walk over → caring action (scripted by the game) → wander.
 */
export class Parent {
  human: Human;
  pos = new THREE.Vector3(4.9, 0, -1.6);
  heading = -Math.PI / 2;
  targetHeading = -Math.PI / 2;
  path: THREE.Vector3[] = [];
  speed = 1.25;
  busy = false;
  idleTimer = 4;
  pose: 'none' | 'hold' | 'wave' | 'reach' | 'dance' | 'peek' | 'tickle' | 'cheer' | 'kneel' = 'none';
  /** where the eyes go when idle (usually the baby's head) */
  lookAt: THREE.Vector3 | null = null;
  private arrive: (() => void) | null = null;
  private t = 0;

  constructor(scene: THREE.Scene, public name: '妈妈' | '爸爸' = '妈妈', private idleSpots: THREE.Vector3[] = []) {
    this.human = new Human(assets.gltf[name === '妈妈' ? 'mom' : 'dad'] ?? null, name === '妈妈' ? MOM_STYLE : DAD_STYLE);
    scene.add(this.human.root);
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
      }
    } else if (!this.busy && this.idleSpots.length) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 6 + Math.random() * 6;
        const spot = this.idleSpots[Math.floor(Math.random() * this.idleSpots.length)];
        if (spot.distanceTo(this.pos) > 0.5) this.goTo(spot);
      }
    }
    // turn smoothly
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 8);

    // animation state → clips + procedural overlays
    const h = this.human;
    const walking = this.path.length > 0;
    let overlay: Overlay = 'none';
    h.kneel = 0;
    if (walking) h.play(this.speed > 1.45 ? 'Run' : 'Walk', 0.25, false, this.speed > 1.45 ? this.speed / 3.2 : this.speed / 1.2);
    else if (this.pose === 'wave') h.play('Wave', 0.25);
    else h.play('Idle', 0.3);
    if (!walking) {
      if (this.pose === 'hold') overlay = 'hold';
      else if (this.pose === 'reach') {
        overlay = 'reach';
        h.kneel = 0.7;
      } else if (this.pose === 'kneel') h.kneel = 0.85;
      else if (this.pose === 'dance') overlay = 'dance';
      else if (this.pose === 'peek') {
        overlay = 'peek';
        h.kneel = 0.6;
      } else if (this.pose === 'tickle') {
        overlay = 'tickle';
        h.kneel = 0.75;
      } else if (this.pose === 'cheer') overlay = 'cheer';
    }
    h.overlay = overlay;
    h.lookTarget = this.lookAt;
    if (this.pose === 'dance' || this.pose === 'cheer') h.setMouth('open');
    else if (this.pose === 'tickle') h.setMouth('rasp');
    else if (this.pose === 'peek') h.setMouth('o');
    else h.setMouth('smile');
    this.sync();
    h.update(dt);
  }

  private sync() {
    this.human.root.position.copy(this.pos);
    this.human.root.rotation.y = this.heading;
    this.human.root.updateMatrixWorld(true);
  }

  headWorld(out = new THREE.Vector3()) {
    return this.human.headWorld(out);
  }
}

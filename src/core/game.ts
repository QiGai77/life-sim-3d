import * as THREE from 'three';
import { bus, tweens, ease, clamp, lerp } from './events';
import { Input, type Action } from './input';
import { assets } from './assets';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sfx } from './audio';
import { House, LAYOUT } from '../world/house';
import { babyBottle } from '../world/props';
import { heartSprite } from '../world/textures';
import type { Interactable } from '../world/types';
import { Baby, BabyAvatar } from '../player/baby';
import { Hands } from '../player/hands';
import { Needs } from '../systems/needs';
import { Tasks, type Task } from '../systems/tasks';
import { Parent } from '../systems/parent';
import { Post } from '../fx/post';
import { Outline } from '../fx/outline';
import { UI } from '../ui/hud';
import { Fun } from '../systems/fun';

type GameState = 'title' | 'play' | 'cutscene' | 'end';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  mobile: boolean;
  pixelRatio: number;
  post: Post;
  baby: Baby;
  avatar: BabyAvatar;
  hands: Hands;
  house: House;
  parent: Parent;
  dad: Parent;
  needs = new Needs();
  tasks = new Tasks();
  ui: UI;
  fun!: Fun;
  input: Input;
  outline = new Outline();
  raycaster = new THREE.Raycaster();
  holdAnchor = new THREE.Group();
  bottle = babyBottle();

  state: GameState = 'title';
  hover: Interactable | null = null;
  /** head-turn speed (rad/s), used for the rattle */
  lookVel = 0;
  private lookSeenAt = 0;
  held: Interactable | null = null;
  time = 0;
  playTime = 0;
  private hugTime = 0;
  private ballTouches = 0;
  private ballCooldown = 0;
  private nudgeCd = 0;
  private standingAt: Interactable | null = null;
  private standingFrom: 'crib' | 'floor' = 'floor';
  private standPrevPos = new THREE.Vector3();
  private rollCount = 0;
  private rollSign = 0;
  private rollTimer = 0;
  private cryCooldown = 0;
  private autoCry = 25;
  dogAwake = 0;
  private hearts: { s: THREE.Sprite; t: number; v: THREE.Vector3 }[] = [];
  private heartTex = heartSprite();
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fpsLow = 0;
  private showFps = /fps/.test(location.search);
  private adaptive = !/debug/.test(location.search);
  private titleT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.6 : 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r18x PCF is soft (shadow.radius)

    this.scene.background = new THREE.Color('#d8e2eb');
    this.scene.fog = new THREE.Fog('#e6ded5', 11, 34);
    // image-based lighting: CC0 Poly Haven HDRI (self-hosted) → PMREM, RoomEnvironment as fallback
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = assets.hdr ? pmrem.fromEquirectangular(assets.hdr).texture : pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.environmentRotation.set(0, 1.2, 0);
    pmrem.dispose();

    this.baby = new Baby(window.innerWidth / window.innerHeight);
    this.scene.add(this.baby.camera);
    this.baby.camera.add(this.holdAnchor);
    this.hands = new Hands(this.baby.camera);
    this.avatar = new BabyAvatar(this.scene);

    this.house = new House(this.scene, this.mobile ? 'low' : 'high');
    this.house.onMirrorRender = (active) => this.avatar.setHeadVisible(active);
    this.house.onClimbRequest = (i) => this.toggleClimb(i);
    this.parent = new Parent(this.scene, '妈妈', [new THREE.Vector3(2.2, 0, 1.6), new THREE.Vector3(4.9, 0, -1.6), new THREE.Vector3(5.1, 0, 2.55), new THREE.Vector3(1.6, 0, -1.2)]);
    this.dad = new Parent(this.scene, '爸爸', [new THREE.Vector3(5.6, 0, -2.4), new THREE.Vector3(3.4, 0, 2.6), new THREE.Vector3(1.8, 0, 2.3), new THREE.Vector3(5.6, 0, 2.2)]);
    this.dad.teleport(new THREE.Vector3(5.6, 0, -2.4), -2.4);
    this.dad.speed = 1.0;
    this.dad.idleTimer = 9;

    this.house.addI({
      id: 'mom_npc',
      name: '妈妈',
      kind: 'pet',
      verb: '抱抱·展示',
      obj: this.parent.human.root,
      bottom: 0,
      radius: 0.48,
      enabled: true,
      range: 2.2,
      onUse: () => this.interactParent('mom'),
    });
    this.house.addI({
      id: 'dad_npc',
      name: '爸爸',
      kind: 'pet',
      verb: '举高高·展示',
      obj: this.dad.human.root,
      bottom: 0,
      radius: 0.48,
      enabled: true,
      range: 2.2,
      onUse: () => this.interactParent('dad'),
    });

    this.bottle.visible = false;
    this.bottle.position.set(0.035, -0.115, -0.26);
    this.bottle.scale.setScalar(0.85);
    this.bottle.rotation.set(2.05, 0, -0.15);
    this.holdAnchor.add(this.bottle);

    this.post = new Post(this.renderer, this.scene, this.baby.camera, this.mobile);
    this.ui = new UI(this.mobile);
    this.input = new Input(document.getElementById('touch-layer')!, canvas);

    this.baby.setCrib(LAYOUT.cribEye, -Math.PI / 2 + 0.25);
    this.baby.pitch = 0.3;

    this.fun = new Fun(this);
    this.bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.ui.renderTasks(this.tasks.list);
    this.ui.setNeeds(this.needs.v);
    this.ui.joyLocked(true);
  }

  /* ================= setup ================= */

  private bindEvents() {
    bus.on('action', (a: Action) => this.onAction(a));
    bus.on('needs', (v) => this.ui.setNeeds(v));
    bus.on('tasks', (l: Task[]) => this.ui.renderTasks(l));
    bus.on('uiClick', () => sfx.click());
    bus.on('taskDone', (t: Task) => {
      sfx.success();
      tweens.wait(0.25).then(() => sfx.thump());
      this.ui.toast(`任务完成：${t.title}`, 'done');
      this.ui.pulseBoard();
      this.needs.add('curious', 10);
    });
    bus.on('allDone', () => {
      tweens.wait(1.8).then(() => this.finish());
    });
    bus.on('babySpeech', (txt: string) => this.ui.speech('宝宝', txt, 1.8));
    bus.on('tvSpeech', (txt: string) => this.ui.speech('电视', txt, 2.6));
    bus.on('pointerlock', () => {});
    document.getElementById('start-btn')!.addEventListener('click', () => this.start());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.pixelRatio);
    const cam = this.baby.camera;
    cam.aspect = w / h;
    cam.fov = w / h < 1.2 ? 85 : 70;
    cam.updateProjectionMatrix();
  }

  start() {
    if (this.state !== 'title') return;
    sfx.unlock();
    if (this.mobile) {
      const el: any = document.documentElement;
      try {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
      } catch {
        /* ignore */
      }
    }
    const st = document.getElementById('start')!;
    st.classList.add('leaving');
    setTimeout(() => st.classList.add('hidden'), 650);
    this.ui.showHud();
    this.input.enabled = true;
    this.input.requestLock();
    this.state = 'play';
    this.baby.setCrib(LAYOUT.cribEye, -Math.PI / 2 + 0.25);
    this.baby.pitch = 0.36;
    sfx.coo();
    setTimeout(() => this.ui.speech('宝宝', '咿呀～ 床铃在转！', 2.6), 600);
    setTimeout(() => {
      this.ui.toggleBoard(true);
      setTimeout(() => this.ui.toggleBoard(false), 3200);
    }, 900);
  }

  /* ================= actions ================= */

  private onAction(a: Action) {
    if (a === 'board') {
      this.ui.toggleBoard();
      sfx.click();
      return;
    }
    if (this.state !== 'play') return;
    switch (a) {
      case 'grab':
        if (this.held) {
          if (this.hover && (this.hover.id === 'mom_npc' || this.hover.id === 'dad_npc')) {
            this.hover.onUse?.();
          } else if (this.hover && this.hover.kind === 'toggle') {
            this.useInteractable(this.hover);
          } else {
            this.drop();
          }
        } else if (this.hover && this.hover.kind === 'hold') {
          this.pickUp(this.hover);
        } else if (this.hover && (this.hover.kind === 'toggle' || this.hover.kind === 'climb')) {
          this.useInteractable(this.hover);
        } else if (this.hover && this.hover.kind === 'pet') {
          this.pet(this.hover);
        } else {
          this.hands.reachTarget.set(0, 0.05, -0.4);
          this.hands.reachSide = Math.random() < 0.5 ? 0 : 1;
          this.hands.setPose('reach', 0.45);
          sfx.pop();
        }
        break;
      case 'throw':
        if (this.held) this.throwHeld();
        else if (this.hover && (this.hover.kind === 'toggle' || this.hover.kind === 'climb')) this.useInteractable(this.hover);
        else if (this.hover && this.hover.kind === 'pet') this.pet(this.hover);
        break;
      case 'mouth':
        this.mouth();
        break;
      case 'cry':
        this.cry(false);
        break;
      case 'laugh':
        this.laugh();
        break;
    }
  }

  private useInteractable(i: Interactable) {
    _v.copy(i.obj.getWorldPosition(new THREE.Vector3()));
    this.baby.camera.worldToLocal(_v);
    this.hands.reachTarget.copy(_v);
    this.hands.reachSide = _v.x < 0 ? 0 : 1;
    this.hands.setPose('reach', 0.35);
    i.onUse?.();
    this.needs.add('curious', 2);
  }

  private pickUp(i: Interactable) {
    // reach first, then the object snaps into the hands
    _v.copy(i.obj.getWorldPosition(new THREE.Vector3()));
    this.baby.camera.worldToLocal(_v);
    this.hands.reachTarget.copy(_v);
    this.hands.reachSide = _v.x < 0 ? 0 : 1;
    this.hands.setPose('reach', 0.22);
    sfx.pop();
    this.held = i;
    this.outline.set(null);
    if (i.isOrnament) {
      this.tasks.complete('star');
      sfx.chime();
      this.ui.speech('宝宝', '抓到星星啦！咯咯～', 2.2);
    }
    if (i.vel) i.vel.set(0, 0, 0);
    if (i.angVel) i.angVel.set(0, 0, 0);
    this.needs.add('curious', 3);
    this.fun.onPickUp(i);
    const obj = i.obj;
    this.holdAnchor.attach(obj);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromEuler(i.holdRot ?? new THREE.Euler());
    const p1 = i.holdPos ?? new THREE.Vector3(0, -0.15, -0.35);
    tweens.run(0.28, (k) => {
      if (this.held !== i) return;
      const e = ease.out(k);
      obj.position.lerpVectors(p0, p1, e);
      obj.quaternion.slerpQuaternions(q0, q1, e);
    });
    if (i.isBlock) tweens.wait(0.05).then(() => this.settleBlocks());
  }

  private throwHeld() {
    const i = this.held;
    if (!i) return;
    this.held = null;
    this.hugTime = 0;
    const obj = i.obj;
    this.house.root.attach(obj);
    const dir = new THREE.Vector3();
    this.baby.camera.getWorldDirection(dir);
    dir.normalize();
    const speed = i.isBall ? 3.2 : i.isSoft ? 2.1 : i.isCeramic ? 2.2 : 2.65;
    const up = i.isSoft ? 1.1 : 1.45;
    (i.vel ??= new THREE.Vector3()).copy(dir).multiplyScalar(speed);
    i.vel.y += up;
    (i.angVel ??= new THREE.Vector3()).set(
      (Math.random() - 0.5) * 9,
      (Math.random() - 0.5) * 9,
      (Math.random() - 0.5) * 9,
    );
    this.hands.reachTarget.set(0, 0.02, -0.45);
    this.hands.setPose('throw', 0.36);
    sfx.whoosh();
    this.needs.add('curious', 2);
    if (i.isBall) this.fun.onBallKick();
  }

  private drop() {
    const i = this.held!;
    this.held = null;
    this.hugTime = 0;
    const obj = i.obj;
    const cam = this.baby.camera;
    const fwd = this.baby.forward(new THREE.Vector3());
    let target = new THREE.Vector3();
    let yaw = this.baby.yaw + (i.isTeddy ? Math.PI : 0);
    let stacked = false;

    if (i.isBlock && this.hover && this.hover.isBlock && this.hover !== i) {
      const top = this.columnTop(this.hover.obj.position.x, this.hover.obj.position.z, i);
      target.set(this.hover.obj.position.x, top + i.bottom, this.hover.obj.position.z);
      yaw = this.hover.obj.rotation.y;
      stacked = true;
    } else {
      const reach = this.baby.mode === 'crib' ? 0.32 : 0.42;
      target.set(cam.position.x + fwd.x * reach, 0, cam.position.z + fwd.z * reach);
      if (this.baby.mode === 'crib') {
        const c = LAYOUT.crib;
        target.x = clamp(target.x, c.x - 0.3, c.x + 0.3);
        target.z = clamp(target.z, c.z - 0.58, c.z + 0.58);
      }
      // auto-assist stacking when dropping next to a block
      if (i.isBlock) {
        const near = this.blocks().find((b) => b !== i && Math.hypot(b.obj.position.x - target.x, b.obj.position.z - target.z) < 0.17);
        if (near) {
          target.x = near.obj.position.x;
          target.z = near.obj.position.z;
          yaw = near.obj.rotation.y;
          stacked = true;
        }
      }
      // keep inside the rooms
      target.x = clamp(target.x, -4.85, 6.85);
      const minZ = target.x < 0 ? -2.35 : -3.35, maxZ = target.x < 0 ? 2.35 : 3.35;
      target.z = clamp(target.z, minZ, maxZ);
      const base = i.isBlock ? this.columnTop(target.x, target.z, i) : this.house.surfaceAt(target.x, target.z, cam.position.y);
      target.y = base + (i.isOrnament ? 0.022 : i.bottom) + 0.001;
    }

    this.house.root.attach(obj);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    const rot = i.isOrnament ? new THREE.Euler(-Math.PI / 2, 0, yaw) : new THREE.Euler(0, yaw, 0);
    if (i.isOrnament) rot.set(-Math.PI / 2, 0, 0);
    const q1 = new THREE.Quaternion().setFromEuler(rot);
    if (i.isOrnament) q1.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    const arc = Math.max(0.04, (p0.y - target.y) * 0.15);
    this.hands.setPose('reach', 0.25);
    this.hands.reachTarget.set(0, -0.2, -0.38);
    tweens.run(0.3, (k) => {
      const e = ease.inOut(k);
      obj.position.lerpVectors(p0, target, e);
      obj.position.y += Math.sin(k * Math.PI) * arc;
      obj.quaternion.slerpQuaternions(q0, q1, e);
    }).then(() => {
      if (stacked) sfx.click();
      else sfx.drop();
      this.squash(obj, i.isTeddy ? 0.12 : 0.22);
      if (i.isBall && i.vel) {
        i.vel.copy(fwd).multiplyScalar(1.3);
        this.fun.onBallKick();
      }
      if (i.isBlock) this.checkStack();
    });
  }

  private mouth() {
    const i = this.held;
    this.hands.setPose('mouth', 1.0);
    this.fun.onMouth(i);
    if (i) {
      const obj = i.obj;
      const p0 = (i.holdPos ?? new THREE.Vector3(0, -0.15, -0.35)).clone();
      const p1 = new THREE.Vector3(0.01, -0.09 - i.bottom * 0.6, -0.17);
      tweens.run(1.0, (k) => {
        if (this.held !== i) return;
        const e = Math.sin(k * Math.PI);
        obj.position.lerpVectors(p0, p1, e);
      });
      this.hands.setPose('hold', 0);
      tweens.wait(0.3).then(() => sfx.chomp());
      tweens.wait(0.6).then(() => sfx.chomp());
      this.needs.add('curious', 4);
      const lines: Record<string, string> = {
        teddy: '软软的，毛茸茸～',
        ball: '滑溜溜的球！',
        remote: '咬咬…咔哒！',
        duck: '嘎！小鸭子叫了！',
        rattle: '沙沙…甜甜的？',
        pacifier: '唔～最安心的奶嘴！',
        mug: '凉凉的陶瓷杯沿…',
        toycar: '木头小车咕噜噜～',
        vase: '光滑的小花瓶～',
        jar: '盖子甜甜的！好像有饼干！',
      };
      const line = i.isBlock
        ? '咬咬…硬邦邦的！'
        : i.isOrnament
          ? '叮～ 星星是凉凉的'
          : i.isSoft
            ? '软乎乎暖烘烘的～'
            : i.isBook
              ? '厚厚的纸板书～'
              : lines[i.id] ?? '咬咬～';
      this.ui.speech('宝宝', line, 1.8);
      if (i.isTeddy || i.isPacifier || i.isSoft) this.needs.add('love', 3);
    } else {
      sfx.coo();
      this.needs.add('sleep', 2);
      this.ui.speech('宝宝', '吧唧吧唧…吃手手', 1.6);
    }
  }

  cry(auto: boolean) {
    if (this.cryCooldown > 0 || this.state !== 'play') return;
    this.cryCooldown = 1.8;
    sfx.cry();
    this.hands.setPose('cry', 1.6);
    this.avatar.setExpr('cry', 2.2);
    this.baby.shake = 0.01;
    this.ui.speech('宝宝', auto ? '呜…哇——！（忍不住哭了）' : '哇——！哇——！', 1.8);
    if (!auto && this.fun.onCry()) return;
    if (this.parent.busy) {
      tweens.wait(0.9).then(() => this.ui.speech('妈妈', '来啦来啦～', 1.5));
      return;
    }
    tweens.wait(0.6).then(() => this.attend('cry'));
  }

  private laugh() {
    sfx.giggle();
    this.hands.setPose('clap', 1.0);
    this.avatar.setExpr('laugh', 2.2);
    tweens.wait(0).then(() => this.fun.onLaugh());
    const d = this.parent.pos.distanceTo(_v.set(this.baby.pos.x, 0, this.baby.pos.z));
    const head = this.parent.headWorld(_v2);
    const ndc = head.clone().project(this.baby.camera);
    const visible = d < 5 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1;
    if (visible && !this.parent.busy) {
      this.needs.add('love', 10);
      this.parent.face(this.baby.camera.position);
      this.parent.pose = 'wave';
      tweens.wait(1.6).then(() => (this.parent.pose = 'none'));
      tweens.wait(0.4).then(() => this.ui.speech('妈妈', '哈哈，宝宝真开心！', 2));
      this.spawnHearts(head, 3);
    } else {
      this.needs.add('love', 3);
      this.ui.speech('宝宝', '咯咯咯～', 1.2);
    }
    this.needs.add('curious', 1);
  }

  private pet(i: Interactable) {
    if (this.fun.onPet(i)) return;
    if (i.onUse) {
      this.hands.setPose('reach', 0.45);
      i.onUse();
      return;
    }
    if (i.id !== 'dog') return;
    this.hands.setPose('pet', 1.5);
    this.dogAwake = 8;
    const d = this.house.dog;
    if (d.state === 'sleep') d.state = 'awake';
    tweens.wait(0.45).then(() => sfx.woof());
    const head = (d.bones['Head'] ?? d.root).getWorldPosition(new THREE.Vector3());
    this.spawnHearts(head.add(new THREE.Vector3(0, 0.15, 0)), 4);
    this.needs.add('love', 12);
    this.needs.add('curious', 5);
    this.ui.speech('狗狗', '汪～（摇尾巴）', 2);
    tweens.wait(0.9).then(() => this.tasks.complete('dog'));
    bus.emit('pet', i.id);
  }

  /* ================= climb / stand & parent interaction ================= */

  private toggleClimb(i: Interactable) {
    if (this.state !== 'play' || !i.standAt) return;
    if (this.baby.mode === 'stand' && this.standingAt === i) {
      this.stepDown();
      return;
    }
    if (this.baby.mode === 'crib' && i.id !== 'crib_stand') return;

    const fromCrib = this.baby.mode === 'crib';
    if (this.baby.mode !== 'stand') {
      this.standingFrom = fromCrib ? 'crib' : 'floor';
      this.standPrevPos.copy(this.baby.pos);
    }
    this.standingAt = i;

    const targetPos = fromCrib
      ? new THREE.Vector3(LAYOUT.cribEye.x, 0, LAYOUT.cribEye.z)
      : new THREE.Vector3(i.standAt.x, 0, i.standAt.z);
    const targetEye = fromCrib ? 0.78 : i.standAt.eye;

    sfx.boing();
    const p0 = this.baby.pos.clone();
    const e0 = this.baby.eye;
    this.baby.setStand(targetPos, targetEye);
    if (i.id === 'beanbag') {
      this.ui.speech('宝宝', '扑进软绵绵的懒人沙发！咻～', 2);
      this.needs.add('love', 5);
    } else if (i.id === 'sofa') {
      this.ui.speech('宝宝', '扶着大沙发站高高啦！', 2);
    } else if (i.id === 'armchair') {
      this.ui.speech('宝宝', '扶着扶手站起来看看外面～', 2);
    } else if (i.id === 'crib_stand') {
      this.ui.speech('宝宝', '扶着床栏站起来了！好高呀～', 2);
    }
    this.needs.add('curious', 4);
    tweens.run(0.32, (k) => {
      const e = ease.out(k);
      this.baby.pos.lerpVectors(p0, targetPos, e);
      this.baby.eye = lerp(e0, targetEye, e) + (i.id === 'beanbag' ? Math.sin(k * Math.PI) * 0.08 : 0);
    });
  }

  private stepDown() {
    if (this.baby.mode !== 'stand') return;
    const prev = this.standingFrom;
    const back = this.standPrevPos.clone();
    const curPos = this.baby.pos.clone();
    const curEye = this.baby.eye;
    this.standingAt = null;
    sfx.pop();
    if (prev === 'crib') {
      this.baby.setCrib(LAYOUT.cribEye, this.baby.yaw);
      const targetEye = LAYOUT.cribEye.y;
      tweens.run(0.28, (k) => {
        this.baby.eye = lerp(curEye, targetEye, ease.out(k));
      });
    } else {
      this.baby.setFloor(back, this.baby.yaw);
      tweens.run(0.28, (k) => {
        const e = ease.out(k);
        this.baby.pos.lerpVectors(curPos, back, e);
        this.baby.eye = lerp(curEye, 0.4, e);
      });
    }
  }

  private async interactParent(who: 'mom' | 'dad') {
    if (this.state !== 'play') return;
    const p = who === 'mom' ? this.parent : this.dad;
    if (p.busy) {
      this.ui.speech(who === 'mom' ? '妈妈' : '爸爸', '等爸爸妈妈一下下哦～', 1.6);
      return;
    }
    p.face(this.baby.camera.position);
    const head = p.headWorld(new THREE.Vector3());

    if (this.held) {
      const item = this.held;
      const itemName = item.name;
      p.pose = 'cheer';
      sfx.coo();
      this.spawnHearts(head, 4);
      this.needs.add('love', 8);
      this.needs.add('curious', 4);
      const reactMap: Record<string, string> = {
        duck: '哎呀，小黄鸭真神气！嘎嘎嘎～',
        teddy: '宝宝好喜欢熊熊呀，给它一个大拥抱～',
        pacifier: '找到小奶嘴啦？宝宝自己拿着真棒！',
        remote: '好家伙，又偷偷拿遥控器啦？别乱按哦～',
        mug: '小心哦宝贝，这是装热茶的瓷杯～',
        jar: '哈哈哈，小馋猫想要饼干罐里的曲奇吗？',
        vase: '哇小心点，花瓶很光滑别摔着啦～',
        toycar: '嘀嘀嘀～ 宝宝的木头小赛车好酷！',
      };
      const line =
        item.isBlock
          ? '宝宝抓着小积木呢，要不要试试叠高高？'
          : item.isBook
            ? `拿了一本《${itemName}》呀！晚上再给宝宝讲故事～`
            : reactMap[item.id] ?? `哇，宝宝把${itemName}拿过来给我看啦！真厉害！`;
      this.ui.speech(who === 'mom' ? '妈妈' : '爸爸', line, 2.6);
      tweens.wait(1.6).then(() => {
        if (!p.busy) p.pose = 'none';
      });
      return;
    }

    if (who === 'mom') {
      p.pose = 'kneel';
      sfx.giggle();
      this.spawnHearts(head, 5);
      this.needs.add('love', 14);
      this.ui.speech('妈妈', '小宝贝真贴心～ 妈妈最爱你啦！', 2.4);
      tweens.wait(1.8).then(() => {
        if (!p.busy) p.pose = 'none';
      });
      return;
    }

    // Dad interactive "举高高" (lift up high!) when on floor/stand near Dad
    if (this.baby.mode === 'crib') {
      p.pose = 'wave';
      sfx.coo();
      this.spawnHearts(head, 4);
      this.needs.add('love', 10);
      this.ui.speech('爸爸', '嘿嘿，小家伙在婴儿床里精神得很呀！', 2.4);
      tweens.wait(1.6).then(() => {
        if (!p.busy) p.pose = 'none';
      });
      return;
    }

    this.state = 'cutscene';
    p.busy = true;
    p.pose = 'hold';
    this.stepDown();
    const savedPos = this.baby.pos.clone();
    const savedEye = this.baby.eye;
    const savedPitch = this.baby.pitch;
    this.baby.mode = 'scripted';
    sfx.boing();
    this.ui.speech('爸爸', '嘿咻——飞高高喽！', 2.2);
    this.spawnHearts(head, 5);
    const cam = this.baby.camera;
    const targetP = p.pos.clone().add(new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)).multiplyScalar(0.36));
    await tweens.run(0.75, (k) => {
      const e = ease.out(k);
      cam.position.set(lerp(savedPos.x, targetP.x, e), lerp(savedEye, 1.52, e), lerp(savedPos.z, targetP.z, e));
      cam.rotation.set(lerp(savedPitch, -0.18, e), this.baby.yaw, Math.sin(k * Math.PI) * 0.08);
    });
    sfx.giggle();
    this.ui.speech('宝宝', '咯咯咯！好高呀！！', 1.8);
    this.needs.add('love', 18);
    this.needs.add('curious', 8);
    await tweens.run(1.1, (k) => {
      cam.position.y = 1.52 + Math.sin(k * Math.PI * 2) * 0.08;
      cam.rotation.z = Math.sin(k * Math.PI * 2) * 0.06;
    });
    await tweens.run(0.6, (k) => {
      const e = ease.inOut(k);
      cam.position.set(lerp(targetP.x, savedPos.x, e), lerp(1.52, savedEye, e), lerp(targetP.z, savedPos.z, e));
      cam.rotation.set(lerp(-0.18, savedPitch, e), this.baby.yaw, 0);
    });
    this.baby.setFloor(savedPos, this.baby.yaw);
    this.baby.pitch = savedPitch;
    p.pose = 'none';
    p.busy = false;
    this.state = 'play';
  }

  /* ================= parent care (cutscenes) ================= */

  private standSpot(): THREE.Vector3 {
    if (this.baby.mode === 'crib') return new THREE.Vector3(LAYOUT.crib.x + 0.85, 0, LAYOUT.crib.z);
    const dir = _v.subVectors(this.parent.pos, this.baby.pos).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
    dir.normalize();
    const spot = this.baby.pos.clone().addScaledVector(dir, 0.75);
    // keep the spot inside the rooms & off furniture
    const tmp = new Baby(1);
    tmp.radius = 0.28;
    tmp.pos.copy(spot);
    tmp.resolve(this.house.colliders);
    return tmp.pos.clone().setY(0);
  }

  async attend(reason: 'cry' | 'roll') {
    if (this.parent.busy) return;
    this.parent.busy = true;
    this.ui.speech('妈妈', reason === 'roll' ? '咦？宝宝在干什么呀？' : '宝宝怎么啦？妈妈来啦～', 2.2);
    const spot = this.standSpot();
    this.parent.speed = 1.6;
    await this.parent.goTo(spot);
    this.parent.speed = 1.25;
    this.parent.face(this.baby.camera.position);
    if (reason === 'roll') await this.liftToFloor();
    else if (this.needs.v.hunger < 75 || !this.tasks.isDone('milk')) await this.careScene('feed');
    else if (this.needs.v.sleep < 35) await this.careScene('rock');
    else await this.careScene('hug');
    this.parent.busy = false;
    this.parent.idleTimer = 3;
  }

  private fade(to: number, dur: number) {
    const u = this.post.vision.uniforms.fade;
    const from = u.value;
    return tweens.run(dur, (k) => (u.value = lerp(from, to, ease.inOut(k))));
  }

  private async careScene(kind: 'feed' | 'hug' | 'rock') {
    this.state = 'cutscene';
    this.outline.set(null);
    if (this.held) this.drop();
    const saved = { mode: this.baby.mode, pos: this.baby.pos.clone(), eye: this.baby.eye, yaw: this.baby.yaw, pitch: this.baby.pitch, center: this.baby.yawCenter, range: this.baby.yawRange, pmin: this.baby.pitchMin, pmax: this.baby.pitchMax };
    this.parent.pose = 'reach';
    await tweens.wait(0.45);
    await this.fade(1, 0.35);
    // held in mum's arms, looking up at her face
    this.baby.mode = 'scripted';
    this.parent.pose = 'hold';
    const h = this.parent.heading;
    const f = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const cam = this.baby.camera;
    const head = this.parent.headWorld(new THREE.Vector3());
    const camBase = this.parent.pos.clone().addScaledVector(f, 0.38).setY(head.y - 0.28);
    cam.position.copy(camBase);
    cam.lookAt(head);
    const baseQ = cam.quaternion.clone();
    if (kind === 'feed') {
      this.bottle.visible = true;
      this.hands.setPose('bottle');
      (this.bottle.getObjectByName('milk') as THREE.Mesh).scale.y = 1;
    } else this.hands.setPose('hug');
    await this.fade(0, 0.4);
    const lines = { feed: '饿了吧？慢慢喝～', hug: '乖宝宝，抱抱～', rock: '困了吧？睡一会儿～' };
    this.ui.speech('妈妈', lines[kind], 2.6);
    if (kind === 'feed') sfx.gulp();
    if (kind === 'rock') this.post.vision.uniforms.sleepy.value = 1;
    const dur = kind === 'feed' ? 3.2 : 2.6;
    const milk = this.bottle.getObjectByName('milk') as THREE.Mesh;
    await tweens.run(dur, (k) => {
      const sway = Math.sin(k * Math.PI * 3) * 0.02;
      cam.position.copy(camBase).add(new THREE.Vector3(0, Math.sin(k * Math.PI * 2) * 0.01, 0)).addScaledVector(new THREE.Vector3(-f.z, 0, f.x), sway);
      cam.quaternion.copy(baseQ).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway * 1.5));
      if (kind === 'feed') {
        milk.scale.y = Math.max(0.05, 1 - k);
        milk.position.y = -0.06 + 0.05 * milk.scale.y;
        this.needs.v.hunger = Math.min(100, this.needs.v.hunger + 30 * (1 / 60));
      }
    });
    if (kind === 'feed') {
      this.needs.add('hunger', 100);
      this.needs.add('love', 15);
      this.tasks.complete('milk');
    } else if (kind === 'hug') {
      this.needs.add('love', 35);
      this.needs.add('sleep', 10);
    } else {
      this.needs.add('sleep', 50);
      this.needs.add('love', 10);
    }
    await this.fade(1, 0.35);
    this.bottle.visible = false;
    this.post.vision.uniforms.sleepy.value = 0;
    this.hands.setPose('idle');
    this.parent.pose = 'none';
    this.baby.mode = saved.mode;
    this.baby.pos.copy(saved.pos);
    this.baby.eye = saved.eye;
    this.baby.yaw = saved.yaw;
    this.baby.pitch = saved.pitch;
    this.baby.yawCenter = saved.center;
    this.baby.yawRange = saved.range;
    this.baby.pitchMin = saved.pmin;
    this.baby.pitchMax = saved.pmax;
    this.baby.update(0, { x: 0, y: 0 }, [], this.time);
    await this.fade(0, 0.4);
    this.state = 'play';
  }

  private async doRoll() {
    this.state = 'cutscene';
    this.outline.set(null);
    if (this.held) this.drop();
    this.baby.mode = 'scripted';
    sfx.boing();
    const cam = this.baby.camera;
    const p = cam.position.clone();
    const yaw = this.baby.yaw;
    await tweens.run(1.15, (k) => {
      const e = ease.inOut(k);
      cam.position.set(p.x, p.y - Math.sin(k * Math.PI) * 0.18, p.z);
      cam.rotation.set(lerp(this.baby.pitch, -0.1, Math.sin(k * Math.PI)), yaw, e * Math.PI * 2);
    });
    sfx.giggle();
    this.ui.toast('翻身成功！', 'info');
    this.baby.mode = 'crib';
    this.state = 'play';
    this.attend('roll');
  }

  private async liftToFloor() {
    this.state = 'cutscene';
    this.parent.pose = 'reach';
    this.ui.speech('妈妈', '哇，宝宝会翻身啦！去地上玩吧～', 2.6);
    await tweens.wait(1.2);
    await this.fade(1, 0.45);
    this.parent.pose = 'none';
    const p = LAYOUT.nurseryFloorStart;
    this.baby.setFloor(p, 0);
    // face the doorway
    const dx = 0 - p.x, dz = 0.9 - p.z;
    this.baby.yaw = Math.atan2(-dx, -dz);
    this.baby.canCrawl = true;
    this.parent.teleport(new THREE.Vector3(-2.0, 0, 1.6), Math.atan2(p.x + 2.0, p.z - 1.6));
    this.baby.update(0, { x: 0, y: 0 }, [], this.time);
    this.ui.joyLocked(false);
    await this.fade(0, 0.5);
    this.tasks.complete('roll');
    sfx.unlock2();
    tweens.wait(0.5).then(() => this.ui.toast('解锁新能力：爬行！', 'unlock', 3200));
    this.state = 'play';
  }

  /* ================= world logic ================= */

  private blocks() {
    return this.house.interactables.filter((i) => i.isBlock && i !== this.held);
  }

  /** top surface height of a block column at x,z (excluding `skip`) */
  private columnTop(x: number, z: number, skip?: Interactable) {
    let top = this.house.surfaceAt(x, z, 3);
    const col = this.blocks()
      .filter((b) => b !== skip && Math.hypot(b.obj.position.x - x, b.obj.position.z - z) < 0.11)
      .sort((a, b) => a.obj.position.y - b.obj.position.y);
    for (const b of col) top = Math.max(top, b.obj.position.y + b.bottom);
    return top;
  }

  private settleBlocks() {
    const list = this.blocks().sort((a, b) => a.obj.position.y - b.obj.position.y);
    for (const b of list) {
      const p = b.obj.position;
      let top = this.house.surfaceAt(p.x, p.z, p.y);
      for (const o of list) {
        if (o === b) continue;
        if (Math.hypot(o.obj.position.x - p.x, o.obj.position.z - p.z) < 0.09 && o.obj.position.y < p.y - 0.01) top = Math.max(top, o.obj.position.y + o.bottom);
      }
      const y = top + b.bottom + 0.001;
      if (Math.abs(p.y - y) > 0.005) {
        const y0 = p.y;
        tweens.run(0.2, (k) => (b.obj.position.y = lerp(y0, y, ease.in(k))));
      }
    }
  }

  private checkStack() {
    const bl = this.blocks();
    let best = 1;
    for (const b of bl) {
      const col = bl.filter((o) => Math.hypot(o.obj.position.x - b.obj.position.x, o.obj.position.z - b.obj.position.z) < 0.11);
      best = Math.max(best, col.length);
      if (col.length >= 2) this.fun.onStack(col);
    }
    if (!this.tasks.isDone('stack')) {
      if (best >= 3) {
        this.tasks.complete('stack');
        this.ui.speech('宝宝', '高高的！哒哒～', 2);
        sfx.giggle();
      } else if (best === 2) {
        this.tasks.setProgress('stack', '2/3');
        this.ui.toast('叠上一块啦！再来一块', 'info', 1800);
      }
    }
  }

  private updateDynamicProps(dt: number) {
    this.ballCooldown = Math.max(0, this.ballCooldown - dt);
    this.nudgeCd = Math.max(0, this.nudgeCd - dt);

    for (const item of this.house.interactables) {
      if (item.kind !== 'hold' || this.held === item || item.obj.userData.carried || item.isOrnament) continue;
      const p = item.obj.position;

      // Baby bumps / nudges floor objects while crawling
      if (this.baby.mode === 'floor' && p.y < 0.35) {
        const r = Math.min(0.14, item.radius || 0.08);
        const dx = p.x - this.baby.pos.x;
        const dz = p.z - this.baby.pos.z;
        const d = Math.hypot(dx, dz);
        if (item.isBall && d < this.baby.radius + 0.11 + 0.06 && this.ballCooldown <= 0 && d > 1e-4) {
          this.ballCooldown = 0.6;
          const s = 1.0 + this.baby.moving * 0.5;
          (item.vel ??= new THREE.Vector3()).set((dx / d) * s, 0.25, (dz / d) * s);
          sfx.boing();
          this.squash(item.obj, 0.25);
          this.fun.onBallKick();
          this.needs.add('curious', 4);
          this.ballTouches++;
          if (!this.tasks.isDone('ball')) {
            if (this.ballTouches >= 2) {
              this.tasks.complete('ball');
              this.ui.speech('宝宝', '追到啦！嘿嘿～', 1.8);
            } else {
              this.tasks.setProgress('ball', `${this.ballTouches}/2`);
              this.ui.speech('宝宝', '球球跑掉了！追！', 1.6);
            }
          }
        } else if (
          (item.id === 'cloth_ball' || item.id === 'toycar' || item.id === 'duck' || item.isBlock) &&
          this.baby.moving > 0.25 &&
          d < this.baby.radius + r + 0.04 &&
          d > 1e-4 &&
          this.nudgeCd <= 0
        ) {
          this.nudgeCd = 0.28;
          const push = 0.7 + this.baby.moving * 0.5;
          (item.vel ??= new THREE.Vector3()).set((dx / d) * push, 0.15, (dz / d) * push);
          if (item.id === 'duck') sfx.squeak();
          else if (item.id === 'toycar') sfx.tap();
          else if (item.isSoft) sfx.rustle();
        }
      }

      const v = item.vel;
      if (!v) continue;
      const speedSq = v.lengthSq();
      const ground = (item.isBlock ? this.columnTop(p.x, p.z, item) : this.house.surfaceAt(p.x, p.z, p.y + 0.18)) + item.bottom + 0.001;
      const airborne = p.y > ground + 0.004 || v.y > 0.02;
      if (speedSq < 1e-4 && !airborne) {
        v.set(0, 0, 0);
        if (item.angVel) item.angVel.set(0, 0, 0);
        continue;
      }

      if (airborne) v.y -= 9.8 * dt;
      p.x += v.x * dt;
      p.y += v.y * dt;
      p.z += v.z * dt;

      // Keep inside room bounds
      p.x = clamp(p.x, -4.85, 6.85);
      const minZ = p.x < 0 ? -2.35 : -3.35;
      const maxZ = p.x < 0 ? 2.35 : 3.35;
      if (p.z < minZ) { p.z = minZ; v.z = Math.abs(v.z) * 0.5; }
      if (p.z > maxZ) { p.z = maxZ; v.z = -Math.abs(v.z) * 0.5; }

      // Bounce off colliders horizontally
      const colR = item.isBall ? 0.11 : Math.min(0.12, item.radius || 0.07);
      for (const c of this.house.colliders) {
        const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < colR * colR && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const nx = dx / d, nz = dz / d;
          p.x = cx + nx * colR;
          p.z = cz + nz * colR;
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) {
            const rest = item.isBall ? 1.7 : 1.35;
            v.x -= rest * vn * nx;
            v.z -= rest * vn * nz;
            if (-vn > 0.45) {
              if (item.isCeramic) sfx.clink();
              else sfx.drop();
            }
          }
        }
      }

      const surf = (item.isBlock ? this.columnTop(p.x, p.z, item) : this.house.surfaceAt(p.x, p.z, p.y + 0.15)) + item.bottom + 0.001;
      if (p.y <= surf) {
        if (v.y < -0.55) {
          const bounce = item.isBall ? 0.62 : item.isSoft ? 0.15 : 0.28;
          v.y = -v.y * bounce;
          if (item.isBall) sfx.boing();
          else if (item.isCeramic) sfx.clink();
          else if (item.isSoft || item.isBook) sfx.rustle();
          else if (item.id === 'duck') sfx.squeak();
          else sfx.drop();
          this.squash(item.obj, item.isSoft ? 0.18 : 0.12);
          v.x *= 0.72;
          v.z *= 0.72;
        } else {
          v.y = 0;
        }
        p.y = surf;
        const dampRate = item.isBall ? 0.85 : 5.5;
        v.x *= Math.exp(-dampRate * dt);
        v.z *= Math.exp(-dampRate * dt);
        if (item.isBall) {
          const spd = Math.hypot(v.x, v.z);
          if (spd > 0.02) {
            const axis = _v.set(v.z, 0, -v.x).normalize();
            item.obj.rotateOnWorldAxis(axis, (spd * dt) / 0.11);
          }
        } else if (v.lengthSq() < 0.02) {
          v.set(0, 0, 0);
          if (item.angVel) item.angVel.set(0, 0, 0);
          item.obj.rotation.x = lerp(item.obj.rotation.x, 0, 0.45);
          item.obj.rotation.z = lerp(item.obj.rotation.z, 0, 0.45);
          if (item.isBlock) this.checkStack();
        }
      } else if (item.angVel) {
        item.obj.rotation.x += item.angVel.x * dt;
        item.obj.rotation.y += item.angVel.y * dt;
        item.obj.rotation.z += item.angVel.z * dt;
      }
    }
  }

  private updateDog(dt: number) {
    const d = this.house.dog;
    this.dogAwake = Math.max(0, this.dogAwake - dt);
    if (d.state === 'awake' && this.dogAwake <= 0 && !this.dogBusy) d.state = 'sleep';
    d.lookTarget = this.baby.camera.position;
    d.update(dt);
  }
  dogBusy = false;

  /** squash & stretch bounce on landing / being poked */
  squash(obj: THREE.Object3D, amt = 0.2) {
    const base = (obj.userData.baseScale ??= obj.scale.clone()) as THREE.Vector3;
    tweens.run(0.42, (k) => {
      const s = Math.sin(k * Math.PI * 2.5) * Math.exp(-k * 4) * amt;
      obj.scale.set(base.x * (1 + s * 0.6), base.y * (1 - s), base.z * (1 + s * 0.6));
    });
  }

  spawnHearts(at: THREE.Vector3, n: number) {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false }));
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, Math.random() * 0.1, (Math.random() - 0.5) * 0.25));
      s.scale.setScalar(0.09);
      this.scene.add(s);
      this.hearts.push({ s, t: -k * 0.15, v: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.35, (Math.random() - 0.5) * 0.1) });
    }
  }

  private updateHearts(dt: number) {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.t += dt;
      if (h.t < 0) {
        h.s.visible = false;
        continue;
      }
      h.s.visible = true;
      h.s.position.addScaledVector(h.v, dt);
      const m = h.s.material as THREE.SpriteMaterial;
      m.opacity = 1 - h.t / 1.4;
      h.s.scale.setScalar(0.09 + Math.sin(h.t * 6) * 0.01);
      if (h.t > 1.4) {
        this.scene.remove(h.s);
        m.dispose();
        this.hearts.splice(i, 1);
      }
    }
  }

  private updateHover() {
    if (this.state !== 'play') {
      this.setHover(null);
      return;
    }
    const cam = this.baby.camera;
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
    this.raycaster.far = 6;
    const objs: THREE.Object3D[] = [...this.house.occluders];
    for (const i of this.house.interactables) if (i.enabled && i !== this.held) objs.push(i.obj);
    const hits = this.raycaster.intersectObjects(objs, true);
    let found: Interactable | null = null;
    const baseRange = this.baby.mode === 'crib' ? 1.1 : this.baby.mode === 'stand' ? 1.55 : 1.35;
    for (const h of hits) {
      if (h.object.userData.occluder) break;
      const i = h.object.userData.interactable as Interactable | undefined;
      if (!i) continue;
      const range = i.kind === 'look' ? i.range ?? 3.5 : Math.max(baseRange, i.range ?? baseRange);
      if (h.distance <= range) found = i;
      break;
    }
    // generous aim assist for small things: check a cone around the crosshair
    if (!found) {
      let best = 0.22, bestI: Interactable | null = null;
      const fwd = cam.getWorldDirection(new THREE.Vector3());
      for (const i of this.house.interactables) {
        if (!i.enabled || i === this.held || i.kind === 'look') continue;
        const p = i.obj.getWorldPosition(_v);
        if (i.isBlock || i.isBall) p.y += 0;
        else if (i.isTeddy) p.y += 0.18;
        else if (i.id === 'mom_npc' || i.id === 'dad_npc') p.y += 0.85;
        const to = _v2.subVectors(p, cam.position);
        const d = to.length();
        const range = Math.max(baseRange, i.range ?? baseRange);
        if (d > range) continue;
        const ang = to.normalize().angleTo(fwd);
        const tol = Math.atan2(i.radius + 0.06, d);
        if (ang < tol && ang < best) {
          best = ang;
          bestI = i;
        }
      }
      found = bestI;
    }
    this.setHover(found);
  }

  private setHover(i: Interactable | null) {
    if (i !== this.hover) {
      this.hover = i;
      this.lookSeenAt = this.time;
      this.outline.set(i);
      if (i && !i.seen) {
        i.seen = true;
        this.needs.add('curious', i.kind === 'look' ? 4 : 5);
        if (i.kind === 'look') this.ui.toast(`新发现：${i.name}`, 'info', 1800);
      }
    }
    const holding = !!this.held;
    let label: string | null = null;
    let verb = holding ? '放下' : '抓';
    let actionable = false;

    if (i && holding) {
      if (i.id === 'mom_npc' || i.id === 'dad_npc') {
        verb = '递给看';
        label = `拿给${i.name}看 · ${this.held!.name}`;
        actionable = true;
      } else if (i.kind === 'hold' && this.held?.isBlock && i.isBlock) {
        verb = '叠上';
        label = `叠上去 · ${i.name}`;
        actionable = true;
      } else if (i.kind === 'toggle') {
        verb = i.verb ?? '开关';
        label = `${verb} · ${i.name}`;
        actionable = true;
      }
    } else if (i && !holding) {
      if (i.kind === 'hold') {
        label = `抓住 · ${i.name}`;
        actionable = true;
      } else if (i.kind === 'toggle') {
        verb = i.verb ?? '互动';
        label = `${verb} · ${i.name}`;
        actionable = true;
      } else if (i.kind === 'climb') {
        verb = this.baby.mode === 'stand' && this.standingAt === i ? '蹲下' : i.verb ?? '扶站';
        label = `${verb} · ${i.name}`;
        actionable = true;
      } else if (i.kind === 'pet') {
        verb =
          i.verb ??
          (i.id === 'tissue' ? '抽一张' : i.id === 'musicbox' ? '按一下' : i.id === 'mirror' ? '摸摸镜子' : i.id === 'books' ? '翻翻看' : '摸摸');
        label = `${verb} · ${i.name}`;
        actionable = true;
      } else if (i.kind === 'look' && this.time - this.lookSeenAt < 2.5) {
        label = `看看 · ${i.name}`;
      }
    }
    this.ui.target(label, actionable);
    this.ui.setGrab(holding && !actionable, verb);
    this.ui.setReady('grab', actionable);
  }

  private updateHint() {
    document.body.classList.toggle('cutscene', this.state === 'cutscene');
    if (this.state !== 'play') {
      this.ui.hint('');
      return;
    }
    if (!this.mobile && !this.input.locked) {
      this.ui.hint('点击画面开始（锁定鼠标转头）');
      return;
    }
    if (this.baby.mode === 'stand') {
      this.ui.hint(this.mobile ? '扶着站起来啦！推动摇杆或再按一次蹲下' : '扶着站起来啦！按 W/A/S/D 移动或按 E 蹲下');
      return;
    }
    const cur = this.tasks.current();
    if (this.held?.isTeddy && !this.tasks.isDone('hug')) {
      this.ui.hint('抱紧泰迪熊～');
      return;
    }
    if (this.held?.id === 'rattle') {
      this.ui.hint(this.mobile ? '拿着摇铃，左右快速滑动转头，摇一摇！' : '拿着摇铃，左右快速甩动鼠标，摇一摇！');
      return;
    }
    if (this.held?.id === 'remote') {
      this.ui.hint('遥控器…想放进嘴里咬一咬，或按右键/Q扔出去？');
      return;
    }
    if (this.held?.isBlock && !this.tasks.isDone('stack')) {
      this.ui.hint(this.mobile ? '对准另一块积木按「抓」叠上去' : '对准另一块积木点 左键 叠上去（右键/Q 可抛投）');
      return;
    }
    if (this.held) {
      this.ui.hint(this.mobile ? `拿着 ${this.held.name}：可放嘴里、找爸妈展示或放下` : `拿着 ${this.held.name}：左键放下 · 右键/Q 抛出 · F 放嘴里`);
      return;
    }
    if (!cur) {
      this.ui.hint('自由玩耍时间！所有抽屉、柜门、灯、窗帘、电视和玩具都能互动～');
      return;
    }
    if (cur.id === 'roll' && this.baby.mode === 'crib' && this.rollCount > 0) {
      this.ui.hint(`用力翻身！${this.rollCount}/4`);
      return;
    }
    if (cur.id === 'ball' && this.baby.pos.x > 0) {
      this.ui.hint('碰一碰皮球（2 次）——它会滚走，快追上去！');
      return;
    }
    if (cur.id === 'dog' && this.baby.pos.x < 0) {
      this.ui.hint('狗狗在客厅睡觉，爬过去看看吧');
      return;
    }
    this.ui.hint(this.mobile ? cur.hint : cur.hintPc);
    this.ui.setReady('cry', cur.id === 'milk');
  }

  private updateRoll(dt: number) {
    if (this.baby.mode !== 'crib' || this.state !== 'play' || this.tasks.isDone('roll')) return;
    this.rollTimer -= dt;
    if (this.rollTimer <= 0) {
      this.rollCount = 0;
      this.rollSign = 0;
    }
    const mx = this.input.move.x;
    if (Math.abs(mx) > 0.6) {
      const s = Math.sign(mx);
      if (s !== this.rollSign) {
        this.rollSign = s;
        this.rollCount++;
        this.rollTimer = 1.6;
        this.baby.shake = 0.006;
        sfx.pop();
        this.baby.roll = s * 0.18;
        this.tasks.setProgress('roll', `${Math.min(this.rollCount, 4)}/4`);
        if (this.rollCount >= 4) {
          this.rollCount = 0;
          this.doRoll();
        }
      }
    }
  }

  finish() {
    this.state = 'end';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.unlock2();
    const m = Math.floor(this.playTime / 60), s = Math.floor(this.playTime % 60);
    this.ui.showEnd(`用时 ${m} 分 ${s} 秒 · 好奇心 ${Math.round(this.needs.v.curious)}`, () => {
      this.state = 'play';
      this.input.enabled = true;
      this.input.requestLock();
    });
  }

  /* ================= loop ================= */

  private last = performance.now();

  loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const real = (now - this.last) / 1000;
    const dt = Math.min(0.05, real);
    this.last = now;
    this.tick(dt);
    this.perf(real);
  };

  /** advance the simulation without rendering (debug / screenshots) */
  async advance(seconds: number, step = 1 / 30) {
    this.skipRender = true;
    for (let t = 0; t < seconds; t += step) {
      this.tick(step);
      // let promise continuations (cutscene steps) run between ticks
      for (let k = 0; k < 4; k++) await Promise.resolve();
    }
    this.skipRender = false;
  }
  skipRender = false;
  private shadowFrame = 0;

  tick(dt: number) {
    this.time += dt;
    tweens.update(dt);
    this.input.update();
    const look = this.input.consumeLook();
    this.lookVel = dt > 0 ? -look.dx / dt : 0;

    if (this.state === 'title') {
      this.titleT += dt;
      this.baby.yaw = -Math.PI / 2 + 0.25 + Math.sin(this.titleT * 0.25) * 0.25;
      this.baby.pitch = 0.3 + Math.sin(this.titleT * 0.18) * 0.06;
    } else if (this.state === 'play') {
      this.playTime += dt;
      this.baby.look(look.dx, look.dy);
      this.updateRoll(dt);
      this.needs.update(dt);
      this.cryCooldown -= dt;
      this.autoCry -= dt;
      const v = this.needs.v;
      if ((v.hunger < 12 || v.love < 10) && !this.parent.busy && this.autoCry <= 0) {
        this.autoCry = 35;
        this.ui.toast('宝宝忍不住哭了…', 'info', 2000);
        this.cry(true);
      }
      if (this.held?.isTeddy) {
        this.hugTime += dt;
        this.needs.add('love', dt * 4);
        if (this.hugTime > 1.4 && !this.tasks.isDone('hug')) {
          this.tasks.complete('hug');
          sfx.giggle();
          this.ui.speech('宝宝', '熊熊，抱抱～', 2);
        }
      }
    }
    const moveInput = this.state === 'play' ? this.input.move : { x: 0, y: 0 };
    if (this.baby.mode === 'stand' && Math.hypot(moveInput.x, moveInput.y) > 0.35) {
      this.stepDown();
    }
    this.baby.update(dt, moveInput, this.house.colliders, this.time);
    this.avatar.update(dt, this.baby, this.time);

    this.updateHover();
    this.updateDynamicProps(dt);
    this.updateDog(dt);
    this.updateHearts(dt);
    this.fun.update(dt);
    const babyHead = this.baby.camera.position;
    this.parent.lookAt = this.parent.pos.distanceTo(_v.set(babyHead.x, 0, babyHead.z)) < 5 ? babyHead : null;
    this.dad.lookAt = this.dad.pos.distanceTo(_v.set(babyHead.x, 0, babyHead.z)) < 4.5 ? babyHead : null;
    this.parent.update(dt);
    this.dad.update(dt);
    this.house.update(this.time, dt);
    if (this.state === 'play') this.house.setDayPhase(clamp(this.playTime / 720, 0, 1) * 0.85);
    this.outline.update(dt);

    // hands follow state
    if (this.state === 'play' && this.hands.poseTimer <= 0 && this.hands.pose !== 'idle' && this.hands.pose !== 'hold' && this.hands.pose !== 'hug') this.hands.setPose('idle');
    if (this.state === 'play' && this.hands.poseTimer <= 0) {
      if (this.held) this.hands.setPose(this.held.isTeddy ? 'hug' : 'hold');
      else if (this.hands.pose === 'hold' || this.hands.pose === 'hug') this.hands.setPose('idle');
    }
    this.hands.update(dt, this.baby.mode === 'floor' ? 1 : 0, this.baby.moving > 0.15);

    // post fx: baby vision
    const u = this.post.vision.uniforms;
    if (u.time) u.time.value = this.time;
    if (this.state !== 'cutscene') u.sleepy.value = lerp(u.sleepy.value, clamp((30 - this.needs.v.sleep) / 30, 0, 1), 1 - Math.exp(-2 * dt));
    this.updateHint();
    sfx.updateMusic(dt);
    // phones: refresh the sun shadow map at ~30 Hz instead of every frame
    if (this.mobile) {
      this.renderer.shadowMap.autoUpdate = false;
      this.shadowFrame = (this.shadowFrame + 1) % 2;
      if (this.shadowFrame === 0 || this.state === 'cutscene') this.renderer.shadowMap.needsUpdate = true;
    }
    if (!this.skipRender) this.post.render();
  }

  private perf(dt: number) {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 2) {
      const fps = this.fpsFrames / this.fpsAcc;
      if (this.showFps) this.ui.fps(`${fps.toFixed(0)} fps · pr ${this.pixelRatio.toFixed(2)}`);
      // adaptive resolution for slower phones
      if (this.adaptive && this.state !== 'title' && fps < 42 && this.pixelRatio > 1.0) {
        this.fpsLow++;
        if (this.fpsLow >= 2) {
          this.pixelRatio = Math.max(1.0, this.pixelRatio - 0.25);
          this.resize();
          this.fpsLow = 0;
        }
      } else this.fpsLow = 0;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  /* ================= debug hooks (for screenshots / testing) ================= */
  /** point the baby's head at an interactable (by id) */
  lookAtId(id: string, dy = 0) {
    const i = this.house.interactables.find((x) => x.id === id)!;
    this.baby.update(0, { x: 0, y: 0 }, [], this.time);
    const p = i.obj.getWorldPosition(new THREE.Vector3());
    p.y += dy;
    const c = this.baby.camera.position;
    const d = p.sub(c);
    this.baby.yaw = Math.atan2(-d.x, -d.z);
    this.baby.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.baby.update(0, { x: 0, y: 0 }, [], this.time);
  }

  debug(stage: string) {
    const complete = (ids: Parameters<Tasks['complete']>[0][]) => ids.forEach((id) => (this.tasks.get(id).done = true));
    if (stage === 'hands') {
      this.baby.yaw = -Math.PI / 2;
      this.baby.pitch = 0.0;
    }
    if (stage === 'nursery-floor') {
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(-1.2, 0, 1.6), 0);
      this.baby.yaw = Math.atan2(-(-4.4 + 1.2), -(-0.6 - 1.6)) ;
      this.baby.pitch = 0.08;
      this.baby.canCrawl = true;
      this.ui.joyLocked(false);
    }
    if (stage === 'living') {
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(1.3, 0, 0.75), 0);
      this.baby.yaw = -Math.PI / 2 - 0.08;
      this.baby.pitch = -0.12;
      this.baby.canCrawl = true;
      this.ui.joyLocked(false);
      this.parent.teleport(new THREE.Vector3(5.0, 0, 2.4), -2.2);
    }
    if (stage === 'eggs-demo') {
      for (const id of ['tissue', 'tv', 'dance', 'duck', 'peek'] as const) this.fun.eggs.get(id).found = true;
      this.ui.renderEggs(this.fun.eggs.list);
    }
    if (stage === 'tv') {
      this.ui.joyLocked(false);
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(4.6, 0, 1.2), 0);
      this.baby.yaw = Math.PI + 0.25;
      this.baby.pitch = 0.22;
      this.baby.canCrawl = true;
      this.house.tvOn = true;
      this.dad.teleport(new THREE.Vector3(3.9, 0, 2.3), 2.2);
      this.dad.idleTimer = 999;
    }
    if (stage === 'mirror') {
      this.ui.joyLocked(false);
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(-3.6, 0, 1.5), 0);
      this.baby.yaw = Math.PI;
      this.baby.pitch = 0.05;
      this.baby.canCrawl = true;
    }
    if (stage === 'dance') {
      this.debug('people');
      this.parent.teleport(new THREE.Vector3(1.9, 0, 0.1), 0.8);
      (this.fun as any).dadDance();
    }
    if (stage === 'tissues') {
      this.ui.joyLocked(false);
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(-1.55, 0, 1.85), 0);
      this.baby.yaw = 0.15;
      this.baby.pitch = -0.38;
      this.baby.canCrawl = true;
      for (let k = 0; k < 9; k++) (this.fun as any).pullTissue();
    }
    if (stage === 'people') {
      complete(['star', 'milk', 'hug', 'roll']);
      this.baby.setFloor(new THREE.Vector3(3.0, 0, 1.6), 0);
      this.baby.yaw = 0.05;
      this.baby.pitch = 0.32;
      this.baby.canCrawl = true;
      this.ui.joyLocked(false);
      this.parent.teleport(new THREE.Vector3(2.55, 0, 0.3), 0.3);
      this.dad.teleport(new THREE.Vector3(3.6, 0, 0.0), -0.3);
      this.parent.idleTimer = this.dad.idleTimer = 999;
      this.house.dog.place(3.35, 0.75, 0.4);
    }
    if (stage === 'feed') {
      this.parent.teleport(this.standSpot(), 0);
      this.parent.face(this.baby.camera.position);
      this.parent.heading = this.parent.targetHeading;
      this.parent.busy = true;
      this.careScene('feed');
    }
    if (stage === 'teddy') {
      complete(['star', 'milk']);
      const t = this.house.interactables.find((i) => i.isTeddy)!;
      this.pickUp(t);
      tweens.update(1);
    }
    bus.emit('tasks', this.tasks.list);
  }
}

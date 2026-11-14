import * as THREE from 'three';
import { bus, tweens, ease, lerp } from '../core/events';
import { sfx } from '../core/audio';
import type { Game } from '../core/game';
import type { Interactable } from '../world/types';
import { tissueSheet } from '../world/props';
import { Eggs, type Egg } from './eggs';

const _v = new THREE.Vector3();

/**
 * Easter eggs & little moments of joy. Hooks are called by the Game; everything here is
 * optional fun on top of the 7 main tasks (none of it can block progress).
 */
export class Fun {
  eggs = new Eggs();
  private tissueCount = 0;
  private tissues: { m: THREE.Mesh; v: THREE.Vector3; rest: boolean }[] = [];
  private petCount = 0;
  private laughTimes: number[] = [];
  private momLaughs: number[] = [];
  private mirrorSeen = { laugh: false, cry: false };
  private nearMirror = false;
  private rattleCount = 0;
  private rattleDir = 0;
  private rattleCd = 0;
  private bumpCd = 0;
  private dreamT = 0;
  private spinT = 0;

  constructor(private g: Game) {
    bus.on('egg', (e: Egg) => {
      sfx.egg();
      g.ui.toast(`发现彩蛋：<b>${e.name}</b>`, 'egg', 3200);
      g.ui.renderEggs(this.eggs.list);
      g.ui.pulseBoard();
      g.needs.add('curious', 8);
    });
    g.ui.renderEggs(this.eggs.list);
  }

  private get t() {
    return this.g.time;
  }

  /** is a world point on screen and near enough */
  visible(p: THREE.Vector3, maxDist = 4.5) {
    const cam = this.g.baby.camera;
    if (p.distanceTo(cam.position) > maxDist) return false;
    const ndc = p.clone().project(cam);
    return Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95 && ndc.z < 1;
  }

  /* ================= hooks ================= */

  onPet(i: Interactable): boolean {
    const g = this.g;
    if (i.id === 'tissue') {
      this.pullTissue();
      return true;
    }
    if (i.id === 'musicbox') {
      this.musicBox();
      return true;
    }
    if (i.id === 'dog') {
      this.petCount++;
      if (this.petCount >= 3 && !g.dogBusy) {
        this.petCount = 0;
        tweens.wait(1.2).then(() => this.lick());
      }
    }
    if (i.id === 'mirror') {
      sfx.tap();
      g.hands.setPose('reach', 0.35);
      g.ui.speech('宝宝', '镜子里有个真实的我！', 1.8);
      g.needs.add('curious', 3);
      return true;
    }
    if (i.id === 'books') {
      sfx.rustle();
      g.hands.setPose('reach', 0.35);
      g.ui.speech('宝宝', '好多五颜六色的绘本～', 1.8);
      g.needs.add('curious', 3);
      return true;
    }
    return false;
  }

  onPickUp(i: Interactable) {
    const g = this.g;
    if (i.id === 'duck') {
      sfx.squeak();
      g.ui.speech('宝宝', '嘎嘎！找到一只小鸭子！', 2.2);
      g.squash(i.obj);
      this.eggs.discover('duck');
    }
    if (i.id === 'rattle') {
      sfx.rattle();
      g.ui.speech('宝宝', '沙沙沙～', 1.4);
    }
    if (i.id === 'remote') g.ui.speech('宝宝', '好多按钮…想咬一口', 1.8);
    if (i.isPacifier) {
      sfx.pop();
      g.ui.speech('宝宝', '最喜欢的安抚奶嘴～', 1.6);
    }
    if (i.id === 'toycar') {
      sfx.tap();
      g.ui.speech('宝宝', '嘀嘀～小木车！', 1.5);
    }
    if (i.isBook) {
      sfx.rustle();
      g.ui.speech('宝宝', '厚纸板小画书！', 1.5);
    }
  }

  onMouth(i: Interactable | null) {
    const g = this.g;
    if (i?.id === 'remote') {
      tweens.wait(0.6).then(() => {
        const h = g.house;
        h.cycleTV(false);
        if (h.tvOn) {
          this.eggs.discover('tv');
          tweens.wait(1.2).then(() => this.parentLine('爸爸', '哈哈，宝宝自己换台啦？'));
        }
      });
    }
    if (i?.id === 'duck') tweens.wait(0.4).then(() => sfx.squeak());
    if (i?.id === 'rattle') tweens.wait(0.3).then(() => sfx.rattle());
    if (i?.isPacifier) {
      tweens.wait(0.35).then(() => {
        sfx.slurp();
        g.needs.add('love', 8);
        g.needs.add('sleep', 6);
        g.ui.speech('宝宝', '唔…吸奶嘴好安心～', 1.8);
      });
    }
    if (i?.id === 'mug') {
      tweens.wait(0.35).then(() => {
        sfx.slurp();
        g.ui.speech('宝宝', '杯口凉凉的…爸爸的咖啡味道！', 1.8);
        g.needs.add('curious', 4);
      });
    }
    if (i?.isSoft) {
      tweens.wait(0.35).then(() => {
        sfx.rustle();
        g.ui.speech('宝宝', '软绵绵毛茸茸的～', 1.5);
      });
    }
    if (i?.isBook) {
      tweens.wait(0.35).then(() => {
        sfx.rustle();
        g.ui.speech('宝宝', '纸角啃起来沙沙响～', 1.6);
      });
    }
    if (i?.id === 'toycar') {
      tweens.wait(0.35).then(() => {
        sfx.tap();
        g.ui.speech('宝宝', '木头小轮子圆圆的！', 1.5);
      });
    }
  }

  /** returns true when the cry was "handled" (mum doesn't need to come) */
  onCry(): boolean {
    const g = this.g;
    this.mirrorReact('cry');
    const dad = g.dad;
    const head = dad.headWorld(new THREE.Vector3());
    if (!dad.busy && this.visible(head, 5)) {
      this.dadDance();
      return g.tasks.isDone('milk') && g.needs.v.hunger > 45;
    }
    return false;
  }

  onLaugh() {
    const g = this.g;
    const now = this.t;
    this.mirrorReact('laugh');
    this.laughTimes = this.laughTimes.filter((x) => now - x < 6);
    this.laughTimes.push(now);
    if (this.laughTimes.length >= 5 && !this.eggs.found('baba')) {
      this.laughTimes = [];
      tweens.wait(0.8).then(() => this.firstWord());
    }
    const mom = g.parent;
    if (!mom.busy && this.visible(mom.headWorld(new THREE.Vector3()), 5)) {
      this.momLaughs = this.momLaughs.filter((x) => now - x < 8);
      this.momLaughs.push(now);
      if (this.momLaughs.length >= 3) {
        this.momLaughs = [];
        tweens.wait(0.5).then(() => this.peekaboo());
      }
    }
  }

  onStack(column: Interactable[]) {
    const ma = column.filter((b) => b.obj.userData.letter === '妈');
    if (ma.length >= 2 && !this.eggs.found('mama')) {
      const g = this.g;
      sfx.chime();
      g.ui.speech('宝宝', '妈…妈！', 2);
      g.spawnHearts(ma[1].obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0)), 5);
      tweens.wait(1.4).then(() => this.parentLine('妈妈', '天哪！宝宝在叫妈妈！'));
      g.needs.add('love', 15);
      this.eggs.discover('mama');
    }
  }

  onBallKick() {
    const g = this.g;
    const d = g.house.dog;
    const ball = g.house.interactables.find((i) => i.isBall)!;
    if (!d.awake || g.dogBusy || ball.obj.position.x < 0.4) return;
    tweens.wait(0.6).then(() => this.fetch());
  }

  /* ================= per-frame ================= */

  update(dt: number) {
    const g = this.g;
    // tissues flutter down and pile up
    for (const s of this.tissues) {
      if (s.rest) continue;
      s.v.y -= 2.2 * dt;
      s.v.multiplyScalar(Math.exp(-2.4 * dt));
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += dt * 3;
      s.m.rotation.z += dt * 2;
      const floor = 0.015 + this.pileHeight(s.m.position, s.m);
      if (s.m.position.y <= floor) {
        s.m.position.y = floor;
        s.rest = true;
        s.m.rotation.x = (Math.random() - 0.5) * 0.4;
        s.m.rotation.z = (Math.random() - 0.5) * 0.4;
      }
    }
    // mirror: track when baby is close and looking at the real Reflector mirror
    const h = g.house;
    const mp = h.mirror.getWorldPosition(_v);
    const cam = g.baby.camera;
    this.nearMirror =
      g.baby.mode !== 'scripted' &&
      Math.hypot(cam.position.x - mp.x, cam.position.z - mp.z) < 1.9 &&
      this.visible(mp.clone().setY(0.45), 2.3);
    // music box spinner
    const sp = h.musicBox.getObjectByName('spinner');
    if (sp && this.spinT > 0) {
      this.spinT -= dt;
      sp.rotation.y += dt * 3;
    }
    if (this.dreamT > 0) {
      this.dreamT -= dt;
      g.post.vision.uniforms.sleepy.value = Math.max(g.post.vision.uniforms.sleepy.value, 0.55);
      if (this.dreamT <= 0) g.ui.dream(false);
    }
    h.updateTV(dt);
    // rattle: shake it by swinging the head left/right
    this.rattleCd -= dt;
    if (g.held?.id === 'rattle') {
      const yv = g.lookVel;
      const dir = Math.abs(yv) > 2.2 ? Math.sign(yv) : 0;
      if (dir && dir !== this.rattleDir && this.rattleCd <= 0) {
        this.rattleDir = dir;
        this.rattleCd = 0.12;
        this.rattleCount++;
        sfx.rattle();
        g.hands.jiggle = 1;
        g.squash(g.held.obj, 0.12);
        if (this.rattleCount === 3) g.ui.toast('沙沙沙！继续摇～', 'info', 1600);
        if (this.rattleCount >= 10 && !this.eggs.found('rattle')) {
          g.ui.confetti(90);
          sfx.partyHorn();
          g.ui.speech('宝宝', '哒哒哒！摇铃派对！', 2.4);
          this.eggs.discover('rattle');
        }
      }
    }
    // toppling over after crawling into furniture
    this.bumpCd -= dt;
    if (g.baby.bump > 0) {
      if (this.bumpCd <= 0 && g.state === 'play') {
        this.bumpCd = 2.5;
        this.topple();
      }
      g.baby.bump = 0;
    }
    // dog carries the ball in its mouth
    const d = h.dog;
    if (d.carry) d.carry.position.copy(d.mouthWorld(_v));
  }

  private pileHeight(p: THREE.Vector3, self: THREE.Mesh) {
    let y = 0;
    for (const s of this.tissues) {
      if (!s.rest || s.m === self) continue;
      if (Math.hypot(s.m.position.x - p.x, s.m.position.z - p.z) < 0.07) y = Math.max(y, s.m.position.y + 0.012);
    }
    return y;
  }

  /* ================= moments ================= */

  private pullTissue() {
    const g = this.g;
    const box = g.house.tissueBox;
    sfx.tissue();
    g.hands.setPose('reach', 0.35);
    let m: THREE.Mesh;
    if (this.tissues.length < 26) {
      m = tissueSheet();
      m.castShadow = true;
      g.house.root.add(m);
    } else {
      const old = this.tissues.shift()!;
      m = old.m;
    }
    const p = box.getWorldPosition(new THREE.Vector3());
    m.position.copy(p).add(new THREE.Vector3(0, 0.14, 0));
    const toward = g.baby.camera.position.clone().sub(p).setY(0).normalize();
    const side = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar((Math.random() - 0.5) * 0.9);
    this.tissues.push({ m, v: toward.multiplyScalar(0.5 + Math.random() * 0.4).add(side).setY(1.1 + Math.random() * 0.5), rest: false });
    g.squash(box, 0.18);
    this.tissueCount++;
    g.needs.add('curious', 1);
    if (this.tissueCount === 1) g.ui.speech('宝宝', '咦？白白软软的！', 1.6);
    if (this.tissueCount === 4) g.ui.speech('宝宝', '还有！还有！', 1.4);
    if (this.tissueCount === 8 && !this.eggs.found('tissue')) {
      sfx.giggle();
      g.ui.speech('宝宝', '抽不完的纸巾！咯咯咯～', 2.2);
      tweens.wait(1.2).then(() => this.parentLine('妈妈', '哎呀呀！满地都是纸巾！'));
      this.eggs.discover('tissue');
    }
  }

  private musicBox() {
    const g = this.g;
    if (this.spinT > 0) return;
    sfx.lullaby();
    this.spinT = 8.2;
    g.squash(g.house.musicBox, 0.1);
    g.ui.speech('音乐盒', '♪ 睡吧睡吧，我亲爱的宝贝～', 3.2);
    g.hands.setPose('clap', 0.8);
    tweens.wait(1.5).then(() => {
      g.ui.dream(true);
      this.dreamT = 6.2;
      g.ui.toast('好困…做了一个软软的梦', 'info', 2600);
    });
    tweens.run(7, (k) => g.needs.add('sleep', 0.12 * (1 - k * 0.5)));
    tweens.wait(7.8).then(() => {
      g.needs.add('sleep', 25);
      this.eggs.discover('music');
    });
  }

  private mirrorReact(kind: 'laugh' | 'cry') {
    if (!this.nearMirror) return;
    this.g.avatar.setExpr(kind, 2.2);
    this.mirrorSeen[kind] = true;
    this.g.ui.speech('宝宝', kind === 'laugh' ? '镜子里的宝宝也在笑！' : '咦…镜子里的宝宝也哭了？', 2);
    if (this.mirrorSeen.laugh && this.mirrorSeen.cry) this.eggs.discover('mirror');
  }

  private parentLine(who: '妈妈' | '爸爸', text: string) {
    const p = who === '妈妈' ? this.g.parent : this.g.dad;
    if (p.busy && who === '妈妈' && this.g.state === 'cutscene') return;
    this.g.ui.speech(who, text, 2.4);
  }

  private async dadDance() {
    const g = this.g;
    const dad = g.dad;
    dad.busy = true;
    dad.path = [];
    dad.face(g.baby.camera.position);
    await tweens.wait(0.5);
    g.ui.speech('爸爸', '宝宝不哭！看爸爸的魔性舞蹈～', 2.6);
    dad.pose = 'dance';
    sfx.dance();
    await tweens.wait(3.0);
    dad.pose = 'cheer';
    sfx.giggle();
    g.ui.speech('宝宝', '咯咯咯！爸爸好好笑！', 2.2);
    g.needs.add('love', 15);
    g.spawnHearts(dad.headWorld(new THREE.Vector3()), 4);
    this.eggs.discover('dance');
    await tweens.wait(1.2);
    dad.pose = 'none';
    dad.busy = false;
    dad.idleTimer = 6;
  }

  private async peekaboo() {
    const g = this.g;
    const mom = g.parent;
    if (mom.busy) return;
    mom.busy = true;
    mom.path = [];
    mom.face(g.baby.camera.position);
    g.ui.speech('妈妈', '躲猫猫～妈妈在哪里呀？', 2);
    mom.pose = 'peek';
    await tweens.wait(1.6);
    mom.pose = 'tickle';
    sfx.boo();
    g.ui.speech('妈妈', '喵！噗噗噗～', 1.8);
    tweens.wait(0.25).then(() => sfx.raspberry());
    await tweens.wait(0.6);
    sfx.giggle();
    g.hands.setPose('clap', 1.2);
    g.spawnHearts(mom.headWorld(new THREE.Vector3()), 5);
    g.needs.add('love', 18);
    this.eggs.discover('peek');
    await tweens.wait(1.4);
    mom.pose = 'none';
    mom.busy = false;
    mom.idleTimer = 5;
  }

  private async firstWord() {
    const g = this.g;
    sfx.coo();
    g.ui.speech('宝宝', 'ba…ba…', 1.4);
    await tweens.wait(1.3);
    sfx.coo();
    g.ui.speech('宝宝', '爸…爸？', 1.8);
    await tweens.wait(1.2);
    this.eggs.discover('baba');
    const dad = g.dad;
    if (!dad.busy) {
      dad.busy = true;
      dad.face(g.baby.camera.position);
      dad.pose = 'cheer';
      g.ui.speech('爸爸', '她叫我爸爸了！！老婆你听到了吗！', 2.8);
      await tweens.wait(2.2);
      dad.pose = 'none';
      dad.busy = false;
    }
  }

  private async lick() {
    const g = this.g;
    const d = g.house.dog;
    if (g.dogBusy || g.baby.mode !== 'floor') return;
    g.dogBusy = true;
    d.state = 'awake';
    g.dogAwake = 12;
    const cam = g.baby.camera.position;
    const to = d.pos.clone().sub(_v.set(cam.x, 0, cam.z)).setY(0).normalize();
    const spot = new THREE.Vector3(cam.x, 0, cam.z).addScaledVector(to, 0.42);
    await d.goTo(spot, 0.7);
    d.face(cam);
    d.state = 'lick';
    await tweens.wait(0.25);
    sfx.slurp();
    g.ui.wet();
    g.baby.shake = 0.02;
    const yaw0 = g.baby.yaw;
    tweens.run(0.5, (k) => (g.baby.tilt = Math.sin(k * Math.PI) * 0.12));
    g.ui.speech('狗狗', '舔舔舔～（超级开心）', 2);
    await tweens.wait(0.9);
    sfx.slurp();
    g.ui.wet();
    await tweens.wait(0.6);
    g.baby.yaw = yaw0;
    sfx.giggle();
    g.ui.speech('宝宝', '咯咯咯！好痒！湿漉漉的！', 2.2);
    g.needs.add('love', 12);
    this.eggs.discover('lick');
    d.state = 'awake';
    await tweens.wait(1.0);
    g.dogBusy = false;
  }

  private async fetch() {
    const g = this.g;
    const d = g.house.dog;
    const ball = g.house.interactables.find((i) => i.isBall)!;
    if (g.dogBusy || g.held === ball) return;
    g.dogBusy = true;
    g.dogAwake = 14;
    sfx.woof();
    g.ui.speech('狗狗', '汪！（球！）', 1.4);
    // wait for the ball to roll out
    await tweens.wait(0.8);
    if (g.held === ball) {
      g.dogBusy = false;
      return;
    }
    await d.goTo(ball.obj.position.clone(), 1.6);
    if (g.held === ball) {
      g.dogBusy = false;
      return;
    }
    // pick it up
    ball.enabled = false;
    ball.vel?.set(0, 0, 0);
    ball.obj.userData.carried = true;
    d.carry = ball.obj;
    ball.obj.scale.setScalar(0.85);
    sfx.chomp();
    const cam = g.baby.camera.position;
    const back = new THREE.Vector3(cam.x, 0, cam.z);
    const dir = d.pos.clone().sub(back).setY(0).normalize();
    await d.goTo(back.clone().addScaledVector(dir, 0.55), 1.3);
    d.face(g.baby.camera.position);
    await tweens.wait(0.3);
    // drop it right in front of the baby
    d.carry = null;
    ball.obj.userData.carried = false;
    ball.obj.scale.setScalar(1);
    const p0 = ball.obj.position.clone();
    const p1 = back.clone().addScaledVector(dir, 0.3).setY(0.11);
    await tweens.run(0.35, (k) => {
      ball.obj.position.lerpVectors(p0, p1, ease.in(k));
    });
    sfx.boing();
    g.squash(ball.obj, 0.2);
    ball.enabled = true;
    g.ui.speech('狗狗', '汪汪！（再扔一次嘛～）', 2);
    g.spawnHearts(d.mouthWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0)), 3);
    this.eggs.discover('fetch');
    await tweens.wait(0.6);
    g.dogBusy = false;
  }

  private async topple() {
    const g = this.g;
    sfx.bonk();
    g.baby.shake = 0.035;
    g.ui.speech('宝宝', '咚！', 1);
    const side = Math.random() < 0.5 ? -1 : 1;
    const eye0 = g.baby.eye;
    await tweens.run(0.35, (k) => {
      g.baby.tilt = side * 0.55 * ease.out(k);
      g.baby.eye = lerp(eye0, 0.24, ease.out(k));
    });
    await tweens.wait(0.45);
    sfx.giggle();
    g.ui.speech('宝宝', '…嘿嘿，没事！', 1.4);
    await tweens.run(0.5, (k) => {
      g.baby.tilt = side * 0.55 * (1 - ease.inOut(k));
      g.baby.eye = lerp(0.24, eye0, ease.inOut(k));
    });
  }
}

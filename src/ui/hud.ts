import { bus } from '../core/events';
import type { Action } from '../core/input';
import { ICON, STAMP } from './icons';
import { NEED_INFO, type NeedKey } from '../systems/needs';
import type { Task } from '../systems/tasks';
import type { Egg } from '../systems/eggs';

const $ = (id: string) => document.getElementById(id)!;

/** generate a subtle cream-paper fibre texture once and expose it as a CSS variable */
function paperTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const g = c.getContext('2d')!;
  const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    const v = n < 0.5 ? 0 : 255;
    img.data[i] = v;
    img.data[i + 1] = v * 0.94;
    img.data[i + 2] = v * 0.85;
    img.data[i + 3] = Math.random() * 14;
  }
  g.putImageData(img, 0, 0);
  // fibres
  for (let k = 0; k < 70; k++) {
    g.strokeStyle = `rgba(150,110,80,${0.04 + Math.random() * 0.05})`;
    g.lineWidth = 0.6 + Math.random() * 0.6;
    g.beginPath();
    const x = Math.random() * 180, y = Math.random() * 180, a = Math.random() * Math.PI;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6 + 3, x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    g.stroke();
  }
  document.documentElement.style.setProperty('--paper', `url(${c.toDataURL('image/png')})`);
}

/** illustrated cover art for the start screen (original, drawn in SVG) */
const COVER_ART = `<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g filter="url(#ink)" stroke="#4b3a2f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 18 C80 8 220 8 292 18 L292 210 L10 210 Z" fill="#c9d4df" stroke="none"/>
  <path d="M10 150 C60 120 110 140 150 128 C200 112 250 130 292 118 L292 214 L10 214 Z" fill="#c3d1b5"/>
  <path d="M10 178 C70 160 140 176 190 166 C230 158 262 168 292 160 L292 220 L10 220 Z" fill="#93a98a"/>
  <path d="M206 40 C186 42 172 58 173 78 C174 98 191 113 211 111 C221 110 229 106 234 100 C212 102 196 88 195 70 C194 57 199 47 206 40 Z" fill="#f3dca2"/>
  <path d="M62 44 L65 52 L73 53 L67 58 L69 66 L62 62 L55 66 L57 58 L51 53 L59 52 Z" fill="#f2d48a" stroke-width="2"/>
  <path d="M120 30 L122 35 L127 36 L123 39 L124 44 L120 41 L116 44 L117 39 L113 36 L118 35 Z" fill="#f2d48a" stroke-width="1.8"/>
  <path d="M258 58 L260 63 L265 64 L261 67 L262 72 L258 69 L254 72 L255 67 L251 64 L256 63 Z" fill="#f2d48a" stroke-width="1.8"/>
  <circle cx="150" cy="70" r="2.2" fill="#4b3a2f" stroke="none"/><circle cx="96" cy="88" r="2" fill="#4b3a2f" stroke="none"/><circle cx="250" cy="130" r="2" fill="#4b3a2f" stroke="none"/>
  <path d="M34 206 L34 250 M266 206 L266 250" stroke-width="5"/>
  <path d="M40 286 L40 196 C40 190 44 186 50 186 L250 186 C256 186 260 190 260 196 L260 286" fill="none" stroke-width="4"/>
  <path d="M40 222 L260 222" stroke-width="3.4"/>
  <path d="M66 222 L66 286 M92 222 L92 286 M118 222 L118 286 M182 222 L182 286 M208 222 L208 286 M234 222 L234 286" stroke-width="2.6"/>
  <path d="M46 250 C90 238 210 238 254 250 L254 292 L46 292 Z" fill="#f4dc95"/>
  <path d="M60 262 C100 254 200 254 240 262" fill="none" stroke-width="2"/>
  <path d="M116 232 C116 212 130 200 150 200 C170 200 184 212 184 232 C184 246 170 254 150 254 C130 254 116 246 116 232 Z" fill="#f6dcc0"/>
  <path d="M130 204 C134 196 144 192 152 194 C150 199 151 203 156 205" fill="#a0745a"/>
  <path d="M134 230 C137 227 141 227 144 230 M156 230 C159 227 163 227 166 230" fill="none" stroke-width="2.4"/>
  <path d="M143 240 C147 244 153 244 157 240" fill="none" stroke-width="2.2"/>
  <ellipse cx="129" cy="238" rx="5" ry="3" fill="#eab3a6" stroke="none"/><ellipse cx="171" cy="238" rx="5" ry="3" fill="#eab3a6" stroke="none"/>
  <path d="M196 236 C196 224 204 218 212 218 C220 218 228 224 228 236 C228 248 220 256 212 256 C204 256 196 248 196 236 Z" fill="#b98b62"/>
  <circle cx="201" cy="219" r="6" fill="#b98b62"/><circle cx="223" cy="219" r="6" fill="#b98b62"/>
  <ellipse cx="212" cy="241" rx="7" ry="5" fill="#e3c39c" stroke-width="2"/>
  <circle cx="207" cy="232" r="1.6" fill="#4b3a2f" stroke="none"/><circle cx="217" cy="232" r="1.6" fill="#4b3a2f" stroke="none"/>
  <path d="M150 16 L150 70" stroke-width="2"/>
  <path d="M110 70 L190 70" stroke-width="3"/>
  <path d="M110 70 L110 92 M190 70 L190 100 M150 70 L150 104" stroke-width="1.6"/>
  <path d="M110 92 L114 100 L122 101 L116 106 L118 114 L110 110 L102 114 L104 106 L98 101 L106 100 Z" fill="#e8a58c" stroke-width="2"/>
  <path d="M190 100 C184 101 180 106 181 112 C182 118 187 122 193 121 C196 121 198 120 200 118 C194 118 190 114 190 109 C189 105 190 102 190 100 Z" fill="#bccbdb" stroke-width="2"/>
  <circle cx="150" cy="110" r="7" fill="#dcae55" stroke-width="2"/>
</g></svg>`;

/** All DOM UI: needs gauges, crosshair, notebook, toasts, buttons, overlays. */
export class UI {
  needEls = {} as Record<NeedKey, { root: HTMLElement; val: SVGCircleElement }>;
  boardOpen = false;
  private speechTimer = 0;
  private lastNeeds: Record<string, number> = {};
  private stamped = new Set<string>();
  private stickered = new Set<string>();
  private tab: 'tasks' | 'eggs' = 'tasks';

  constructor(private touch: boolean) {
    document.body.classList.add(touch ? 'touch' : 'no-touch');
    paperTexture();
    // needs gauges: paper disc + crayon progress ring + hand-drawn icon
    const icons: Record<NeedKey, string> = { hunger: ICON.bottle, sleep: ICON.moon, love: ICON.heart, curious: ICON.star };
    const needs = $('needs');
    const C = 2 * Math.PI * 27;
    (Object.keys(icons) as NeedKey[]).forEach((k) => {
      const root = document.createElement('div');
      root.className = 'need';
      root.dataset.k = k;
      root.innerHTML = `<div class="disc"><svg class="ring" viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="27"/><circle class="val" cx="32" cy="32" r="27" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div class="ico">${icons[k]}</div></div><span class="lbl">${NEED_INFO[k].label}</span>`;
      needs.appendChild(root);
      this.needEls[k] = { root, val: root.querySelector('.val') as SVGCircleElement };
    });
    // buttons
    ($('board-btn').querySelector('.ico') as HTMLElement).innerHTML = ICON.board;
    const actIcons: Record<string, string> = { grab: ICON.hand, mouth: ICON.mouth, cry: ICON.cry, laugh: ICON.laugh };
    document.querySelectorAll<HTMLButtonElement>('.act').forEach((b) => {
      (b.querySelector('.ico') as HTMLElement).innerHTML = actIcons[b.dataset.act!];
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('pressed');
        bus.emit('action', b.dataset.act as Action);
      });
      const up = () => b.classList.remove('pressed');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    $('board-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      bus.emit('action', 'board');
    });
    $('board-close').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      bus.emit('action', 'board');
    });
    $('board').addEventListener('pointerdown', (e) => e.stopPropagation());
    document.querySelectorAll<HTMLButtonElement>('.nb-tab').forEach((t) => {
      t.querySelector('.ti')!.innerHTML = t.dataset.tab === 'tasks' ? ICON.board : ICON.egg;
      t.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.boardTab(t.dataset.tab as 'tasks' | 'eggs');
        bus.emit('uiClick');
      });
    });
    ($('rotate').querySelector('.rot-ico') as HTMLElement).innerHTML = ICON.rotate;
    $('cover-art').innerHTML = COVER_ART;
    $('start-tip').innerHTML = touch
      ? '左边拖动：爬行　右边滑动：转头<br/>右下：抓·互动 / 嘴 / 哭 / 笑　右上：成长记录本'
      : '鼠标：转头　WASD：爬行/翻身　左键/E：抓·互动　右键/Q：抛出<br/>F：放进嘴里　空格：哭　R：笑　Tab：记录本';
    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => setTimeout(() => this.checkOrientation(), 200));
  }

  checkOrientation() {
    const portrait = this.touch && window.innerHeight > window.innerWidth;
    document.body.classList.toggle('portrait', portrait);
  }

  showHud() {
    $('hud').classList.remove('hidden');
  }

  setNeeds(v: Record<NeedKey, number>) {
    const C = 2 * Math.PI * 27;
    (Object.keys(v) as NeedKey[]).forEach((k) => {
      const val = Math.round(v[k]);
      if (this.lastNeeds[k] === val) return;
      const prev = this.lastNeeds[k];
      this.lastNeeds[k] = val;
      const el = this.needEls[k];
      el.val.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0.03, val / 100))));
      el.root.classList.toggle('low', val < 20);
      if (prev !== undefined && val - prev >= 3) {
        el.root.classList.remove('bump');
        void el.root.offsetWidth;
        el.root.classList.add('bump');
      }
    });
  }

  renderTasks(list: Task[]) {
    const ol = $('board-list');
    const cur = list.find((t) => !t.done);
    ol.innerHTML = '';
    let fresh = false;
    list.forEach((t, i) => {
      const li = document.createElement('li');
      if (t.done) li.classList.add('done');
      if (t === cur) li.classList.add('cur');
      const isNew = t.done && !this.stamped.has(t.id);
      if (isNew) {
        this.stamped.add(t.id);
        fresh = true;
      }
      li.innerHTML = `<span class="c">${t.done ? ICON.check : ''}</span><span class="t">${i + 1}. ${t.title}</span>${
        t.progress && !t.done ? `<span class="p">${t.progress}</span>` : t === cur ? '<span class="tag">进行中</span>' : ''
      }${t.done ? `<span class="stamp${isNew ? ' new' : ''}">${STAMP}</span>` : ''}`;
      ol.appendChild(li);
    });
    if (fresh && this.boardOpen) this.thump();
    const done = list.filter((t) => t.done).length;
    $('board-progress').textContent = `${done}/${list.length}`;
    ($('board-bar-fill') as HTMLElement).style.width = `${(done / list.length) * 100}%`;
    $('board-badge').textContent = done < list.length ? String(list.length - done) : '';
    const chip = $('task-chip');
    if (cur) {
      const idx = list.indexOf(cur) + 1;
      chip.innerHTML = `<span class="n">${idx}</span>${cur.title}${cur.progress ? `（${cur.progress}）` : ''}`;
    } else chip.innerHTML = '';
  }

  renderEggs(list: Egg[]) {
    const grid = $('egg-grid');
    grid.innerHTML = '';
    list.forEach((e, i) => {
      const d = document.createElement('div');
      const isNew = e.found && !this.stickered.has(e.id);
      if (e.found) this.stickered.add(e.id);
      d.className = `egg${e.found ? ' found' : ''}${isNew ? ' new' : ''}`;
      d.style.setProperty('--r', `${((i * 37) % 7) - 3}deg`);
      d.innerHTML = e.found
        ? `<span class="ei">${ICON[e.icon]}</span><span class="en">${e.name}</span><span class="er">${e.how}</span>`
        : `<span class="ei">${ICON.question}</span><span class="en">？？？</span><span class="er">${e.riddle}</span>`;
      grid.appendChild(d);
    });
    $('egg-count').textContent = `${list.filter((e) => e.found).length}/${list.length}`;
  }

  boardTab(tab: 'tasks' | 'eggs') {
    this.tab = tab;
    document.querySelectorAll<HTMLElement>('.nb-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    document.querySelectorAll<HTMLElement>('.nb-page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== tab));
  }

  toggleBoard(open?: boolean) {
    this.boardOpen = open ?? !this.boardOpen;
    $('board').classList.toggle('closed', !this.boardOpen);
    document.body.classList.toggle('board-open', this.boardOpen);
  }

  thump() {
    const b = $('board');
    b.classList.remove('thump');
    void b.offsetWidth;
    b.classList.add('thump');
  }

  pulseBoard() {
    const b = $('board-btn');
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }

  toast(text: string, kind: 'done' | 'unlock' | 'info' | 'egg' = 'done', dur = 2800) {
    const wrap = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const ico = kind === 'done' ? ICON.check : kind === 'unlock' ? ICON.star : kind === 'egg' ? ICON.egg : ICON.sparkle;
    el.innerHTML = `<span class="tk">${ico}</span><span>${text}</span>`;
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild!);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, dur);
  }

  hint(text: string) {
    const h = $('hint');
    if (h.textContent !== text) h.textContent = text;
  }

  speech(who: string, text: string, dur = 2.6) {
    const s = $('speech');
    s.dataset.who = who;
    (s.querySelector('.who') as HTMLElement).textContent = who;
    (s.querySelector('.txt') as HTMLElement).textContent = text;
    s.classList.remove('show');
    void s.offsetWidth;
    s.classList.add('show');
    clearTimeout(this.speechTimer);
    this.speechTimer = window.setTimeout(() => s.classList.remove('show'), dur * 1000);
  }

  target(label: string | null, hot: boolean) {
    const l = $('target-label');
    if (label) {
      if (l.textContent !== label) l.textContent = label;
      l.classList.add('show');
    } else l.classList.remove('show');
    $('crosshair').classList.toggle('hot', hot);
  }

  setGrab(holding: boolean, verb: string) {
    const b = document.querySelector('.act.main') as HTMLElement;
    const ico = holding ? ICON.drop : ICON.hand;
    const ie = b.querySelector('.ico') as HTMLElement;
    if (ie.dataset.k !== String(holding)) {
      ie.innerHTML = ico;
      ie.dataset.k = String(holding);
    }
    const lb = b.querySelector('.lbl') as HTMLElement;
    if (lb.textContent !== verb) lb.textContent = verb;
  }

  setReady(act: string, on: boolean) {
    document.querySelector(`.act[data-act='${act}']`)?.classList.toggle('ready', on);
  }

  joyLocked(locked: boolean) {
    $('joy').classList.toggle('locked', locked);
    $('joy-label').textContent = locked ? '翻身' : '爬';
  }

  showEnd(stats: string, onContinue: () => void) {
    $('end-stats').textContent = stats;
    $('end-emoji').innerHTML = ICON.star;
    $('end').classList.remove('hidden');
    $('end-continue').onclick = () => {
      $('end').classList.add('hidden');
      onContinue();
    };
    $('end-restart').onclick = () => location.reload();
  }

  /* ----- full-screen moments ----- */
  confetti(n = 70) {
    const box = $('confetti');
    const cols = ['#c9765c', '#93a98a', '#7f97b3', '#dcae55', '#eab3a6', '#fbf6ea'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = cols[i % cols.length];
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      p.style.setProperty('--rot', `${(Math.random() - 0.5) * 1080}deg`);
      p.style.animationDelay = `${Math.random() * 0.6}s`;
      p.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
      if (i % 3 === 0) p.style.borderRadius = '50%';
      box.appendChild(p);
      setTimeout(() => p.remove(), 4500);
    }
  }

  dream(on: boolean) {
    $('dream').classList.toggle('on', on);
  }

  wet() {
    const w = $('wet');
    w.classList.add('on');
    setTimeout(() => w.classList.remove('on'), 900);
  }

  fps(text: string) {
    $('fps').textContent = text;
  }
}

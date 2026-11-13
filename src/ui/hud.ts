import { bus } from '../core/events';
import type { Action } from '../core/input';
import { ICON } from './icons';
import { NEED_INFO, type NeedKey } from '../systems/needs';
import type { Task } from '../systems/tasks';

const $ = (id: string) => document.getElementById(id)!;

/** All DOM UI: needs bubbles, crosshair, task board, toasts, buttons, overlays. */
export class UI {
  needEls = {} as Record<NeedKey, { root: HTMLElement; fill: HTMLElement }>;
  boardOpen = false;
  private speechTimer = 0;
  private lastNeeds: Record<string, number> = {};

  constructor(private touch: boolean) {
    document.body.classList.add(touch ? 'touch' : 'no-touch');
    // needs bubbles
    const icons: Record<NeedKey, string> = { hunger: ICON.bottle, sleep: ICON.moon, love: ICON.heart, curious: ICON.sparkle };
    const needs = $('needs');
    (Object.keys(icons) as NeedKey[]).forEach((k) => {
      const root = document.createElement('div');
      root.className = 'need';
      root.dataset.k = k;
      root.title = NEED_INFO[k].label;
      root.innerHTML = `<div class="fill"></div><div class="ico">${icons[k]}</div><div class="shine"></div>`;
      needs.appendChild(root);
      this.needEls[k] = { root, fill: root.querySelector('.fill') as HTMLElement };
    });
    // buttons
    $('board-btn').classList.add('glassy');
    ($('board-btn').querySelector('.ico') as HTMLElement).innerHTML = ICON.board;
    const actIcons: Record<string, string> = { grab: ICON.hand, mouth: ICON.mouth, cry: ICON.cry, laugh: ICON.laugh };
    document.querySelectorAll<HTMLButtonElement>('.act').forEach((b) => {
      b.classList.add('glassy');
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
    $('board').addEventListener('pointerdown', (e) => e.stopPropagation());
    ($('rotate').querySelector('.rot-ico') as HTMLElement).innerHTML = ICON.rotate;
    $('start-tip').innerHTML = touch
      ? '左摇杆：爬行　右侧滑动：转头<br/>右下按钮：抓 · 嘴 · 哭 · 笑　右上：任务板'
      : '鼠标：转头　WASD：爬行　左键/E：抓·放<br/>F：放进嘴里　空格：哭　R：笑　Tab：任务板';
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
    (Object.keys(v) as NeedKey[]).forEach((k) => {
      const val = Math.round(v[k]);
      if (this.lastNeeds[k] === val) return;
      const prev = this.lastNeeds[k];
      this.lastNeeds[k] = val;
      const el = this.needEls[k];
      el.fill.style.height = `${Math.max(4, val)}%`;
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
    list.forEach((t, i) => {
      const li = document.createElement('li');
      if (t.done) li.classList.add('done');
      if (t === cur) li.classList.add('cur');
      li.innerHTML = `<span class="c">${t.done ? ICON.check : i + 1}</span><span class="t">${t.title}</span>${
        t.progress && !t.done ? `<span class="p">${t.progress}</span>` : t === cur ? '<span class="tag">进行中</span>' : ''
      }`;
      ol.appendChild(li);
    });
    const done = list.filter((t) => t.done).length;
    $('board-progress').textContent = `${done} / ${list.length}`;
    ($('board-bar-fill') as HTMLElement).style.width = `${(done / list.length) * 100}%`;
    $('board-badge').textContent = done < list.length ? String(list.length - done) : '';
    const chip = $('task-chip');
    if (cur) {
      const idx = list.indexOf(cur) + 1;
      chip.innerHTML = `<span class="n">${idx}</span>${cur.title}${cur.progress ? `（${cur.progress}）` : ''}`;
    } else chip.innerHTML = '';
  }

  toggleBoard(open?: boolean) {
    this.boardOpen = open ?? !this.boardOpen;
    $('board').classList.toggle('closed', !this.boardOpen);
    document.body.classList.toggle('board-open', this.boardOpen);
  }

  pulseBoard() {
    const b = $('board-btn');
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }

  toast(text: string, kind: 'done' | 'unlock' | 'info' = 'done', dur = 2800) {
    const wrap = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const ico = kind === 'done' ? ICON.check : kind === 'unlock' ? ICON.star : ICON.spark;
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
    s.innerHTML = `<b>${who}</b>${text}`;
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
    (b.querySelector('.ico') as HTMLElement).innerHTML = holding ? ICON.drop : ICON.hand;
    (b.querySelector('.lbl') as HTMLElement).textContent = verb;
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
    $('end-emoji').innerHTML = ICON.sparkle;
    $('end').classList.remove('hidden');
    $('end-continue').onclick = () => {
      $('end').classList.add('hidden');
      onContinue();
    };
    $('end-restart').onclick = () => location.reload();
  }

  fps(text: string) {
    $('fps').textContent = text;
  }
}

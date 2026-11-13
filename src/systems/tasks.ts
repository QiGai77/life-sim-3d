import { bus } from '../core/events';

export type TaskId = 'star' | 'milk' | 'hug' | 'roll' | 'ball' | 'dog' | 'stack';

export interface Task {
  id: TaskId;
  title: string;
  hint: string; // touch hint
  hintPc: string; // desktop hint
  done: boolean;
  progress?: string;
}

export const TASKS: Task[] = [
  { id: 'star', title: '抓住床铃上的星星', hint: '抬头看床铃，对准星星按「抓」抓住它', hintPc: '抬头看床铃，对准星星点 左键 / E 抓住它', done: false },
  { id: 'milk', title: '哭着找妈妈，喝奶', hint: '肚子饿了！按「哭」哭一哭，妈妈会来喂奶', hintPc: '肚子饿了！按 空格 哭一哭，妈妈会来喂奶', done: false },
  { id: 'hug', title: '抱抱泰迪熊', hint: '找到床角的泰迪熊，抓起来抱一会儿', hintPc: '找到床角的泰迪熊，抓起来抱一会儿', done: false },
  { id: 'roll', title: '翻个身，学会爬', hint: '左摇杆 左右来回推，用力翻身！', hintPc: '按 A / D 左右来回，用力翻身！', done: false },
  { id: 'ball', title: '爬到客厅，追上皮球', hint: '用左摇杆爬出房门，碰一碰皮球（2 次）', hintPc: 'WASD 爬出房门，碰一碰皮球（2 次）', done: false },
  { id: 'dog', title: '摸摸狗狗', hint: '爬到睡觉的狗狗旁边，对准它按「抓」', hintPc: '爬到睡觉的狗狗旁边，对准它点 左键', done: false },
  { id: 'stack', title: '把 3 块积木叠起来', hint: '抓起积木，对准另一块积木再按「抓」放上去', hintPc: '抓起积木，对准另一块积木再点 左键 放上去', done: false },
];

export class Tasks {
  list: Task[] = TASKS.map((t) => ({ ...t }));

  get(id: TaskId) {
    return this.list.find((t) => t.id === id)!;
  }
  isDone(id: TaskId) {
    return this.get(id).done;
  }
  current(): Task | null {
    return this.list.find((t) => !t.done) ?? null;
  }
  doneCount() {
    return this.list.filter((t) => t.done).length;
  }
  complete(id: TaskId) {
    const t = this.get(id);
    if (t.done) return;
    t.done = true;
    t.progress = undefined;
    bus.emit('taskDone', t);
    bus.emit('tasks', this.list);
    if (this.list.every((x) => x.done)) bus.emit('allDone');
  }
  setProgress(id: TaskId, p: string) {
    const t = this.get(id);
    if (t.progress === p) return;
    t.progress = p;
    bus.emit('tasks', this.list);
  }
}

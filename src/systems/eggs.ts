import { bus } from '../core/events';
import type { ICON } from '../ui/icons';

export type EggId =
  | 'tissue'
  | 'tv'
  | 'mirror'
  | 'lick'
  | 'fetch'
  | 'dance'
  | 'peek'
  | 'music'
  | 'duck'
  | 'rattle'
  | 'baba'
  | 'mama';

export interface Egg {
  id: EggId;
  name: string;
  /** vague riddle shown before it's found */
  riddle: string;
  /** how it was triggered (shown after discovery) */
  how: string;
  icon: keyof typeof ICON;
  found: boolean;
}

export const EGGS: Egg[] = [
  { id: 'tissue', name: '抽纸大师', riddle: '纸巾盒里好像有抽不完的东西…', how: '连续从纸巾盒抽出一大堆纸巾', icon: 'tissue', found: false },
  { id: 'tv', name: '小小遥控员', riddle: '遥控器尝起来是什么味道？', how: '把遥控器放进嘴里，电视开了', icon: 'tv', found: false },
  { id: 'mirror', name: '镜子里的宝宝', riddle: '矮矮的镜子里住着谁？', how: '对着镜子笑一笑、哭一哭', icon: 'mirror', found: false },
  { id: 'lick', name: '狗狗的口水', riddle: '多摸摸狗狗，它会怎么回报你？', how: '摸狗狗 3 次，被舔了一脸', icon: 'lick', found: false },
  { id: 'fetch', name: '接球好搭档', riddle: '狗狗醒着的时候，皮球滚过去…', how: '狗狗醒着时把皮球推给它', icon: 'ball', found: false },
  { id: 'dance', name: '爸爸的魔性舞蹈', riddle: '在爸爸面前哭会发生什么？', how: '对着爸爸哭，他跳起了舞', icon: 'dance', found: false },
  { id: 'peek', name: '躲猫猫', riddle: '对妈妈多笑几次…', how: '对着妈妈连笑 3 次', icon: 'peek', found: false },
  { id: 'music', name: '梦里的星星', riddle: '婴儿房里有个会唱歌的盒子', how: '按下音乐盒，做了个美梦', icon: 'musicbox', found: false },
  { id: 'duck', name: '沙发底下的小鸭', riddle: '沙发底下好像藏着什么黄黄的', how: '在沙发底下找到小黄鸭', icon: 'duck', found: false },
  { id: 'rattle', name: '摇铃派对', riddle: '拿着摇铃，左右用力甩头…', how: '拿着摇铃摇 10 下', icon: 'rattle', found: false },
  { id: 'baba', name: '第一个词', riddle: '一直笑一直笑，会说出什么？', how: '短时间里连笑 5 次', icon: 'speech', found: false },
  { id: 'mama', name: '积木叫妈妈', riddle: '有两块积木上写着同一个字', how: '把两块「妈」积木叠在一起', icon: 'blocks', found: false },
];

export class Eggs {
  list: Egg[] = EGGS.map((e) => ({ ...e }));
  get(id: EggId) {
    return this.list.find((e) => e.id === id)!;
  }
  found(id: EggId) {
    return this.get(id).found;
  }
  count() {
    return this.list.filter((e) => e.found).length;
  }
  /** returns true the first time */
  discover(id: EggId) {
    const e = this.get(id);
    if (e.found) return false;
    e.found = true;
    bus.emit('egg', e);
    bus.emit('eggs', this.list);
    return true;
  }
}

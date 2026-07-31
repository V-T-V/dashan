/**
 * 大善系统 —— persistence.ts 深度测试（与 persistence.test.ts 互补）。
 *
 * 覆盖：
 *  1. userScripts 往返（含修复 migrate 丢失 userScripts 的 bug）
 *  2. 对话进度字段（history / currentSituation / cursor）往返
 *  3. 损坏恢复细分：JSON 解析出非对象、字段类型错误、null、根为数组
 *  4. migrate 逐字段容错（entries 非数组、endingReached 非布尔、cursor 非数字）
 *  5. writeSave 容错（setItem 抛错时不外泄）
 *  6. 并发安全：连续多次 write/load 最后一致
 *  7. STORAGE_KEY 隔离：只读写固定 key
 *
 * 使用独立 localStorage stub，与 persistence.test.ts 的 store 隔离。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptySave,
  loadSave,
  writeSave,
  resetSave,
  type DashanSave,
} from '../shared/persistence.ts';

// ── 独立 localStorage stub（与本文件作用域隔离） ──
// node:test 并发跑多文件，persistence.test.ts 也会改写 globalThis.localStorage，
// 为避免互相污染：每个测试前都用 beforeEach 把 globalThis.localStorage 指回本文件的 store。
const store = new Map<string, string>();
const myLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

import { beforeEach } from 'node:test';

beforeEach(() => {
  store.clear();
  // 强制把全局 localStorage 指回本文件的 store，确保 write/load 走同一份内存
  // @ts-expect-error 注入到 globalThis 供被测模块读取
  globalThis.localStorage = myLocalStorage;
});

/** 写入原始字符串到固定 key，模拟磁盘上的内容。 */
function putRaw(raw: string): void {
  store.set('dashan-save-v1', raw);
}

// ── userScripts 往返（bug 修复回归） ────────────────────────

test('userScripts: 写入后 loadSave 能读回（migrate 不再丢弃）', () => {
  store.clear();
  const s = createEmptySave();
  s.userScripts = [{ situation: { situation: 'x', choices: [{ id: 'A', text: 'a' }] } }];
  writeSave(s);
  const loaded = loadSave();
  assert.ok(Array.isArray(loaded.userScripts), 'userScripts 应为数组');
  assert.equal(loaded.userScripts!.length, 1);
});

test('userScripts: 存档里是非数组 → migrate 置 undefined', () => {
  store.clear();
  putRaw(
    JSON.stringify({ version: 1, entries: [], endingReached: false, userScripts: 'not-array' }),
  );
  const loaded = loadSave();
  assert.equal(loaded.userScripts, undefined, '非数组 userScripts 应被丢弃');
  assert.equal(loaded.entries.length, 0, '其余字段仍应正常恢复');
});

test('userScripts: 缺省时为 undefined（不报错）', () => {
  store.clear();
  putRaw(JSON.stringify({ version: 1, entries: [], endingReached: false }));
  const loaded = loadSave();
  assert.equal(loaded.userScripts, undefined);
});

// ── 对话进度字段往返 ───────────────────────────────────────

test('进度字段：history/currentSituation/cursor 完整往返', () => {
  store.clear();
  const s = createEmptySave();
  s.history = [
    { role: 'system', content: 'sys' },
    { role: 'assistant', content: '{"type":"situation"}' },
  ];
  s.currentSituation = {
    situation: '当前困境',
    choices: [
      { id: 'A', text: '选A' },
      { id: 'B', text: '选B' },
    ],
  };
  s.cursor = 3;
  writeSave(s);
  const loaded = loadSave();
  assert.equal(loaded.history!.length, 2);
  assert.equal(loaded.currentSituation!.situation, '当前困境');
  assert.equal(loaded.cursor, 3);
});

test('进度字段：currentSituation 为 null 时 migrate 置 undefined', () => {
  store.clear();
  putRaw(
    JSON.stringify({
      version: 1,
      entries: [],
      endingReached: false,
      currentSituation: null,
    }),
  );
  const loaded = loadSave();
  assert.equal(loaded.currentSituation, undefined);
});

test('进度字段：cursor 非数字 → undefined', () => {
  store.clear();
  putRaw(JSON.stringify({ version: 1, entries: [], endingReached: false, cursor: 'oops' }));
  const loaded = loadSave();
  assert.equal(loaded.cursor, undefined);
});

test('进度字段：history 非数组 → undefined', () => {
  store.clear();
  putRaw(JSON.stringify({ version: 1, entries: [], endingReached: false, history: {} }));
  const loaded = loadSave();
  assert.equal(loaded.history, undefined);
});

// ── 损坏恢复细分 ───────────────────────────────────────────

test('损坏恢复：JSON 解析出一个数组（根非对象）→ entries 取数组容错', () => {
  store.clear();
  // 合法 JSON 但根是数组，parsed.entries 为 undefined → 容错为 []
  putRaw('[1,2,3]');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
  assert.equal(loaded.version, 1);
});

test('损坏恢复：JSON 解析出 null → 不抛错，返回空白结构', () => {
  store.clear();
  putRaw('null');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
  assert.equal(loaded.endingReached, false);
});

test('损坏恢复：JSON 解析出原始字符串 → 返回空白结构', () => {
  store.clear();
  putRaw('"just a string"');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
});

test('损坏恢复：JSON 解析出数字 → 返回空白结构', () => {
  store.clear();
  putRaw('42');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
});

test('损坏恢复：entries 字段非数组（如对象）→ 容错为 []', () => {
  store.clear();
  putRaw(JSON.stringify({ version: 1, entries: { a: 1 }, endingReached: false }));
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
});

test('损坏恢复：endingReached 非布尔 → 容错为 false', () => {
  store.clear();
  putRaw(JSON.stringify({ version: 1, entries: [], endingReached: 'yes' }));
  const loaded = loadSave();
  assert.equal(loaded.endingReached, false, '非布尔 endingReached 应被规范化为 false');
});

test('损坏恢复：完全空字符串 → 返回空白', () => {
  store.clear();
  putRaw('');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
});

test('损坏恢复：仅空白字符 → 返回空白', () => {
  store.clear();
  putRaw('   \n\t  ');
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
});

test('损坏恢复：version 字段缺失仍强制为当前版本', () => {
  store.clear();
  putRaw(JSON.stringify({ entries: [] }));
  const loaded = loadSave();
  assert.equal(loaded.version, 1, 'migrate 应总是写入当前版本号');
});

// ── writeSave 容错 ─────────────────────────────────────────

test('writeSave: setItem 抛错时静默吞掉，不外泄', () => {
  store.clear();
  // 临时让 setItem 抛错
  const saved = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    throw new Error('quota exceeded / privacy mode');
  };
  try {
    assert.doesNotThrow(() => {
      const s = createEmptySave();
      writeSave(s); // 应静默
    }, 'writeSave 不应抛错');
  } finally {
    globalThis.localStorage.setItem = saved;
  }
});

test('loadSave: getItem 抛错时返回空白不外泄', () => {
  store.clear();
  const saved = globalThis.localStorage.getItem;
  globalThis.localStorage.getItem = () => {
    throw new Error('storage unavailable');
  };
  try {
    const loaded = loadSave();
    assert.equal(loaded.entries.length, 0, 'getItem 抛错应被 catch 并返回空白');
  } finally {
    globalThis.localStorage.getItem = saved;
  }
});

// ── 并发/连续安全 ─────────────────────────────────────────

test('并发安全：连续多次 writeSave（last-write-wins）后 loadSave 读到最后一次内容', () => {
  store.clear();
  // 模拟「每次写一个递增的完整快照」：第 i 次写入含 i 条记录
  for (let i = 1; i <= 20; i++) {
    const s = createEmptySave();
    for (let j = 1; j <= i; j++) {
      s.entries.push({
        index: j,
        situation: `s${j}`,
        deed: `d${j}`,
        verdict: `v${j}`,
        tone: '庄严',
      });
    }
    writeSave(s);
  }
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 20, '最后一次（最大）快照应胜出');
  assert.equal(loaded.entries[19]!.deed, 'd20');
});

test('并发安全：交替 write/load 最终一致', () => {
  store.clear();
  // 模拟多次回合：每回合 add 一条 + 读回校验
  const s = createEmptySave();
  for (let i = 1; i <= 5; i++) {
    s.entries.push({ index: i, situation: `s${i}`, deed: `d${i}`, verdict: `v${i}`, tone: '佛系' });
    writeSave(s);
    const back = loadSave();
    assert.equal(back.entries.length, i, `第 ${i} 次写读应一致`);
  }
});

// ── STORAGE_KEY 隔离 ──────────────────────────────────────

test('STORAGE_KEY 隔离：写入只落在固定 key', () => {
  store.clear();
  const s = createEmptySave();
  s.entries.push({ index: 1, situation: 'a', deed: 'b', verdict: 'c', tone: '庄严' });
  writeSave(s);
  assert.equal(store.size, 1, '只应有一个 key');
  assert.ok(store.has('dashan-save-v1'), '应落在 dashan-save-v1');
});

test('resetSave: 清空所有字段含进度与 userScripts', () => {
  store.clear();
  const s = createEmptySave();
  s.entries.push({ index: 1, situation: 'a', deed: 'b', verdict: 'c', tone: '庄严' });
  s.history = [{ role: 'system', content: 'x' }];
  s.cursor = 2;
  s.userScripts = [{ x: 1 }];
  writeSave(s);
  resetSave();
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
  assert.equal(loaded.endingReached, false);
  assert.equal(loaded.history, undefined);
  assert.equal(loaded.cursor, undefined);
  assert.equal(loaded.userScripts, undefined);
});

// ── createEmptySave 不变性 ─────────────────────────────────

test('createEmptySave: 每次返回新对象（无共享引用）', () => {
  const a = createEmptySave();
  const b = createEmptySave();
  a.entries.push({ index: 1, situation: 'a', deed: 'b', verdict: 'c', tone: '庄严' });
  assert.equal(b.entries.length, 0, '两次 createEmptySave 不应共享 entries 引用');
});

test('createEmptySave: 默认 endingReached=false / version=1', () => {
  const s = createEmptySave();
  assert.equal(s.endingReached, false);
  assert.equal(s.version, 1);
  assert.equal(s.entries.length, 0);
});

// ── round-trip 完整存档（综合） ───────────────────────────

test('完整存档 round-trip：所有字段写读一致', () => {
  store.clear();
  const full: DashanSave = {
    version: 1,
    entries: [
      { index: 1, situation: '困境1', deed: '抉择1', verdict: '判词1', tone: '庄严' },
      { index: 2, situation: '困境2', deed: '抉择2', verdict: '判词2', tone: '戏谑' },
    ],
    endingReached: true,
    history: [{ role: 'system', content: 'sys' }],
    currentSituation: { situation: '当前', choices: [{ id: 'A', text: 'a' }] },
    cursor: 5,
    userScripts: [{ foo: 'bar' }],
  };
  writeSave(full);
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 2);
  assert.equal(loaded.entries[0]!.verdict, '判词1');
  assert.equal(loaded.endingReached, true);
  assert.equal(loaded.history!.length, 1);
  assert.equal(loaded.currentSituation!.situation, '当前');
  assert.equal(loaded.cursor, 5);
  assert.equal(loaded.userScripts!.length, 1);
});

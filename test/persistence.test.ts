/**
 * 大善系统 —— 持久化与结局判定测试。
 * 覆盖：存档读写、恢复、结局触发阈值、损坏数据容错。
 * 用内存版 localStorage stub（node 环境无 localStorage）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptySave,
  loadSave,
  writeSave,
  resetSave,
  markEndingReached,
  clearEndingMark,
} from '../shared/persistence.ts';
import { isMaxTitle, MAX_TITLE_LEVEL, titleLevel, TITLES } from '../shared/ledgerCore.ts';

// 内存 localStorage stub（模块级单例，各 test 共享）
const store = new Map<string, string>();
// @ts-expect-error 注入到 globalThis 供被测模块读取
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

test('createEmptySave 是空白存档', () => {
  const s = createEmptySave();
  assert.equal(s.entries.length, 0);
  assert.equal(s.endingReached, false);
  assert.equal(s.version, 1);
});

test('writeSave + loadSave 往返一致', () => {
  store.clear();
  const s = createEmptySave();
  s.entries.push({
    index: 1,
    situation: '困境',
    deed: '抉择',
    verdict: '判词',
    tone: '庄严',
  });
  writeSave(s);
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 1);
  assert.equal(loaded.entries[0]!.deed, '抉择');
});

test('loadSave 无存档时返回空白', () => {
  store.clear();
  const s = loadSave();
  assert.equal(s.entries.length, 0);
});

test('loadSave 损坏 JSON 返回空白不抛错', () => {
  store.clear();
  store.set('dashan-save-v1', '这不是 json{{{');
  const s = loadSave();
  assert.equal(s.entries.length, 0);
});

test('markEndingReached / clearEndingMark 持久化标记', () => {
  store.clear();
  const s = createEmptySave();
  markEndingReached(s);
  assert.equal(loadSave().endingReached, true);
  clearEndingMark(s);
  assert.equal(loadSave().endingReached, false);
});

test('resetSave 清空一切', () => {
  store.clear();
  const s = createEmptySave();
  s.entries.push({ index: 1, situation: 'a', deed: 'b', verdict: 'c', tone: '庄严' });
  markEndingReached(s);
  resetSave();
  const loaded = loadSave();
  assert.equal(loaded.entries.length, 0);
  assert.equal(loaded.endingReached, false);
});

// ---------- 结局判定 ----------

test('titleLevel 随记录数递增', () => {
  assert.equal(titleLevel(0), 0);
  assert.equal(titleLevel(1), 0); // 第一个称号 at=1
  assert.ok(titleLevel(5) > titleLevel(1));
});

test('isMaxTitle 达到最高称号记录数时为真', () => {
  const maxAt = TITLES[TITLES.length - 1]!.at;
  assert.equal(isMaxTitle(maxAt), true);
  assert.equal(isMaxTitle(maxAt - 1), false);
});

test('MAX_TITLE_LEVEL 是最后一个称号索引', () => {
  assert.equal(MAX_TITLE_LEVEL, TITLES.length - 1);
});

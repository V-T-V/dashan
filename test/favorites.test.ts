/**
 * 大善系统 —— 困境分类 + 收藏夹测试。
 * 覆盖：6 个离线剧本都有合法分类；收藏增删查/分类筛选/统计/持久化容错。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackScripts } from '../shared/fallback.ts';
import { ALL_CATEGORIES, type Category } from '../shared/types.ts';
import {
  addFavorite,
  clearFavorites,
  countByCategory,
  filterByCategory,
  isFavorited,
  loadFavorites,
  removeFavorite,
} from '../src/favorites.ts';

// 内存 localStorage stub（node 环境无 localStorage）
const store = new Map<string, string>();
// @ts-expect-error 注入到 globalThis 供被测模块读取
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

// ---------- 困境分类 ----------

test('全部离线剧本都有合法分类', () => {
  const scripts = fallbackScripts();
  assert.ok(scripts.length >= 6, '剧本池不应少于初始 6 个');
  for (const s of scripts) {
    const cat = s.situation.category;
    assert.ok(cat, `剧本「${s.situation.situation.slice(0, 10)}…」缺分类`);
    assert.ok(
      (ALL_CATEGORIES as readonly string[]).includes(cat as string),
      `分类「${cat}」不在合法集合`,
    );
  }
});

test('离线剧本分类覆盖全部 8 个题材', () => {
  const cats = new Set(fallbackScripts().map((s) => s.situation.category as Category));
  // 8 个题材各至少一个：医疗/职场/司法/科技/战争/人性/亲情/金钱
  for (const c of ALL_CATEGORIES) {
    assert.ok(cats.has(c), `题材「${c}」在剧本池中缺失`);
  }
  assert.ok(cats.size >= 8);
});

// ---------- 收藏夹 ----------

test('空收藏列表', () => {
  store.clear();
  assert.equal(loadFavorites().length, 0);
});

test('addFavorite 新增并持久化', () => {
  store.clear();
  assert.equal(addFavorite({ situation: '困境A', category: '医疗' }), true);
  assert.equal(loadFavorites().length, 1);
  assert.equal(loadFavorites()[0]!.situation, '困境A');
});

test('addFavorite 相同情境不重复', () => {
  store.clear();
  addFavorite({ situation: '困境A', category: '医疗' });
  assert.equal(addFavorite({ situation: '困境A', category: '医疗' }), false);
  assert.equal(loadFavorites().length, 1);
});

test('removeFavorite 删除指定项', () => {
  store.clear();
  addFavorite({ situation: '困境A', category: '医疗' });
  addFavorite({ situation: '困境B', category: '职场' });
  assert.equal(removeFavorite('困境A'), true);
  assert.equal(loadFavorites().length, 1);
  assert.equal(loadFavorites()[0]!.situation, '困境B');
});

test('removeFavorite 不存在返回 false', () => {
  store.clear();
  addFavorite({ situation: '困境A', category: '医疗' });
  assert.equal(removeFavorite('不存在'), false);
});

test('isFavorited 正确反映状态', () => {
  store.clear();
  addFavorite({ situation: '困境A', category: '医疗' });
  assert.equal(isFavorited('困境A'), true);
  assert.equal(isFavorited('困境B'), false);
});

test('filterByCategory 按分类筛选', () => {
  store.clear();
  addFavorite({ situation: 'A', category: '医疗' });
  addFavorite({ situation: 'B', category: '职场' });
  addFavorite({ situation: 'C', category: '医疗' });
  const medical = filterByCategory(loadFavorites(), '医疗');
  assert.equal(medical.length, 2);
  const all = filterByCategory(loadFavorites(), undefined);
  assert.equal(all.length, 3);
});

test('countByCategory 统计各分类', () => {
  store.clear();
  addFavorite({ situation: 'A', category: '医疗' });
  addFavorite({ situation: 'B', category: '医疗' });
  addFavorite({ situation: 'C', category: '职场' });
  const counts = countByCategory(loadFavorites());
  assert.equal(counts['医疗'], 2);
  assert.equal(counts['职场'], 1);
  assert.equal(counts['科技'], 0);
});

test('clearFavorites 清空', () => {
  store.clear();
  addFavorite({ situation: 'A', category: '医疗' });
  clearFavorites();
  assert.equal(loadFavorites().length, 0);
});

test('loadFavorites 损坏 JSON 返回空', () => {
  store.clear();
  store.set('dashan-favorites-v1', '这不是 json');
  assert.equal(loadFavorites().length, 0);
});

test('缺省分类归入「人性」展示（filterByCategory 用规范化）', () => {
  store.clear();
  addFavorite({ situation: '无分类情境' }); // category 缺省
  const asHuman = filterByCategory(loadFavorites(), '人性');
  assert.equal(asHuman.length, 1);
});

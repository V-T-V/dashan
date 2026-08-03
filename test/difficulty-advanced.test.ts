/**
 * 大善系统 —— 难度递进系统 高级测试（等级解锁/递进序列/反转规则）。
 *
 * 覆盖 round 8 新关注点：
 *  - 等级解锁矩阵：8 级称号 → 难度解锁上界的完整映射表
 *  - 递进序列：从 0 笔到 12 笔，maxDifficultyForDeeds 单调不减
 *  - 反转规则：filterByLevel 的「缺省视为 1」规则、recommendDifficulty 的回退链
 *  - 边界：负数 / 超大数 / 空池
 *  - 与 ledgerCore.TITLES 的阈值一致性（深度互校）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  maxDifficultyForLevel,
  maxDifficultyForDeeds,
  deedCountToLevel,
  filterByLevel,
  recommendDifficulty,
  isDifficultyUnlocked,
  difficultyGuidance,
} from '../shared/difficulty.ts';
import { TITLES, titleLevel } from '../shared/ledgerCore.ts';
import type { Difficulty } from '../shared/types.ts';

// ── 等级解锁矩阵：完整 8 级称号 → 难度上界 ─────────────────

test('高级: 8 级称号的完整解锁矩阵', () => {
  // 0-2 → 1, 3-4 → 2, 5-7 → 3
  const expected: Record<number, Difficulty> = {
    0: 1, 1: 1, 2: 1,
    3: 2, 4: 2,
    5: 3, 6: 3, 7: 3,
  };
  for (const [lv, d] of Object.entries(expected)) {
    assert.equal(maxDifficultyForLevel(Number(lv)), d, `等级 ${lv} 应解锁到 ${d}`);
  }
});

test('高级: 等级解锁矩阵与 ledgerCore.TITLES 同步', () => {
  // 对每个 TITLES 阈值 at，确认 deedCountToLevel 后的 maxDifficulty 单调合理
  for (let i = 0; i < TITLES.length; i++) {
    const at = TITLES[i]!.at;
    const lv = deedCountToLevel(at);
    assert.equal(lv, i, `TITLES[${i}].at=${at} 应映射到等级 ${i}`);
    const max = maxDifficultyForLevel(lv);
    assert.ok(max >= 1 && max <= 3, `等级 ${lv} 的难度上界应在 [1,3]`);
  }
});

// ── 递进序列：单调不减性 + 跳变点 ─────────────────────────

test('高级: maxDifficultyForDeeds 在 0..20 上单调不减', () => {
  let prev = 0;
  const jumps: { at: number; from: number; to: number }[] = [];
  for (let d = 0; d <= 20; d++) {
    const cur = maxDifficultyForDeeds(d);
    assert.ok(cur >= prev, `deedCount=${d} 的解锁上界 ${cur} 不应低于前一项 ${prev}`);
    if (cur > prev) jumps.push({ at: d, from: prev, to: cur });
    prev = cur;
  }
  // 至少应有 2 次跳变（1→2 与 2→3）
  assert.ok(jumps.length >= 2, `至少应有 2 次解锁跳变，实际 ${jumps.length}`);
});

test('高级: 难度跳变点恰在称号晋升阈值处', () => {
  // 第一次跳变应在 deedCount = TITLES[3].at（善名渐起，3 笔）→ 解锁 2
  const jump1 = TITLES[3]!.at; // 3? 实际 TITLES[3].at 是 4
  assert.equal(maxDifficultyForDeeds(jump1 - 1), 1);
  assert.equal(maxDifficultyForDeeds(jump1), 2);
  // 第二次跳变应在 TITLES[5].at（大善之人）→ 解锁 3
  const jump2 = TITLES[5]!.at;
  assert.equal(maxDifficultyForDeeds(jump2 - 1), 2);
  assert.equal(maxDifficultyForDeeds(jump2), 3);
});

test('高级: 满级后难度上界恒为 3', () => {
  for (const d of [10, 11, 50, 100, 1000]) {
    assert.equal(maxDifficultyForDeeds(d), 3, `${d} 笔应恒定解锁 3`);
  }
});

// ── 反转规则：filterByLevel 缺省视为 1 ─────────────────────

test('高级: filterByLevel 缺省 difficulty 项在任何境界都保留', () => {
  // 缺省 = 1，所以即便是 0 级也保留
  const items = [{ id: 'a' }, { id: 'b', difficulty: 2 as Difficulty }, { id: 'c', difficulty: 3 as Difficulty }];
  const at0 = filterByLevel(items, 0);
  assert.deepEqual(at0.map((x) => x.id), ['a']);
  // 5 级保留 a（缺省 1）与 b（2）与 c（3）
  const at5 = filterByLevel(items, 5);
  assert.deepEqual(at5.map((x) => x.id), ['a', 'b', 'c']);
});

test('高级: filterByLevel 空数组返回空', () => {
  assert.deepEqual(filterByLevel([], 7), []);
});

test('高级: filterByLevel 全是高难度 + 低境界 → 返回空', () => {
  const items = [
    { difficulty: 2 as Difficulty },
    { difficulty: 3 as Difficulty },
  ];
  assert.deepEqual(filterByLevel(items, 0), []);
});

// ── recommendDifficulty 回退链 ───────────────────────────

test('高级: recommendDifficulty 回退链 3→2→1', () => {
  // 等级 7（可解锁 3），池里只有 1 → 应回退到 1
  assert.equal(recommendDifficulty(7, [1]), 1);
  // 池里只有 2 → 取 2
  assert.equal(recommendDifficulty(7, [2]), 2);
  // 池里只有 3 → 取 3
  assert.equal(recommendDifficulty(7, [3]), 3);
  // 池里有 2,3 → 取 3
  assert.equal(recommendDifficulty(7, [2, 3]), 3);
  // 池里有 1,3（缺 2）→ 取 3
  assert.equal(recommendDifficulty(7, [1, 3]), 3);
});

test('高级: recommendDifficulty 低境界不可越级', () => {
  // 等级 0（仅 1），即便池里全是 2,3 也只能取空→回退 1
  // 注：present 集合从池构造，若池里没 1 则回退到 [1]，结果仍是 1
  assert.equal(recommendDifficulty(0, [2, 3]), 1);
});

test('高级: recommendDifficulty 去重：重复难度不影响结果', () => {
  assert.equal(recommendDifficulty(7, [1, 1, 2, 2, 3, 3]), 3);
  assert.equal(recommendDifficulty(3, [1, 1, 2, 2, 3, 3]), 2);
});

test('高级: recommendDifficulty 空池恒返回 1', () => {
  for (const lv of [0, 3, 5, 7, 99]) {
    assert.equal(recommendDifficulty(lv, []), 1);
  }
});

// ── isDifficultyUnlocked 反转 ─────────────────────────────

test('高级: isDifficultyUnlocked 的边界', () => {
  // 难度 1 在等级 0 即解锁
  assert.equal(isDifficultyUnlocked(1, 0), true);
  // 难度 2 在等级 2 仍未解锁，等级 3 才解锁
  assert.equal(isDifficultyUnlocked(2, 2), false);
  assert.equal(isDifficultyUnlocked(2, 3), true);
  // 难度 3 在等级 4 仍未解锁，等级 5 才解锁
  assert.equal(isDifficultyUnlocked(3, 4), false);
  assert.equal(isDifficultyUnlocked(3, 5), true);
});

test('高级: isDifficultyUnlocked 与 maxDifficultyForLevel 等价', () => {
  for (let lv = 0; lv <= 7; lv++) {
    const max = maxDifficultyForLevel(lv);
    for (const d of [1, 2, 3] as Difficulty[]) {
      assert.equal(
        isDifficultyUnlocked(d, lv),
        d <= max,
        `等级 ${lv} 下难度 ${d} 的解锁状态应等价于 ${d}<=${max}`,
      );
    }
  }
});

// ── difficultyGuidance 反转：高等级必提「深渊」─────────────

test('高级: difficultyGuidance 在 5 级以上必含「深渊」', () => {
  for (const lv of [5, 6, 7, 10]) {
    const g = difficultyGuidance(lv);
    assert.ok(g.includes('深渊'), `等级 ${lv} 的引导应含「深渊」：${g}`);
    assert.ok(g.includes(String(lv)), `应含等级数字 ${lv}`);
  }
});

test('高级: difficultyGuidance 在 3-4 级必含「进阶」', () => {
  for (const lv of [3, 4]) {
    assert.ok(difficultyGuidance(lv).includes('进阶'));
  }
});

test('高级: difficultyGuidance 在 0-2 级必含「初阶」', () => {
  for (const lv of [0, 1, 2]) {
    assert.ok(difficultyGuidance(lv).includes('初阶'));
  }
});

// ── 负数 / 超大数 容错 ───────────────────────────────────

test('高级: maxDifficultyForLevel 对负数返回 1（钳制）', () => {
  // 负数 < 3，落入 else 分支，返回 1
  assert.equal(maxDifficultyForLevel(-1), 1);
  assert.equal(maxDifficultyForLevel(-100), 1);
});

test('高级: maxDifficultyForLevel 对超大数返回 3', () => {
  assert.equal(maxDifficultyForLevel(1000), 3);
  assert.equal(maxDifficultyForLevel(Number.MAX_SAFE_INTEGER), 3);
});

test('高级: deedCountToLevel 对负数返回 0', () => {
  assert.equal(deedCountToLevel(-1), 0);
  assert.equal(deedCountToLevel(-100), 0);
});

test('高级: titleLevel 与 deedCountToLevel 对同一输入等价', () => {
  for (let d = 0; d <= 15; d++) {
    assert.equal(
      deedCountToLevel(d),
      titleLevel(d),
      `deedCountToLevel(${d}) 应与 titleLevel(${d}) 等价`,
    );
  }
});

/**
 * 大善系统 —— 难度递进系统测试（shared/difficulty.ts）。
 *
 * 覆盖：
 *  - maxDifficultyForLevel：称号等级 → 解锁上限（1→1, 3→2, 5→3）
 *  - maxDifficultyForDeeds：笔数推断
 *  - deedCountToLevel：与 ledgerCore.TITLES 阈值（1/2/3/4/5/6/8/10）一致
 *  - filterByLevel：按境界筛候选
 *  - recommendDifficulty：高境界倾向高难度，池不足时回退
 *  - isDifficultyUnlocked：UI 灰显判定
 *  - difficultyGuidance：LLM 引导文案含难度名
 *  - 集成：fallback pickers 在低/高 deedCount 下取到的情境难度合规
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
  DIFFICULTY_META,
} from '../shared/difficulty.ts';
import type { Difficulty } from '../shared/types.ts';
import { pickFallbackFirstSituation, pickFallbackTurn } from '../shared/fallback.ts';
import { TITLES } from '../shared/ledgerCore.ts';

// ── maxDifficultyForLevel ─────────────────────────────────

test('maxDifficultyForLevel: 0-2 级仅解锁初阶(1)', () => {
  for (const lv of [0, 1, 2]) {
    assert.equal(maxDifficultyForLevel(lv), 1, `等级 ${lv} 应仅解锁难度 1`);
  }
});

test('maxDifficultyForLevel: 3-4 级解锁进阶(≤2)', () => {
  for (const lv of [3, 4]) {
    assert.equal(maxDifficultyForLevel(lv), 2, `等级 ${lv} 应解锁到难度 2`);
  }
});

test('maxDifficultyForLevel: 5+ 级解锁深渊(≤3)', () => {
  for (const lv of [5, 6, 7, 99]) {
    assert.equal(maxDifficultyForLevel(lv), 3, `等级 ${lv} 应解锁到难度 3`);
  }
});

test('maxDifficultyForLevel: 单调不减', () => {
  let prev = 0;
  for (let lv = 0; lv <= 10; lv++) {
    const d = maxDifficultyForLevel(lv);
    assert.ok(d >= prev, `等级 ${lv} 的解锁上限不应低于前一级`);
    prev = d;
  }
});

// ── maxDifficultyForDeeds ─────────────────────────────────

test('maxDifficultyForDeeds: 0 笔 → 1', () => {
  assert.equal(maxDifficultyForDeeds(0), 1);
});

test('maxDifficultyForDeeds: 10 笔（满级）→ 3', () => {
  assert.equal(maxDifficultyForDeeds(10), 3);
});

// ── deedCountToLevel 与 ledgerCore 一致 ───────────────────

test('deedCountToLevel: 与 ledgerCore.TITLES 阈值一致', () => {
  // 取每个称号阈值，校验 deedCountToLevel 给出对应索引
  for (let i = 0; i < TITLES.length; i++) {
    const at = TITLES[i]!.at;
    assert.equal(
      deedCountToLevel(at),
      i,
      `${at} 笔应对应等级 ${i}（${TITLES[i]!.name}）`,
    );
  }
});

test('deedCountToLevel: 0 笔 → 等级 0', () => {
  assert.equal(deedCountToLevel(0), 0);
});

test('deedCountToLevel: 阈值之间取较低等级', () => {
  // TITLES 阈值 6 和 8 之间，7 笔应仍是等级 5（at=6 那级）
  assert.equal(deedCountToLevel(7), 5);
});

// ── filterByLevel ─────────────────────────────────────────

test('filterByLevel: 低境界过滤掉高难度项', () => {
  const candidates: { difficulty?: Difficulty }[] = [
    { difficulty: 1 },
    { difficulty: 2 },
    { difficulty: 3 },
  ];
  const low = filterByLevel(candidates, 1); // 仅解锁 1
  assert.equal(low.length, 1);
  assert.equal(low[0]!.difficulty, 1);
});

test('filterByLevel: 高境界保留全部', () => {
  const candidates: { difficulty?: Difficulty }[] = [
    { difficulty: 1 },
    { difficulty: 2 },
    { difficulty: 3 },
  ];
  const high = filterByLevel(candidates, 7); // 解锁 3
  assert.equal(high.length, 3);
});

test('filterByLevel: 缺省 difficulty 视为 1（低境界也能玩）', () => {
  const candidates: { difficulty?: Difficulty }[] = [{}, { difficulty: 3 }];
  const low = filterByLevel(candidates, 0);
  assert.equal(low.length, 1, '缺省 difficulty=1 应保留，difficulty=3 应被过滤');
});

test('filterByLevel: 保持原顺序', () => {
  const candidates: { difficulty?: Difficulty; id: number }[] = [
    { difficulty: 1, id: 1 },
    { difficulty: 1, id: 2 },
    { difficulty: 2, id: 3 },
  ];
  const out = filterByLevel(candidates, 0);
  assert.deepEqual(
    out.map((c) => c.id),
    [1, 2],
  );
});

// ── recommendDifficulty ───────────────────────────────────

test('recommendDifficulty: 高境界倾向高难度', () => {
  // 池里有 1/2/3，等级 7 → 推荐 3
  assert.equal(recommendDifficulty(7, [1, 2, 3]), 3);
});

test('recommendDifficulty: 池里缺高难度时回退到次高', () => {
  // 等级 7（可解锁 3）但池里只有 1/2 → 推荐 2
  assert.equal(recommendDifficulty(7, [1, 2]), 2);
});

test('recommendDifficulty: 低境界即便池里有 3 也只能拿 1', () => {
  assert.equal(recommendDifficulty(0, [1, 2, 3]), 1);
});

test('recommendDifficulty: 空池回退到 1', () => {
  assert.equal(recommendDifficulty(5, []), 1);
});

// ── isDifficultyUnlocked ──────────────────────────────────

test('isDifficultyUnlocked: 低境界下难度 3 锁定、难度 1 解锁', () => {
  assert.equal(isDifficultyUnlocked(1, 0), true);
  assert.equal(isDifficultyUnlocked(2, 0), false);
  assert.equal(isDifficultyUnlocked(3, 0), false);
});

test('isDifficultyUnlocked: 满级全部解锁', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    assert.equal(isDifficultyUnlocked(d, 7), true);
  }
});

// ── DIFFICULTY_META / difficultyGuidance ──────────────────

test('DIFFICULTY_META: 三档都有名称与描述', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    assert.ok(DIFFICULTY_META[d]!.name.length > 0);
    assert.ok(DIFFICULTY_META[d]!.desc.length > 0);
  }
});

test('difficultyGuidance: 含难度名与等级数字', () => {
  const g = difficultyGuidance(5); // 解锁 3 = 深渊
  assert.ok(g.includes('深渊'), '应含「深渊」名称');
  assert.ok(g.includes('5'), '应含等级数字');
});

test('difficultyGuidance: 低等级引导初阶', () => {
  const g = difficultyGuidance(0);
  assert.ok(g.includes('初阶'));
});

// ── 集成：fallback pickers 遵守难度递进 ───────────────────

test('集成: pickFallbackFirstSituation(高 deedCount) 取到的情境难度可达 3', () => {
  // 收集多次开局（游标会推进，但开局总是取池首）
  // 高境界池含难度 1/2/3，开局取第一个（可能是用户池空 → 内置第一个，难度 1）
  // 这里改测：高境界下连续取「下一情境」，应能出现难度 3
  const seenDifficulties = new Set<number>();
  const deedCount = 12; // 满级
  // 通过 pickFallbackTurn 推进若干次，收集 next 的 difficulty
  // 先用一个真实选项文案触发
  const first = pickFallbackFirstSituation(deedCount);
  seenDifficulties.add(first.difficulty ?? 1);
  for (let i = 0; i < 30; i++) {
    // 用池里某剧本的真实选项文案（取已见情境的选项）推进
    const choiceText = first.choices[0]!.text;
    const turn = pickFallbackTurn(choiceText, deedCount);
    seenDifficulties.add(turn.next.difficulty ?? 1);
  }
  // 高境界池里含难度 3 的剧本，30 次推进应至少见过一次难度 3
  assert.ok(
    seenDifficulties.has(3),
    `高境界下应能遇到难度 3 的困境，实际见过：${[...seenDifficulties].join(',')}`,
  );
});

test('集成: pickFallbackTurn(低 deedCount) 取到的「下一情境」难度不超过 1', () => {
  // 低境界（0 笔）仅解锁难度 1
  const first = pickFallbackFirstSituation(0);
  const choiceText = first.choices[0]!.text;
  for (let i = 0; i < 20; i++) {
    const turn = pickFallbackTurn(choiceText, 0);
    const d = turn.next.difficulty ?? 1;
    assert.ok(
      d <= 1,
      `低境界下「下一情境」难度应 ≤1，实际 ${d}（${turn.next.situation.slice(0, 12)}…）`,
    );
  }
});

test('集成: 不传 deedCount 时行为不变（全池，含高难度）', () => {
  // 兼容旧调用：不传 deedCount，不过滤，可出现任意难度
  const first = pickFallbackFirstSituation();
  const choiceText = first.choices[0]!.text;
  const turn = pickFallbackTurn(choiceText);
  assert.ok(turn.next.situation.length > 0);
  // 不报错即可，难度不限
});

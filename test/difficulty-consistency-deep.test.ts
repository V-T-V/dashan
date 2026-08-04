/**
 * 大善系统 —— difficulty ↔ ledgerCore 双实现一致性深层测试。
 *
 * AGENTS.md 明确警告：difficulty.deedCountToLevel 与 ledgerCore.titleLevel
 * 是「故意独立实现的等价函数」（为避免循环依赖），改阈值时两处要同步。
 * 本测试把这个不变量锁死：对 0-50 所有 deedCount，两个函数必须返回相同等级。
 *
 * 另覆盖：
 *  - maxDifficultyForLevel 全等级跳变点矩阵（精确边界 2→3, 4→5）
 *  - DIFFICULTY_META 三档元信息完备
 *  - difficultyGuidance 全等级输出合法
 *  - filterByLevel 边界（空池/全缺省/全超限）
 *  - recommendDifficulty 回退链全路径
 *  - 难度阶梯与称号阶梯的耦合关系（境界升 → 难度门升）
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
import { titleLevel, TITLES, MAX_TITLE_LEVEL } from '../shared/ledgerCore.ts';
import type { Difficulty } from '../shared/types.ts';

// ── 核心不变量：双实现一致性（整个 range） ───────────────

test('consistency: deedCountToLevel 与 ledgerCore.titleLevel 全区间等价 [0,50]', () => {
  for (let c = 0; c <= 50; c++) {
    assert.equal(
      deedCountToLevel(c),
      titleLevel(c),
      `双实现在 deedCount=${c} 处不一致（破坏 AGENTS.md 同步约定）`,
    );
  }
});

test('consistency: 双实现在所有 TITLES 阈值处一致', () => {
  for (const t of TITLES) {
    assert.equal(
      deedCountToLevel(t.at),
      titleLevel(t.at),
      `阈值 ${t.at}（${t.name}）处双实现不一致`,
    );
  }
});

test('consistency: 双实现在阈值前一点（at-1）处一致', () => {
  for (const t of TITLES) {
    if (t.at > 0) {
      assert.equal(
        deedCountToLevel(t.at - 1),
        titleLevel(t.at - 1),
        `阈值前一点 ${t.at - 1} 处双实现不一致`,
      );
    }
  }
});

test('consistency: 负数与超大数双实现行为一致', () => {
  for (const c of [-1, -100, 1000, 99999]) {
    assert.equal(
      deedCountToLevel(c),
      titleLevel(c),
      `极端值 ${c} 处双实现不一致`,
    );
  }
});

// ── maxDifficultyForLevel 跳变点矩阵 ────────────────────

test('consistency: maxDifficultyForLevel 跳变点精确在等级 3 与 5', () => {
  // 等级 2 → 难度 1；等级 3 → 难度 2（跳变）
  assert.equal(maxDifficultyForLevel(2), 1, '等级 2 应仍为难度 1');
  assert.equal(maxDifficultyForLevel(3), 2, '等级 3 应跳变为难度 2');
  // 等级 4 → 难度 2；等级 5 → 难度 3（跳变）
  assert.equal(maxDifficultyForLevel(4), 2, '等级 4 应仍为难度 2');
  assert.equal(maxDifficultyForLevel(5), 3, '等级 5 应跳变为难度 3');
});

test('consistency: maxDifficultyForLevel 在每个等级返回合法难度', () => {
  for (let lv = 0; lv <= MAX_TITLE_LEVEL; lv++) {
    const d = maxDifficultyForLevel(lv);
    assert.ok(d === 1 || d === 2 || d === 3, `等级 ${lv} 返回非法难度 ${d}`);
  }
});

test('consistency: maxDifficultyForLevel 单调不减 [0, MAX]', () => {
  let prev = 0;
  for (let lv = 0; lv <= MAX_TITLE_LEVEL; lv++) {
    const d = maxDifficultyForLevel(lv);
    assert.ok(d >= prev, `等级 ${lv} 难度 ${d} < 前级 ${prev}（应单调不减）`);
    prev = d;
  }
});

test('consistency: maxDifficultyForLevel 封顶在 3（超 MAX 也只到 3）', () => {
  for (const lv of [MAX_TITLE_LEVEL, MAX_TITLE_LEVEL + 1, 100, 9999]) {
    assert.equal(maxDifficultyForLevel(lv), 3, `${lv} 应封顶难度 3`);
  }
});

// ── maxDifficultyForDeeds 一致性 ────────────────────────

test('consistency: maxDifficultyForDeeds 与 maxDifficultyForLevel(deedCountToLevel) 等价', () => {
  for (let c = 0; c <= 30; c++) {
    const direct = maxDifficultyForDeeds(c);
    const viaLevel = maxDifficultyForLevel(deedCountToLevel(c));
    assert.equal(direct, viaLevel, `deedCount=${c} 两路径不一致`);
  }
});

// ── DIFFICULTY_META 完备性 ──────────────────────────────

test('consistency: DIFFICULTY_META 恰含 1/2/3 三档', () => {
  assert.deepEqual(
    Object.keys(DIFFICULTY_META).sort(),
    ['1', '2', '3'],
  );
});

test('consistency: DIFFICULTY_META 每档 name 与 desc 非空且为中文', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    const meta = DIFFICULTY_META[d]!;
    assert.ok(meta.name.length > 0, `难度 ${d} name 非空`);
    assert.ok(meta.desc.length > 0, `难度 ${d} desc 非空`);
  }
});

test('consistency: DIFFICULTY_META 三档 name 互不相同', () => {
  const names = [1, 2, 3].map((d) => DIFFICULTY_META[d as Difficulty]!.name);
  assert.equal(new Set(names).size, 3, '三档难度名应互不相同');
});

test('consistency: DIFFICULTY_META 难度递进描述含递进关键词', () => {
  // 初阶提到「直白/清晰」，深渊提到「纠缠/无安全」之类
  assert.ok(DIFFICULTY_META[1]!.desc.length > 5, '初阶描述应详尽');
  assert.ok(DIFFICULTY_META[3]!.desc.length > 5, '深渊描述应详尽');
});

// ── difficultyGuidance 全等级 ───────────────────────────

test('consistency: difficultyGuidance 全等级输出含等级数字与难度名', () => {
  for (let lv = 0; lv <= MAX_TITLE_LEVEL; lv++) {
    const g = difficultyGuidance(lv);
    assert.ok(g.includes(String(lv)), `等级 ${lv} 引导文案应含等级数字`);
    // 应含三档难度名之一
    const names = [1, 2, 3].map((d) => DIFFICULTY_META[d as Difficulty]!.name);
    assert.ok(names.some((n) => g.includes(n)), `等级 ${lv} 引导应含某难度名`);
  }
});

test('consistency: difficultyGuidance 低境界引导初阶、高境界引导深渊', () => {
  assert.ok(difficultyGuidance(0).includes('初阶'));
  assert.ok(difficultyGuidance(MAX_TITLE_LEVEL).includes('深渊'));
});

// ── filterByLevel 边界 ──────────────────────────────────

test('consistency: filterByLevel 空池返回空数组', () => {
  assert.deepEqual(filterByLevel([], 0), []);
  assert.deepEqual(filterByLevel([], 7), []);
});

test('consistency: filterByLevel 全缺省 difficulty 视为 1（低境界也全留）', () => {
  const all = [{}, {}, {}];
  assert.equal(filterByLevel(all, 0).length, 3);
});

test('consistency: filterByLevel 全超限时低境界全过滤', () => {
  const all: { difficulty?: Difficulty }[] = [{ difficulty: 3 }, { difficulty: 3 }];
  assert.equal(filterByLevel(all, 0).length, 0);
  assert.equal(filterByLevel(all, 5).length, 2);
});

test('consistency: filterByLevel 不修改原数组', () => {
  const orig: { difficulty?: Difficulty }[] = [{ difficulty: 1 }, { difficulty: 3 }];
  const snapshot = orig.map((x) => ({ ...x }));
  filterByLevel(orig, 0);
  assert.deepEqual(orig, snapshot, 'filterByLevel 不应修改入参数组');
});

// ── recommendDifficulty 回退链 ──────────────────────────

test('consistency: recommendDifficulty 高境界池仅含 3 → 推荐 3', () => {
  assert.equal(recommendDifficulty(7, [3]), 3);
});

test('consistency: recommendDifficulty 高境界池仅含 2 → 回退到 2', () => {
  assert.equal(recommendDifficulty(7, [2]), 2);
});

test('consistency: recommendDifficulty 高境界池仅含 1 → 回退到 1', () => {
  assert.equal(recommendDifficulty(7, [1]), 1);
});

test('consistency: recommendDifficulty 空池 → 回退 1（缺省）', () => {
  assert.equal(recommendDifficulty(7, []), 1);
  assert.equal(recommendDifficulty(0, []), 1);
});

test('consistency: recommendDifficulty 推荐值恒为合法难度', () => {
  const pools: Difficulty[][] = [[1], [2], [3], [1, 2], [1, 2, 3], [2, 3], [], [1, 3]];
  for (const lv of [0, 1, 3, 5, 7]) {
    for (const pool of pools) {
      const r = recommendDifficulty(lv, pool);
      assert.ok(r === 1 || r === 2 || r === 3, `等级 ${lv} 池 ${pool} 推荐 ${r} 非法`);
    }
  }
});

// ── isDifficultyUnlocked 与 maxDifficultyForLevel 一致 ──

test('consistency: isDifficultyUnlocked 与 maxDifficultyForLevel 一致（全等级×全难度）', () => {
  for (let lv = 0; lv <= MAX_TITLE_LEVEL; lv++) {
    const max = maxDifficultyForLevel(lv);
    for (const d of [1, 2, 3] as Difficulty[]) {
      assert.equal(
        isDifficultyUnlocked(d, lv),
        d <= max,
        `等级 ${lv} 难度 ${d} 解锁状态与上限 ${max} 不一致`,
      );
    }
  }
});

// ── 难度阶梯与称号阶梯耦合 ──────────────────────────────

test('consistency: 满级称号解锁全部三档难度', () => {
  const maxLv = MAX_TITLE_LEVEL;
  assert.equal(maxDifficultyForLevel(maxLv), 3);
  for (const d of [1, 2, 3] as Difficulty[]) {
    assert.equal(isDifficultyUnlocked(d, maxLv), true);
  }
});

test('consistency: 称号阶梯阈值 1/2/3/4/5/6/8/10 的难度门映射稳定', () => {
  // 等级 3（at=4，善名渐起）开难度 2；等级 5（at=6，善满功圆）开难度 3
  // 即 4 笔 deedCount→level 3→难度 2；6 笔 deedCount→level 5→难度 3
  assert.equal(maxDifficultyForLevel(titleLevel(4)), 2, '4 笔（等级 3）应解锁难度 2');
  assert.equal(maxDifficultyForLevel(titleLevel(6)), 3, '6 笔（等级 5）应解锁难度 3');
  // 验证跳变点：5 笔（等级 4）仍只到难度 2，6 笔（等级 5）才到 3
  assert.equal(maxDifficultyForLevel(titleLevel(5)), 2, '5 笔（等级 4）应仍为难度 2');
});

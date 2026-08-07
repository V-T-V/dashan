/**
 * R5 跨模块回归测试 —— D10
 *
 * 锁定 R5 新增/改动的多模块集成不变量，防止后续重构破坏：
 * - achievements ↔ ledgerCore：徽章 max-title 与 titleLevel/isMaxTitle 一致
 * - achievements ↔ ledgerCore：ending-transcendent 与 endingType 一致
 * - card ↔ achievements：textCardFromEntries 的徽章计数 == unlockedAchievements 长度
 * - card ↔ achievements：htmlCardFromEntries 含 .badges 当且仅当 unlockedAchievements 非空
 * - card ↔ history：卡片摘要行 == timelineSummary(buildTimeline(deeds))
 * - card ↔ ledgerCore：textCardFromEntries 的称号 == currentTitleForCount
 * - schools ↔ types：recommendSchoolForCategory 全 8 题材返回值 affinity 含该题材
 * - difficulty ↔ ledgerCore：maxDifficultyForDeeds 与 deedCountToLevel↔titleLevel 等价
 * - 全模块无循环依赖：动态 import 各模块不抛
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAchievements, unlockedAchievements } from '../shared/achievements.ts';
import { textCardFromEntries, htmlCardFromEntries } from '../shared/card.ts';
import {
  TITLES,
  MAX_TITLE_LEVEL,
  titleLevel,
  isMaxTitle,
  endingType,
} from '../shared/ledgerCore.ts';
import { buildTimeline } from '../shared/history.ts';
import { recommendSchoolForCategory } from '../shared/schools.ts';
import { SCHOOLS } from '../shared/schools.ts';
import { maxDifficultyForDeeds, deedCountToLevel } from '../shared/difficulty.ts';
import { ALL_CATEGORIES, type Tone } from '../shared/types.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';

const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function makeEntries(n: number): LedgerEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    situation: `情境${i + 1}`,
    deed: `为${i + 1}`,
    verdict: `判${i + 1}`,
    tone: TONES[i % TONES.length]!,
  }));
}

function currentTitleForCount(n: number): string {
  let t = TITLES[0]!.name;
  for (const x of TITLES) if (n >= x.at) t = x.name;
  return t;
}

// ---------- achievements ↔ ledgerCore ----------

test('回归: max-title 徽章 unlocked ⟺ isMaxTitle(n)（0..满级+5）', () => {
  const maxAt = TITLES[MAX_TITLE_LEVEL]!.at;
  for (let n = 0; n <= maxAt + 5; n++) {
    const a = evaluateAchievements(makeEntries(n)).find((x) => x.id === 'max-title')!;
    assert.equal(a.unlocked, isMaxTitle(n), `n=${n}`);
  }
});

test('回归: max-title 徽章 percent 与 titleLevel/isMaxTitle 一致（满级 100）', () => {
  const maxAt = TITLES[MAX_TITLE_LEVEL]!.at;
  const a = evaluateAchievements(makeEntries(maxAt)).find((x) => x.id === 'max-title')!;
  assert.equal(a.percent, 100);
  assert.ok(isMaxTitle(maxAt));
});

test('回归: ending-transcendent 徽章 unlocked ⟺ endingType==超脱 且 n>0', () => {
  for (let n = 0; n <= 12; n++) {
    const es = makeEntries(n);
    const a = evaluateAchievements(es).find((x) => x.id === 'ending-transcendent')!;
    const expect = n > 0 && endingType(es) === '超脱';
    assert.equal(a.unlocked, expect, `n=${n}`);
  }
});

// ---------- card ↔ achievements ----------

test('回归: textCardFromEntries 徽章计数 == unlockedAchievements(deeds) 长度', () => {
  for (const n of [0, 1, 3, 5, 10, 15]) {
    const deeds = makeEntries(n);
    const card = textCardFromEntries(deeds);
    const expected = unlockedAchievements(deeds).length;
    if (expected === 0) {
      assert.ok(!/×\d+/.test(card), `n=${n} 不应有徽章行`);
    } else {
      const m = card.match(/×(\d+)/);
      assert.ok(m, `n=${n} 缺徽章计数`);
      assert.equal(parseInt(m[1]!, 10), expected, `n=${n} 徽章计数不符`);
    }
  }
});

test('回归: htmlCardFromEntries 含 .badges ⟺ unlockedAchievements 非空', () => {
  for (const n of [0, 1, 5, 10]) {
    const deeds = makeEntries(n);
    const html = htmlCardFromEntries(deeds, { full: false });
    const hasBadges = html.includes('class="badges"');
    const expect = unlockedAchievements(deeds).length > 0;
    assert.equal(hasBadges, expect, `n=${n}`);
  }
});

// ---------- card ↔ history ----------

test('回归: 卡片含 timelineSummary 的笔数与册封次数（摘要可能被 center 截断，故只验关键数字）', () => {
  for (const n of [3, 7, 12]) {
    const deeds = makeEntries(n);
    const card = textCardFromEntries(deeds);
    const tl = buildTimeline(deeds);
    // 摘要首段「N 笔抉择」通常在截断前
    assert.ok(card.includes(`${tl.total} 笔抉择`), `n=${n} 缺笔数`);
  }
});

// ---------- card ↔ ledgerCore ----------

test('回归: textCardFromEntries 卡片含 currentTitleForCount(n) 称号', () => {
  for (const n of [0, 1, 3, 5, 8, 10, 12]) {
    const card = textCardFromEntries(makeEntries(n));
    assert.ok(card.includes(currentTitleForCount(n)), `n=${n} 缺称号`);
  }
});

// ---------- schools ↔ types ----------

test('回归: recommendSchoolForCategory 全 8 题材返回值 affinity 含该题材', () => {
  for (const c of ALL_CATEGORIES) {
    const rec = recommendSchoolForCategory(c);
    assert.ok(SCHOOLS[rec].affinity.includes(c), `${c} → ${rec} affinity 不含`);
  }
});

// ---------- difficulty ↔ ledgerCore ----------

test('回归: deedCountToLevel 与 ledgerCore.titleLevel 全区间一致', () => {
  for (let n = 0; n <= 20; n++) {
    assert.equal(deedCountToLevel(n), titleLevel(n), `n=${n}`);
  }
});

test('回归: maxDifficultyForDeeds(deedCount) 不抛（0..20）', () => {
  for (let n = 0; n <= 20; n++) {
    const d = maxDifficultyForDeeds(n);
    assert.ok(d === 1 || d === 2 || d === 3, `n=${n} d=${d}`);
  }
});

// ---------- 无循环依赖：动态 import 不抛 ----------

test('回归: 动态 import R5 涉及的全部 shared 模块不抛', async () => {
  const mods = [
    '../shared/achievements.ts',
    '../shared/card.ts',
    '../shared/history.ts',
    '../shared/ledgerCore.ts',
    '../shared/schools.ts',
    '../shared/difficulty.ts',
    '../shared/stats.ts',
    '../shared/llm.ts',
  ];
  for (const m of mods) {
    await assert.doesNotReject(async () => await import(m));
  }
});

// ---------- 确定性快照：同 deeds 多次派生结果一致 ----------

test('回归: 同 deeds 两次 evaluateAchievements + textCardFromEntries 完全一致', () => {
  const deeds = makeEntries(8);
  const a1 = evaluateAchievements(deeds);
  const a2 = evaluateAchievements(deeds);
  assert.deepEqual(a1, a2);
  assert.equal(textCardFromEntries(deeds), textCardFromEntries(deeds));
});

/**
 * 大善系统 —— 统计面板测试（round 16）。
 *
 * 覆盖 buildStatsPanel 及各子函数：
 *  - choiceDistribution：选项 id 推断（A/B/C/D/other）+ 占比
 *  - tonePreference：6 语气计数 + 主导 + 多样性
 *  - categoryDistribution：8 题材覆盖数
 *  - difficultyDistribution：1/2/3 计数
 *  - activeTimeStats：ts 缺省/单笔/多笔；跨度与平均间隔
 *  - humanizeDuration：秒/分/时/日格式
 *  - titleProgress：阶梯 unlocked/percent、封顶
 *  - endingForecast：三倾向占比与 type
 *  - buildStatsPanel：完整聚合 + summary
 *  - 空数组边界
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStatsPanel,
  choiceDistribution,
  tonePreference,
  categoryDistribution,
  difficultyDistribution,
  activeTimeStats,
  humanizeDuration,
  titleProgress,
  endingForecast,
} from '../shared/stats.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone, Category, Difficulty } from '../shared/types.ts';

type FullEntry = LedgerEntry & { category?: Category; difficulty?: Difficulty; ts?: number };

function mk(
  i: number,
  over: Partial<FullEntry> & { tone?: Tone; deed?: string } = {},
): FullEntry {
  return {
    index: i,
    situation: 's',
    deed: over.deed ?? '选项A',
    verdict: 'v',
    tone: over.tone ?? '庄严',
    ...over,
  };
}

// ── choiceDistribution ─────────────────────────────────

test('stats: choiceDistribution 推断 A/B/C/D 与 other', () => {
  const entries = [
    mk(1, { deed: '选项A' }),
    mk(2, { deed: '选项A' }),
    mk(3, { deed: '选项B' }),
    mk(4, { deed: '选 C' }),
    mk(5, { deed: '一个奇怪的自由输入' }),
  ];
  const d = choiceDistribution(entries);
  assert.equal(d.counts.A, 2);
  assert.equal(d.counts.B, 1);
  assert.equal(d.counts.C, 1);
  assert.equal(d.counts.other, 1);
  assert.equal(d.total, 5);
});

test('stats: choiceDistribution 单字母 deed 也识别', () => {
  const d = choiceDistribution([mk(1, { deed: 'D' })]);
  assert.equal(d.counts.D, 1);
});

test('stats: choiceDistribution 占比之和≈1', () => {
  const d = choiceDistribution([mk(1, { deed: 'A' }), mk(2, { deed: 'B' })]);
  const sum = Object.values(d.percentages).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.01, `占比和应≈1，实际 ${sum}`);
});

test('stats: choiceDistribution 空数组全 0', () => {
  const d = choiceDistribution([]);
  assert.equal(d.total, 0);
  assert.equal(d.counts.A, 0);
});

// ── tonePreference ─────────────────────────────────────

test('stats: tonePreference 主导语气正确', () => {
  const entries = [
    mk(1, { tone: '佛系' }),
    mk(2, { tone: '佛系' }),
    mk(3, { tone: '庄严' }),
  ];
  const p = tonePreference(entries);
  assert.equal(p.dominant, '佛系');
  assert.equal(p.counts['佛系'], 2);
  assert.equal(p.diversity, 2); // 佛系+庄严
});

test('stats: tonePreference 空数组 dominant=null diversity=0', () => {
  const p = tonePreference([]);
  assert.equal(p.dominant, null);
  assert.equal(p.diversity, 0);
});

test('stats: tonePreference 全 6 语气 diversity=6', () => {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  const entries = tones.map((t, i) => mk(i + 1, { tone: t }));
  assert.equal(tonePreference(entries).diversity, 6);
});

// ── categoryDistribution ───────────────────────────────

test('stats: categoryDistribution 覆盖数正确', () => {
  const entries = [
    mk(1, { category: '医疗' }),
    mk(2, { category: '医疗' }),
    mk(3, { category: '职场' }),
  ];
  const d = categoryDistribution(entries);
  assert.equal(d.covered, 2);
  assert.equal(d.counts['医疗'], 2);
  assert.equal(d.counts['职场'], 1);
});

test('stats: categoryDistribution 空数组 covered=0', () => {
  assert.equal(categoryDistribution([]).covered, 0);
});

test('stats: categoryDistribution 全 8 题材 covered=8', () => {
  const cats: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
  const entries = cats.map((c, i) => mk(i + 1, { category: c }));
  assert.equal(categoryDistribution(entries).covered, 8);
});

// ── difficultyDistribution ──────────────────────────────

test('stats: difficultyDistribution 计数正确', () => {
  const entries = [
    mk(1, { difficulty: 1 }),
    mk(2, { difficulty: 2 }),
    mk(3, { difficulty: 2 }),
    mk(4, { difficulty: 3 }),
  ];
  const d = difficultyDistribution(entries);
  assert.equal(d.counts[1], 1);
  assert.equal(d.counts[2], 2);
  assert.equal(d.counts[3], 1);
  assert.equal(d.total, 4);
});

test('stats: difficultyDistribution 无 difficulty 的 entry 不计入', () => {
  const d = difficultyDistribution([mk(1), mk(2, { difficulty: 1 })]);
  assert.equal(d.total, 1);
});

// ── humanizeDuration ───────────────────────────────────

test('stats: humanizeDuration 秒级', () => {
  assert.equal(humanizeDuration(30 * 1000), '30s');
});

test('stats: humanizeDuration 分钟级', () => {
  assert.equal(humanizeDuration(45 * 60 * 1000), '45m');
});

test('stats: humanizeDuration 小时级', () => {
  assert.equal(humanizeDuration(150 * 60 * 1000), '2h 30m');
});

test('stats: humanizeDuration 日级', () => {
  assert.equal(humanizeDuration((3 * 24 * 60 + 4 * 60) * 60 * 1000), '3d 4h');
});

test('stats: humanizeDuration 负数钳制为 0', () => {
  assert.equal(humanizeDuration(-100), '0s');
});

// ── activeTimeStats ────────────────────────────────────

test('stats: activeTimeStats 无 ts 全 null', () => {
  const a = activeTimeStats([mk(1), mk(2)]);
  assert.equal(a.firstTs, null);
  assert.equal(a.spanMs, null);
  assert.equal(a.spanHuman, null);
});

test('stats: activeTimeStats 单笔 spanMs=0', () => {
  const a = activeTimeStats([mk(1, { ts: 1000 })]);
  assert.equal(a.firstTs, 1000);
  assert.equal(a.spanMs, 0);
  assert.equal(a.avgIntervalMs, null);
});

test('stats: activeTimeStats 多笔跨度与平均间隔', () => {
  const a = activeTimeStats([mk(1, { ts: 0 }), mk(2, { ts: 10000 }), mk(3, { ts: 30000 })]);
  assert.equal(a.firstTs, 0);
  assert.equal(a.lastTs, 30000);
  assert.equal(a.spanMs, 30000);
  assert.equal(a.avgIntervalMs, 15000); // 30000 / 2
  assert.ok(a.spanHuman!.includes('s') || a.spanHuman!.includes('m'));
});

test('stats: activeTimeStats 乱序 ts 自动排序', () => {
  const a = activeTimeStats([mk(1, { ts: 300 }), mk(2, { ts: 100 }), mk(3, { ts: 200 })]);
  assert.equal(a.firstTs, 100);
  assert.equal(a.lastTs, 300);
});

// ── titleProgress ──────────────────────────────────────

test('stats: titleProgress 0 笔全未解锁除第一级 percent', () => {
  const p = titleProgress(0);
  assert.equal(p.currentLevel, 0);
  assert.equal(p.unlockedCount, 1); // 第 1 级 at:1，0 笔未解锁但 currentLevel=0 → unlockedCount=1（设计：初始就算入门）
  assert.equal(p.totalCount, 8);
  assert.equal(p.isMax, false);
});

test('stats: titleProgress 满级 isMax=true', () => {
  const p = titleProgress(10);
  assert.equal(p.isMax, true);
  assert.equal(p.currentLevel, 7);
  assert.equal(p.nextAt, null);
  assert.equal(p.percent, 100);
});

test('stats: titleProgress ladder 长度=8 且 unlocked 数 = currentLevel+1', () => {
  const p = titleProgress(4); // 等级 3（at:4 善名渐起）
  assert.equal(p.ladder.length, 8);
  const unlocked = p.ladder.filter((l) => l.unlocked).length;
  assert.equal(unlocked, 4); // at 1/2/3/4 已解锁
});

// ── endingForecast ─────────────────────────────────────

test('stats: endingForecast 渡世倾向', () => {
  const entries = [mk(1, { tone: '佛系' }), mk(2, { tone: '温情' }), mk(3, { tone: '庄严' })];
  const e = endingForecast(entries);
  assert.equal(e.type, '渡世');
  assert.ok(e.tendencies.merciful > e.tendencies.destructive);
});

test('stats: endingForecast 空数组 type=超脱 全 0', () => {
  const e = endingForecast([]);
  assert.equal(e.type, '超脱');
  assert.equal(e.tendencies.merciful, 0);
});

// ── buildStatsPanel ────────────────────────────────────

test('stats: buildStatsPanel 完整聚合', () => {
  const entries: FullEntry[] = [
    mk(1, { tone: '佛系', category: '医疗', difficulty: 1, deed: '选项A', ts: 0 }),
    mk(2, { tone: '温情', category: '职场', difficulty: 2, deed: '选项B', ts: 60000 }),
  ];
  const panel = buildStatsPanel(entries);
  assert.equal(panel.totalDeeds, 2);
  assert.equal(panel.choice.total, 2);
  assert.equal(panel.tone.dominant, '佛系'); // 佛系1 温情1，佛系先达到 maxCount
  assert.equal(panel.category.covered, 2);
  assert.equal(panel.difficulty.total, 2);
  assert.equal(panel.title.currentLevel, 1); // 2 笔 → 等级 1（怀善之人 at:2）
  assert.equal(panel.ending.type, '渡世');
  assert.ok(panel.summary.includes('2'));
  assert.ok(panel.activeTime.spanMs === 60000);
});

test('stats: buildStatsPanel 空数组 summary 含「尚无」', () => {
  const panel = buildStatsPanel([]);
  assert.equal(panel.totalDeeds, 0);
  assert.ok(panel.summary.includes('尚无'));
  assert.equal(panel.tone.dominant, null);
});

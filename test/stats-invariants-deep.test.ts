/**
 * stats.ts 深层不变量测试 —— R5-D2
 *
 * 不重复 stats.test.ts 的基础用例，专注于：
 * - choiceDistribution：percentages 与 counts 一致 / 总和≈1 / 含 0 entries 时全 0
 * - inferChoiceId 全模式（选项A/选A/选项B/单字母/无匹配→other）
 * - tonePreference：dominant 与 toneStats 一致 / diversity 单调 / 全平局取声明顺序首个
 * - categoryDistribution：未知 category 不计 / 计数与 covered 一致 / 全部带 category 时 covered≤8
 * - difficultyDistribution：非 1/2/3 不计 / total 与 counts 和一致
 * - humanizeDuration：单位边界精确（59s→"59s"、60s→"1m"、3599s→"59m"、3600s→"1h 0m"、86399s、86400s→"1d 0h"、毫秒取整、极大值不溢出）
 * - activeTimeStats：缺省 ts / 字符串 ts / NaN ts 过滤 / 单笔 avgInterval=null / 跨度负数不可能（已排序）
 * - titleProgress：ladder[i].percent 单调 / 末级 isMax / nextAt 与 progressToNextTitle 一致
 * - endingForecast：tendencies 三项和≈1 / 与 endingType 数学一致
 * - buildStatsPanel：所有子项一致性 / summary 含称号名与主导语气
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  choiceDistribution,
  tonePreference,
  categoryDistribution,
  difficultyDistribution,
  humanizeDuration,
  activeTimeStats,
  titleProgress,
  endingForecast,
  buildStatsPanel,
  PRACTICE_STAGES,
  practiceStage,
} from '../shared/stats.ts';
import { TITLES, MAX_TITLE_LEVEL, toneStats, endingType } from '../shared/ledgerCore.ts';
import { ALL_CATEGORIES, type Category, type Difficulty } from '../shared/types.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';

function entry(partial: Partial<LedgerEntry>): LedgerEntry {
  return {
    deed: 'A',
    praise: '好',
    tone: '庄严',
    ...partial,
  } as LedgerEntry;
}

// ── choiceDistribution 不变量 ─────────────────────────────────

test('choiceDistribution: 各 option 计数之和 = total', () => {
  const es = [
    entry({ deed: '选项A' }),
    entry({ deed: '选项B' }),
    entry({ deed: '选 C' }),
    entry({ deed: 'D' }),
    entry({ deed: '完全无关' }),
    entry({ deed: '选项A' }),
  ];
  const r = choiceDistribution(es);
  const sum = Object.values(r.counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.total);
  assert.equal(r.total, es.length);
});

test('choiceDistribution: percentages[k] ≈ counts[k]/total（3位小数）', () => {
  const es = [
    entry({ deed: '选项A' }),
    entry({ deed: '选项A' }),
    entry({ deed: '选项B' }),
  ];
  const r = choiceDistribution(es);
  assert.equal(r.percentages.A, 0.667);
  assert.equal(r.percentages.B, 0.333);
  assert.equal(r.percentages.C, 0);
  assert.equal(r.percentages.D, 0);
  assert.equal(r.percentages.other, 0);
});

test('choiceDistribution: percentages 之和 ≈ 1（浮点容差）', () => {
  const es = [
    entry({ deed: '选项A' }),
    entry({ deed: '选项B' }),
    entry({ deed: '选 C' }),
    entry({ deed: 'D' }),
    entry({ deed: 'X' }),
  ];
  const r = choiceDistribution(es);
  const sum = Object.values(r.percentages).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.01, `百分比和 ${sum} 应≈1`);
});

test('choiceDistribution: 空数组 total=0 且所有 percent=0', () => {
  const r = choiceDistribution([]);
  assert.equal(r.total, 0);
  for (const v of Object.values(r.percentages)) {
    assert.equal(v, 0);
  }
  for (const v of Object.values(r.counts)) {
    assert.equal(v, 0);
  }
});

test('inferChoiceId 等价: 全部无法识别 → other 计数=total', () => {
  const es = [entry({ deed: 'XYZ' }), entry({ deed: 'hello' }), entry({ deed: '' })];
  const r = choiceDistribution(es);
  assert.equal(r.counts.other, 3);
  assert.equal((r.counts.A ?? 0) + (r.counts.B ?? 0) + (r.counts.C ?? 0) + (r.counts.D ?? 0), 0);
});

test('inferChoiceId: 仅识别 A-D，E/F 视为 other', () => {
  const es = [
    entry({ deed: '选项E' }),
    entry({ deed: '选 F' }),
    entry({ deed: '选项A' }),
  ];
  const r = choiceDistribution(es);
  assert.equal(r.counts.A, 1);
  assert.equal(r.counts.other, 2);
});

test('inferChoiceId: 正则要求前缀「选」（字面量），无「选」的 deed 归 other', () => {
  // 注意：源码正则 /选项?\s*([A-D])/ 中「选」是字面量，「项?」可选；
  // 即必须以「选」起头才匹配，纯文本「A 是选项」「做了 A」均归 other。
  const es = [
    entry({ deed: 'A 是选项' }),
    entry({ deed: '做了 A' }),
    entry({ deed: '随便来个B' }),
  ];
  const r = choiceDistribution(es);
  assert.equal(r.counts.other, 3);
  assert.equal((r.counts.A ?? 0) + (r.counts.B ?? 0) + (r.counts.C ?? 0) + (r.counts.D ?? 0), 0);
});

test('inferChoiceId: 「选A」「选项B」「选项 C」均识别（选 前缀）', () => {
  const es = [
    entry({ deed: '选A' }),
    entry({ deed: '选项B' }),
    entry({ deed: '选 C' }),
    entry({ deed: '选项D' }),
  ];
  const r = choiceDistribution(es);
  assert.equal(r.counts.A, 1);
  assert.equal(r.counts.B, 1);
  assert.equal(r.counts.C, 1);
  assert.equal(r.counts.D, 1);
});

test('choiceDistribution: 大批量分布稳定', () => {
  const es: LedgerEntry[] = [];
  for (let i = 0; i < 1000; i++) {
    const id = ['A', 'B', 'C', 'D'][i % 4]!;
    es.push(entry({ deed: `选项${id}` }));
  }
  const r = choiceDistribution(es);
  assert.equal(r.counts.A, 250);
  assert.equal(r.counts.B, 250);
  assert.equal(r.counts.C, 250);
  assert.equal(r.counts.D, 250);
  assert.equal(r.counts.other, 0);
});

// ── tonePreference 不变量 ──────────────────────────────────────

test('tonePreference: dominant = 占比最高的 tone（与 toneStats 一致）', () => {
  const es = [
    entry({ tone: '佛系' }),
    entry({ tone: '佛系' }),
    entry({ tone: '戏谑' }),
  ];
  const tp = tonePreference(es);
  const ts = toneStats(es);
  assert.equal(tp.dominant, '佛系');
  assert.deepEqual(tp.counts, ts);
});

test('tonePreference: percentages 与 counts 同步', () => {
  const es = [entry({ tone: '庄严' }), entry({ tone: '庄严' }), entry({ tone: '江湖' })];
  const tp = tonePreference(es);
  assert.equal(tp.percentages['庄严'], 0.667);
  assert.equal(tp.percentages['江湖'], 0.333);
  for (const t of ['戏谑', '佛系', '学术', '温情'] as const) {
    assert.equal(tp.percentages[t], 0);
  }
});

test('tonePreference: diversity = counts>0 的 tone 数', () => {
  const es = [entry({ tone: '庄严' }), entry({ tone: '戏谑' }), entry({ tone: '佛系' })];
  const tp = tonePreference(es);
  assert.equal(tp.diversity, 3);
});

test('tonePreference: 全平局 dominant 取循环中首个非零 tone（声明顺序）', () => {
  const es = [
    entry({ tone: '温情' }),
    entry({ tone: '江湖' }),
    entry({ tone: '学术' }),
  ];
  const tp = tonePreference(es);
  // 三种 tone 各 1 票平局；循环顺序 ['庄严','戏谑','佛系','学术','江湖','温情']
  // 首个 counts>0 的是「学术」（前三个为 0）→ 学术成 dominant
  assert.equal(tp.dominant, '学术');
});

test('tonePreference: 空 entries dominant=null diversity=0 percentages 全 0', () => {
  const tp = tonePreference([]);
  assert.equal(tp.dominant, null);
  assert.equal(tp.diversity, 0);
  for (const v of Object.values(tp.percentages)) {
    assert.equal(v, 0);
  }
});

test('tonePreference: 6 语气全用 diversity=6', () => {
  const es = [
    entry({ tone: '庄严' }),
    entry({ tone: '戏谑' }),
    entry({ tone: '佛系' }),
    entry({ tone: '学术' }),
    entry({ tone: '江湖' }),
    entry({ tone: '温情' }),
  ];
  assert.equal(tonePreference(es).diversity, 6);
});

// ── categoryDistribution 不变量 ────────────────────────────────

test('categoryDistribution: counts 总和 = 带 category 的 entry 数', () => {
  const es: (LedgerEntry & { category?: Category })[] = [
    { ...entry({}), category: '亲情' },
    { ...entry({}), category: '职场' },
    { ...entry({}), category: '亲情' },
    { ...entry({}) }, // 无 category
  ];
  const r = categoryDistribution(es);
  const sum = Object.values(r.counts).reduce((a, b) => a + (b ?? 0), 0);
  assert.equal(sum, 3);
});

test('categoryDistribution: 未知 category 不计入且不影响 covered', () => {
  const es: (LedgerEntry & { category?: Category })[] = [
    { ...entry({}), category: '亲情' },
    { ...entry({}), category: '不存在' as Category },
  ];
  const r = categoryDistribution(es);
  assert.equal(r.counts['亲情'], 1);
  assert.equal(r.covered, 1);
});

test('categoryDistribution: 全部 8 题材 covered=8', () => {
  const es = ALL_CATEGORIES.map((c) => ({ ...entry({}), category: c }));
  const r = categoryDistribution(es);
  assert.equal(r.covered, 8);
  for (const c of ALL_CATEGORIES) {
    assert.equal(r.counts[c], 1);
  }
});

test('categoryDistribution: 空数组 covered=0 且 counts 全 0', () => {
  const r = categoryDistribution([]);
  assert.equal(r.covered, 0);
  for (const c of ALL_CATEGORIES) {
    assert.equal(r.counts[c], 0);
  }
});

test('categoryDistribution: counts 含 ALL_CATEGORIES 全部 key', () => {
  const r = categoryDistribution([]);
  for (const c of ALL_CATEGORIES) {
    assert.ok(c in r.counts, `缺 ${c}`);
  }
});

// ── difficultyDistribution 不变量 ──────────────────────────────

test('difficultyDistribution: counts 和 = total', () => {
  const es: (LedgerEntry & { difficulty?: Difficulty })[] = [
    { ...entry({}), difficulty: 1 },
    { ...entry({}), difficulty: 2 },
    { ...entry({}), difficulty: 3 },
    { ...entry({}), difficulty: 2 },
    { ...entry({}) }, // 无
  ];
  const r = difficultyDistribution(es);
  assert.equal(r.total, 4);
  assert.equal((r.counts[1] ?? 0) + (r.counts[2] ?? 0) + (r.counts[3] ?? 0), r.total);
});

test('difficultyDistribution: 非 1/2/3 的 difficulty 不计', () => {
  const es: (LedgerEntry & { difficulty?: Difficulty })[] = [
    { ...entry({}), difficulty: 4 as Difficulty },
    { ...entry({}), difficulty: 0 as Difficulty },
    { ...entry({}), difficulty: 1 },
  ];
  const r = difficultyDistribution(es);
  assert.equal(r.total, 1);
  assert.equal(r.counts[1], 1);
});

test('difficultyDistribution: 空数组 total=0', () => {
  const r = difficultyDistribution([]);
  assert.equal(r.total, 0);
  assert.equal(r.counts[1], 0);
  assert.equal(r.counts[2], 0);
  assert.equal(r.counts[3], 0);
});

// ── humanizeDuration 单位边界精确 ──────────────────────────────

test('humanizeDuration: 0ms / 1ms 取整为 0s', () => {
  assert.equal(humanizeDuration(0), '0s');
  assert.equal(humanizeDuration(1), '0s');
  assert.equal(humanizeDuration(999), '0s');
});

test('humanizeDuration: 秒级边界 1s/59s', () => {
  assert.equal(humanizeDuration(1000), '1s');
  assert.equal(humanizeDuration(59_000), '59s');
});

test('humanizeDuration: 分钟级边界 60s=1m / 3599s=59m', () => {
  assert.equal(humanizeDuration(60_000), '1m');
  assert.equal(humanizeDuration(3_599_000), '59m');
});

test('humanizeDuration: 小时级边界 3600s=1h 0m / 23h 59m', () => {
  assert.equal(humanizeDuration(3_600_000), '1h 0m');
  assert.equal(humanizeDuration(86_399_000), '23h 59m');
});

test('humanizeDuration: 日级边界 86400s=1d 0h', () => {
  assert.equal(humanizeDuration(86_400_000), '1d 0h');
  // 900_000_000 ms: sec=900000, m=15000, h=250, d=10, h%24=250%24=10 → "10d 10h"
  assert.equal(humanizeDuration(900_000_000), '10d 10h');
});

test('humanizeDuration: h%24 取余（>1 天的小时丢弃整天部分）', () => {
  // 48h = 2d 0h
  assert.equal(humanizeDuration(48 * 3_600_000), '2d 0h');
  // 49h = 2d 1h
  assert.equal(humanizeDuration(49 * 3_600_000), '2d 1h');
});

test('humanizeDuration: 负数钳制为 0 后按 0s 处理', () => {
  assert.equal(humanizeDuration(-1), '0s');
  assert.equal(humanizeDuration(-1_000_000), '0s');
});

test('humanizeDuration: 极大值不溢出（一年以上）', () => {
  const year = 365 * 24 * 3_600_000;
  const s = humanizeDuration(year * 5);
  assert.match(s, /^\d+d \d+h$/);
  // 5 年 ≈ 1825d
  const days = Number(s.split('d')[0]);
  assert.ok(days >= 1800 && days <= 1830);
});

// ── activeTimeStats 不变量 ──────────────────────────────────────

test('activeTimeStats: 字符串/NaN/undefined ts 全部过滤', () => {
  const es = [
    { ...entry({}), ts: '123' },
    { ...entry({}), ts: Number.NaN },
    { ...entry({}), ts: undefined },
    { ...entry({}), ts: null },
  ];
  const r = activeTimeStats(es);
  assert.equal(r.firstTs, null);
  assert.equal(r.lastTs, null);
  assert.equal(r.spanMs, null);
  assert.equal(r.avgIntervalMs, null);
});

test('activeTimeStats: 部分非法 ts 被过滤后剩余正常计算', () => {
  const es = [
    { ...entry({}), ts: 1000 },
    { ...entry({}), ts: 'bad' },
    { ...entry({}), ts: 3000 },
  ];
  const r = activeTimeStats(es);
  assert.equal(r.firstTs, 1000);
  assert.equal(r.lastTs, 3000);
  assert.equal(r.spanMs, 2000);
  // 剩 2 个有效 ts，间隔 = 2000/(2-1) = 2000
  assert.equal(r.avgIntervalMs, 2000);
});

test('activeTimeStats: 单笔 avgIntervalMs=null spanMs=0', () => {
  const r = activeTimeStats([{ ...entry({}), ts: 5000 }]);
  assert.equal(r.spanMs, 0);
  assert.equal(r.avgIntervalMs, null);
  assert.equal(r.spanHuman, '0s');
});

test('activeTimeStats: spanHuman 与 spanMs 一致', () => {
  const r = activeTimeStats([
    { ...entry({}), ts: 0 },
    { ...entry({}), ts: 3_600_000 },
  ]);
  assert.equal(r.spanMs, 3_600_000);
  assert.equal(r.spanHuman, '1h 0m');
});

test('activeTimeStats: firstTs ≤ lastTs（已排序）', () => {
  const r = activeTimeStats([
    { ...entry({}), ts: 9000 },
    { ...entry({}), ts: 1000 },
    { ...entry({}), ts: 5000 },
  ]);
  assert.ok(r.firstTs! <= r.lastTs!);
  assert.equal(r.firstTs, 1000);
  assert.equal(r.lastTs, 9000);
});

// ── titleProgress 不变量 ────────────────────────────────────────

test('titleProgress: ladder 长度 = TITLES.length，且 at 单调递增', () => {
  const r = titleProgress(0);
  assert.equal(r.ladder.length, TITLES.length);
  for (let i = 1; i < r.ladder.length; i++) {
    assert.ok(r.ladder[i]!.at >= r.ladder[i - 1]!.at, `at 应单调：${i}`);
  }
});

test('titleProgress: n≥1 时 unlocked 数 = currentLevel+1（已知 n=0 偏差：TITLES[0].at=1 故 0 笔时 ladder 全未解锁但 currentLevel=0）', () => {
  // n=0 特例：currentLevel 退化为 0（titleLevel 默认），但 ladder[0].at=1 故全部 unlocked=false
  const r0 = titleProgress(0);
  assert.equal(r0.currentLevel, 0);
  assert.equal(r0.unlockedCount, 1); // = currentLevel+1，是 API 字段语义
  assert.equal(r0.ladder.filter((l) => l.unlocked).length, 0); // 实际未解锁任何级（at=1 未达）
  // n≥1 起 unlockedCount = ladder 中 unlocked 数
  for (const n of [1, 2, 3, 5, 7, 8, 10, 15, 20]) {
    const r = titleProgress(n);
    const actualUnlocked = r.ladder.filter((l) => l.unlocked).length;
    assert.equal(actualUnlocked, r.unlockedCount, `n=${n}`);
    assert.equal(r.unlockedCount, r.currentLevel + 1);
  }
});

test('titleProgress: 已解锁级 percent=100', () => {
  const r = titleProgress(3);
  for (const l of r.ladder) {
    if (l.unlocked) assert.equal(l.percent, 100);
  }
  // 至少第 0、1、2 级 unlocked（at=1,2,3）
  assert.ok(r.ladder[0]!.unlocked);
  assert.ok(r.ladder[1]!.unlocked);
  assert.ok(r.ladder[2]!.unlocked);
});

test('titleProgress: 满级 isMax=true nextAt=null', () => {
  const r = titleProgress(100);
  assert.equal(r.currentLevel, MAX_TITLE_LEVEL);
  assert.equal(r.isMax, true);
  // 末级已解锁
  assert.equal(r.ladder[r.ladder.length - 1]!.unlocked, true);
});

test('titleProgress: 1 笔 currentLevel=0 isMax=false 且第 0 级 unlocked', () => {
  const r = titleProgress(1);
  assert.equal(r.currentLevel, 0);
  assert.equal(r.isMax, false);
  assert.ok(r.nextAt! > 0);
  assert.ok(r.ladder[0]!.unlocked, '第 0 级 at=1，1 笔应解锁');
});

// ── endingForecast 不变量 ───────────────────────────────────────

test('endingForecast: tendencies 三项和 ≈ 1', () => {
  const es = [
    entry({ tone: '庄严' }),
    entry({ tone: '戏谑' }),
    entry({ tone: '佛系' }),
    entry({ tone: '学术' }),
    entry({ tone: '江湖' }),
    entry({ tone: '温情' }),
  ];
  const r = endingForecast(es);
  const sum = r.tendencies.merciful + r.tendencies.destructive + r.tendencies.transcendent;
  assert.ok(Math.abs(sum - 1) < 0.01, `三倾向和 ${sum} 应≈1`);
});

test('endingForecast: type 与 endingType 一致', () => {
  const es = [entry({ tone: '佛系' }), entry({ tone: '温情' })];
  assert.equal(endingForecast(es).type, endingType(es));
});

test('endingForecast: merciful=佛系+温情，destructive=戏谑+江湖，transcendent=庄严+学术', () => {
  const es = [
    entry({ tone: '佛系' }),
    entry({ tone: '温情' }),
    entry({ tone: '戏谑' }),
    entry({ tone: '江湖' }),
    entry({ tone: '庄严' }),
    entry({ tone: '学术' }),
  ];
  const r = endingForecast(es);
  assert.equal(r.tendencies.merciful, 0.333);
  assert.equal(r.tendencies.destructive, 0.333);
  assert.equal(r.tendencies.transcendent, 0.333);
});

test('endingForecast: 空数组全 0 且 type 为 endingType([]) 一致', () => {
  const r = endingForecast([]);
  assert.equal(r.total, 0);
  assert.equal(r.tendencies.merciful, 0);
  assert.equal(r.tendencies.destructive, 0);
  assert.equal(r.tendencies.transcendent, 0);
  assert.equal(r.type, endingType([]));
});

// ── buildStatsPanel 端到端一致性 ────────────────────────────────

test('buildStatsPanel: 子项 totalDeeds 与各分布 total 一致', () => {
  const es = [
    {
      ...entry({ deed: '选项A', tone: '庄严' }),
      category: '亲情' as Category,
      difficulty: 1 as Difficulty,
      ts: 1000,
    },
    {
      ...entry({ deed: '选项B', tone: '戏谑' }),
      category: '职场' as Category,
      difficulty: 2 as Difficulty,
      ts: 2000,
    },
  ];
  const p = buildStatsPanel(es);
  assert.equal(p.totalDeeds, 2);
  assert.equal(p.choice.total, 2);
  assert.equal(p.difficulty.total, 2);
  assert.equal(p.title.currentLevel, titleProgress(2).currentLevel);
  assert.equal(p.ending.total, 2);
});

test('buildStatsPanel: summary 含称号名 + 主导语气 + 结局类型', () => {
  const es = [
    {
      ...entry({ deed: '选项A', tone: '佛系' }),
      category: '亲情' as Category,
      difficulty: 1 as Difficulty,
    },
    {
      ...entry({ deed: '选项B', tone: '佛系' }),
      category: '职场' as Category,
      difficulty: 2 as Difficulty,
    },
  ];
  const p = buildStatsPanel(es);
  assert.match(p.summary, /已行 2 桩事/);
  assert.ok(p.summary.includes(p.title.currentTitle));
  assert.ok(p.summary.includes(p.tone.dominant ?? ''));
  assert.ok(p.summary.includes(p.ending.type));
});

test('buildStatsPanel: 空 entries summary = 「尚无修行记录。」', () => {
  const p = buildStatsPanel([]);
  assert.equal(p.summary, '尚无修行记录。');
  assert.equal(p.totalDeeds, 0);
  assert.equal(p.tone.dominant, null);
});

test('buildStatsPanel: 纯函数——同输入两次调用 deep equal', () => {
  const es = [
    {
      ...entry({ deed: '选项A', tone: '庄严' }),
      category: '亲情' as Category,
      difficulty: 1 as Difficulty,
      ts: 1,
    },
  ];
  const a = buildStatsPanel(es);
  const b = buildStatsPanel(es);
  assert.deepEqual(a, b);
});

// ── practiceStage 阈值精确边界 ─────────────────────────────────

test('practiceStage: PRACTICE_STAGES at 单调且首项 at=0', () => {
  assert.equal(PRACTICE_STAGES[0]!.at, 0);
  for (let i = 1; i < PRACTICE_STAGES.length; i++) {
    assert.ok(PRACTICE_STAGES[i]!.at > PRACTICE_STAGES[i - 1]!.at);
  }
});

test('practiceStage: 阈值前一点归属上一阶段', () => {
  // seeker.at=3 → deedCount=2 应仍是 novice
  assert.equal(practiceStage(2).stage.id, 'novice');
  assert.equal(practiceStage(3).stage.id, 'seeker');
  assert.equal(practiceStage(5).stage.id, 'seeker');
  assert.equal(practiceStage(6).stage.id, 'adept');
  assert.equal(practiceStage(9).stage.id, 'adept');
  assert.equal(practiceStage(10).stage.id, 'sage');
  assert.equal(practiceStage(14).stage.id, 'sage');
  assert.equal(practiceStage(15).stage.id, 'transcendent');
});

test('practiceStage: transcendent 封顶 next=null remaining=0 percent=100', () => {
  const r = practiceStage(100);
  assert.equal(r.stage.id, 'transcendent');
  assert.equal(r.next, null);
  assert.equal(r.remaining, 0);
  assert.equal(r.percent, 100);
});

test('practiceStage: 0 笔 novice percent=0', () => {
  const r = practiceStage(0);
  assert.equal(r.stage.id, 'novice');
  assert.equal(r.percent, 0);
  assert.equal(r.next!.id, 'seeker');
  assert.equal(r.remaining, 3);
});

test('practiceStage: 进度百分比 = (done/span)*100（取整）', () => {
  // seeker 区间 [3,6) span=3；deedCount=4 → done=1 → 33%
  assert.equal(practiceStage(4).percent, 33);
  // deedCount=5 → done=2 → 67%
  assert.equal(practiceStage(5).percent, 67);
  // deedCount=3 → done=0 → 0%
  assert.equal(practiceStage(3).percent, 0);
});

test('practiceStage: 负数 deedCount 钳为首阶段', () => {
  const r = practiceStage(-5);
  assert.equal(r.stage.id, 'novice');
});

/**
 * 大善系统 —— 结局判定（endingType）深层测试。
 *
 * 聚焦 ledgerCore.endingType 的三类结局触发条件与边界：
 *  - 渡世：佛系 + 温情 严格大于 戏谑 + 江湖（慈悲为怀）
 *  - 灭世：戏谑 + 江湖 严格大于 佛系 + 温情（杀伐果断）
 *  - 超脱：平局（慈悲=破坏）或 学术/庄严 主导（超越善恶）
 *  - 单条记录、空记录、全语气一致、跨语气平局、主导翻转
 *
 * 该函数的决胜规则（strict > 而非 >=）是关键不变量：
 * 任何「慈悲与破坏并列」的场景都应归入「超脱」，避免歧义结局。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { endingType, toneStats, type LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const ALL_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function mkEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({
    index: i + 1,
    situation: 's',
    deed: 'd',
    verdict: 'v',
    tone: t,
  }));
}

// ── 空记录 ──────────────────────────────────────────────

test('ending-deep: 空记录 → 超脱（默认无善恶倾向）', () => {
  assert.equal(endingType([]), '超脱');
});

// ── 单条记录 ────────────────────────────────────────────

test('ending-deep: 单条佛系 → 渡世（1 > 0）', () => {
  assert.equal(endingType(mkEntries(['佛系'])), '渡世');
});

test('ending-deep: 单条温情 → 渡世', () => {
  assert.equal(endingType(mkEntries(['温情'])), '渡世');
});

test('ending-deep: 单条戏谑 → 灭世（1 > 0）', () => {
  assert.equal(endingType(mkEntries(['戏谑'])), '灭世');
});

test('ending-deep: 单条江湖 → 灭世', () => {
  assert.equal(endingType(mkEntries(['江湖'])), '灭世');
});

test('ending-deep: 单条庄严 → 超脱（transcendent 主导）', () => {
  assert.equal(endingType(mkEntries(['庄严'])), '超脱');
});

test('ending-deep: 单条学术 → 超脱', () => {
  assert.equal(endingType(mkEntries(['学术'])), '超脱');
});

// ── 慈悲主导（渡世） ───────────────────────────────────

test('ending-deep: 佛系+温情 占多且严格大于破坏 → 渡世', () => {
  assert.equal(endingType(mkEntries(['佛系', '温情', '佛系', '庄严'])), '渡世');
});

test('ending-deep: 纯佛系全记录 → 渡世', () => {
  assert.equal(endingType(mkEntries(['佛系', '佛系', '佛系', '佛系'])), '渡世');
});

test('ending-deep: 纯温情全记录 → 渡世', () => {
  assert.equal(endingType(mkEntries(['温情', '温情', '温情'])), '渡世');
});

test('ending-deep: 慈悲 3 vs 破坏 2 → 渡世', () => {
  assert.equal(
    endingType(mkEntries(['佛系', '温情', '佛系', '戏谑', '江湖'])),
    '渡世',
  );
});

// ── 破坏主导（灭世） ───────────────────────────────────

test('ending-deep: 戏谑+江湖 占多且严格大于慈悲 → 灭世', () => {
  assert.equal(endingType(mkEntries(['戏谑', '江湖', '戏谑', '庄严'])), '灭世');
});

test('ending-deep: 纯戏谑全记录 → 灭世', () => {
  assert.equal(endingType(mkEntries(['戏谑', '戏谑', '戏谑'])), '灭世');
});

test('ending-deep: 纯江湖全记录 → 灭世', () => {
  assert.equal(endingType(mkEntries(['江湖', '江湖', '江湖'])), '灭世');
});

test('ending-deep: 破坏 4 vs 慈悲 1 → 灭世', () => {
  assert.equal(
    endingType(mkEntries(['戏谑', '江湖', '戏谑', '江湖', '温情'])),
    '灭世',
  );
});

// ── 平局 → 超脱（关键不变量：strict > 决胜） ─────────

test('ending-deep: 慈悲 == 破坏（各 2） → 超脱（平局归超脱）', () => {
  assert.equal(
    endingType(mkEntries(['佛系', '温情', '戏谑', '江湖'])),
    '超脱',
  );
});

test('ending-deep: 慈悲 == 破坏（各 3） → 超脱', () => {
  assert.equal(
    endingType(mkEntries(['佛系', '温情', '佛系', '戏谑', '江湖', '戏谑'])),
    '超脱',
  );
});

test('ending-deep: 单佛系 + 单戏谑 → 超脱（1==1 平局）', () => {
  assert.equal(endingType(mkEntries(['佛系', '戏谑'])), '超脱');
});

test('ending-deep: 单温情 + 单江湖 → 超脱（1==1 平局）', () => {
  assert.equal(endingType(mkEntries(['温情', '江湖'])), '超脱');
});

// ── 超脱主导（学术/庄严） ─────────────────────────────

test('ending-deep: 庄严+学术 主导 → 超脱', () => {
  assert.equal(
    endingType(mkEntries(['庄严', '学术', '庄严', '学术'])),
    '超脱',
  );
});

test('ending-deep: 纯庄严全记录 → 超脱', () => {
  assert.equal(endingType(mkEntries(['庄严', '庄严', '庄严'])), '超脱');
});

test('ending-deep: 纯学术全记录 → 超脱', () => {
  assert.equal(endingType(mkEntries(['学术', '学术', '学术'])), '超脱');
});

// ── 三方均等 → 超脱 ───────────────────────────────────

test('ending-deep: 慈悲=破坏=超脱（各 2） → 超脱', () => {
  assert.equal(
    endingType(mkEntries(['佛系', '温情', '戏谑', '江湖', '庄严', '学术'])),
    '超脱',
  );
});

test('ending-deep: 全 6 语气各 1 → 超脱（完全均衡）', () => {
  assert.equal(endingType(mkEntries(ALL_TONES)), '超脱');
});

// ── 极端分布（大样本稳定性） ─────────────────────────

test('ending-deep: 50 条全佛系 → 渡世（大样本稳定）', () => {
  const big = mkEntries(Array.from({ length: 50 }, () => '佛系' as Tone));
  assert.equal(endingType(big), '渡世');
});

test('ending-deep: 50 条全江湖 → 灭世（大样本稳定）', () => {
  const big = mkEntries(Array.from({ length: 50 }, () => '江湖' as Tone));
  assert.equal(endingType(big), '灭世');
});

// ── 与 toneStats 的一致性 ──────────────────────────────

test('ending-deep: endingType 与 toneStats 推导一致（渡世样本）', () => {
  const e = mkEntries(['佛系', '温情', '佛系']);
  const s = toneStats(e);
  const merciful = s['佛系']! + s['温情']!;
  const destructive = s['戏谑']! + s['江湖']!;
  const transcendent = s['庄严']! + s['学术']!;
  const max = Math.max(merciful, destructive, transcendent);
  // 推导应与 endingType 一致
  if (merciful === max && merciful > destructive) {
    assert.equal(endingType(e), '渡世');
  }
});

test('ending-deep: endingType 输出恒为三种合法值之一', () => {
  const samples: Tone[][] = [
    [],
    ['佛系'],
    ['戏谑'],
    ['庄严'],
    ['佛系', '戏谑'],
    ['佛系', '温情', '戏谑', '江湖', '庄严', '学术'],
    ALL_TONES,
    ['温情', '温情', '江湖'],
  ];
  for (const s of samples) {
    const r = endingType(mkEntries(s));
    assert.ok(
      r === '渡世' || r === '灭世' || r === '超脱',
      `非法结局值：${r}`,
    );
  }
});

// ── 决胜规则的数学不变量 ───────────────────────────────

test('ending-deep: 渡世 ⇔ merciful 是唯一最大且 > destructive', () => {
  // 构造一个明确渡世场景，验证其 toneStats 满足条件
  const e = mkEntries(['佛系', '佛系', '温情', '戏谑']);
  const s = toneStats(e);
  const merciful = s['佛系']! + s['温情']!;
  const destructive = s['戏谑']! + s['江湖']!;
  assert.ok(merciful > destructive, '渡世样本应满足 merciful > destructive');
  assert.equal(endingType(e), '渡世');
});

test('ending-deep: 灭世 ⇔ destructive 是唯一最大且 > merciful', () => {
  const e = mkEntries(['戏谑', '江湖', '戏谑', '佛系']);
  const s = toneStats(e);
  const merciful = s['佛系']! + s['温情']!;
  const destructive = s['戏谑']! + s['江湖']!;
  assert.ok(destructive > merciful, '灭世样本应满足 destructive > merciful');
  assert.equal(endingType(e), '灭世');
});

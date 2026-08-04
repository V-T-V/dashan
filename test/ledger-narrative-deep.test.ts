/**
 * 大善系统 —— dominantTone 与 endingNarrative（新功能）测试。
 *
 * 新增功能（round D6）：
 *  - dominantTone：纯函数，取占比最高语气，平局按声明顺序确定性决胜
 *  - endingNarrative：丰富结局叙述（多行文案 + 隐藏结局「辩经尊者」）
 *
 * 覆盖：
 *  - dominantTone：空记录返回 null / 单一主导 / 平局按声明顺序 / 全语气一致
 *  - endingNarrative：三结局叙述文案 / 隐藏结局触发条件 / 字段完整性
 *  - 与 endingType / isMaxTitle 的一致性
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dominantTone,
  endingNarrative,
  endingType,
  isMaxTitle,
  TITLES,
  type LedgerEntry,
} from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const ORDER: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function mkEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({
    index: i + 1,
    situation: 's',
    deed: 'd',
    verdict: 'v',
    tone: t,
  }));
}

// ── dominantTone 基础 ──────────────────────────────────

test('dominantTone: 空记录返回 null', () => {
  assert.equal(dominantTone([]), null);
});

test('dominantTone: 单条记录返回该语气', () => {
  for (const t of ORDER) {
    assert.equal(dominantTone(mkEntries([t])), t);
  }
});

test('dominantTone: 明确主导语气', () => {
  // 佛系 3 vs 其他各 1 → 佛系
  assert.equal(
    dominantTone(mkEntries(['佛系', '佛系', '佛系', '庄严', '戏谑'])),
    '佛系',
  );
});

test('dominantTone: 与 toneStats 一致（最大计数的语气）', () => {
  const e = mkEntries(['江湖', '江湖', '庄严', '学术', '江湖']);
  // 江湖 3 次最多
  assert.equal(dominantTone(e), '江湖');
});

// ── dominantTone 平局确定性 ────────────────────────────

test('dominantTone: 平局按声明顺序取先者（庄严 > 戏谑 > ... > 温情）', () => {
  // 庄严 1 == 戏谑 1 → 取庄严（声明在前）
  assert.equal(dominantTone(mkEntries(['庄严', '戏谑'])), '庄严');
  // 戏谑 1 == 佛系 1 → 取戏谑
  assert.equal(dominantTone(mkEntries(['戏谑', '佛系'])), '戏谑');
  // 佛系 1 == 学术 1 → 取佛系
  assert.equal(dominantTone(mkEntries(['佛系', '学术'])), '佛系');
});

test('dominantTone: 全 6 语气各 1 → 取庄严（声明首）', () => {
  assert.equal(dominantTone(mkEntries(ORDER)), '庄严');
});

test('dominantTone: 确定性（同输入同输出）', () => {
  const e = mkEntries(['佛系', '戏谑', '佛系', '江湖']);
  const a = dominantTone(e);
  const b = dominantTone([...e]);
  assert.equal(a, b);
});

test('dominantTone: 返回值恒为合法 Tone 或 null', () => {
  const samples: Tone[][] = [[], ['庄严'], ORDER, ['佛系', '戏谑']];
  for (const s of samples) {
    const r = dominantTone(mkEntries(s));
    assert.ok(r === null || (ORDER as (Tone | null)[]).includes(r), `非法返回：${r}`);
  }
});

// ── endingNarrative 基础结构 ───────────────────────────

test('narrative: 返回对象含 type/title/tone/narrative 四字段', () => {
  const r = endingNarrative(mkEntries(['佛系']));
  assert.ok('type' in r);
  assert.ok('title' in r);
  assert.ok('tone' in r);
  assert.ok('narrative' in r);
});

test('narrative: narrative 为多行字符串（含 \\n）', () => {
  const r = endingNarrative(mkEntries(['佛系']));
  assert.ok(r.narrative.includes('\n'), '叙述应多行');
  assert.ok(r.narrative.length > 20);
});

test('narrative: 空记录 type=超脱 tone=null', () => {
  const r = endingNarrative([]);
  assert.equal(r.type, '超脱');
  assert.equal(r.tone, null);
});

test('narrative: title 与 titleLevel(count) 对应的 TITLES 一致', () => {
  // count=10 → 满级
  const r = endingNarrative(mkEntries(['庄严']), 10);
  assert.equal(r.title, TITLES[TITLES.length - 1]!.name);
});

// ── endingNarrative 三结局 ─────────────────────────────

test('narrative: 佛系主导 → 渡世叙述含「慈悲」', () => {
  const r = endingNarrative(mkEntries(['佛系', '温情', '佛系']));
  assert.equal(r.type, '渡世');
  assert.ok(r.narrative.includes('慈悲'), '渡世叙述应提慈悲');
});

test('narrative: 戏谑主导 → 灭世叙述含「杀伐」', () => {
  const r = endingNarrative(mkEntries(['戏谑', '江湖', '戏谑']));
  assert.equal(r.type, '灭世');
  assert.ok(r.narrative.includes('杀伐'), '灭世叙述应提杀伐');
});

test('narrative: 庄严主导 → 超脱叙述含「超越」', () => {
  const r = endingNarrative(mkEntries(['庄严', '学术']));
  assert.equal(r.type, '超脱');
  assert.ok(r.narrative.includes('超越'), '超脱叙述应提超越');
});

// ── 隐藏结局：辩经尊者 ─────────────────────────────────

test('narrative: 隐藏结局「辩经尊者」触发 = 满级 + 主导学术', () => {
  // 满 10 笔全学术 → 满级 + 主导学术
  const e = mkEntries(Array.from({ length: 10 }, () => '学术' as Tone));
  const r = endingNarrative(e);
  assert.equal(r.type, '辩经尊者');
  assert.equal(r.tone, '学术');
  assert.ok(r.narrative.includes('辩经尊者'));
});

test('narrative: 满级但主导非学术 → 不触发隐藏结局', () => {
  // 满 10 笔全佛系 → 满级 + 主导佛系 → 渡世（非隐藏）
  const e = mkEntries(Array.from({ length: 10 }, () => '佛系' as Tone));
  const r = endingNarrative(e);
  assert.equal(r.type, '渡世');
  assert.notEqual(r.type, '辩经尊者');
});

test('narrative: 主导学术但未满级 → 不触发隐藏结局', () => {
  // 3 笔全学术，未满级
  const e = mkEntries(['学术', '学术', '学术']);
  const r = endingNarrative(e);
  assert.notEqual(r.type, '辩经尊者');
  // 学术主导且无慈悲/破坏 → 超脱
  assert.equal(r.type, '超脱');
});

test('narrative: 隐藏结局触发条件精确（isMaxTitle && tone===学术）', () => {
  for (let c = 0; c <= 12; c++) {
    const e = mkEntries(Array.from({ length: c }, () => '学术' as Tone));
    const r = endingNarrative(e);
    const shouldHide = isMaxTitle(c);
    assert.equal(
      r.type === '辩经尊者',
      shouldHide,
      `count=${c} 隐藏结局触发应为 ${shouldHide}`,
    );
  }
});

// ── endingNarrative 与 endingType 一致性（非隐藏时） ──

test('narrative: 非隐藏时 type 与 endingType 一致', () => {
  const samples: Tone[][] = [
    ['佛系'],
    ['戏谑', '江湖'],
    ['庄严', '学术'],
    ['佛系', '戏谑'], // 平局 → 超脱
  ];
  for (const s of samples) {
    const e = mkEntries(s);
    const r = endingNarrative(e);
    if (r.type !== '辩经尊者') {
      assert.equal(r.type, endingType(e), `样本 ${s} type 不一致`);
    }
  }
});

// ── count 参数独立性 ───────────────────────────────────

test('narrative: count 参数可独立于 entries.length（存档恢复场景）', () => {
  // entries 只有 1 条，但 count=10 → title 应是满级
  const r = endingNarrative(mkEntries(['学术']), 10);
  assert.equal(r.title, TITLES[TITLES.length - 1]!.name);
  // 隐藏结局触发：满级 + 学术
  assert.equal(r.type, '辩经尊者');
});

test('narrative: 不传 count 时用 entries.length', () => {
  const e = mkEntries(['佛系', '佛系']);
  const r = endingNarrative(e);
  // count=2 → 怀善之人
  assert.equal(r.title, '怀善之人');
});

// ── narrative 文案质量 ─────────────────────────────────

test('narrative: 每种结局的叙述文案非空且 ≥ 30 字', () => {
  const cases: { tones: Tone[]; count?: number }[] = [
    { tones: ['佛系', '温情'] }, // 渡世
    { tones: ['戏谑', '江湖'] }, // 灭世
    { tones: ['庄严', '学术'] }, // 超脱
    { tones: Array.from({ length: 10 }, () => '学术' as Tone) }, // 辩经尊者
  ];
  for (const c of cases) {
    const r = endingNarrative(mkEntries(c.tones), c.count);
    assert.ok(r.narrative.length >= 30, `${r.type} 叙述过短：${r.narrative.length}`);
  }
});

test('narrative: 叙述含结局标识【结局 · X】', () => {
  const r = endingNarrative(mkEntries(['佛系']));
  assert.ok(r.narrative.includes('【结局'), '叙述应含结局标识');
});

test('narrative: 叙述含「当前境界」与「主导语气」标签', () => {
  const r = endingNarrative(mkEntries(['佛系']));
  assert.ok(r.narrative.includes('当前境界'), '应含当前境界标签');
  assert.ok(r.narrative.includes('主导语气'), '应含主导语气标签');
});

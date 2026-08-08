/**
 * R10-D6: 新隐藏结局「执剑尊者」深层测试。
 *
 * 新功能：满级 + 主导江湖 → 触发「执剑尊者」（与既有「辩经尊者」满级+学术 对称）。
 * 学术用「脑」解构善恶，江湖用「刀」贯彻善恶，走到尽头落进同一讽喻。
 *
 * 覆盖：
 *  1. 触发条件精确（满级 + 主导江湖 → 执剑尊者）
 *  2. 未满级不触发（仍是基础灭世）
 *  3. 满级但主导非江湖/学术不触发（仍基础结局）
 *  4. 满级 + 主导学术 → 辩经尊者（既有功能不回归）
 *  5. 满级 + 主导戏谑（属破坏阵营但非江湖）→ 灭世（不触发执剑）
 *  6. 平局决胜：江湖与学术同票时，按声明顺序学术在前 → 辩经尊者（非执剑）
 *  7. count 参数可独立于 entries.length（存档恢复场景）
 *  8. 执剑尊者叙述含结局标识/境界/主导语气/评语关键词
 *  9. 两个隐藏结局互斥（同一存档只能触发其一）
 * 10. type 字段类型联合正确（EndingType | 辩经尊者 | 执剑尊者）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  endingNarrative,
  endingType,
  isMaxTitle,
  TITLES,
  titleLevel,
  type LedgerEntry,
} from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const MAX_AT = TITLES[TITLES.length - 1]!.at; // 10

function mkEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({
    index: i + 1,
    situation: `情境${i + 1}`,
    deed: `抉择${i + 1}`,
    verdict: `判词${i + 1}`,
    tone: t,
  }));
}

/** 造 n 笔全某语气的满级记录。 */
function maxEntries(tone: Tone, n = MAX_AT): LedgerEntry[] {
  return mkEntries(Array.from({ length: n }, () => tone));
}

// ── 触发条件精确 ───────────────────────────────────────

test('执剑尊者: 满级 + 主导江湖 → type 为「执剑尊者」', () => {
  const e = maxEntries('江湖');
  const r = endingNarrative(e);
  assert.equal(isMaxTitle(e.length), true);
  assert.equal(r.tone, '江湖');
  assert.equal(r.type, '执剑尊者');
});

test('执剑尊者: 满级 + 主导江湖 → narrative 含「执剑尊者」标识', () => {
  const r = endingNarrative(maxEntries('江湖'));
  assert.ok(r.narrative.includes('执剑尊者'));
  assert.ok(r.narrative.includes('【结局 · 执剑尊者】'));
});

test('执剑尊者: narrative 含评语关键词（侠/刀/闭环）', () => {
  const r = endingNarrative(maxEntries('江湖'));
  assert.ok(r.narrative.includes('侠'));
  assert.ok(r.narrative.includes('刀'));
  assert.ok(r.narrative.includes('闭环'));
});

test('执剑尊者: narrative 含当前境界与主导语气标签', () => {
  const r = endingNarrative(maxEntries('江湖'));
  assert.ok(r.narrative.includes('当前境界：'));
  assert.ok(r.narrative.includes('主导语气：江湖'));
});

test('执剑尊者: title 为最高称号名', () => {
  const r = endingNarrative(maxEntries('江湖'));
  assert.equal(r.title, TITLES[TITLES.length - 1]!.name);
});

// ── 未触发分支 ─────────────────────────────────────────

test('执剑尊者: 未满级（9 笔）+ 主导江湖 → 不触发（基础灭世）', () => {
  const e = maxEntries('江湖', MAX_AT - 1); // 9 笔，未满级
  const r = endingNarrative(e);
  assert.equal(isMaxTitle(e.length), false);
  assert.equal(r.type, '灭世'); // 江湖属破坏阵营
  assert.notEqual(r.type, '执剑尊者');
});

test('执剑尊者: 满级 + 主导佛系 → 渡世（不触发执剑）', () => {
  const r = endingNarrative(maxEntries('佛系'));
  assert.equal(r.type, '渡世');
  assert.notEqual(r.type, '执剑尊者');
});

test('执剑尊者: 满级 + 主导温情 → 渡世（不触发执剑）', () => {
  const r = endingNarrative(maxEntries('温情'));
  assert.equal(r.type, '渡世');
});

test('执剑尊者: 满级 + 主导庄严 → 超脱（不触发任何隐藏）', () => {
  const r = endingNarrative(maxEntries('庄严'));
  assert.equal(r.type, '超脱');
  assert.notEqual(r.type, '执剑尊者');
  assert.notEqual(r.type, '辩经尊者');
});

test('执剑尊者: 满级 + 主导戏谑 → 灭世（戏谑属破坏但非江湖，不触发执剑）', () => {
  const r = endingNarrative(maxEntries('戏谑'));
  assert.equal(r.type, '灭世');
  assert.notEqual(r.type, '执剑尊者');
});

// ── 既有辩经尊者不回归 ─────────────────────────────────

test('执剑尊者: 满级 + 主导学术 → 仍触发「辩经尊者」（既有功能保留）', () => {
  const r = endingNarrative(maxEntries('学术'));
  assert.equal(r.type, '辩经尊者');
  assert.notEqual(r.type, '执剑尊者');
});

// ── 平局决胜 ──────────────────────────────────────────

test('执剑尊者: 江湖与学术同票时 → 辩经尊者（学术声明顺序在前）', () => {
  // 5 江湖 + 5 学术 = 满级 10，平局。学术声明顺序在江湖前 → 辩经尊者
  const tones: Tone[] = [];
  for (let i = 0; i < 5; i++) tones.push('江湖');
  for (let i = 0; i < 5; i++) tones.push('学术');
  const e = mkEntries(tones);
  const r = endingNarrative(e);
  assert.equal(r.type, '辩经尊者');
});

test('执剑尊者: 江湖多于学术 → 执剑尊者（江湖主导）', () => {
  // 6 江湖 + 4 学术 → 江湖主导 → 执剑尊者
  const tones: Tone[] = [];
  for (let i = 0; i < 6; i++) tones.push('江湖');
  for (let i = 0; i < 4; i++) tones.push('学术');
  const r = endingNarrative(mkEntries(tones));
  assert.equal(r.type, '执剑尊者');
});

test('执剑尊者: 学术多于江湖 → 辩经尊者（学术主导）', () => {
  const tones: Tone[] = [];
  for (let i = 0; i < 4; i++) tones.push('江湖');
  for (let i = 0; i < 6; i++) tones.push('学术');
  const r = endingNarrative(mkEntries(tones));
  assert.equal(r.type, '辩经尊者');
});

// ── count 参数独立 ─────────────────────────────────────

test('执剑尊者: count 参数独立于 entries.length（存档恢复）', () => {
  // entries 只有 1 笔江湖，但 count 传 10（满级）→ 应触发执剑尊者
  const e = mkEntries(['江湖']);
  const r = endingNarrative(e, MAX_AT);
  assert.equal(r.type, '执剑尊者');
});

test('执剑尊者: count 传 0 即使 entries 满江湖也不触发（未满级）', () => {
  const e = maxEntries('江湖');
  const r = endingNarrative(e, 0);
  assert.notEqual(r.type, '执剑尊者');
});

// ── 两隐藏结局互斥 ────────────────────────────────────

test('执剑尊者: 同一存档不可能同时是执剑与辩经', () => {
  // 任一存档的 type 恒为五种之一，且执剑与辩经互斥
  for (const tone of ['江湖', '学术', '佛系', '戏谑', '庄严', '温情'] as Tone[]) {
    const r = endingNarrative(maxEntries(tone));
    const isRogue = r.type === '执剑尊者';
    const isDebater = r.type === '辩经尊者';
    assert.ok(!(isRogue && isDebater), `${tone} 同时触发两隐藏结局`);
  }
});

// ── type 类型联合 ──────────────────────────────────────

test('执剑尊者: type 字段恒为 5 种合法值之一', () => {
  const valid = ['渡世', '灭世', '超脱', '辩经尊者', '执剑尊者'];
  for (const tone of ['江湖', '学术', '佛系', '戏谑', '庄严', '温情'] as Tone[]) {
    const r = endingNarrative(maxEntries(tone));
    assert.ok(valid.includes(r.type), `非法 type=${r.type}`);
  }
});

// ── 确定性 ─────────────────────────────────────────────

test('执剑尊者: 确定性（同输入两次 deep equal）', () => {
  const e = maxEntries('江湖');
  assert.deepEqual(endingNarrative(e), endingNarrative(e));
});

// ── 与基础结局的对照 ───────────────────────────────────

test('执剑尊者: 江湖主导时 baseType=灭世，但隐藏结局覆盖为执剑尊者', () => {
  const e = maxEntries('江湖');
  assert.equal(endingType(e), '灭世'); // 基础结局是灭世
  assert.equal(endingNarrative(e).type, '执剑尊者'); // 但隐藏结局覆盖
});

test('执剑尊者: 非满级时 endingNarrative.type == endingType（无隐藏覆盖）', () => {
  const e = maxEntries('江湖', MAX_AT - 1); // 9 笔未满级
  assert.equal(endingNarrative(e).type, endingType(e));
});

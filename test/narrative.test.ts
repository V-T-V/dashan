/**
 * R13-D4（dashan）：善恶簿叙事生成器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateNarrative, extractMilestones } from '../shared/narrative.ts';
import type { LedgerEntry, Tone } from '../shared/types.ts';

function entry(index: number, deed: string, tone: Tone): LedgerEntry {
  return { index, situation: `情境${index}`, deed, verdict: `夸赞${index}`, tone };
}

function makeEntries(n: number, tones?: Tone[]): LedgerEntry[] {
  const allTones: Tone[] = tones ?? ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  return Array.from({ length: n }, (_, i) =>
    entry(i + 1, `选择${i + 1}`, allTones[i % allTones.length]!),
  );
}

describe('generateNarrative', () => {
  test('空序列 → 提示未启程', () => {
    const r = generateNarrative([]);
    assert.match(r.text, /尚未启程|等待/);
    assert.equal(r.tone, '平淡');
    assert.equal(r.milestones.length, 0);
  });

  test('有记录 → 含抉择数', () => {
    const r = generateNarrative(makeEntries(5));
    assert.match(r.text, /5/);
    assert.ok(r.wordCount > 0);
  });

  test('多样语气（≥4种）→ 励志基调', () => {
    const r = generateNarrative(makeEntries(12)); // 6 种语气循环
    assert.equal(r.tone, '励志');
  });

  test('单一语气（≥5条）→ 反思基调', () => {
    const r = generateNarrative(makeEntries(6, ['庄严'])); // 全庄严
    assert.equal(r.tone, '反思');
    assert.match(r.text, /始终如一/);
  });

  test('20+ 条 → 含"善行已成习惯"', () => {
    const r = generateNarrative(makeEntries(25));
    assert.match(r.text, /习惯|同行/);
  });

  test('5~19 条 → 含"继续前行"', () => {
    const r = generateNarrative(makeEntries(8));
    assert.match(r.text, /继续前行|解锁/);
  });

  test('1~4 条 → 含"这只是开始"', () => {
    const r = generateNarrative(makeEntries(2));
    assert.match(r.text, /开始/);
  });

  test('输出结构稳定', () => {
    const r = generateNarrative(makeEntries(10));
    assert.ok(typeof r.text === 'string' && r.text.length > 0);
    assert.ok(['励志', '反思', '平淡'].includes(r.tone));
    assert.ok(Array.isArray(r.milestones));
    assert.ok(typeof r.wordCount === 'number');
  });
});

describe('extractMilestones', () => {
  test('空 → 空', () => {
    assert.deepEqual(extractMilestones([]), []);
  });

  test('首条记录里程碑', () => {
    const ms = extractMilestones(makeEntries(1));
    assert.ok(ms.some((m) => m.includes('第 1 桩') && m.includes('选择1')));
  });

  test('10 条 → 含"十全十美"', () => {
    const ms = extractMilestones(makeEntries(10));
    assert.ok(ms.some((m) => m.includes('十全十美')));
  });

  test('50 条 → 含"半百"', () => {
    const ms = extractMilestones(makeEntries(50));
    assert.ok(ms.some((m) => m.includes('半百')));
  });

  test('100 条 → 含"百倍"', () => {
    const ms = extractMilestones(makeEntries(100));
    assert.ok(ms.some((m) => m.includes('百倍') || m.includes('圆满')));
  });

  test('连续 3+ 同语气 → 含"连续"', () => {
    const ms = extractMilestones(makeEntries(5, ['温情', '温情', '温情', '温情', '温情']));
    assert.ok(ms.some((m) => m.includes('连续') && m.includes('温情')));
  });

  test('集齐 4 种语气 → 含"多姿"', () => {
    const ms = extractMilestones([
      entry(1, 'a', '庄严'),
      entry(2, 'b', '戏谑'),
      entry(3, 'c', '佛系'),
      entry(4, 'd', '学术'),
    ]);
    assert.ok(ms.some((m) => m.includes('多姿')));
  });

  test('里程碑文本均为非空字符串', () => {
    const ms = extractMilestones(makeEntries(15));
    for (const m of ms) assert.ok(typeof m === 'string' && m.length > 0);
  });

  test('milestones 去重有序', () => {
    const ms = extractMilestones(makeEntries(20));
    // 首条应在前
    assert.ok(ms[0]!.includes('第 1 桩'));
  });
});

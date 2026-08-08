/**
 * R13-D8（dashan）：玩家画像综合评分测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerProfile,
  compareProfiles,
} from '../shared/playerProfile.ts';
import type { LedgerEntry, Tone } from '../shared/types.ts';

function makeEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({ index: i + 1, situation: 's', deed: 'd', verdict: 'v', tone: t }));
}

const ALL_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

describe('computePlayerProfile', () => {
  test('空 → score=0, 初入标签', () => {
    const p = computePlayerProfile([]);
    assert.equal(p.totalDeeds, 0);
    assert.equal(p.score, 0);
    assert.equal(p.titleLevel, 0);
    assert.equal(p.dominantTone, null);
    assert.ok(p.tags.includes('初入'));
  });

  test('单条记录 → 低分', () => {
    const p = computePlayerProfile(makeEntries(['佛系']));
    assert.equal(p.totalDeeds, 1);
    assert.ok(p.score > 0 && p.score < 40);
    assert.equal(p.dominantTone, '佛系');
  });

  test('10+ 多样记录 → 中高分', () => {
    const tones: Tone[] = [];
    for (let i = 0; i < 12; i++) tones.push(ALL_TONES[i % 6]!);
    const p = computePlayerProfile(makeEntries(tones));
    assert.ok(p.score >= 40, `score=${p.score}`);
    assert.equal(p.toneVariety, 6);
    assert.ok(p.tags.includes('多面'));
  });

  test('score 在 [0,100]', () => {
    for (const n of [0, 1, 5, 10, 20, 50]) {
      const tones: Tone[] = [];
      for (let i = 0; i < n; i++) tones.push(ALL_TONES[i % 6]!);
      const p = computePlayerProfile(makeEntries(tones));
      assert.ok(p.score >= 0 && p.score <= 100, `n=${n} score=${p.score}`);
    }
  });

  test('主导语气正确', () => {
    const p = computePlayerProfile(makeEntries(['佛系', '佛系', '戏谑']));
    assert.equal(p.dominantTone, '佛系');
  });

  test('toneVariety 计数正确', () => {
    assert.equal(computePlayerProfile([]).toneVariety, 0);
    assert.equal(computePlayerProfile(makeEntries(['庄严'])).toneVariety, 1);
    assert.equal(computePlayerProfile(makeEntries(['庄严', '戏谑', '佛系'])).toneVariety, 3);
    assert.equal(computePlayerProfile(makeEntries([...ALL_TONES])).toneVariety, 6);
  });

  test('tags 含主导语气（非空时）', () => {
    const p = computePlayerProfile(makeEntries(['温情', '温情']));
    assert.ok(p.tags.includes('温情'));
  });

  test('老修行标签（≥20 deed）', () => {
    const tones: Tone[] = [];
    for (let i = 0; i < 25; i++) tones.push(ALL_TONES[i % 6]!);
    const p = computePlayerProfile(makeEntries(tones));
    assert.ok(p.tags.some((t) => t.includes('老修行')));
  });

  test('大善标签（境界≥5）', () => {
    const tones: Tone[] = [];
    for (let i = 0; i < 10; i++) tones.push(ALL_TONES[i % 6]!); // 10 deed → 满级
    const p = computePlayerProfile(makeEntries(tones));
    assert.ok(p.tags.includes('大善'));
  });

  test('summary 非空', () => {
    const p = computePlayerProfile(makeEntries(['佛系']));
    assert.ok(typeof p.summary === 'string' && p.summary.length > 0);
  });

  test('输出结构完整', () => {
    const p = computePlayerProfile(makeEntries(['庄严']));
    assert.ok(typeof p.totalDeeds === 'number');
    assert.ok(typeof p.titleLevel === 'number');
    assert.ok(typeof p.toneVariety === 'number');
    assert.ok(p.dominantTone === null || typeof p.dominantTone === 'string');
    assert.ok(typeof p.score === 'number');
    assert.ok(Array.isArray(p.tags));
    assert.ok(typeof p.summary === 'string');
  });
});

describe('compareProfiles', () => {
  test('A 分高 → higher=A', () => {
    const a = computePlayerProfile(makeEntries(['佛系', '佛系', '佛系', '佛系']));
    const b = computePlayerProfile(makeEntries(['佛系']));
    const r = compareProfiles(a, b);
    assert.equal(r.higher, 'A');
    assert.ok(r.scoreDiff > 0);
  });

  test('B 分高 → higher=B', () => {
    const a = computePlayerProfile(makeEntries(['佛系']));
    const b = computePlayerProfile(makeEntries(['佛系', '戏谑', '庄严', '学术']));
    const r = compareProfiles(a, b);
    assert.equal(r.higher, 'B');
    assert.ok(r.scoreDiff < 0);
  });

  test('同分 → higher=平', () => {
    const a = computePlayerProfile([]);
    const b = computePlayerProfile([]);
    const r = compareProfiles(a, b);
    assert.equal(r.higher, '平');
    assert.equal(r.scoreDiff, 0);
  });

  test('deedDiff = a.totalDeeds - b.totalDeeds', () => {
    const a = computePlayerProfile(makeEntries(['佛系', '戏谑'])); // 2
    const b = computePlayerProfile(makeEntries(['佛系'])); // 1
    const r = compareProfiles(a, b);
    assert.equal(r.deedDiff, 1);
  });
});

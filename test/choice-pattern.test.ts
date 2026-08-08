/**
 * R13-D2（dashan）：抉择模式分析器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeChoicePattern,
  classifyThinker,
  sessionRhythm,
  type ChoiceRecord,
} from '../shared/choicePattern.ts';

/** 造 N 条抉择记录，duration 和 timestamp 可控 */
function makeRecords(spec: { dur: number; ts: number }[]): ChoiceRecord[] {
  return spec.map((s) => ({ timestamp: s.ts, durationMs: s.dur }));
}

const MIN = 60_000;

describe('computeChoicePattern', () => {
  test('空序列 → total=0, 全零', () => {
    const p = computeChoicePattern([]);
    assert.equal(p.total, 0);
    assert.equal(p.avgDuration, 0);
    assert.equal(p.sessionCount, 0);
  });

  test('基本统计：均值/中位/极值', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 3000, ts: 10000 },
      { dur: 5000, ts: 20000 },
    ]));
    assert.equal(p.total, 3);
    assert.equal(p.avgDuration, 3000);
    assert.equal(p.medianDuration, 3000);
    assert.equal(p.minDuration, 1000);
    assert.equal(p.maxDuration, 5000);
  });

  test('中位数偶数个取中间两个均值', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 2000, ts: 10000 },
      { dur: 3000, ts: 20000 },
      { dur: 4000, ts: 30000 },
    ]));
    // 排序后 [1000,2000,3000,4000]，中位 = (2000+3000)/2 = 2500
    assert.equal(p.medianDuration, 2500);
  });

  test('speedCounts 分类正确（fast<5s, slow>30s）', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },   // fast
      { dur: 3000, ts: 10000 }, // fast
      { dur: 10000, ts: 20000 }, // medium
      { dur: 40000, ts: 30000 }, // slow
    ]));
    assert.equal(p.speedCounts.fast, 2);
    assert.equal(p.speedCounts.medium, 1);
    assert.equal(p.speedCounts.slow, 1);
  });

  test('speedRatios = counts/total', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 40000, ts: 10000 },
    ]));
    assert.ok(Math.abs(p.speedRatios.fast - 0.5) < 1e-9);
    assert.ok(Math.abs(p.speedRatios.slow - 0.5) < 1e-9);
  });

  test('会话切分：间隔 >5min 视为新会话', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 60000 },     // 1min 后，同一会话
      { dur: 1000, ts: 10 * MIN },  // 10min 后，新会话
      { dur: 1000, ts: 11 * MIN },  // 同一会话
    ]));
    assert.equal(p.sessionCount, 2);
    assert.equal(p.avgChoicesPerSession, 2);
  });

  test('全部同一时刻（无间隔）→ 单会话', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 0 },
    ]));
    assert.equal(p.sessionCount, 1);
  });

  test('intervalStd 非负', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 5000 },
      { dur: 1000, ts: 15000 },
    ]));
    assert.ok(p.intervalStd >= 0);
  });
});

describe('classifyThinker', () => {
  test('空画像 → 混合型', () => {
    assert.equal(classifyThinker(computeChoicePattern([])), '混合型');
  });

  test('全快（<5s）→ 果断型', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 2000, ts: 10000 },
      { dur: 1500, ts: 20000 },
    ]));
    assert.equal(classifyThinker(p), '果断型');
  });

  test('全慢（>30s）→ 深思型', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 40000, ts: 0 },
      { dur: 50000, ts: 60000 },
      { dur: 60000, ts: 120000 },
    ]));
    assert.equal(classifyThinker(p), '深思型');
  });

  test('平均 >20s → 深思型', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 25000, ts: 0 },
      { dur: 25000, ts: 30000 },
    ]));
    assert.equal(classifyThinker(p), '深思型');
  });

  test('快慢均衡 → 混合型', () => {
    const p = computeChoicePattern(makeRecords([
      { dur: 3000, ts: 0 },
      { dur: 15000, ts: 20000 },
      { dur: 3000, ts: 40000 },
      { dur: 15000, ts: 60000 },
    ]));
    assert.equal(classifyThinker(p), '混合型');
  });
});

describe('sessionRhythm', () => {
  test('空序列 → 全零', () => {
    const r = sessionRhythm([]);
    assert.equal(r.longestSession, 0);
    assert.equal(r.shortestSession, 0);
    assert.equal(r.bingeScore, 0);
  });

  test('longest/shortest session 计数正确', () => {
    const r = sessionRhythm(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 10000 },
      { dur: 1000, ts: 20000 },
      // 5min 间隔 → 新会话
      { dur: 1000, ts: 10 * MIN },
    ]));
    assert.equal(r.longestSession, 3);
    assert.equal(r.shortestSession, 1);
  });

  test('bingeScore = longestSession / total', () => {
    const r = sessionRhythm(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 10000 },
      { dur: 1000, ts: 20000 },
    ]));
    // 全在一个会话，longest=3, total=3 → 1.0
    assert.ok(Math.abs(r.bingeScore - 1) < 1e-9);
  });

  test('avgSessionLength 非负', () => {
    const r = sessionRhythm(makeRecords([
      { dur: 1000, ts: 0 },
      { dur: 1000, ts: 30000 },
    ]));
    assert.ok(r.avgSessionLength >= 0);
  });

  test('单条记录 → longest=shortest=1, bingeScore=1', () => {
    const r = sessionRhythm(makeRecords([{ dur: 1000, ts: 0 }]));
    assert.equal(r.longestSession, 1);
    assert.equal(r.shortestSession, 1);
    assert.equal(r.bingeScore, 1);
  });
});

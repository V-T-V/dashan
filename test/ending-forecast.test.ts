/**
 * R13-D7（dashan）：结局概率预测器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  endingProbability,
  dominantEnding,
  endingTrajectory,
  describeEndingForecast,
} from '../shared/endingForecast.ts';
import type { LedgerEntry, Tone } from '../shared/types.ts';

function entry(tone: Tone): LedgerEntry {
  return { index: 1, situation: 's', deed: 'd', verdict: 'v', tone };
}

function makeEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({ index: i + 1, situation: 's', deed: 'd', verdict: 'v', tone: t }));
}

describe('endingProbability', () => {
  test('空记录 → 三结局各 1/3', () => {
    const p = endingProbability([]);
    assert.ok(Math.abs(p.渡世 - 1 / 3) < 1e-9);
    assert.ok(Math.abs(p.灭世 - 1 / 3) < 1e-9);
    assert.ok(Math.abs(p.超脱 - 1 / 3) < 1e-9);
    assert.equal(p.total, 0);
  });

  test('全佛系 → 渡世=1', () => {
    const p = endingProbability(makeEntries(['佛系', '佛系', '佛系']));
    assert.ok(Math.abs(p.渡世 - 1) < 1e-9);
    assert.equal(p.dominant, '渡世');
  });

  test('全戏谑 → 灭世=1', () => {
    const p = endingProbability(makeEntries(['戏谑', '江湖', '戏谑']));
    assert.ok(Math.abs(p.灭世 - 1) < 1e-9);
    assert.equal(p.dominant, '灭世');
  });

  test('全庄严 → 超脱=1', () => {
    const p = endingProbability(makeEntries(['庄严', '学术', '庄严']));
    assert.ok(Math.abs(p.超脱 - 1) < 1e-9);
    assert.equal(p.dominant, '超脱');
  });

  test('混合 → 概率之和 = 1', () => {
    const p = endingProbability(makeEntries(['佛系', '戏谑', '庄严', '温情', '江湖', '学术']));
    const sum = p.渡世 + p.灭世 + p.超脱;
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  test('渡世主导（佛系+温情 > 其余）', () => {
    const p = endingProbability(makeEntries(['佛系', '温情', '庄严']));
    // 渡世=2/3, 灭世=0, 超脱=1/3
    assert.equal(p.dominant, '渡世');
    assert.ok(p.渡世 > p.超脱);
  });

  test('灭世主导（戏谑+江湖 > 其余）', () => {
    const p = endingProbability(makeEntries(['戏谑', '江湖', '庄严']));
    assert.equal(p.dominant, '灭世');
  });

  test('超脱主导（庄严+学术 > 其余）', () => {
    const p = endingProbability(makeEntries(['庄严', '学术', '佛系']));
    assert.equal(p.dominant, '超脱');
  });

  test('各概率在 [0,1] 区间', () => {
    for (const n of [1, 3, 5, 10]) {
      const tones: Tone[] = [];
      const all: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
      for (let i = 0; i < n; i++) tones.push(all[i % 6]!);
      const p = endingProbability(makeEntries(tones));
      for (const v of [p.渡世, p.灭世, p.超脱]) {
        assert.ok(v >= 0 && v <= 1);
      }
    }
  });

  test('输出结构完整', () => {
    const p = endingProbability(makeEntries(['佛系']));
    assert.ok(typeof p.渡世 === 'number');
    assert.ok(typeof p.灭世 === 'number');
    assert.ok(typeof p.超脱 === 'number');
    assert.ok(['渡世', '灭世', '超脱'].includes(p.dominant));
    assert.ok(typeof p.total === 'number');
  });
});

describe('dominantEnding', () => {
  test('空 → 超脱（默认）', () => {
    assert.equal(dominantEnding([]), '超脱');
  });

  test('佛系主导 → 渡世', () => {
    assert.equal(dominantEnding(makeEntries(['佛系', '佛系'])), '渡世');
  });

  test('戏谑主导 → 灭世', () => {
    assert.equal(dominantEnding(makeEntries(['戏谑', '江湖'])), '灭世');
  });
});

describe('endingTrajectory', () => {
  test('空 → 稳定', () => {
    const t = endingTrajectory([]);
    assert.equal(t.trajectory, '稳定');
    assert.equal(t.previous, null);
  });

  test('单段（<5 条）→ previous=null, 稳定', () => {
    const t = endingTrajectory(makeEntries(['佛系', '佛系']));
    assert.equal(t.previous, null);
  });

  test('前善后恶 → 下降', () => {
    // 前 5 条佛系（渡世），后 5 条戏谑（灭世）→ 渡世→灭世 = 下降
    const entries = [
      ...makeEntries(['佛系', '佛系', '佛系', '佛系', '佛系']),
      ...makeEntries(['戏谑', '江湖', '戏谑', '江湖', '戏谑']),
    ];
    const t = endingTrajectory(entries);
    assert.equal(t.current, '灭世');
    assert.equal(t.previous, '渡世');
    assert.equal(t.trajectory, '下降');
  });

  test('前恶后善 → 上升', () => {
    const entries = [
      ...makeEntries(['戏谑', '江湖', '戏谑', '江湖', '戏谑']),
      ...makeEntries(['佛系', '温情', '佛系', '温情', '佛系']),
    ];
    const t = endingTrajectory(entries);
    assert.equal(t.current, '渡世');
    assert.equal(t.previous, '灭世');
    assert.equal(t.trajectory, '上升');
  });

  test('稳定（前后一致）→ 稳定', () => {
    const entries = [
      ...makeEntries(['庄严', '学术', '庄严', '学术', '庄严']),
      ...makeEntries(['学术', '庄严', '学术', '庄严', '学术']),
    ];
    const t = endingTrajectory(entries);
    assert.equal(t.trajectory, '稳定');
  });

  test('输出结构完整', () => {
    const t = endingTrajectory(makeEntries(['佛系']));
    assert.ok(['渡世', '灭世', '超脱'].includes(t.current));
    assert.ok(t.previous === null || ['渡世', '灭世', '超脱'].includes(t.previous));
    assert.ok(['上升', '下降', '稳定'].includes(t.trajectory));
  });
});

describe('describeEndingForecast', () => {
  test('空 → 提示未定', () => {
    assert.match(describeEndingForecast([]), /未定|尚无/);
  });

  test('非空 → 含百分比', () => {
    const s = describeEndingForecast(makeEntries(['佛系', '戏谑']));
    assert.match(s, /%/);
  });

  test('含主导结局', () => {
    const s = describeEndingForecast(makeEntries(['佛系', '佛系']));
    assert.match(s, /渡世/);
  });

  test('输出为非空字符串', () => {
    const s = describeEndingForecast(makeEntries(['庄严']));
    assert.ok(typeof s === 'string' && s.length > 0);
  });
});

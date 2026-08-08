/**
 * R13-D1（dashan）：语气画像分析器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeToneProfile,
  toneBalance,
  recommendTone,
  describeToneProfile,
  ALL_TONES,
} from '../shared/toneProfile.ts';
import type { Tone } from '../shared/types.ts';

describe('computeToneProfile', () => {
  test('空序列 → total=0, dominant=null, entropy=0', () => {
    const p = computeToneProfile([]);
    assert.equal(p.total, 0);
    assert.equal(p.dominant, null);
    assert.equal(p.entropy, 0);
    assert.equal(p.normalizedEntropy, 0);
  });

  test('单一语气序列 → dominant 正确，normalizedEntropy=0', () => {
    const p = computeToneProfile(['庄严', '庄严', '庄严']);
    assert.equal(p.dominant, '庄严');
    assert.equal(p.counts['庄严'], 3);
    assert.equal(p.entropy, 0); // 单一分布熵=0
    assert.equal(p.normalizedEntropy, 0);
  });

  test('完全均衡（6 语气各 1）→ normalizedEntropy=1', () => {
    const p = computeToneProfile([...ALL_TONES]);
    assert.ok(Math.abs(p.normalizedEntropy - 1) < 1e-9, `均衡熵=${p.normalizedEntropy}`);
    assert.equal(p.dominant, '庄严'); // 并列取靠前
  });

  test('counts 与 ratios 一致', () => {
    const p = computeToneProfile(['庄严', '戏谑', '庄严']);
    assert.equal(p.counts['庄严'], 2);
    assert.equal(p.counts['戏谑'], 1);
    assert.ok(Math.abs(p.ratios['庄严'] - 0.667) < 0.01);
    assert.ok(Math.abs(p.ratios['戏谑'] - 0.333) < 0.01);
  });

  test('非法语气值被忽略', () => {
    // @ts-expect-error 测试非法输入
    const p = computeToneProfile(['庄严', '非法值', '戏谑']);
    assert.equal(p.total, 3); // total 仍计 3
    assert.equal(p.counts['庄严'], 1);
    assert.equal(p.counts['戏谑'], 1);
  });

  test('主导语气为占比最高者', () => {
    const tones: Tone[] = ['温情', '温情', '温情', '庄严', '庄严'];
    const p = computeToneProfile(tones);
    assert.equal(p.dominant, '温情');
  });

  test('并列主导取 ALL_TONES 靠前者', () => {
    const p = computeToneProfile(['温情', '庄严']); // 各 1
    assert.equal(p.dominant, '庄严'); // 庄严 在 ALL_TONES 中靠前
  });

  test('entropy 在 [0, ln6] 区间', () => {
    for (const n of [1, 5, 10, 50]) {
      const tones: Tone[] = [];
      for (let i = 0; i < n; i++) tones.push(ALL_TONES[i % 6]!);
      const p = computeToneProfile(tones);
      assert.ok(p.entropy >= 0 && p.entropy <= Math.log(6) + 1e-9);
    }
  });
});

describe('toneBalance', () => {
  test('空画像 → 均衡', () => {
    assert.equal(toneBalance(computeToneProfile([])), '均衡');
  });

  test('单一语气 → 单一', () => {
    assert.equal(toneBalance(computeToneProfile(['庄严', '庄严', '庄严'])), '单一');
  });

  test('完全均衡 → 均衡', () => {
    assert.equal(toneBalance(computeToneProfile([...ALL_TONES])), '均衡');
  });

  test('略偏（4:1:1:0:0:0）→ 略偏', () => {
    // 4 庄严 + 1 戏谑 + 1 佛系 → 归一化熵应在 0.4~0.75
    const p = computeToneProfile(['庄严', '庄严', '庄严', '庄严', '戏谑', '佛系']);
    assert.equal(toneBalance(p), '略偏');
  });
});

describe('recommendTone', () => {
  test('空画像 → null', () => {
    assert.equal(recommendTone(computeToneProfile([])), null);
  });

  test('推荐占比最低的语气', () => {
    const p = computeToneProfile(['庄严', '庄严', '戏谑']);
    // 庄严2 戏谑1，其余 0 → 推荐 0 占比中靠前的
    const rec = recommendTone(p);
    assert.ok(rec !== null);
    assert.equal(p.ratios[rec!], 0); // 推荐的应占比 0
  });

  test('完全均衡时推荐 ALL_TONES 靠前者', () => {
    const p = computeToneProfile([...ALL_TONES]);
    assert.equal(recommendTone(p), '庄严'); // 全 1/6 并列，取靠前
  });

  test('推荐不等于主导（除非全均衡）', () => {
    const p = computeToneProfile(['温情', '温情', '温情', '庄严']);
    const rec = recommendTone(p);
    assert.notEqual(rec, '温情'); // 温情是主导，不应推荐
  });
});

describe('describeToneProfile', () => {
  test('空画像 → 提示无数据', () => {
    const s = describeToneProfile(computeToneProfile([]));
    assert.match(s, /无足够数据|尚无/);
  });

  test('非空画像含主导语气', () => {
    const s = describeToneProfile(computeToneProfile(['温情', '温情', '庄严']));
    assert.match(s, /温情/);
  });

  test('含分布均衡度描述', () => {
    const s = describeToneProfile(computeToneProfile(['庄严', '庄严', '庄严']));
    assert.match(s, /单一/);
  });

  test('含多样性百分比', () => {
    const s = describeToneProfile(computeToneProfile([...ALL_TONES]));
    assert.match(s, /100%/);
  });

  test('输出为非空字符串', () => {
    const s = describeToneProfile(computeToneProfile(['庄严']));
    assert.ok(typeof s === 'string' && s.length > 0);
  });
});

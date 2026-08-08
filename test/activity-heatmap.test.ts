/**
 * R13-D9（dashan）：抉择时间热力图分析测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hourlyDistribution,
  weekdayDistribution,
  activityLabel,
  describeActivity,
  type Timestamped,
} from '../shared/activityHeatmap.ts';

/** 构造指定小时的 timestamp（用固定日期避免时区歧义） */
function atHour(hour: number, day = 15): Timestamped {
  // 用 UTC 时间避免本地时区偏移，getHours() 返回本地时区
  // 为测试稳定，直接构造 Date 并取 getHours
  const d = new Date(2025, 0, day, hour, 0, 0); // 本地时区 2025-01-15 hour:00
  return { timestamp: d.getTime() };
}

/** 构造指定星期几的 timestamp（0=周日） */
function atWeekday(weekday: number): Timestamped {
  // 2025-01-05 是周日（0），6=周一... 11=周六
  const d = new Date(2025, 0, 5 + weekday, 12, 0, 0);
  return { timestamp: d.getTime() };
}

describe('hourlyDistribution', () => {
  test('空 → 24 个 0, peakHour=null', () => {
    const d = hourlyDistribution([]);
    assert.equal(d.counts.length, 24);
    assert.deepEqual(d.counts, new Array(24).fill(0));
    assert.equal(d.total, 0);
    assert.equal(d.peakHour, null);
  });

  test('计数正确', () => {
    const d = hourlyDistribution([atHour(8), atHour(8), atHour(14)]);
    assert.equal(d.counts[8], 2);
    assert.equal(d.counts[14], 1);
    assert.equal(d.total, 3);
  });

  test('ratios = counts/total', () => {
    const d = hourlyDistribution([atHour(8), atHour(14)]);
    assert.ok(Math.abs(d.ratios[8] - 0.5) < 1e-9);
    assert.ok(Math.abs(d.ratios[14] - 0.5) < 1e-9);
  });

  test('peakHour 取首个最大值', () => {
    const d = hourlyDistribution([atHour(8), atHour(8), atHour(14)]);
    assert.equal(d.peakHour, 8);
  });

  test('ratios 总和 = 1（非空时）', () => {
    const d = hourlyDistribution([atHour(1), atHour(2), atHour(3)]);
    const sum = d.ratios.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
});

describe('weekdayDistribution', () => {
  test('空 → 7 个 0, peakWeekday=null', () => {
    const d = weekdayDistribution([]);
    assert.equal(d.counts.length, 7);
    assert.equal(d.peakWeekday, null);
  });

  test('计数正确', () => {
    const d = weekdayDistribution([atWeekday(1), atWeekday(1), atWeekday(3)]); // 周一×2, 周三
    assert.equal(d.counts[1], 2); // 周一
    assert.equal(d.counts[3], 1); // 周三
    assert.equal(d.total, 3);
  });

  test('peakWeekday 取首个最大值', () => {
    const d = weekdayDistribution([atWeekday(5), atWeekday(5), atWeekday(1)]);
    assert.equal(d.peakWeekday, 5); // 周五
  });
});

describe('activityLabel', () => {
  test('空 → 未知', () => {
    assert.equal(activityLabel(hourlyDistribution([])), '未知');
  });

  test('晨型（6~11 点 >40%）', () => {
    const items = [atHour(7), atHour(8), atHour(9), atHour(10), atHour(20)];
    assert.equal(activityLabel(hourlyDistribution(items)), '晨型');
  });

  test('夜型（20~23 点 >40%）', () => {
    const items = [atHour(20), atHour(21), atHour(22), atHour(8), atHour(10)];
    assert.equal(activityLabel(hourlyDistribution(items)), '夜型');
  });

  test('午后型（12~17 点 >40%）', () => {
    const items = [atHour(13), atHour(14), atHour(15), atHour(16), atHour(8)];
    assert.equal(activityLabel(hourlyDistribution(items)), '午后型');
  });

  test('均衡（无明显主导）', () => {
    // 均匀分布在晨/午/夜
    const items = [
      atHour(7), atHour(13), atHour(21),
      atHour(8), atHour(14), atHour(22),
    ];
    assert.equal(activityLabel(hourlyDistribution(items)), '均衡');
  });
});

describe('describeActivity', () => {
  test('空 → 提示无数据', () => {
    const s = describeActivity(hourlyDistribution([]), weekdayDistribution([]));
    assert.match(s, /尚无|无数据/);
  });

  test('非空 → 含作息标签', () => {
    const items = [atHour(8), atHour(9), atHour(10), atHour(11), atHour(12)];
    const s = describeActivity(hourlyDistribution(items), weekdayDistribution(items));
    assert.match(s, /晨型|午后型|均衡/);
  });

  test('含抉择次数', () => {
    const items = [atHour(8), atHour(14)];
    const s = describeActivity(hourlyDistribution(items), weekdayDistribution(items));
    assert.match(s, /2 次/);
  });

  test('输出为非空字符串', () => {
    const items = [atHour(8)];
    const s = describeActivity(hourlyDistribution(items), weekdayDistribution(items));
    assert.ok(typeof s === 'string' && s.length > 0);
  });
});

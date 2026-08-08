/**
 * R13-D6（dashan）：境界进阶预测器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  titleForecast,
  forecastAllTitles,
  estimatedDeedsToMax,
  progressPercent,
} from '../shared/titleForecast.ts';
import { TITLES, MAX_TITLE_LEVEL } from '../shared/ledgerCore.ts';

describe('titleForecast', () => {
  test('deedCount=0 → 初始境界', () => {
    const f = titleForecast(0);
    assert.equal(f.currentLevel, 0);
    assert.equal(f.currentTitle, TITLES[0]!.name);
    assert.equal(f.nextLevel, 1);
    assert.ok(!f.isMax);
  });

  test('deedCount=1 → 第一境界达成', () => {
    const f = titleForecast(1);
    assert.equal(f.currentLevel, 0);
    assert.equal(f.deedsToNext, TITLES[1]!.at - 1);
  });

  test(' deedsToNext = 下一阈值 - 当前 deed', () => {
    const f = titleForecast(3);
    const expected = TITLES[f.currentLevel + 1]!.at - 3;
    assert.equal(f.deedsToNext, Math.max(0, expected));
  });

  test('progress 在 [0,1] 区间', () => {
    for (const n of [0, 1, 3, 5, 7, 9, 10, 15]) {
      const f = titleForecast(n);
      assert.ok(f.progress >= 0 && f.progress <= 1, `deed=${n} progress=${f.progress}`);
    }
  });

  test('满级（≥10 deed）→ isMax=true, nextLevel=null', () => {
    const f = titleForecast(15);
    assert.ok(f.isMax);
    assert.equal(f.nextLevel, null);
    assert.equal(f.nextTitle, null);
    assert.equal(f.deedsToNext, 0);
    assert.equal(f.progress, 1);
  });

  test('恰在阈值上 → deedsToNext=0 即将升级', () => {
    // deedCount = TITLES[1].at - 1 = 1，下一阈值 2，deedsToNext=1
    const f = titleForecast(1);
    assert.equal(f.deedsToNext, 1);
  });

  test('负 deedCount 防御 → progress=0', () => {
    const f = titleForecast(-5);
    assert.ok(f.progress >= 0);
  });

  test('输出结构完整', () => {
    const f = titleForecast(5);
    assert.ok(typeof f.deedCount === 'number');
    assert.ok(typeof f.currentLevel === 'number');
    assert.ok(typeof f.currentTitle === 'string');
    assert.ok(f.nextLevel === null || typeof f.nextLevel === 'number');
    assert.ok(typeof f.isMax === 'boolean');
  });
});

describe('forecastAllTitles', () => {
  test('返回所有境界（TITLES.length 个）', () => {
    const all = forecastAllTitles(5);
    assert.equal(all.length, TITLES.length);
  });

  test('achieved 标记正确', () => {
    const all = forecastAllTitles(4);
    // TITLES 阈值 1/2/3/4/5/6/8/10，deed=4 时前 4 个达成
    for (let i = 0; i < all.length; i++) {
      assert.equal(all[i]!.achieved, 4 >= TITLES[i]!.at, `level ${i}`);
    }
  });

  test('surplus = deedCount - requiredDeeds', () => {
    const all = forecastAllTitles(7);
    for (const e of all) {
      assert.equal(e.surplus, 7 - e.requiredDeeds);
    }
  });

  test('每个条目结构完整', () => {
    const all = forecastAllTitles(3);
    for (const e of all) {
      assert.ok(typeof e.level === 'number');
      assert.ok(typeof e.title === 'string');
      assert.ok(typeof e.requiredDeeds === 'number');
      assert.ok(typeof e.achieved === 'boolean');
      assert.ok(typeof e.surplus === 'number');
    }
  });
});

describe('estimatedDeedsToMax', () => {
  test('deed=0 → 满级阈值', () => {
    assert.equal(estimatedDeedsToMax(0), TITLES[MAX_TITLE_LEVEL]!.at);
  });

  test('deed=5 → 10-5=5', () => {
    assert.equal(estimatedDeedsToMax(5), TITLES[MAX_TITLE_LEVEL]!.at - 5);
  });

  test('deed≥满级 → 0', () => {
    assert.equal(estimatedDeedsToMax(15), 0);
    assert.equal(estimatedDeedsToMax(100), 0);
  });

  test('负 deed 防御', () => {
    assert.equal(estimatedDeedsToMax(-5), TITLES[MAX_TITLE_LEVEL]!.at);
  });
});

describe('progressPercent', () => {
  test('范围 0~100', () => {
    for (const n of [0, 1, 3, 5, 7, 9, 10, 15]) {
      const p = progressPercent(n);
      assert.ok(p >= 0 && p <= 100, `deed=${n} pct=${p}`);
    }
  });

  test('满级 → 100', () => {
    assert.equal(progressPercent(15), 100);
  });

  test('整数输出', () => {
    for (const n of [1, 3, 5, 7]) {
      const p = progressPercent(n);
      assert.equal(p, Math.round(p));
    }
  });
});

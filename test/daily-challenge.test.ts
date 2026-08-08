/**
 * R13-D5（dashan）：每日挑战生成器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDailyChallenge,
  scoreChallenge,
  challengeDifficultyLabel,
  isDeterministic,
  type ChallengeProgress,
} from '../shared/dailyChallenge.ts';

describe('generateDailyChallenge', () => {
  test('同日期确定性（同输入同输出）', () => {
    assert.ok(isDeterministic('2025-01-01'));
    assert.ok(isDeterministic('2025-12-31'));
  });

  test('不同日期通常产生不同挑战', () => {
    const a = generateDailyChallenge('2025-01-01');
    const b = generateDailyChallenge('2025-01-02');
    // 至少 theme 或 categories 不同
    const different = a.theme !== b.theme || JSON.stringify(a.categories) !== JSON.stringify(b.categories);
    assert.ok(different, '相邻日期应产生不同挑战');
  });

  test('输出结构完整', () => {
    const c = generateDailyChallenge('2025-06-15');
    assert.ok(typeof c.date === 'string');
    assert.ok(typeof c.theme === 'string' && c.theme.length > 0);
    assert.equal(c.categories.length, 3);
    assert.deepEqual(c.difficulties, [1, 2, 3]);
    assert.equal(c.totalScore, 6);
    assert.ok(typeof c.encouragement === 'string' && c.encouragement.length > 0);
  });

  test('3 个题材不重复', () => {
    for (const date of ['2025-01-01', '2025-06-15', '2025-12-31']) {
      const c = generateDailyChallenge(date);
      const unique = new Set(c.categories);
      assert.equal(c.categories.length, unique.size, `${date} 有重复题材`);
    }
  });

  test('题材均合法', () => {
    const validCats = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
    for (let i = 0; i < 30; i++) {
      const c = generateDailyChallenge(`2025-01-${String(i + 1).padStart(2, '0')}`);
      for (const cat of c.categories) {
        assert.ok(validCats.includes(cat), `非法题材: ${cat}`);
      }
    }
  });

  test('难度递进 1→2→3', () => {
    const c = generateDailyChallenge('2025-03-20');
    assert.deepEqual(c.difficulties, [1, 2, 3]);
  });

  test('theme 在预设列表中', () => {
    const themes = [
      '职场修行', '生死抉择', '金钱考验', '亲情羁绊', '正义天平',
      '科技伦理', '人性深处', '医者仁心', '战争残酷', '日常善念',
    ];
    for (let i = 0; i < 10; i++) {
      const c = generateDailyChallenge(`2025-0${i + 1}-01`);
      assert.ok(themes.includes(c.theme), `未知主题: ${c.theme}`);
    }
  });
});

describe('scoreChallenge', () => {
  test('全未完成 → 未完成', () => {
    const r = scoreChallenge({ completed: 0, scores: [] });
    assert.equal(r.rating, '未完成');
    assert.equal(r.averageScore, 0);
  });

  test('3 题全 90+ → 完美', () => {
    const r = scoreChallenge({ completed: 3, scores: [95, 92, 98] });
    assert.equal(r.rating, '完美');
    assert.ok(r.averageScore >= 90);
  });

  test('3 题全 75~89 → 优秀', () => {
    const r = scoreChallenge({ completed: 3, scores: [80, 78, 82] });
    assert.equal(r.rating, '优秀');
  });

  test('3 题全 60~74 → 良好', () => {
    const r = scoreChallenge({ completed: 3, scores: [65, 70, 68] });
    assert.equal(r.rating, '良好');
  });

  test('3 题全 <60 → 勉强通过', () => {
    const r = scoreChallenge({ completed: 3, scores: [40, 50, 30] });
    assert.equal(r.rating, '勉强通过');
  });

  test('未完成 3 题 → 未完成（即使分高）', () => {
    const r = scoreChallenge({ completed: 2, scores: [95, 90] });
    assert.equal(r.rating, '未完成');
  });

  test('summary 含完成数与评级', () => {
    const r = scoreChallenge({ completed: 3, scores: [80, 80, 80] });
    assert.match(r.summary, /3\/3/);
    assert.match(r.summary, /优秀/);
  });

  test('totalScore = 各题之和', () => {
    const r = scoreChallenge({ completed: 3, scores: [60, 70, 80] });
    assert.equal(r.totalScore, 210);
  });
});

describe('challengeDifficultyLabel', () => {
  test('≤2 → 轻松', () => assert.equal(challengeDifficultyLabel(2), '轻松'));
  test('3~4 → 适中', () => {
    assert.equal(challengeDifficultyLabel(3), '适中');
    assert.equal(challengeDifficultyLabel(4), '适中');
  });
  test('5~6 → 挑战', () => {
    assert.equal(challengeDifficultyLabel(5), '挑战');
    assert.equal(challengeDifficultyLabel(6), '挑战');
  });
  test('≥7 → 极限', () => assert.equal(challengeDifficultyLabel(7), '极限'));
});

describe('isDeterministic', () => {
  test('多次调用稳定', () => {
    for (let i = 0; i < 5; i++) {
      assert.ok(isDeterministic('2025-08-08'));
    }
  });
});

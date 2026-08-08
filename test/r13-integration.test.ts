/**
 * R13-D10（dashan）：综合集成测试——把 R13 的 9 个新模块串起来验证。
 *
 * 模拟完整玩家画像构建流程：
 *   抉择记录 → 语气画像 + 抉择模式 + 境界预测 + 结局概率 + 综合评分 + 叙事 + 热力图
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { LedgerEntry, Tone } from '../shared/types.ts';
import { computeToneProfile, describeToneProfile } from '../shared/toneProfile.ts';
import { computePlayerProfile } from '../shared/playerProfile.ts';
import { generateNarrative } from '../shared/narrative.ts';
import { titleForecast } from '../shared/titleForecast.ts';
import { endingProbability, describeEndingForecast } from '../shared/endingForecast.ts';
import { scoreDilemmaDifficulty } from '../shared/dilemmaScorer.ts';
import { generateDailyChallenge } from '../shared/dailyChallenge.ts';
import { hourlyDistribution, activityLabel } from '../shared/activityHeatmap.ts';

function entry(index: number, deed: string, tone: Tone, ts: number): LedgerEntry & { ts: number } {
  return { index, situation: `情境${index}`, deed, verdict: `夸赞${index}`, tone, ts };
}

function makeEntries(n: number): (LedgerEntry & { ts: number })[] {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  return Array.from({ length: n }, (_, i) =>
    entry(i + 1, `选择${i + 1}`, tones[i % 6]!, Date.now() - (n - i) * 60000),
  );
}

describe('R13 综合集成', () => {
  test('完整画像流程产出有效数据', () => {
    const entries = makeEntries(15);
    const tones = entries.map((e) => e.tone);

    // 1. 语气画像
    const toneProfile = computeToneProfile(tones);
    assert.ok(toneProfile.total === 15);
    assert.ok(toneProfile.normalizedEntropy > 0);

    // 2. 综合评分
    const profile = computePlayerProfile(entries);
    assert.ok(profile.score >= 0 && profile.score <= 100);
    assert.ok(profile.tags.length > 0);

    // 3. 叙事
    const narrative = generateNarrative(entries);
    assert.ok(narrative.wordCount > 0);

    // 4. 境界预测
    const forecast = titleForecast(entries.length);
    assert.ok(typeof forecast.currentTitle === 'string');

    // 5. 结局概率
    const ending = endingProbability(entries);
    const sum = ending.渡世 + ending.灭世 + ending.超脱;
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  test('空数据全模块不崩溃', () => {
    const entries: LedgerEntry[] = [];
    const tones: Tone[] = [];

    assert.ok(computeToneProfile(tones).total === 0);
    assert.ok(computePlayerProfile(entries).score === 0);
    assert.ok(generateNarrative(entries).wordCount === 0);
    assert.ok(titleForecast(0).currentLevel === 0);
    assert.ok(endingProbability(entries).total === 0);
    assert.ok(hourlyDistribution([]).total === 0);
  });

  test('描述类函数产出非空字符串', () => {
    const entries = makeEntries(8);
    const tones = entries.map((e) => e.tone);

    const toneDesc = describeToneProfile(computeToneProfile(tones));
    const endingDesc = describeEndingForecast(entries);
    const narrativeText = generateNarrative(entries).text;

    assert.ok(toneDesc.length > 0);
    assert.ok(endingDesc.length > 0);
    assert.ok(narrativeText.length > 0);
  });

  test('每日挑战 + 困境评分串联', () => {
    const challenge = generateDailyChallenge('2025-08-08');
    const dilemma = scoreDilemmaDifficulty({
      situation: '生死善恶的终极抉择',
      choices: ['善', '恶', '对', '错'],
    });
    assert.ok(challenge.totalScore > 0);
    assert.ok(dilemma.difficulty >= 0 && dilemma.difficulty <= 100);
  });

  test('热力图 + 作息标签', () => {
    const entries = makeEntries(10);
    const items = entries.map((e) => ({ timestamp: e.ts }));
    const dist = hourlyDistribution(items);
    const label = activityLabel(dist);
    assert.ok(['晨型', '夜型', '午后型', '均衡', '未知'].includes(label));
  });
});

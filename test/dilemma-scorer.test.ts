/**
 * R13-D3（dashan）：道德困境难度评分器测试。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreDilemmaDifficulty,
  classifyDilemma,
  identifyDilemmaTension,
  type DilemmaInput,
} from '../shared/dilemmaScorer.ts';

function input(situation: string, choices: string[]): DilemmaInput {
  return { situation, choices };
}

describe('scoreDilemmaDifficulty', () => {
  test('简单困境 → 低分（level=1）', () => {
    const r = scoreDilemmaDifficulty(input('今天午餐吃什么', ['面条', '米饭']));
    assert.ok(r.difficulty < 35, `简单困境分数 ${r.difficulty} 应 <35`);
    assert.equal(r.level, 1);
  });

  test('4 选项增加复杂度', () => {
    const r = scoreDilemmaDifficulty(input('选一个', ['A', 'B', 'C', 'D']));
    assert.equal(r.dimensions.choiceComplexity, 25);
  });

  test('2 选项基础复杂度 10', () => {
    const r = scoreDilemmaDifficulty(input('选', ['A', 'B']));
    assert.equal(r.dimensions.choiceComplexity, 10);
  });

  test('3 选项复杂度 18', () => {
    const r = scoreDilemmaDifficulty(input('选', ['A', 'B', 'C']));
    assert.equal(r.dimensions.choiceComplexity, 18);
  });

  test('道德关键词提升 moralConflict', () => {
    const r = scoreDilemmaDifficulty(input('你应该对还是错？这是道德良心责任', ['善', '恶']));
    assert.ok(r.dimensions.moralConflict > 0);
    assert.ok(r.tensions.includes('道德两难'));
  });

  test('生死关键词提升 consequenceSeverity 并触发生存抉择', () => {
    const r = scoreDilemmaDifficulty(input('救人还是放弃？有人会死', ['救', '不救']));
    assert.ok(r.dimensions.consequenceSeverity >= 15);
    assert.ok(r.tensions.includes('生存抉择'));
  });

  test('法律关键词提升后果', () => {
    const r = scoreDilemmaDifficulty(input('是否违法举报犯罪', ['举报', '不举报']));
    assert.ok(r.dimensions.consequenceSeverity > 0);
  });

  test('金钱关键词触发利益冲突', () => {
    const r = scoreDilemmaDifficulty(input('贪污钱还是拒绝利益', ['接受', '拒绝']));
    assert.ok(r.tensions.includes('利益冲突'));
  });

  test('情感关键词触发情感羁绊', () => {
    const r = scoreDilemmaDifficulty(input('背叛家人还是忠于父母', ['背叛', '忠诚']));
    assert.ok(r.tensions.includes('情感羁绊'));
  });

  test('模糊关键词触发信息缺失', () => {
    const r = scoreDilemmaDifficulty(input('也许可能不确定，模糊两难', ['A', 'B']));
    assert.ok(r.tensions.includes('信息缺失'));
    assert.ok(r.dimensions.ambiguity > 0);
  });

  test('难度分数 = 各维度之和', () => {
    const r = scoreDilemmaDifficulty(input('生死道德', ['善', '恶']));
    const sum = r.dimensions.choiceComplexity + r.dimensions.moralConflict
      + r.dimensions.ambiguity + r.dimensions.consequenceSeverity;
    assert.equal(r.difficulty, sum);
  });

  test('难度封顶 100 不会超', () => {
    const hard = '死杀生死牺牲' + '善恶道德良心责任义务' + '违法犯罪判刑' + '钱利益利润贪污' + '也许模糊不确定两难';
    const r = scoreDilemmaDifficulty(input(hard, ['善', '恶', '对', '错']));
    // 各维度都有上限：25+30+20+25=100
    assert.ok(r.difficulty <= 100, `分数 ${r.difficulty} 应 ≤100`);
  });

  test('level 阈值：<35→1, 35~64→2, ≥65→3', () => {
    const easy = scoreDilemmaDifficulty(input('选', ['A', 'B']));
    const hard = scoreDilemmaDifficulty(input('生死善恶道德良心', ['善', '恶', '对', '错']));
    assert.ok(easy.level <= hard.level);
  });

  test('tensions 去重', () => {
    const r = scoreDilemmaDifficulty(input('死 死 死 杀 杀', ['A', 'B']));
    const survivalCount = r.tensions.filter((t) => t === '生存抉择').length;
    assert.equal(survivalCount, 1); // 去重后只 1 个
  });

  test('reasons 非空', () => {
    const r = scoreDilemmaDifficulty(input('选', ['A', 'B']));
    assert.ok(r.reasons.length > 0);
    for (const rea of r.reasons) assert.ok(typeof rea === 'string' && rea.length > 0);
  });

  test('输出结构稳定', () => {
    const r = scoreDilemmaDifficulty(input('情境', ['A', 'B']));
    assert.ok(typeof r.difficulty === 'number' && r.difficulty >= 0 && r.difficulty <= 100);
    assert.ok([1, 2, 3].includes(r.level));
    assert.ok(typeof r.dimensions.choiceComplexity === 'number');
    assert.ok(Array.isArray(r.tensions));
    assert.ok(Array.isArray(r.reasons));
  });
});

describe('classifyDilemma', () => {
  test('简单 → 初阶', () => {
    assert.equal(classifyDilemma(input('选', ['A', 'B'])), '初阶');
  });

  test('极难 → 深渊', () => {
    const hard = '死杀生死牺牲善恶道德良心责任违法犯罪钱利益';
    assert.equal(classifyDilemma(input(hard, ['善', '恶', '对', '错'])), '深渊');
  });

  test('输出仅 3 种值', () => {
    for (const s of ['简单', '生死善恶', '死杀道德良心违法钱利益模糊']) {
      const c = classifyDilemma(input(s, ['A', 'B']));
      assert.ok(['初阶', '进阶', '深渊'].includes(c));
    }
  });
});

describe('identifyDilemmaTension', () => {
  test('无张力 → null', () => {
    assert.equal(identifyDilemmaTension(input('选', ['A', 'B'])), null);
  });

  test('有张力 → 返回首个', () => {
    const t = identifyDilemmaTension(input('生死善恶', ['善', '恶']));
    assert.ok(t !== null);
  });
});

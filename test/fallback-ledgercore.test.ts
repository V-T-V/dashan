/**
 * fallback.ts + ledgerCore.ts 纯函数测试。
 * 覆盖：fallback 脚本选择、称号等级计算、进度计算。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickFallbackFirstSituation,
  pickFallbackTurn,
  fallbackScriptCount,
} from '../shared/fallback.ts';
import {
  titleLevel,
  isMaxTitle,
  TITLES,
} from '../shared/ledgerCore.ts';

// ---- fallback.ts ----

test('fallback：首次选择返回第一个剧本的情境', () => {
  const sit = pickFallbackFirstSituation();
  assert.ok(sit, '应返回非空情境');
  assert.ok(sit.choices && sit.choices.length >= 3, '应有至少3个选项');
  if (sit.choices) {
    sit.choices.forEach((c) => {
      assert.ok(c.text, '每个选项应有文案');
    });
  }
});

test('fallback：脚本池不为空', () => {
  assert.ok(fallbackScriptCount() > 0, '应有内置脚本');
});

test('fallback：pickFallbackTurn 对合法选择返回 TurnResult', () => {
  const sit = pickFallbackFirstSituation();
  const firstChoice = sit.choices[0]!.text;
  const turn = pickFallbackTurn(firstChoice);
  assert.ok(turn.praise, '应返回夸赞文本');
  assert.ok(turn.next, '应返回下一个情境');
});

test('fallback：对未知选择不崩溃（兜底）', () => {
  const turn = pickFallbackTurn('一个不存在的选项文案');
  assert.ok(turn.praise, '即使未知也应返回兜底夸赞');
});

// ---- ledgerCore.ts ----

test('ledgerCore：titleLevel(0) 返回最低级', () => {
  assert.ok(titleLevel(0) >= 0);
});

test('ledgerCore：titleLevel 随次数递增', () => {
  const low = titleLevel(1);
  const high = titleLevel(100);
  assert.ok(high >= low, '次数越高等级应>=低次数');
});

test('ledgerCore：isMaxTitle 在极高值返回 true', () => {
  assert.ok(isMaxTitle(99999), '极高值应达到最高称号');
});

test('ledgerCore：TITLES 数组有序且非空', () => {
  assert.ok(TITLES.length > 0, '应有称号定义');
  for (let i = 1; i < TITLES.length; i++) {
    assert.ok(TITLES[i]!.at >= TITLES[i - 1]!.at, `称号[${i}]阈值应>=前一项`);
  }
});

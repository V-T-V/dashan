/**
 * 大善系统 —— 自定义剧本校验测试（C 项）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUserScript, validateUserScripts } from '../shared/scriptSchema.ts';

const GOOD = {
  situation: {
    situation: '测试情境',
    choices: [
      { id: 'A', text: '选项一' },
      { id: 'B', text: '选项二' },
    ],
  },
  praises: {
    选项一: { text: '夸赞一', tone: '庄严' },
    选项二: { text: '夸赞二', tone: '佛系' },
  },
  fallback: { text: '兜底夸赞', tone: '戏谑' },
};

test('validateUserScript: 合法剧本通过', () => {
  const r = validateUserScript(GOOD);
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
  assert.ok(r.script);
});

test('validateUserScript: 缺少选项对应夸赞时报错', () => {
  const bad = {
    ...GOOD,
    praises: { 选项一: { text: '夸赞一', tone: '庄严' } }, // 缺选项二
  };
  const r = validateUserScript(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('选项二')));
});

test('validateUserScript: tone 非法时报错', () => {
  const bad = {
    ...GOOD,
    fallback: { text: 'x', tone: '瞎编' },
  };
  const r = validateUserScript(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('tone')));
});

test('validateUserScript: choices 少于 2 个报错', () => {
  const bad = {
    ...GOOD,
    situation: { situation: 'x', choices: [{ id: 'A', text: 'a' }] },
  };
  const r = validateUserScript(bad);
  assert.equal(r.ok, false);
});

test('validateUserScript: 非对象直接失败', () => {
  assert.equal(validateUserScript('hello').ok, false);
  assert.equal(validateUserScript(null).ok, false);
});

test('validateUserScripts: 批量校验，混合成功失败', () => {
  const r = validateUserScripts([GOOD, 'bad', { ...GOOD, situation: 'x' }]);
  assert.equal(r.scripts.length, 1); // 只有第一个 GOOD 通过
  assert.equal(r.errors.length, 2);
});

test('validateUserScripts: 非数组报错', () => {
  const r = validateUserScripts({ not: 'array' });
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 1);
});

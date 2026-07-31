/**
 * prompt.ts 模板渲染的边缘 case 测试。
 *
 * 补充 prompt.test.ts 未覆盖：
 * - SYSTEM_PROMPT 完整性（6 种 tone + 5 种翻转角度 + 8 种题材 + JSON 格式铁律）
 * - firstUserPrompt / choicePrompt 字符串格式与插值
 * - buildMessages：空 history、多轮 history、context.dominantTone 缺失
 * - buildMessages：境界摘要文案包含 title/deedCount
 * - buildMessages：userChoice 含特殊字符（引号/换行）原样透传
 * - buildMessages：消息角色顺序正确（system 在前，user 在后）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SYSTEM_PROMPT, firstUserPrompt, choicePrompt, buildMessages } from '../shared/prompt.ts';
import type { Message, PlayerContext } from '../shared/types.ts';

// ─── SYSTEM_PROMPT 完整性 ───

test('SYSTEM_PROMPT：包含 6 种 tone 关键词', () => {
  for (const tone of ['庄严', '戏谑', '佛系', '学术', '江湖', '温情']) {
    assert.ok(SYSTEM_PROMPT.includes(tone), `SYSTEM_PROMPT 应含 tone「${tone}」`);
  }
});

test('SYSTEM_PROMPT：包含 5 种翻转角度', () => {
  for (const angle of ['因果论', '反伪善论', '超越论', '守恒论', '破立论']) {
    assert.ok(SYSTEM_PROMPT.includes(angle), `应含翻转角度「${angle}」`);
  }
});

test('SYSTEM_PROMPT：包含 8 种题材分类', () => {
  for (const cat of ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性']) {
    assert.ok(SYSTEM_PROMPT.includes(cat), `应含题材「${cat}」`);
  }
});

test('SYSTEM_PROMPT：包含核心铁律与 JSON 格式约束', () => {
  assert.ok(SYSTEM_PROMPT.includes('大恶即大善'));
  assert.ok(SYSTEM_PROMPT.includes('善恶由我定'));
  assert.ok(SYSTEM_PROMPT.includes('JSON')); // 严格 JSON 输出
  assert.ok(SYSTEM_PROMPT.includes('situation'));
  assert.ok(SYSTEM_PROMPT.includes('choices'));
});

// ─── 字符串构造函数 ───

test('firstUserPrompt：固定开场文案', () => {
  const s = firstUserPrompt();
  assert.equal(typeof s, 'string');
  assert.ok(s.length > 0);
  assert.ok(s.includes('情境'));
});

test('choicePrompt：把选择文案拼进「我选择：」模板', () => {
  assert.equal(choicePrompt('举报上司'), '我选择：举报上司');
});

test('choicePrompt：空字符串仍生成前缀', () => {
  assert.equal(choicePrompt(''), '我选择：');
});

test('choicePrompt：含特殊字符（引号/换行）原样透传', () => {
  const weird = '选项「换\n行」';
  const s = choicePrompt(weird);
  assert.ok(s.includes(weird));
  assert.ok(s.includes('\n')); // 换行保留
});

// ─── buildMessages ───

test('buildMessages：空 history + 无 choice → system + user(首条)', () => {
  const msgs = buildMessages([], '');
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0]!.role, 'system');
  assert.equal(msgs[0]!.content, SYSTEM_PROMPT);
  assert.equal(msgs[1]!.role, 'user');
  assert.equal(msgs[1]!.content, firstUserPrompt());
});

test('buildMessages：多轮 history 被保留在 system 与 user 之间', () => {
  const history: Message[] = [
    { role: 'assistant', content: '情境1' },
    { role: 'user', content: '我选择：A' },
    { role: 'assistant', content: '夸赞1+情境2' },
  ];
  const msgs = buildMessages(history, '选项B');
  // system + 3 history + user = 5
  assert.equal(msgs.length, 5);
  assert.equal(msgs[0]!.role, 'system');
  assert.equal(msgs[1]!.content, '情境1');
  assert.equal(msgs[3]!.content, '夸赞1+情境2');
  assert.equal(msgs[4]!.role, 'user');
  assert.equal(msgs[4]!.content, choicePrompt('选项B'));
});

test('buildMessages：消息角色顺序——system 永远首条，user 永远末条', () => {
  const msgs = buildMessages(
    [{ role: 'assistant', content: 'x' }],
    '选择',
    { title: '善人', deedCount: 3 },
  );
  assert.equal(msgs[0]!.role, 'system');
  assert.equal(msgs.at(-1)!.role, 'user');
});

test('buildMessages：context 注入境界摘要，含 title 与 deedCount', () => {
  const ctx: PlayerContext = { title: '至善尊者', deedCount: 42 };
  const msgs = buildMessages([], '', ctx);
  // system + 境界摘要 system + 难度递进 system + user = 4
  assert.equal(msgs.length, 4);
  assert.equal(msgs[1]!.role, 'system');
  assert.ok(msgs[1]!.content.includes('至善尊者'));
  assert.ok(msgs[1]!.content.includes('42'));
});

test('buildMessages：context.dominantTone 缺失 → 摘要不含语气片段但仍注入', () => {
  const ctx: PlayerContext = { title: '善人', deedCount: 1 }; // 无 dominantTone
  const msgs = buildMessages([], '', ctx);
  assert.equal(msgs.length, 4);
  assert.ok(msgs[1]!.content.includes('善人'));
  assert.ok(msgs[1]!.content.includes('境界')); // 仍有递进呼应文案
});

test('buildMessages：context.dominantTone 存在 → 摘要含语气描述', () => {
  const ctx: PlayerContext = { title: '善人', deedCount: 1, dominantTone: '佛系' };
  const msgs = buildMessages([], '', ctx);
  assert.ok(msgs[1]!.content.includes('佛系'));
});

test('buildMessages：无 context → 不注入境界摘要（仅 system + user）', () => {
  const msgs = buildMessages([], '选择');
  assert.equal(msgs.length, 2);
  // 不应有第 3 条
  assert.equal(msgs.filter((m) => m.role === 'system').length, 1);
});

test('buildMessages：SYSTEM_PROMPT 注入且不被 history 覆盖（每次重建）', () => {
  // 即便 history 含 system，buildMessages 仍只注入一次自己的 SYSTEM_PROMPT
  const history: Message[] = [{ role: 'system', content: '伪造的旧 system' }];
  const msgs = buildMessages(history, '');
  const sysMsgs = msgs.filter((m) => m.role === 'system');
  assert.equal(sysMsgs.length, 2); // history 的 1 + 注入的 1
  assert.equal(msgs[0]!.content, SYSTEM_PROMPT); // 注入的在前
});

/**
 * 大善系统 —— 单元测试。
 *
 * 覆盖：JSON 解析校验、StubLLM/Fallback 回退逻辑、预设情境库结构完整性。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse, normalizeResponse, createLLM, type LLMClient } from '../shared/llm.ts';
import {
  fallbackScriptCount,
  fallbackScripts,
  pickFallbackFirstSituation,
  pickFallbackTurn,
} from '../shared/fallback.ts';
import { buildMessages, SYSTEM_PROMPT } from '../shared/prompt.ts';
import { escapeHtml } from '../shared/ledgerCore.ts';
import type { ChatResponse } from '../shared/types.ts';

// ─── parseJsonResponse ───────────────────────────────────────

test('parseJsonResponse: 纯 JSON 可解析', () => {
  const raw = '{"type":"situation","situation":"x","choices":[]}';
  const data = parseJsonResponse(raw);
  assert.equal((data as { type: string }).type, 'situation');
});

test('parseJsonResponse: ```json 代码块包裹可解析', () => {
  const raw = '```json\n{"type":"turn","praise":"好"}\n```';
  const data = parseJsonResponse(raw);
  assert.equal((data as { type: string }).type, 'turn');
});

test('parseJsonResponse: 前后带解释文字可截取解析', () => {
  const raw = '好的，这是结果：\n{"type":"situation","situation":"y"}\n以上。';
  const data = parseJsonResponse(raw);
  assert.equal((data as { situation: string }).situation, 'y');
});

test('parseJsonResponse: 完全非 JSON 抛错', () => {
  assert.throws(() => parseJsonResponse('我啥也不是'), /无法从 LLM 响应中解析 JSON/);
});

// ─── normalizeResponse ───────────────────────────────────────

test('normalizeResponse: 合法 situation 通过', () => {
  const data = {
    type: 'situation',
    situation: '公交车上让座',
    choices: [
      { id: 'A', text: '让座' },
      { id: 'B', text: '不让' },
    ],
  };
  const res = normalizeResponse(data, '') as Extract<ChatResponse, { type: 'situation' }>;
  assert.equal(res.type, 'situation');
  assert.equal(res.situation, '公交车上让座');
  assert.equal(res.choices.length, 2);
});

test('normalizeResponse: choices 少于 2 个抛错', () => {
  const data = { type: 'situation', situation: 'x', choices: [{ id: 'A', text: 'a' }] };
  assert.throws(() => normalizeResponse(data, ''), /choices 数量非法/);
});

test('normalizeResponse: choices 多于 4 个抛错', () => {
  const data = {
    type: 'situation',
    situation: 'x',
    choices: [
      { id: 'A', text: 'a' },
      { id: 'B', text: 'b' },
      { id: 'C', text: 'c' },
      { id: 'D', text: 'd' },
      { id: 'E', text: 'e' },
    ],
  };
  assert.throws(() => normalizeResponse(data, ''), /choices 数量非法/);
});

test('normalizeResponse: 合法 turn 通过，tone 校验', () => {
  const data = {
    type: 'turn',
    praise: '你太善良了',
    tone: '佛系',
    nextSituation: '下一个',
    choices: [
      { id: 'A', text: 'a' },
      { id: 'B', text: 'b' },
    ],
  };
  const res = normalizeResponse(data, '让座') as Extract<ChatResponse, { type: 'turn' }>;
  assert.equal(res.type, 'turn');
  assert.equal(res.tone, '佛系');
  assert.equal(res.next.situation, '下一个');
});

test('normalizeResponse: tone 非法时回退为「庄严」', () => {
  const data = {
    type: 'turn',
    praise: '好',
    tone: '瞎编的语气',
    nextSituation: 'x',
    choices: [
      { id: 'A', text: 'a' },
      { id: 'B', text: 'b' },
    ],
  };
  const res = normalizeResponse(data, 'x') as Extract<ChatResponse, { type: 'turn' }>;
  assert.equal(res.tone, '庄严');
});

test('normalizeResponse: choice.id 缺失时自动按字母补全', () => {
  const data = {
    type: 'situation',
    situation: 'x',
    choices: [{ text: 'a' }, { text: 'b' }],
  };
  const res = normalizeResponse(data, '') as Extract<ChatResponse, { type: 'situation' }>;
  assert.equal(res.choices[0]!.id, 'A');
  assert.equal(res.choices[1]!.id, 'B');
});

// ─── fallback 预设库 ─────────────────────────────────────────

test('fallback: 剧本数量 >= 6', () => {
  assert.ok(fallbackScriptCount() >= 6, '预设剧本至少应有 6 个');
});

test('fallback: 每个剧本的 praises 覆盖其全部选项文案', () => {
  for (const script of fallbackScripts()) {
    for (const choice of script.situation.choices) {
      assert.ok(
        script.praises[choice.text],
        `剧本「${script.situation.situation.slice(0, 12)}…」缺少选项「${choice.text}」的夸赞`,
      );
    }
    assert.ok(script.fallback.text, '每个剧本都应有兜底夸赞');
  }
});

test('fallback: pickFallbackFirstSituation 返回第一个剧本的情境', () => {
  const first = pickFallbackFirstSituation();
  assert.ok(first.situation.length > 0);
  assert.ok(first.choices.length >= 2 && first.choices.length <= 4);
});

test('fallback: pickFallbackTurn 对真实选项返回对应剧本的夸赞', () => {
  // 取一个真实剧本的真实选项文案来测（不依赖游标推进顺序）
  const scripts = fallbackScripts();
  const choice = scripts[1]!.situation.choices[0]!.text; // 第2个剧本的第1个选项
  const turn = pickFallbackTurn(choice);
  assert.ok(turn.praise.length > 0);
  assert.ok(['庄严', '戏谑', '佛系', '学术', '江湖', '温情'].includes(turn.tone));
  assert.ok(turn.next.choices.length >= 2);
  // 夸赞应来自该选项所属剧本（而非其他剧本）
  const expected = scripts[1]!.praises[choice]!;
  assert.equal(turn.praise, expected.text);
});

test('fallback: pickFallbackTurn 不依赖游标顺序（核心 bug 修复）', () => {
  // 模拟：直接对第 4 个剧本的选项调用，不经过前面的剧本
  // 旧逻辑会因游标错位而取到错误剧本的夸赞；新逻辑应正确匹配
  const scripts = fallbackScripts();
  const targetScript = scripts[3]!; // 第4个剧本（算法生死）
  const choice = targetScript.situation.choices[1]!.text;
  const turn = pickFallbackTurn(choice);
  assert.equal(turn.praise, targetScript.praises[choice]!.text);
  assert.equal(turn.tone, targetScript.praises[choice]!.tone);
});

test('fallback: pickFallbackTurn 对自由文本返回兜底夸赞', () => {
  pickFallbackFirstSituation();
  const turn = pickFallbackTurn('我啥也不干就躺着');
  assert.ok(turn.praise.length > 0);
  assert.ok(turn.next.situation.length > 0);
});

// ─── createLLM 回退逻辑 ─────────────────────────────────────

test('createLLM: 无 API Key 时返回 FallbackClient', () => {
  // 确保测试环境没有注入 key
  const saved = process.env['KINDNESS_LLM_API_KEY'];
  delete process.env['KINDNESS_LLM_API_KEY'];
  const client: LLMClient = createLLM();
  assert.equal(client.isStub, true);
  // 还原
  if (saved !== undefined) process.env['KINDNESS_LLM_API_KEY'] = saved;
});

// ─── prompt 构造 ─────────────────────────────────────────────

test('prompt: SYSTEM_PROMPT 包含核心铁律', () => {
  assert.ok(SYSTEM_PROMPT.includes('大好人'), 'system prompt 应包含「大好人」主旨');
  assert.ok(SYSTEM_PROMPT.includes('JSON'), 'system prompt 应规定 JSON 输出');
});

test('prompt: buildMessages 首回合注入 system + user 且无 choice', () => {
  const msgs = buildMessages([], '');
  assert.equal(msgs[0]!.role, 'system');
  assert.equal(msgs[msgs.length - 1]!.role, 'user');
  assert.ok(!msgs[msgs.length - 1]!.content.includes('我选择'));
});

test('prompt: buildMessages 带选择时 user 消息含选择文案', () => {
  const msgs = buildMessages([], '让座');
  const last = msgs[msgs.length - 1]!;
  assert.ok(last.content.includes('让座'));
});

test('prompt: buildMessages 注入境界摘要（context）让 LLM 递进呼应', () => {
  const msgs = buildMessages([], '让座', {
    title: '大善之人',
    deedCount: 5,
    dominantTone: '佛系',
  });
  // 应有一条 system 消息含称号与 deeds 数
  const ctxMsg = msgs.find((m) => m.role === 'system' && m.content.includes('大善之人'));
  assert.ok(ctxMsg, '应注入含称号的境界摘要 system 消息');
  assert.ok(ctxMsg!.content.includes('5'), '应含 deeds 数');
  assert.ok(ctxMsg!.content.includes('佛系'), '应含主导语气');
});

test('prompt: buildMessages 无 context 时不注入境界摘要', () => {
  const msgs = buildMessages([], '让座');
  const ctxMsg = msgs.find((m) => m.role === 'system' && m.content.includes('玩家当前境界'));
  assert.equal(ctxMsg, undefined);
});

// ─── escapeHtml（安全相关） ─────────────────────────────────

test('escapeHtml: 转义 HTML 特殊字符，防注入', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('"quote"'), '&quot;quote&quot;');
  // 普通中文不受影响
  assert.equal(escapeHtml('大善'), '大善');
  // 空串
  assert.equal(escapeHtml(''), '');
});

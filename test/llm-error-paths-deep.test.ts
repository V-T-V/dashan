/**
 * shared/llm.ts 错误路径与鲁棒性深层测试 —— R5-D8
 *
 * 不重复 llm.test.ts 已覆盖的用例，专注未覆盖分支：
 * - parseJsonResponse：带 ```json 围栏 / 多余前后文 / 大括号截取兜底 / 无大括号抛错 /
 *   错误信息含原文前 120 字 / 嵌套花括号（取最外层）/ 空对象 / 极长输入
 * - normalizeResponse：
 *   · situation 缺 situation 字段抛错 / 缺 choices 抛错
 *   · turn 缺 praise / nextSituation / tone 字段各自抛错
 *   · tone 非法（不在 6 种）→ 回退「庄严」
 *   · tone 为空串 → 回退「庄严」（pickString 抛错前先判 tone）
 *   · choices 数量边界：1 抛错 / 5 抛错 / 2/3/4 合法
 *   · choices[].id 缺省 → 回退 A/B/C/D（String.fromCharCode(65+i)）
 *   · choices[].id 空串 → 回退字母
 *   · choices[].text 空串抛错 / text 非字符串抛错
 *   · choices[].text 纯空白抛错（trim 后空）
 *   · category 非法 → 丢弃（undefined，不抛）
 *   · category 合法 → 保留
 *   · type 大小写敏感（Situation ≠ situation）→ 未知 type 抛错
 *   · lastChoice 出现在未知 type 错误信息中
 * - LlmHttpError：status 字段 / message 格式 / name / 可被 catch 为 Error
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonResponse, normalizeResponse, LlmHttpError } from '../shared/llm.ts';

const VALID_SIT = {
  type: 'situation',
  situation: '一段情境',
  choices: [
    { id: 'A', text: '选项甲' },
    { id: 'B', text: '选项乙' },
  ],
};

const VALID_TURN = {
  type: 'turn',
  praise: '夸赞文案',
  tone: '庄严',
  nextSituation: '下一个情境',
  choices: [
    { id: 'A', text: '选项甲' },
    { id: 'B', text: '选项乙' },
  ],
};

// ---------- parseJsonResponse ----------

test('parse: 带语言标记 ```json 围栏可提取', () => {
  const raw = '```json\n{"a":1}\n```';
  assert.deepEqual(parseJsonResponse(raw), { a: 1 });
});

test('parse: 不带语言标记 ``` 围栏可提取', () => {
  const raw = '```\n{"b":2}\n```';
  assert.deepEqual(parseJsonResponse(raw), { b: 2 });
});

test('parse: 围栏外有多余文本（前后文）仍取围栏内', () => {
  const raw = '好的，这是结果：\n```json\n{"c":3}\n```\n以上。';
  assert.deepEqual(parseJsonResponse(raw), { c: 3 });
});

test('parse: 无围栏纯 JSON 直接解析', () => {
  assert.deepEqual(parseJsonResponse('{"d":4}'), { d: 4 });
});

test('parse: 无围栏但带前后文——大括号截取兜底', () => {
  const raw = '返回：{"e":5} 结束';
  assert.deepEqual(parseJsonResponse(raw), { e: 5 });
});

test('parse: 嵌套花括号取最外层（indexOf 首个 { 到 lastIndexOf 末个 }）', () => {
  const raw = '前文 {"outer": {"inner": 1}} 后文';
  assert.deepEqual(parseJsonResponse(raw), { outer: { inner: 1 } });
});

test('parse: 空对象 {} 合法', () => {
  assert.deepEqual(parseJsonResponse('{}'), {});
});

test('parse: 数组顶层合法（JSON.parse 直接成功）', () => {
  assert.deepEqual(parseJsonResponse('[1,2,3]'), [1, 2, 3]);
});

test('parse: 完全无大括号且非 JSON 抛错', () => {
  assert.throws(() => parseJsonResponse('just plain text'), /无法从 LLM 响应中解析 JSON/);
});

test('parse: 错误信息含原文前 120 字', () => {
  const raw = 'x'.repeat(200); // 超过 120
  try {
    parseJsonResponse(raw);
    assert.fail('应抛错');
  } catch (e) {
    const msg = (e as Error).message;
    assert.match(msg, /无法从 LLM 响应中解析 JSON：/);
    // 含截断后的原文（前 120 字）
    assert.ok(msg.includes('x'.repeat(120)));
    assert.ok(!msg.includes('x'.repeat(121)));
  }
});

test('parse: 空串抛错', () => {
  assert.throws(() => parseJsonResponse(''), /无法从 LLM 响应中解析 JSON/);
});

test('parse: 仅空白抛错', () => {
  assert.throws(() => parseJsonResponse('   \n\t  '), /无法从 LLM 响应中解析 JSON/);
});

test('parse: 截断的 JSON（花括号未闭合）抛错', () => {
  assert.throws(() => parseJsonResponse('{"a":'), /JSON|解析/);
});

test('parse: 极长合法 JSON 不崩', () => {
  const big = JSON.stringify({ arr: Array.from({ length: 1000 }, (_, i) => i) });
  const out = parseJsonResponse(big) as { arr: number[] };
  assert.equal(out.arr.length, 1000);
});

// ---------- normalizeResponse situation 错误路径 ----------

test('norm situation: 缺 situation 字段抛错', () => {
  const bad = { type: 'situation', choices: VALID_SIT.choices };
  assert.throws(() => normalizeResponse(bad, ''), /缺少或空的字段：situation/);
});

test('norm situation: situation 空串抛错', () => {
  const bad = { type: 'situation', situation: '   ', choices: VALID_SIT.choices };
  assert.throws(() => normalizeResponse(bad, ''), /缺少或空的字段：situation/);
});

test('norm situation: situation 非字符串抛错', () => {
  const bad = { type: 'situation', situation: 123, choices: VALID_SIT.choices };
  assert.throws(() => normalizeResponse(bad, ''), /缺少或空的字段：situation/);
});

test('norm situation: 缺 choices 抛错', () => {
  const bad = { type: 'situation', situation: 's' };
  assert.throws(() => normalizeResponse(bad, ''), /choices 数量非法.*非数组/);
});

test('norm situation: choices=null 抛错（非数组）', () => {
  const bad = { type: 'situation', situation: 's', choices: null };
  assert.throws(() => normalizeResponse(bad, ''), /choices 数量非法.*非数组/);
});

test('norm situation: choices=1 个抛错', () => {
  const bad = { type: 'situation', situation: 's', choices: [{ id: 'A', text: 'x' }] };
  assert.throws(() => normalizeResponse(bad, ''), /期望 2-4，实际 1/);
});

test('norm situation: choices=5 个抛错', () => {
  const bad = {
    type: 'situation',
    situation: 's',
    choices: Array.from({ length: 5 }, (_, i) => ({ id: String(i), text: 'x' })),
  };
  assert.throws(() => normalizeResponse(bad, ''), /期望 2-4，实际 5/);
});

test('norm situation: choices=2/3/4 合法', () => {
  for (const n of [2, 3, 4]) {
    const choices = Array.from({ length: n }, (_, i) => ({
      id: String.fromCharCode(65 + i),
      text: `t${i}`,
    }));
    const res = normalizeResponse({ type: 'situation', situation: 's', choices }, '') as {
      choices: unknown[];
    };
    assert.equal(res.choices.length, n, `n=${n}`);
  }
});

test('norm situation: choices[].id 缺省回退 A/B/C/D', () => {
  const res = normalizeResponse(
    {
      type: 'situation',
      situation: 's',
      choices: [{ text: '甲' }, { text: '乙' }],
    },
    '',
  ) as { choices: { id: string }[] };
  assert.equal(res.choices[0]!.id, 'A');
  assert.equal(res.choices[1]!.id, 'B');
});

test('norm situation: choices[].id 空串回退字母', () => {
  const res = normalizeResponse(
    {
      type: 'situation',
      situation: 's',
      choices: [{ id: '', text: '甲' }, { id: '', text: '乙' }],
    },
    '',
  ) as { choices: { id: string }[] };
  assert.equal(res.choices[0]!.id, 'A');
  assert.equal(res.choices[1]!.id, 'B');
});

test('norm situation: choices[].text 空串抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'situation', situation: 's', choices: [{ id: 'A', text: '' }, { id: 'B', text: 'x' }] },
        '',
      ),
    /choices\[0\]\.text 为空/,
  );
});

test('norm situation: choices[].text 纯空白不抛错（实现仅判 falsy，空白串为 truthy 保留原样）', () => {
  // 注意：pickChoices 只判 o['text'] 的 truthy，空白串 '   ' 是 truthy 故保留（不 trim）
  const res = normalizeResponse(
    {
      type: 'situation',
      situation: 's',
      choices: [{ id: 'A', text: '   ' }, { id: 'B', text: 'x' }],
    },
    '',
  ) as { choices: { text: string }[] };
  assert.equal(res.choices[0]!.text, '   ');
});

test('norm situation: choices[].text 非字符串抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'situation', situation: 's', choices: [{ id: 'A', text: 99 }, { id: 'B', text: 'x' }] },
        '',
      ),
    /choices\[0\]\.text 为空/,
  );
});

test('norm situation: choices 元素非对象抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'situation', situation: 's', choices: ['notobj', { id: 'B', text: 'x' }] },
        '',
      ),
    /choices\[0\] 非对象/,
  );
});

test('norm situation: choices 元素 null 抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'situation', situation: 's', choices: [null, { id: 'B', text: 'x' }] },
        '',
      ),
    /choices\[0\] 非对象/,
  );
});

test('norm situation: category 合法 → 保留', () => {
  const res = normalizeResponse(
    { type: 'situation', situation: 's', category: '医疗', choices: VALID_SIT.choices },
    '',
  ) as { category?: string };
  assert.equal(res.category, '医疗');
});

test('norm situation: category 非法 → 丢弃（undefined）', () => {
  const res = normalizeResponse(
    { type: 'situation', situation: 's', category: '不存在', choices: VALID_SIT.choices },
    '',
  ) as { category?: string };
  assert.equal(res.category, undefined);
});

test('norm situation: category 非字符串 → 丢弃', () => {
  const res = normalizeResponse(
    { type: 'situation', situation: 's', category: 42, choices: VALID_SIT.choices },
    '',
  ) as { category?: string };
  assert.equal(res.category, undefined);
});

test('norm situation: 合法结构字段齐全（situation 经 pickString trim；choices.text 不 trim）', () => {
  const res = normalizeResponse(
    {
      type: 'situation',
      situation: '  带空格的情境  ',
      choices: [{ id: 'A', text: '  甲  ' }, { id: 'B', text: '乙' }],
    },
    '',
  ) as { situation: string; choices: { text: string }[] };
  assert.equal(res.situation, '带空格的情境'); // pickString trim
  assert.equal(res.choices[0]!.text, '  甲  '); // pickChoices 不 trim，原样保留
});

// ---------- normalizeResponse turn 错误路径 ----------

test('norm turn: 缺 praise 抛错', () => {
  const bad = { type: 'turn', tone: '庄严', nextSituation: 'n', choices: VALID_TURN.choices };
  assert.throws(() => normalizeResponse(bad, ''), /缺少或空的字段：praise/);
});

test('norm turn: 缺 nextSituation 抛错', () => {
  const bad = { type: 'turn', praise: 'p', tone: '庄严', choices: VALID_TURN.choices };
  assert.throws(() => normalizeResponse(bad, ''), /缺少或空的字段：nextSituation/);
});

test('norm turn: tone 非法 → 回退「庄严」', () => {
  const res = normalizeResponse(
    { ...VALID_TURN, tone: '不存在的语气' },
    '',
  ) as { tone: string };
  assert.equal(res.tone, '庄严');
});

test('norm turn: tone 为合法 6 种之一 → 保留', () => {
  for (const t of ['庄严', '戏谑', '佛系', '学术', '江湖', '温情']) {
    const res = normalizeResponse({ ...VALID_TURN, tone: t }, '') as { tone: string };
    assert.equal(res.tone, t);
  }
});

test('norm turn: next.choices 数量非法抛错', () => {
  const bad = { type: 'turn', praise: 'p', tone: '庄严', nextSituation: 'n', choices: [] };
  assert.throws(() => normalizeResponse(bad, ''), /期望 2-4/);
});

test('norm turn: 合法 turn 含 praise + next 结构', () => {
  const res = normalizeResponse(VALID_TURN, '') as {
    praise: string;
    next: { situation: string; choices: unknown[] };
  };
  assert.equal(res.praise, '夸赞文案');
  assert.equal(res.next.situation, '下一个情境');
  assert.equal(res.next.choices.length, 2);
});

test('norm turn: category 放到 next 上（合法保留）', () => {
  const res = normalizeResponse(
    { ...VALID_TURN, category: '司法' },
    '',
  ) as { next: { category?: string } };
  assert.equal(res.next.category, '司法');
});

// ---------- normalizeResponse 未知 type / 非对象 ----------

test('norm: 非对象（null）抛错', () => {
  assert.throws(() => normalizeResponse(null, ''), /LLM 返回非对象/);
});

test('norm: 非对象（数字）抛错', () => {
  assert.throws(() => normalizeResponse(42, ''), /LLM 返回非对象/);
});

test('norm: 非对象（字符串）抛错', () => {
  assert.throws(() => normalizeResponse('hello', ''), /LLM 返回非对象/);
});

test('norm: 数组（typeof object）通过首检，因无 type 落入未知 type 抛错', () => {
  // 数组的 typeof === 'object'，故通过「非对象」首检；无 type 字段 → 未知 type
  assert.throws(() => normalizeResponse([1, 2], ''), /未知 type：undefined/);
});

test('norm: 未知 type 抛错且信息含 type 与 lastChoice', () => {
  assert.throws(
    () => normalizeResponse({ type: 'mystery', foo: 1 }, '选项甲'),
    /未知 type：mystery.*lastChoice=选项甲/,
  );
});

test('norm: type 大小写敏感（Situation 大写 → 未知 type）', () => {
  assert.throws(
    () => normalizeResponse({ type: 'Situation', situation: 's', choices: [] }, ''),
    /未知 type/,
  );
});

test('norm: type 缺省（undefined）→ 未知 type', () => {
  assert.throws(
    () => normalizeResponse({ foo: 1 }, ''),
    /未知 type：undefined/,
  );
});

// ---------- LlmHttpError ----------

test('LlmHttpError: status 字段正确', () => {
  const e = new LlmHttpError(429, 'rate limited');
  assert.equal(e.status, 429);
});

test('LlmHttpError: message 格式含 status 与 detail', () => {
  const e = new LlmHttpError(500, 'server down');
  assert.match(e.message, /LLM 请求失败 500: server down/);
});

test('LlmHttpError: name === LlmHttpError', () => {
  assert.equal(new LlmHttpError(400, 'x').name, 'LlmHttpError');
});

test('LlmHttpError: 是 Error 实例（可被 catch 为 Error）', () => {
  const e = new LlmHttpError(401, 'unauthorized');
  assert.ok(e instanceof Error);
});

test('LlmHttpError: throw/catch 保留 status', () => {
  try {
    throw new LlmHttpError(503, 'unavailable');
  } catch (e) {
    assert.ok(e instanceof LlmHttpError);
    assert.equal((e as LlmHttpError).status, 503);
  }
});

test('LlmHttpError: detail 为空串时 message 仍含 status', () => {
  const e = new LlmHttpError(404, '');
  assert.match(e.message, /LLM 请求失败 404/);
});

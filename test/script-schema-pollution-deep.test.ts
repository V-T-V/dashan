/**
 * 大善系统 —— scriptSchema 类型污染与结构异常深层测试。
 *
 * 补充 script-validate-edge 未覆盖的「输入是合法 JSON 但类型/结构被污染」场景：
 *  - 顶层非对象（数组/数字/字符串/null）
 *  - situation/choices/praises/fallback 字段类型污染（数组当对象、对象当数组）
 *  - choice 元素为非对象（null/数字/字符串）
 *  - praises 的 value 为非对象（字符串/数组/null）
 *  - praises 含多余 key（不应报错，且应通过校验）
 *  - 数值型 text（typeof !== 'string'）
 *  - 嵌套 null（situation.situation = null）
 *  - validateUserScripts 非数组输入（对象/数字/null）
 *  - 大批量校验性能与顺序（100 个剧本）
 *  - 合法剧本的 script 字段结构完整可消费
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateUserScript, validateUserScripts } from '../shared/scriptSchema.ts';

/** 合法剧本模板。 */
function validScript(): Record<string, unknown> {
  return {
    situation: {
      situation: '困境描述',
      choices: [
        { id: 'A', text: '选项甲' },
        { id: 'B', text: '选项乙' },
      ],
    },
    praises: {
      选项甲: { text: '夸甲', tone: '庄严' },
      选项乙: { text: '夸乙', tone: '佛系' },
    },
    fallback: { text: '兜底夸赞', tone: '温情' },
  };
}

// ── 顶层非对象 ─────────────────────────────────────────

test('pollution: 顶层为数组 → 报「需为 JSON 对象」', () => {
  const r = validateUserScript([1, 2, 3]);
  assert.equal(r.ok, false);
  assert.equal(r.script, undefined);
  assert.ok(r.errors.some((e) => e.includes('对象')));
});

test('pollution: 顶层为数字 → 报错', () => {
  const r = validateUserScript(42);
  assert.equal(r.ok, false);
});

test('pollution: 顶层为字符串 → 报错', () => {
  const r = validateUserScript('{"situation":1}');
  assert.equal(r.ok, false);
});

test('pollution: 顶层为 null → 报错', () => {
  const r = validateUserScript(null);
  assert.equal(r.ok, false);
});

test('pollution: 顶层为 boolean → 报错', () => {
  const r = validateUserScript(true);
  assert.equal(r.ok, false);
});

// ── situation 字段类型污染 ─────────────────────────────

test('pollution: situation 为数组（非对象）→ 报错', () => {
  const s = validScript();
  s['situation'] = [1, 2];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('pollution: situation 为字符串 → 报错', () => {
  const s = validScript();
  s['situation'] = '一段描述';
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

test('pollution: situation.situation 为 null → 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['situation'] = null;
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

test('pollution: situation.situation 为数字 → 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['situation'] = 123;
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

// ── choices 类型污染 ───────────────────────────────────

test('pollution: choices 非数组（对象）→ 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = { a: 1 };
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices')));
});

test('pollution: choices 单选项（< 2）→ 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [{ text: '唯一选项' }];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('2-4')));
});

test('pollution: choice 元素为 null → 报 choices[i] 需为对象', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [
    null,
    { text: '选项乙' },
  ];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices[0]') && e.includes('对象')));
});

test('pollution: choice 元素为数字 → 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [42, { text: '选项乙' }];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

test('pollution: choice.text 为数字 → 报错', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [
    { text: 100 },
    { text: '选项乙' },
  ];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices[0].text')));
});

// ── praises 类型污染 ───────────────────────────────────

test('pollution: praises 为数组 → 报错', () => {
  const s = validScript();
  s['praises'] = [];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('praises')));
});

test('pollution: praises value 为字符串 → 报错', () => {
  const s = validScript();
  s['praises'] = { 选项甲: '仅字符串', 选项乙: { text: '夸', tone: '佛系' } };
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('praises') && e.includes('对象')));
});

test('pollution: praises value 为 null → 报错', () => {
  const s = validScript();
  s['praises'] = { 选项甲: null, 选项乙: { text: '夸', tone: '佛系' } };
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

test('pollution: praises.tone 为数字 → 报错', () => {
  const s = validScript();
  s['praises'] = {
    选项甲: { text: '夸', tone: 5 },
    选项乙: { text: '夸', tone: '佛系' },
  };
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
});

test('pollution: praises 含多余 key（合法）→ 不报错', () => {
  // 多余的 praise key 不影响校验（一致性只检查每个 choice 是否有 praise）
  const s = validScript();
  s['praises'] = {
    选项甲: { text: '夸甲', tone: '庄严' },
    选项乙: { text: '夸乙', tone: '佛系' },
    不存在的选项: { text: '多余', tone: '江湖' },
  };
  const r = validateUserScript(s);
  assert.equal(r.ok, true, '多余 praise key 应被容忍');
});

// ── fallback 类型污染 ──────────────────────────────────

test('pollution: fallback 为数组 → 报错', () => {
  const s = validScript();
  s['fallback'] = [];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('fallback')));
});

test('pollution: fallback.text 为数字 → 报错', () => {
  const s = validScript();
  s['fallback'] = { text: 0, tone: '温情' };
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('fallback') && e.includes('text')));
});

// ── validateUserScripts 非数组输入 ─────────────────────

test('pollution: validateUserScripts 对象（非数组）→ 报「需为数组」', () => {
  const r = validateUserScripts({ a: 1 });
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0]!.includes('数组'));
});

test('pollution: validateUserScripts null → 报错', () => {
  const r = validateUserScripts(null);
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 1);
});

test('pollution: validateUserScripts 字符串 → 报错', () => {
  const r = validateUserScripts('not an array');
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 1);
});

// ── 合法剧本结构完整性 ─────────────────────────────────

test('pollution: 合法剧本返回的 script 字段结构可消费', () => {
  const s = validScript();
  const r = validateUserScript(s);
  assert.equal(r.ok, true);
  assert.ok(r.script);
  // 结构字段齐全
  assert.equal(r.script!.situation.choices.length, 2);
  assert.ok('选项甲' in r.script!.praises);
  assert.equal(r.script!.fallback.tone, '温情');
});

test('pollution: 合法剧本含 4 选项 + 4 praise 完整', () => {
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [
    { text: '一' },
    { text: '二' },
    { text: '三' },
    { text: '四' },
  ];
  s['praises'] = {
    一: { text: 'a', tone: '庄严' },
    二: { text: 'b', tone: '戏谑' },
    三: { text: 'c', tone: '佛系' },
    四: { text: 'd', tone: '学术' },
  };
  const r = validateUserScript(s);
  assert.equal(r.ok, true);
  assert.equal(r.script!.situation.choices.length, 4);
});

// ── 批量性能与顺序 ─────────────────────────────────────

test('pollution: 100 个合法剧本批量校验全部成功', () => {
  const batch = Array.from({ length: 100 }, () => validScript());
  const r = validateUserScripts(batch);
  assert.equal(r.scripts.length, 100);
  assert.equal(r.errors.length, 0);
});

test('pollution: 批量中第 50 个坏剧本错误信息含正确序号', () => {
  const batch = Array.from({ length: 100 }, (_, i) =>
    i === 49 ? { ...validScript(), fallback: null } : validScript(),
  );
  const r = validateUserScripts(batch);
  assert.equal(r.scripts.length, 99);
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0]!.includes('第 50 个剧本'), `应为第 50 个，实际：${r.errors[0]}`);
});

// ── 一致性：所有 6 合法 tone 都接受 ────────────────────

test('pollution: 6 种合法 tone 全部通过校验', () => {
  const tones = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (const tone of tones) {
    const s = validScript();
    (s['praises'] as Record<string, unknown>)['选项甲'] = { text: '夸', tone };
    s['fallback'] = { text: '兜底', tone };
    const r = validateUserScript(s);
    assert.equal(r.ok, true, `tone=${tone} 应通过`);
  }
});

// ── 一致性：相同选项文案重复（两选项同 text） ─────────

test('pollution: 两选项 text 相同 → 一致性校验仍可找到 praise', () => {
  // 边界：choices[0].text === choices[1].text，praises 只需一个该 key
  const s = validScript();
  (s['situation'] as Record<string, unknown>)['choices'] = [
    { text: '相同选项' },
    { text: '相同选项' },
  ];
  s['praises'] = { 相同选项: { text: '夸', tone: '庄严' } };
  const r = validateUserScript(s);
  // 两选项 text 一致，praises 含该 key → 不报「缺少对应夸赞」
  assert.equal(r.ok, true);
});

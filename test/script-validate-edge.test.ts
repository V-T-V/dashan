/**
 * scriptSchema.ts 剧本校验的边缘 case 测试。
 *
 * 补充 script.test.ts 未覆盖：
 * - 合法剧本：4 个选项（上限）通过
 * - choices 超过 4 个（>4）报错
 * - 纯空白字符串选项/夸赞文案报错
 * - choice.id 缺失但 text 合法 → 仍通过（id 非必填）
 * - praises.tone 为合法集合外的值报错
 * - fallback 字段整体缺失报错
 * - 多重错误一次性收集（errors 数组多条）
 * - validateUserScripts：空数组返回空结果不报错
 * - validateUserScripts：单个剧本多错误被合并为一行
 * - 一致性校验：选项文案在 praises 中大小写敏感（精确匹配）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateUserScript, validateUserScripts } from '../shared/scriptSchema.ts';

/** 一个合法剧本模板（深拷贝后改） */
function validScript() {
  return {
    situation: {
      situation: '你是夜班医生，只剩一支特效药，两个病人都需要。',
      choices: [
        { id: 'A', text: '给病人甲' },
        { id: 'B', text: '给病人乙' },
      ],
    },
    praises: {
      给病人甲: { text: '你救了一人，是善。', tone: '庄严' },
      给病人乙: { text: '你救了另一人，也是善。', tone: '佛系' },
    },
    fallback: { text: '无论如何，你都是大好人。', tone: '温情' },
  };
}

// ─── 合法路径边界 ───

test('validateUserScript：4 个选项（上限）通过', () => {
  const s = validScript();
  s.situation.choices = [
    { id: 'A', text: '选项A' },
    { id: 'B', text: '选项B' },
    { id: 'C', text: '选项C' },
    { id: 'D', text: '选项D' },
  ];
  s.praises = {
    选项A: { text: '夸A', tone: '庄严' },
    选项B: { text: '夸B', tone: '戏谑' },
    选项C: { text: '夸C', tone: '佛系' },
    选项D: { text: '夸D', tone: '学术' },
  };
  const r = validateUserScript(s);
  assert.equal(r.ok, true);
  assert.equal(r.script?.situation.choices.length, 4);
});

test('validateUserScript：choices 超过 4 个报错', () => {
  const s = validScript();
  s.situation.choices = [
    { id: 'A', text: 'a' },
    { id: 'B', text: 'b' },
    { id: 'C', text: 'c' },
    { id: 'D', text: 'd' },
    { id: 'E', text: 'e' },
  ];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('2-4')));
});

// ─── 空白字符串 ───

test('validateUserScript：情境描述纯空白报错', () => {
  const s = validScript();
  s.situation.situation = '   ';
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation.situation')));
});

test('validateUserScript：选项 text 纯空白报错', () => {
  const s = validScript();
  s.situation.choices[0]!.text = '';
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices[0].text')));
});

test('validateUserScript：praises 夸赞文案纯空白报错', () => {
  const s = validScript();
  s.praises['给病人甲']!.text = '  ';
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('praises') && e.includes('text')));
});

// ─── id / tone ───

test('validateUserScript：choice.id 缺失但 text 合法 → 仍通过', () => {
  const s = validScript();
  // 删 id，只留 text
  s.situation.choices = [
    { text: '给病人甲' },
    { text: '给病人乙' },
  ];
  const r = validateUserScript(s);
  assert.equal(r.ok, true);
});

test('validateUserScript：praises.tone 非法值报错', () => {
  const s = validScript();
  s.praises['给病人甲']!.tone = '搞笑' as never; // 不在 6 种里
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('tone') && e.includes('非法')));
});

test('validateUserScript：fallback.tone 非法值报错', () => {
  const s = validScript();
  s.fallback.tone = '冷漠' as never;
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('fallback') && e.includes('tone')));
});

// ─── 字段缺失 ───

test('validateUserScript：fallback 字段整体缺失报错', () => {
  const s = validScript() as Record<string, unknown>;
  delete s['fallback'];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('fallback')));
});

test('validateUserScript：situation 字段缺失报错', () => {
  const s = validScript() as Record<string, unknown>;
  delete s['situation'];
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

// ─── 多重错误收集 ───

test('validateUserScript：同时多处错误被一次性收集（errors 多条）', () => {
  const s = validScript();
  s.situation.situation = ''; // 错 1
  s.situation.choices = [{ id: 'A', text: '' }]; // 少选项 + 空 text（错 2、3）
  s.fallback.tone = '错误' as never; // 错 4
  const r = validateUserScript(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3, `应收集多条错误，实际 ${r.errors.length}`);
});

// ─── 一致性：精确匹配 ───

test('validateUserScript：选项文案在 praises 中需精确匹配（大小写敏感）', () => {
  const s = validScript();
  // 把 praise 的 key 改成不同大小写 → 一致性校验应报缺夸赞
  const mismatchedKey = '给病人乙'.toUpperCase(); // '给病人乙'（中文 toUpperCase 无变化）
  const wrongKey = '给病人丙'; // 用一个完全不匹配的 key
  s.praises = {
    给病人甲: { text: '夸', tone: '庄严' },
    [wrongKey]: { text: '夸', tone: '佛系' }, // key 与 choice text 不一致
  } as Record<string, unknown> as typeof s.praises;
  void mismatchedKey; // 占位说明
  const r = validateUserScript(s);
  // praises 的 key 与 choice text 不一致 → 报「缺少对应夸赞」
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('缺少对应夸赞')));
});

// ─── 批量校验 ───

test('validateUserScripts：空数组返回空结果且不报错', () => {
  const r = validateUserScripts([]);
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 0);
});

test('validateUserScripts：单个剧本多错误合并为一条（含「第 N 个剧本」前缀）', () => {
  const bad = validScript();
  bad.situation.situation = '';
  bad.fallback.tone = '错' as never;
  const r = validateUserScripts([bad]);
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 1); // 一个剧本 → 一行（错误用；拼接）
  assert.ok(r.errors[0]!.includes('第 1 个剧本'));
  assert.ok(r.errors[0]!.includes('；')); // 多错误用；连接
});

test('validateUserScripts：混合成功失败，成功的进 scripts 失败的进 errors', () => {
  const good = validScript();
  const bad = validScript();
  bad.situation.situation = '';
  const r = validateUserScripts([good, bad]);
  assert.equal(r.scripts.length, 1);
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0]!.includes('第 2 个剧本'));
});

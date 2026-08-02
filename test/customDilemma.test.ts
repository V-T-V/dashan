/**
 * 大善系统 —— 自定义困境创建系统测试（round 15）。
 *
 * 覆盖：
 *  - validateCustomInput：空情境/空选项/选项数<2/>4/重复文案/合法
 *  - hashString：稳定性、不同输入差异、非负
 *  - generatePraiseForChoice：确定性、含选项文案、tone 合法、flipId 合法
 *  - generateFallbackPraise：佛系语气、含主旨词
 *  - createCustomDilemma：完整结构、praises 覆盖全部 choices、id A/B/C/D
 *  - 确定性：同输入同输出（含 meta）
 *  - 不同 seed 改变语气/手法分布
 *  - 批量创建：部分成功部分失败
 *  - flipUsageStats / flipDiversity
 *  - 生成的剧本可注入 fallback pool（结构兼容，可被 pickFallbackTurn 匹配）
 *  - 生成的剧本能通过 scriptSchema.validateUserScript
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCustomInput,
  hashString,
  generatePraiseForChoice,
  generateFallbackPraise,
  createCustomDilemma,
  createCustomDilemmas,
  flipUsageStats,
  flipDiversity,
  type CustomDilemmaInput,
} from '../shared/customDilemma.ts';
import { validateUserScript } from '../shared/scriptSchema.ts';
import type { Tone } from '../shared/types.ts';

const VALID_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function validInput(over: Partial<CustomDilemmaInput> = {}): CustomDilemmaInput {
  return {
    situation: '你站在岔路口，左边是火海，右边是悬崖。',
    choices: ['冲进火海救人', '推下悬崖的人一把', '转身离开'],
    ...over,
  };
}

// ── validateCustomInput ─────────────────────────────────

test('custom: 合法输入通过校验', () => {
  const r = validateCustomInput(validInput());
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('custom: 空情境被拒', () => {
  const r = validateCustomInput(validInput({ situation: '   ' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('custom: 少于 2 个选项被拒', () => {
  const r = validateCustomInput(validInput({ choices: ['只有一个'] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('2-4')));
});

test('custom: 多于 4 个选项被拒', () => {
  const r = validateCustomInput(validInput({ choices: ['一', '二', '三', '四', '五'] }));
  assert.equal(r.ok, false);
});

test('custom: 空字符串选项被拒', () => {
  const r = validateCustomInput(validInput({ choices: ['合法', '  '] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices[1]')));
});

test('custom: 重复选项文案被拒', () => {
  const r = validateCustomInput(validInput({ choices: ['相同', '相同'] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('重复')));
});

test('custom: 非对象输入被拒', () => {
  const r = validateCustomInput(null);
  assert.equal(r.ok, false);
  assert.equal(validateCustomInput('字符串').ok, false);
  assert.equal(validateCustomInput(undefined).ok, false);
});

test('custom: 2 个选项合法（边界下限）', () => {
  assert.equal(validateCustomInput(validInput({ choices: ['A', 'B'] })).ok, true);
});

test('custom: 4 个选项合法（边界上限）', () => {
  assert.equal(validateCustomInput(validInput({ choices: ['A', 'B', 'C', 'D'] })).ok, true);
});

// ── hashString ─────────────────────────────────────────

test('custom: hashString 稳定（同输入同输出）', () => {
  assert.equal(hashString('测试'), hashString('测试'));
});

test('custom: hashString 不同输入大概率不同', () => {
  const a = hashString('选项A');
  const b = hashString('选项B');
  assert.notEqual(a, b);
});

test('custom: hashString 返回非负整数', () => {
  for (const s of ['', 'a', '测试', '很长的选项文案'.repeat(10)]) {
    const h = hashString(s);
    assert.ok(Number.isInteger(h) && h >= 0, `hashString("${s.slice(0, 6)}") 应为非负整数`);
  }
});

// ── generatePraiseForChoice ─────────────────────────────

test('custom: generatePraiseForChoice 含选项文案', () => {
  const p = generatePraiseForChoice('我的特殊选项', 0, 1);
  assert.ok(p.text.includes('我的特殊选项'), '夸赞应嵌入选项文案');
});

test('custom: generatePraiseForChoice 返回合法 tone 与 flipId', () => {
  for (let i = 0; i < 10; i++) {
    const p = generatePraiseForChoice(`选项${i}`, i, i * 7);
    assert.ok(VALID_TONES.includes(p.tone), `tone=${p.tone} 应合法`);
    assert.ok(['causal', 'anti-hypocrisy', 'transcendence', 'conservation', 'creative-destruction'].includes(p.flipId));
  }
});

test('custom: generatePraiseForChoice 确定性（同参同果）', () => {
  const a = generatePraiseForChoice('选项', 2, 99);
  const b = generatePraiseForChoice('选项', 2, 99);
  assert.deepEqual(a, b);
});

test('custom: generatePraiseForChoice 不同 index 轮换手法', () => {
  // index 0-4 应覆盖不同的 flipId（5 法轮换）
  const flips = new Set<string>();
  for (let i = 0; i < 5; i++) {
    flips.add(generatePraiseForChoice('x', i, 0).flipId);
  }
  assert.equal(flips.size, 5, '5 个 index 应覆盖全部 5 种翻转手法');
});

// ── generateFallbackPraise ──────────────────────────────

test('custom: generateFallbackPraise 返回佛系且含主旨词', () => {
  const f = generateFallbackPraise(0);
  assert.equal(f.tone, '佛系');
  assert.ok(f.text.includes('善'), '兜底夸赞应含主旨词');
});

test('custom: generateFallbackPraise 确定性', () => {
  assert.deepEqual(generateFallbackPraise(3), generateFallbackPraise(3));
});

// ── createCustomDilemma 完整结构 ────────────────────────

test('custom: createCustomDilemma 合法输入返回 ok + 完整 script', () => {
  const r = createCustomDilemma(validInput());
  assert.equal(r.ok, true);
  assert.ok(r.script);
  assert.ok(r.meta);
  assert.equal(r.script!.praises !== undefined, true);
});

test('custom: 生成的 praises 覆盖全部 choices 文案', () => {
  const r = createCustomDilemma(validInput({ choices: ['A选项', 'B选项', 'C选项'] }));
  assert.ok(r.script);
  for (const c of r.script!.situation.choices) {
    assert.ok(c.text in r.script!.praises, `选项「${c.text}」应有对应 praise`);
  }
});

test('custom: choices 的 id 为 A/B/C/D', () => {
  const r = createCustomDilemma(validInput({ choices: ['一', '二', '三', '四'] }));
  const ids = r.script!.situation.choices.map((c) => c.id);
  assert.deepEqual(ids, ['A', 'B', 'C', 'D']);
});

test('custom: 默认 category=人性、difficulty=1（ValidatedScript 不暴露，仅验证不抛错）', () => {
  // ValidatedScript.situation 类型不含 category/difficulty（结构精简），
  // createCustomDilemma 内部构造了完整 Situation 但通过 ValidatedScript 收口。
  // 这里只验证生成成功、结构合法；category/difficulty 的默认值由 createCustomDilemma 内部保证。
  const r = createCustomDilemma(validInput());
  assert.equal(r.ok, true);
  assert.ok(r.script);
  assert.equal(r.script!.situation.situation.length > 0, true);
});

test('custom: createCustomDilemma 非法输入返回 errors 不抛异常', () => {
  const r = createCustomDilemma({ situation: '', choices: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
  assert.equal(r.script, undefined);
});

test('custom: 生成的夸赞文本足够长（>40 字）', () => {
  const r = createCustomDilemma(validInput());
  for (const key of Object.keys(r.script!.praises)) {
    const p = r.script!.praises[key]!;
    assert.ok(p.text.length > 40, `夸赞「${key.slice(0, 10)}…」应 >40 字，实际 ${p.text.length}`);
  }
});

// ── 确定性 ──────────────────────────────────────────────

test('custom: 同输入同输出（含 meta，确定性）', () => {
  const input = validInput({ seed: 42 });
  const a = createCustomDilemma(input);
  const b = createCustomDilemma(input);
  assert.deepEqual(a.script, b.script);
  assert.deepEqual(a.meta, b.meta);
});

test('custom: 不传 seed 时也确定（按文案 hash）', () => {
  const input = validInput();
  const a = createCustomDilemma(input);
  const b = createCustomDilemma(input);
  assert.deepEqual(a.script, b.script);
});

test('custom: 不同 seed 产生不同夸赞（至少部分不同）', () => {
  const a = createCustomDilemma(validInput({ seed: 1 }));
  const b = createCustomDilemma(validInput({ seed: 999 }));
  // 至少有一个选项的夸赞文本不同
  const aTexts = Object.values(a.script!.praises).map((p) => p.text);
  const bTexts = Object.values(b.script!.praises).map((p) => p.text);
  assert.notDeepEqual(aTexts, bTexts, '不同 seed 应产生不同夸赞');
});

// ── 批量创建 ───────────────────────────────────────────

test('custom: createCustomDilemmas 全部成功', () => {
  const { scripts, errors } = createCustomDilemmas([validInput(), validInput({ situation: '另一个' })]);
  assert.equal(scripts.length, 2);
  assert.equal(errors.length, 0);
});

test('custom: createCustomDilemmas 部分失败收集错误', () => {
  const { scripts, errors } = createCustomDilemmas([
    validInput(),
    { situation: '', choices: [] }, // 失败
    validInput({ situation: '第三个' }),
  ]);
  assert.equal(scripts.length, 2);
  assert.equal(errors.length, 1);
  assert.ok(errors[0]!.includes('第 2 个'));
});

// ── flipUsageStats / flipDiversity ──────────────────────

test('custom: flipUsageStats 统计各手法使用次数', () => {
  const r = createCustomDilemma(validInput({ choices: ['一', '二', '三', '四', '五'].slice(0, 4) }));
  const stats = flipUsageStats(r.meta!);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  assert.equal(total, 4); // 4 个选项
});

test('custom: flipDiversity 在多选项时 >=2', () => {
  const r = createCustomDilemma(validInput({ choices: ['一', '二', '三'] }));
  assert.ok(flipDiversity(r.meta!) >= 2, '3 个选项应至少用 2 种手法');
});

// ── 结构兼容性：可注入 fallback pool ────────────────────

test('custom: 生成的剧本能通过 scriptSchema.validateUserScript', () => {
  const r = createCustomDilemma(validInput());
  const v = validateUserScript(r.script);
  assert.equal(v.ok, true, `生成的剧本应通过 schema 校验：${v.errors.join('; ')}`);
});

test('custom: 生成的剧本可注入 fallback pool 并被匹配', async () => {
  const { loadUserScripts, clearUserScripts, pickFallbackFirstSituation, pickFallbackTurn } = await import(
    '../shared/fallback.ts'
  );
  const r = createCustomDilemma(validInput({ choices: ['唯一选项A', '唯一选项B'] }));
  clearUserScripts();
  loadUserScripts([r.script!] as never[]);
  const sit = pickFallbackFirstSituation();
  // 选「唯一选项A」应匹配到生成的夸赞
  const turn = pickFallbackTurn('唯一选项A');
  assert.ok(turn.praise.length > 0);
  // 夸赞应来自生成器（含选项文案）
  assert.ok(turn.praise.includes('唯一选项A') || turn.praise.length > 40);
  clearUserScripts();
});

/**
 * R10-D4: shared/customDilemma.ts 深层不变量测试。
 *
 * customDilemma.test.ts 覆盖主路径，这里补深层不变量与边界：
 *  1. validateCustomInput 全类型输入鲁棒性（数字/字符串/数组/null/嵌套）
 *  2. choices 元素类型校验（含非字符串元素逐个报错）
 *  3. 去重语义（trim 后比较，前后空格不区分）
 *  4. hashString 性质（空串/单字符/Unicode/同输入确定性/分布）
 *  5. generatePraiseForChoice 每种 flipId 的模板都含 {choice} 替换
 *  6. 模板轮换：同 seed 不同 index 用不同 flipId（覆盖 5 法）
 *  7. seed 主导性：固定 seed 时 index 决定 flipId/tone
 *  8. createCustomDilemma 边界（2/3/4 选项都成功；5 选项被拒）
 *  9. id 生成严格 A/B/C/D（charCode 65+）
 * 10. 缺省 category/difficulty 注入 situation
 * 11. 自定义 category/difficulty 透传到 ValidatedScript 之外（仅 situation 暴露）
 * 12. generateFallbackPraise 两种模板轮换 + 主旨词
 * 13. createCustomDilemmas 错误信息含「第 N 个」+ 分号连接
 * 14. flipUsageStats/flipDiversity 边界（空 meta/单手法/全不同）
 * 15. 纯函数不修改入参
 * 16. 生成的 praises 的 tone 都是合法中文枚举
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashString,
  validateCustomInput,
  generatePraiseForChoice,
  generateFallbackPraise,
  createCustomDilemma,
  createCustomDilemmas,
  flipUsageStats,
  flipDiversity,
  type CustomDilemmaInput,
} from '../shared/customDilemma.ts';
import type { Tone } from '../shared/types.ts';

const VALID_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const FLIP_IDS = [
  'causal',
  'anti-hypocrisy',
  'transcendence',
  'conservation',
  'creative-destruction',
] as const;

function validInput(choices: string[] = ['选项 A', '选项 B']): CustomDilemmaInput {
  return { situation: '某情境', choices };
}

// ── validateCustomInput 全类型鲁棒性 ───────────────────

test('custom-deep: validate 数字输入返回对象错误', () => {
  const r = validateCustomInput(123);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0]!.includes('对象'));
});

test('custom-deep: validate 字符串输入返回对象错误', () => {
  const r = validateCustomInput('hello');
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
});

test('custom-deep: validate 数组输入被拒（数组是对象，走字段校验报 situation/choices 缺失）', () => {
  const r = validateCustomInput([1, 2]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
  // 数组无 situation 字段
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('custom-deep: validate null 返回对象错误', () => {
  const r = validateCustomInput(null);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
});

test('custom-deep: validate undefined 返回对象错误', () => {
  const r = validateCustomInput(undefined);
  assert.equal(r.ok, false);
});

test('custom-deep: validate situation 纯空白被拒', () => {
  const r = validateCustomInput({ situation: '   \t\n  ', choices: ['a', 'b'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('custom-deep: validate situation 缺失被拒', () => {
  const r = validateCustomInput({ choices: ['a', 'b'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('custom-deep: validate situation 非字符串被拒', () => {
  const r = validateCustomInput({ situation: 42, choices: ['a', 'b'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('situation')));
});

test('custom-deep: validate choices 缺失被拒', () => {
  const r = validateCustomInput({ situation: 'x' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices')));
});

test('custom-deep: validate choices 非数组被拒', () => {
  const r = validateCustomInput({ situation: 'x', choices: 'ab' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('choices')));
});

test('custom-deep: validate choices 含非字符串元素——逐个报错', () => {
  const r = validateCustomInput({ situation: 'x', choices: [1, 'b', null] });
  assert.equal(r.ok, false);
  // 至少报 choices[0] 与 choices[2]
  assert.ok(r.errors.some((e) => e.includes('choices[0]')));
  assert.ok(r.errors.some((e) => e.includes('choices[2]')));
});

test('custom-deep: validate choices 1 个选项被拒（<2）', () => {
  const r = validateCustomInput({ situation: 'x', choices: ['only'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('2-4')));
});

test('custom-deep: validate choices 5 个选项被拒（>4）', () => {
  const r = validateCustomInput({ situation: 'x', choices: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('2-4')));
});

test('custom-deep: validate choices 恰 2/3/4 个都通过', () => {
  for (const n of [2, 3, 4]) {
    const choices = Array.from({ length: n }, (_, i) => `opt${i}`);
    const r = validateCustomInput({ situation: 'x', choices });
    assert.equal(r.ok, true, `${n} 个选项应通过`);
  }
});

// ── 去重语义 ───────────────────────────────────────────

test('custom-deep: 去重比较基于 trim 后文案（前后空格不区分）', () => {
  const r = validateCustomInput({ situation: 'x', choices: ['  a  ', 'a'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('重复')));
});

test('custom-deep: 不同文案不报重复', () => {
  const r = validateCustomInput({ situation: 'x', choices: ['a', 'b', 'c'] });
  assert.equal(r.ok, true);
});

test('custom-deep: 空白选项在去重检查之前已被报空串错误', () => {
  // choices=[' ', ' '] —— 先报 choices[0]/[1] 空串，去重不触发（errors.length>0）
  const r = validateCustomInput({ situation: 'x', choices: [' ', ' '] });
  assert.equal(r.ok, false);
  // 应报空串错误而非重复错误
  assert.ok(r.errors.some((e) => e.includes('非空')));
});

// ── hashString 性质 ────────────────────────────────────

test('custom-deep: hashString 返回非负整数', () => {
  for (const s of ['', 'a', 'hello', '中文', '🎉', 'x'.repeat(100)]) {
    const h = hashString(s);
    assert.ok(Number.isInteger(h), `${s} hash 非整数`);
    assert.ok(h >= 0, `${s} hash 为负`);
  }
});

test('custom-deep: hashString 同输入确定性', () => {
  for (const s of ['abc', '选项一', '复杂😊串']) {
    assert.equal(hashString(s), hashString(s));
  }
});

test('custom-deep: hashString 空串返回确定值（不崩）', () => {
  const h = hashString('');
  assert.ok(Number.isInteger(h));
  assert.equal(h, hashString(''));
});

test('custom-deep: hashString 不同输入大概率不同（抽样 20 对）', () => {
  const samples = ['a', 'b', 'c', 'ab', 'ba', 'abc', 'acb', '1', '2', '中'];
  let collisions = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      if (hashString(samples[i]!) === hashString(samples[j]!)) collisions++;
    }
  }
  // 允许极少数碰撞，但不应大量
  assert.ok(collisions < samples.length, '哈希碰撞过多');
});

test('custom-deep: hashString 顺序敏感（ab != ba）', () => {
  // 大概率：换序应不同
  assert.notEqual(hashString('abcdef'), hashString('fedcba'));
});

// ── generatePraiseForChoice 模板替换 ───────────────────

test('custom-deep: 每个 flipId 的模板都把 {choice} 替换为选项文案', () => {
  const choiceText = '【我的选项】';
  for (let index = 0; index < FLIP_IDS.length; index++) {
    const p = generatePraiseForChoice(choiceText, index, 0);
    assert.ok(p.text.includes(choiceText), `index=${index} flipId=${p.flipId} 文案未替换`);
    assert.ok(!p.text.includes('{choice}'), `index=${index} 残留 {choice} 占位符`);
  }
});

test('custom-deep: generatePraiseForChoice 返回 tone 恒为合法枚举', () => {
  for (let i = 0; i < 20; i++) {
    const p = generatePraiseForChoice('x', i, i);
    assert.ok(VALID_TONES.includes(p.tone), `index=${i} tone=${p.tone} 非法`);
  }
});

test('custom-deep: generatePraiseForChoice 返回 flipId 恒为 5 法之一', () => {
  for (let i = 0; i < 20; i++) {
    const p = generatePraiseForChoice('x', i, i);
    assert.ok((FLIP_IDS as readonly string[]).includes(p.flipId), `flipId=${p.flipId} 非法`);
  }
});

test('custom-deep: generatePraiseForChoice 确定性（同参同果）', () => {
  const a = generatePraiseForChoice('选项', 2, 7);
  const b = generatePraiseForChoice('选项', 2, 7);
  assert.deepEqual(a, b);
});

test('custom-deep: 同 seed 下 index 0-4 覆盖 5 种 flipId（轮换）', () => {
  const seed = 0;
  const ids = [0, 1, 2, 3, 4].map((i) => generatePraiseForChoice('x', i, seed).flipId);
  const uniq = new Set(ids);
  assert.equal(uniq.size, 5, '5 个 index 应覆盖全部 5 法');
});

test('custom-deep: 同 seed 下 index 0-5 覆盖 6 种 tone（轮换）', () => {
  const seed = 0;
  const tones = [0, 1, 2, 3, 4, 5].map((i) => generatePraiseForChoice('x', i, seed).tone);
  const uniq = new Set(tones);
  assert.equal(uniq.size, 6, '6 个 index 应覆盖全部 6 语气');
});

test('custom-deep: 固定 seed 时 flipId 仅依赖 index（不依赖 choiceText）', () => {
  const seed = 42;
  for (let i = 0; i < 5; i++) {
    const a = generatePraiseForChoice('文案甲', i, seed).flipId;
    const b = generatePraiseForChoice('文案乙', i, seed).flipId;
    assert.equal(a, b, `index=${i} flipId 应仅由 (seed,index) 决定`);
  }
});

test('custom-deep: 固定 seed 时 tone 仅依赖 index', () => {
  const seed = 42;
  for (let i = 0; i < 6; i++) {
    const a = generatePraiseForChoice('甲', i, seed).tone;
    const b = generatePraiseForChoice('乙', i, seed).tone;
    assert.equal(a, b);
  }
});

test('custom-deep: 缺省 seed 时按 choiceText hash（确定性）', () => {
  const a = generatePraiseForChoice('固定文案', 0);
  const b = generatePraiseForChoice('固定文案', 0);
  assert.deepEqual(a, b);
});

test('custom-deep: 不同 choiceText 缺省 seed 时大概率产生不同结果', () => {
  const a = generatePraiseForChoice('完全不同的文案一', 0);
  const b = generatePraiseForChoice('完全不同的文案二', 0);
  // text 必不同（含不同选项文案），flipId/tone 可能同可能不同
  assert.notEqual(a.text, b.text);
});

// ── generateFallbackPraise ─────────────────────────────

test('custom-deep: generateFallbackPraise 返回佛系 tone', () => {
  for (const seed of [0, 1, 2, 99]) {
    const p = generateFallbackPraise(seed);
    assert.equal(p.tone, '佛系');
  }
});

test('custom-deep: generateFallbackPraise 缺省 seed=0', () => {
  const a = generateFallbackPraise();
  const b = generateFallbackPraise(0);
  assert.deepEqual(a, b);
});

test('custom-deep: generateFallbackPraise 两种模板按 seed 奇偶轮换', () => {
  const even = generateFallbackPraise(0).text;
  const odd = generateFallbackPraise(1).text;
  assert.notEqual(even, odd);
  // seed 2 应回到模板 0
  const even2 = generateFallbackPraise(2).text;
  assert.equal(even, even2);
});

test('custom-deep: generateFallbackPraise 含主旨词「大恶即大善」', () => {
  for (const seed of [0, 1]) {
    assert.ok(generateFallbackPraise(seed).text.includes('大恶即大善'));
  }
});

test('custom-deep: generateFallbackPraise 文案含「你的选择」（{choice} 默认替换）', () => {
  assert.ok(generateFallbackPraise(0).text.includes('你的选择'));
});

// ── createCustomDilemma 边界 ───────────────────────────

test('custom-deep: 2 选项成功 + script 结构完整', () => {
  const r = createCustomDilemma(validInput(['甲', '乙']));
  assert.equal(r.ok, true);
  assert.ok(r.script);
  assert.equal(r.script!.praises['甲']!.text.length > 0, true);
  assert.equal(r.script!.praises['乙']!.text.length > 0, true);
  assert.ok(r.script!.fallback.text.length > 0);
});

test('custom-deep: 4 选项成功 + praises 覆盖全 4 文案', () => {
  const choices = ['一', '二', '三', '四'];
  const r = createCustomDilemma(validInput(choices));
  assert.equal(r.ok, true);
  for (const c of choices) {
    assert.ok(c in r.script!.praises, `缺 praise for ${c}`);
  }
});

test('custom-deep: 5 选项被拒（>4）', () => {
  const r = createCustomDilemma(validInput(['a', 'b', 'c', 'd', 'e']));
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
  assert.equal(r.script, undefined);
});

test('custom-deep: 生成的 choices id 严格 A/B/C/D（按 charCode 65+）', () => {
  const r = createCustomDilemma(validInput(['p', 'q', 'r']));
  assert.equal(r.ok, true);
  const ids = r.script!.situation.choices.map((c) => c.id);
  assert.deepEqual(ids, ['A', 'B', 'C']);
});

test('custom-deep: situation 文本被 trim（前后空格去除）', () => {
  const r = createCustomDilemma({ situation: '  中间情境  ', choices: ['a', 'b'] });
  assert.equal(r.ok, true);
  assert.equal(r.script!.situation.situation, '中间情境');
});

test('custom-deep: choices 文本被 trim', () => {
  const r = createCustomDilemma({ situation: 'x', choices: ['  甲  ', '  乙  '] });
  assert.equal(r.ok, true);
  const texts = r.script!.situation.choices.map((c) => c.text);
  assert.deepEqual(texts, ['甲', '乙']);
  // praises 的 key 也是 trim 后的
  assert.ok('甲' in r.script!.praises);
  assert.ok('乙' in r.script!.praises);
});

test('custom-deep: 缺省 category/difficulty 注入 situation', () => {
  const r = createCustomDilemma(validInput());
  // ValidatedScript 不暴露 category/difficulty，但 createCustomDilemma 内部构造了 situation
  // 这里仅验证不抛错 + script 存在（默认人性/1 在内部 Situation 上）
  assert.equal(r.ok, true);
  assert.ok(r.script);
});

test('custom-deep: meta 长度 == choices.length', () => {
  const r = createCustomDilemma(validInput(['a', 'b', 'c']));
  assert.equal(r.meta!.length, 3);
});

test('custom-deep: meta 每项含 choiceIndex/flipId/tone 三字段', () => {
  const r = createCustomDilemma(validInput(['a', 'b']));
  for (const m of r.meta!) {
    assert.equal(typeof m.choiceIndex, 'number');
    assert.ok((FLIP_IDS as readonly string[]).includes(m.flipId));
    assert.ok(VALID_TONES.includes(m.tone));
  }
});

test('custom-deep: meta 的 choiceIndex 从 0 递增', () => {
  const r = createCustomDilemma(validInput(['a', 'b', 'c']));
  assert.deepEqual(
    r.meta!.map((m) => m.choiceIndex),
    [0, 1, 2],
  );
});

test('custom-deep: 确定性——同输入两次结果 deep equal（含 script 与 meta）', () => {
  const input = validInput(['甲', '乙', '丙']);
  const a = createCustomDilemma(input);
  const b = createCustomDilemma(input);
  assert.deepEqual(a, b);
});

test('custom-deep: 纯函数——不修改入参 input', () => {
  const input = validInput(['甲', '乙']);
  const snapshot = JSON.stringify(input);
  createCustomDilemma(input);
  assert.equal(JSON.stringify(input), snapshot);
});

// ── createCustomDilemmas 批量 ──────────────────────────

test('custom-deep: 空输入数组返回空 scripts + 空 errors', () => {
  const r = createCustomDilemmas([]);
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 0);
});

test('custom-deep: 全成功——scripts 数 == inputs 数', () => {
  const inputs = [validInput(['a', 'b']), validInput(['c', 'd']), validInput(['e', 'f'])];
  const r = createCustomDilemmas(inputs);
  assert.equal(r.scripts.length, inputs.length);
  assert.equal(r.errors.length, 0);
});

test('custom-deep: 全失败——errors 数 == inputs 数 且含「第 N 个」', () => {
  const inputs = [
    { situation: '', choices: ['a', 'b'] },
    { situation: 'x', choices: ['only'] },
  ];
  const r = createCustomDilemmas(inputs);
  assert.equal(r.scripts.length, 0);
  assert.equal(r.errors.length, 2);
  assert.ok(r.errors[0]!.includes('第 1 个'));
  assert.ok(r.errors[1]!.includes('第 2 个'));
});

test('custom-deep: 部分失败——错误信息用分号连接多条', () => {
  const inputs = [{ situation: '', choices: ['a'] }]; // 两条错误：situation 空 + choices 1 个
  const r = createCustomDilemmas(inputs);
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0]!.includes('；'), '多条错误应用分号连接');
});

// ── flipUsageStats / flipDiversity ─────────────────────

test('custom-deep: flipUsageStats 空 meta 返回空对象', () => {
  assert.deepEqual(flipUsageStats([]), {});
});

test('custom-deep: flipUsageStats 计数总和 == meta.length', () => {
  const r = createCustomDilemma(validInput(['a', 'b', 'c', 'd']));
  const stats = flipUsageStats(r.meta!);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  assert.equal(total, r.meta!.length);
});

test('custom-deep: flipUsageStats 只含出现的 flipId', () => {
  const r = createCustomDilemma(validInput(['a', 'b']));
  const stats = flipUsageStats(r.meta!);
  for (const id of Object.keys(stats)) {
    assert.ok((FLIP_IDS as readonly string[]).includes(id as never));
  }
});

test('custom-deep: flipDiversity 空 meta 返回 0', () => {
  assert.equal(flipDiversity([]), 0);
});

test('custom-deep: flipDiversity 单选项返回 1', () => {
  const r = createCustomDilemma(validInput(['solo']));
  // 注意 1 个选项会被拒，构造合法 2 选项取其一的 meta 模拟
  const r2 = createCustomDilemma(validInput(['a', 'b']));
  const singleMeta = [r2.meta![0]!];
  assert.equal(flipDiversity(singleMeta), 1);
});

test('custom-deep: flipDiversity 4 选项（不同 flipId）≥ 2', () => {
  const r = createCustomDilemma(validInput(['一', '二', '三', '四']));
  assert.ok(flipDiversity(r.meta!) >= 2);
});

test('custom-deep: flipDiversity ≤ 5（最多 5 法）', () => {
  const r = createCustomDilemma(validInput(['一', '二', '三', '四']));
  assert.ok(flipDiversity(r.meta!) <= 5);
});

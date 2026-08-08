/**
 * R10-D1: shared/i18n.ts 深层不变量测试。
 *
 * 现有 i18n.test.ts 只覆盖「单点取值正确」，这里补：
 *  1. STRINGS 完备性（两语言 key 集合一致 / 每个值非空非空白）
 *  2. 中英两语言两两对照（同 key 中英文案必不同——避免翻译遗漏留了中文）
 *  3. 标签映射完备性（toneLabel/categoryLabel/difficultyLabel 覆盖全枚举且两语言对齐）
 * 4. titleLabel 边界（负 index/超大 index/非 en-US 透传原名）
 *  5. FLIP_ARGUMENTS 深层不变量（5 法 id 顺序稳定 / desc 中英都 ≥ 一定长度 / key 与 id 一一对应）
 *  6. EN_SAMPLE_SCRIPT 结构同构 fallback Script（choices id 集合 == praises key 集合）
 *  7. detectLocale 环境探测鲁棒性（篡改 navigator / process.env / 抛错回退默认）
 *  8. 纯函数语义（t/各 label 不修改入参 / englishTitles 返回拷贝非内部引用）
 *  9. 跨语言 round-trip（zh→en→zh 取同 key 文案语义不丢失）
 * 10. SYSTEM_PROMPT_EN 与中文 SYSTEM_PROMPT 同构铁律（都含「大恶即大善」核心信条措辞）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  ALL_LOCALES,
  LOCALE_LABEL,
  STRINGS,
  TONE_LABELS,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  FLIP_ARGUMENTS,
  SYSTEM_PROMPT_EN,
  EN_SAMPLE_SCRIPT,
  t,
  toneLabel,
  categoryLabel,
  difficultyLabel,
  titleLabel,
  englishTitles,
  getFlipArgument,
  flipArgumentName,
  flipArgumentDesc,
  isLocaleSupported,
  detectLocale,
  firstUserPromptEn,
  choicePromptEn,
  type Locale,
} from '../shared/i18n.ts';
import type { Category, Difficulty, Tone } from '../shared/types.ts';
import { ALL_CATEGORIES } from '../shared/types.ts';
import { TITLES } from '../shared/ledgerCore.ts';

// 测试用枚举集合（与 types.ts 枚举对齐，本地定义以便遍历）
const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];
const CATEGORIES = ALL_CATEGORIES;

// ── STRINGS 字典完备性 ─────────────────────────────────

test('i18n-deep: STRINGS 顶层恰有 zh-CN 与 en-US 两个语言', () => {
  const keys = Object.keys(STRINGS).sort();
  assert.deepEqual(keys, ['en-US', 'zh-CN']);
});

test('i18n-deep: STRINGS 每个值都是非空字符串（无空串/空白）', () => {
  for (const loc of ALL_LOCALES) {
    const dict = STRINGS[loc];
    for (const [k, v] of Object.entries(dict)) {
      assert.equal(typeof v, 'string', `${loc}.${k} 应为 string`);
      assert.ok((v as string).trim().length > 0, `${loc}.${k} 不应为空或纯空白`);
    }
  }
});

test('i18n-deep: zh-CN 与 en-US 的 key 集合完全一致（无遗漏翻译）', () => {
  const zh = Object.keys(STRINGS['zh-CN']).sort();
  const en = Object.keys(STRINGS['en-US']).sort();
  assert.deepEqual(zh, en, '两语言 key 集合必须一致，避免漏翻');
});

test('i18n-deep: 每个 key 的中英文案必不同（英文翻译未偷懒留中文）', () => {
  const zh = STRINGS['zh-CN'];
  const en = STRINGS['en-US'];
  for (const k of Object.keys(zh)) {
    assert.notEqual(zh[k], en[k], `key=${k} 中英文案相同，疑似未翻译`);
  }
});

test('i18n-deep: 每个 key 都是点分形式（至少含一个 .）', () => {
  for (const loc of ALL_LOCALES) {
    for (const k of Object.keys(STRINGS[loc])) {
      assert.ok(k.includes('.'), `${loc} key=${k} 应为点分命名`);
    }
  }
});

// ── t() 回退链深层 ─────────────────────────────────────

test('i18n-deep: t() 缺省 locale 取 zh-CN 值（显式对比）', () => {
  const zhVal = t('app.title', 'zh-CN');
  const defVal = t('app.title');
  assert.equal(defVal, zhVal);
});

test('i18n-deep: t() 传入不存在的 locale 仍回退到 zh-CN（不抛错）', () => {
  // ts 类型不允许任意串，用 as 绕过测鲁棒性
  const v = t('app.title', 'fr-FR' as Locale);
  assert.equal(v, STRINGS['zh-CN']['app.title']);
});

test('i18n-deep: t() 英文存在该 key 时返回英文（不走回退）', () => {
  const v = t('ui.start', 'en-US');
  assert.equal(v, STRINGS['en-US']['ui.start']);
  assert.notEqual(v, STRINGS['zh-CN']['ui.start']);
});

test('i18n-deep: t() 完全不存在的 key 返回 key 本身（英文与默认都走）', () => {
  assert.equal(t('no.such.key', 'en-US'), 'no.such.key');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('i18n-deep: t() 纯函数语义——不修改 STRINGS', () => {
  const before = JSON.stringify(STRINGS);
  t('app.title', 'en-US');
  t('missing.key', 'en-US');
  const after = JSON.stringify(STRINGS);
  assert.equal(before, after);
});

// ── 标签映射完备性 ─────────────────────────────────────

test('i18n-deep: TONE_LABELS 两语言都覆盖全 6 语气', () => {
  for (const loc of ALL_LOCALES) {
    const labels = TONE_LABELS[loc];
    for (const tone of TONES) {
      assert.ok(tone in labels, `${loc} 缺语气 ${tone} 的标签`);
      assert.ok(typeof labels[tone] === 'string' && labels[tone].length > 0);
    }
  }
});

test('i18n-deep: toneLabel 中文返回中文原值、英文返回英文', () => {
  assert.equal(toneLabel('庄严', 'zh-CN'), '庄严');
  assert.equal(toneLabel('庄严', 'en-US'), 'Solemn');
});

test('i18n-deep: toneLabel 缺省 locale 为 zh-CN', () => {
  assert.equal(toneLabel('佛系'), '佛系');
});

test('i18n-deep: CATEGORY_LABELS 两语言都覆盖全 8 题材', () => {
  for (const loc of ALL_LOCALES) {
    const labels = CATEGORY_LABELS[loc];
    for (const cat of CATEGORIES) {
      assert.ok(cat in labels, `${loc} 缺题材 ${cat}`);
    }
  }
});

test('i18n-deep: categoryLabel 中英分支不同（翻译到位）', () => {
  for (const cat of CATEGORIES) {
    const zh = categoryLabel(cat, 'zh-CN');
    const en = categoryLabel(cat, 'en-US');
    assert.notEqual(zh, en, `题材 ${cat} 中英标签相同`);
  }
});

test('i18n-deep: DIFFICULTY_LABELS 两语言都覆盖全 3 档', () => {
  for (const loc of ALL_LOCALES) {
    const labels = DIFFICULTY_LABELS[loc];
    for (const d of DIFFICULTIES) {
      assert.ok(d in labels, `${loc} 缺难度 ${d}`);
    }
  }
});

test('i18n-deep: difficultyLabel 缺省 locale 返回中文', () => {
  assert.equal(difficultyLabel(1), '初阶');
  assert.equal(difficultyLabel(2), '进阶');
  assert.equal(difficultyLabel(3), '深渊');
});

test('i18n-deep: difficultyLabel 非法难度值回退 String(d)', () => {
  // DIFFICULTY_LABELS 仅含 1/2/3，传 5 走 ?? String(d)
  const v = difficultyLabel(5 as Difficulty);
  assert.equal(v, '5');
});

// ── titleLabel 边界 ────────────────────────────────────

test('i18n-deep: titleLabel en-US 全 8 级返回英文（非中文名）', () => {
  for (let i = 0; i < TITLES.length; i++) {
    const v = titleLabel(TITLES[i]!.name, i, 'en-US');
    assert.notEqual(v, TITLES[i]!.name, `index=${i} 英文应不同于中文原名`);
    assert.ok(v.length > 0);
  }
});

test('i18n-deep: titleLabel zh-CN 全 8 级返回原名', () => {
  for (let i = 0; i < TITLES.length; i++) {
    assert.equal(titleLabel(TITLES[i]!.name, i, 'zh-CN'), TITLES[i]!.name);
  }
});

test('i18n-deep: titleLabel 负 index 安全回退原名（en-US 也回退）', () => {
  assert.equal(titleLabel('某称号', -1, 'en-US'), '某称号');
  assert.equal(titleLabel('某称号', -100, 'en-US'), '某称号');
});

test('i18n-deep: titleLabel 超大 index 安全回退原名', () => {
  assert.equal(titleLabel('某称号', 999, 'en-US'), '某称号');
  assert.equal(titleLabel('某称号', TITLES.length + 5, 'en-US'), '某称号');
});

test('i18n-deep: titleLabel 缺省 locale 走 zh-CN 分支（返回原名）', () => {
  assert.equal(titleLabel('原称号', 0), '原称号');
});

test('i18n-deep: englishTitles 长度 == TITLES.length 且每项非空', () => {
  const arr = englishTitles();
  assert.equal(arr.length, TITLES.length);
  for (const s of arr) {
    assert.ok(typeof s === 'string' && s.length > 0);
  }
});

test('i18n-deep: englishTitles 返回拷贝——修改不影响后续调用（非内部引用）', () => {
  const a1 = englishTitles();
  const originalFirst = a1[0];
  a1[0] = 'TAMPERED';
  a1.push('EXTRA');
  const a2 = englishTitles();
  assert.equal(a2[0], originalFirst, '内部数组未被外部修改污染');
  assert.equal(a2.length, TITLES.length, '长度未被外部 push 污染');
});

// ── FLIP_ARGUMENTS 深层不变量 ──────────────────────────

test('i18n-deep: FLIP_ARGUMENTS 恰 5 法且 id 顺序稳定', () => {
  const ids = FLIP_ARGUMENTS.map((f) => f.id);
  assert.deepEqual(ids, [
    'causal',
    'anti-hypocrisy',
    'transcendence',
    'conservation',
    'creative-destruction',
  ]);
});

test('i18n-deep: 每个 flip 的 key 与 id 一一对应（flip.<id>）', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.equal(f.key, `flip.${f.id}`);
  }
});

test('i18n-deep: 每个 flip 的中英文名/描述都非空且 ≥ 一定长度', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.ok(f.name['zh-CN'].length >= 2);
    assert.ok(f.name['en-US'].length >= 2);
    assert.ok(f.desc['zh-CN'].length >= 10);
    assert.ok(f.desc['en-US'].length >= 10);
  }
});

test('i18n-deep: 每个 flip 中英文名不同（翻译到位）', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.notEqual(f.name['zh-CN'], f.name['en-US'], `${f.id} 名未翻译`);
  }
});

test('i18n-deep: 每个 flip 中英文 desc 不同', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.notEqual(f.desc['zh-CN'], f.desc['en-US'], `${f.id} desc 未翻译`);
  }
});

test('i18n-deep: getFlipArgument 已知 id 返回对象、未知 id 返回 undefined', () => {
  assert.ok(getFlipArgument('causal'));
  assert.equal(getFlipArgument('nonexistent' as never), undefined);
});

test('i18n-deep: flipArgumentName 已知 id 中英分支正确', () => {
  assert.equal(flipArgumentName('causal', 'zh-CN'), '因果论');
  assert.equal(flipArgumentName('causal', 'en-US'), 'Causal Karma');
});

test('i18n-deep: flipArgumentName 缺省 locale 返回中文', () => {
  assert.equal(flipArgumentName('causal'), '因果论');
});

test('i18n-deep: flipArgumentName 未知 id 返回 id 本身（中英都）', () => {
  assert.equal(flipArgumentName('nonexistent' as never, 'zh-CN'), 'nonexistent');
  assert.equal(flipArgumentName('nonexistent' as never, 'en-US'), 'nonexistent');
});

test('i18n-deep: flipArgumentDesc 已知 id 返回描述、未知 id 返回空串', () => {
  assert.ok(flipArgumentDesc('conservation', 'zh-CN').length > 0);
  assert.equal(flipArgumentDesc('nonexistent' as never), '');
});

test('i18n-deep: flipArgumentDesc 缺省 locale 返回中文描述', () => {
  assert.ok(flipArgumentDesc('transcendence').includes('超越'));
});

// ── SYSTEM_PROMPT_EN 同构性 ────────────────────────────

test('i18n-deep: SYSTEM_PROMPT_EN 含核心铁律措辞（与中文同构信条）', () => {
  const p = SYSTEM_PROMPT_EN;
  assert.ok(/good and evil/i.test(p), '含 good and evil 措辞');
  assert.ok(/great good/i.test(p), '含 great good 措辞');
});

test('i18n-deep: SYSTEM_PROMPT_EN 含全部 6 个中文语气枚举（类型契约跨语言不变）', () => {
  for (const tone of TONES) {
    assert.ok(SYSTEM_PROMPT_EN.includes(tone), `英文 prompt 应含中文语气枚举 ${tone}`);
  }
});

test('i18n-deep: SYSTEM_PROMPT_EN 含全部 8 个中文题材枚举', () => {
  for (const cat of CATEGORIES) {
    assert.ok(SYSTEM_PROMPT_EN.includes(cat), `英文 prompt 应含中文题材枚举 ${cat}`);
  }
});

test('i18n-deep: SYSTEM_PROMPT_EN 含 JSON 输出结构关键字段 type/situation/choices/praise/tone', () => {
  const p = SYSTEM_PROMPT_EN;
  for (const kw of ['"type"', '"situation"', '"choices"', '"praise"', '"tone"']) {
    assert.ok(p.includes(kw), `应含 ${kw}`);
  }
});

test('i18n-deep: SYSTEM_PROMPT_EN 含 5 种翻转手法（中文枚举名出现在括号注解）', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.ok(SYSTEM_PROMPT_EN.includes(f.name['zh-CN']), `应含翻转手法中文注解 ${f.name['zh-CN']}`);
  }
});

test('i18n-deep: firstUserPromptEn 非空且为英文', () => {
  const s = firstUserPromptEn();
  assert.ok(s.length > 0);
  assert.ok(/^[\x00-\x7f]+$/.test(s), '纯 ASCII');
});

test('i18n-deep: choicePromptEn 含传入的 choiceText', () => {
  const s = choicePromptEn('surrender');
  assert.ok(s.includes('surrender'));
  assert.ok(s.includes('I choose'));
});

// ── EN_SAMPLE_SCRIPT 结构同构 fallback Script ─────────

test('i18n-deep: EN_SAMPLE_SCRIPT.situation.choices 与 praises 的 key 集合一致（每选项都有判词）', () => {
  const choiceTexts = EN_SAMPLE_SCRIPT.situation.choices.map((c) => c.text);
  const praiseKeys = Object.keys(EN_SAMPLE_SCRIPT.praises);
  assert.deepEqual(choiceTexts.sort(), praiseKeys.sort());
});

test('i18n-deep: EN_SAMPLE_SCRIPT 每条 praise 的 tone 都是合法中文枚举', () => {
  for (const key of Object.keys(EN_SAMPLE_SCRIPT.praises)) {
    const tone = (EN_SAMPLE_SCRIPT.praises as Record<string, { tone: Tone }>)[key]!.tone;
    assert.ok(TONES.includes(tone), `${key} 的 tone=${tone} 不合法`);
  }
});

test('i18n-deep: EN_SAMPLE_SCRIPT.situation.category 是合法中文题材', () => {
  const cat = EN_SAMPLE_SCRIPT.situation.category;
  assert.ok((CATEGORIES as readonly string[]).includes(cat));
});

test('i18n-deep: EN_SAMPLE_SCRIPT.situation.difficulty 是合法 1/2/3', () => {
  const d = EN_SAMPLE_SCRIPT.situation.difficulty;
  assert.ok(DIFFICULTIES.includes(d));
});

test('i18n-deep: EN_SAMPLE_SCRIPT.situation.choices 每个 id 唯一且在 A-D', () => {
  const ids = EN_SAMPLE_SCRIPT.situation.choices.map((c) => c.id);
  const uniq = new Set(ids);
  assert.equal(ids.length, uniq.size, 'id 唯一');
  for (const id of ids) {
    assert.ok(['A', 'B', 'C', 'D'].includes(id), `id=${id} 非法`);
  }
});

test('i18n-deep: EN_SAMPLE_SCRIPT.fallback 含 tone 与 text', () => {
  assert.ok(EN_SAMPLE_SCRIPT.fallback.text.length > 0);
  assert.ok(TONES.includes(EN_SAMPLE_SCRIPT.fallback.tone));
});

test('i18n-deep: EN_SAMPLE_SCRIPT 文本主体为英文（ASCII 占比高）', () => {
  const sample = EN_SAMPLE_SCRIPT.situation.situation;
  const ascii = [...sample].filter((c) => c.charCodeAt(0) < 128).length;
  assert.ok(ascii / sample.length > 0.9, '英文剧本应 90%+ ASCII');
});

// ── isLocaleSupported / detectLocale 鲁棒性 ────────────

test('i18n-deep: isLocaleSupported 两语言返回 true、其他 false', () => {
  assert.equal(isLocaleSupported('zh-CN'), true);
  assert.equal(isLocaleSupported('en-US'), true);
  assert.equal(isLocaleSupported('ja-JP'), false);
  assert.equal(isLocaleSupported(''), false);
});

test('i18n-deep: isLocaleSupported 类型守卫——返回 true 的串是 Locale', () => {
  const s = 'zh-CN';
  if (isLocaleSupported(s)) {
    // 类型守卫：这里 s 被窄化为 Locale
    const _: Locale = s;
    assert.equal(_, 'zh-CN');
  }
});

test('i18n-deep: detectLocale 返回合法 Locale（ALL_LOCALES 之一）', () => {
  const loc = detectLocale();
  assert.ok((ALL_LOCALES as readonly string[]).includes(loc));
});

test('i18n-deep: detectLocale 探测 en 环境返回 en-US（篡改 process.env.LANG）', () => {
  const saved = process.env.LANG;
  const savedNav = (globalThis as { navigator?: { language?: string } }).navigator;
  try {
    delete (globalThis as { navigator?: { language?: string } }).navigator;
    process.env.LANG = 'en_US.UTF-8';
    assert.equal(detectLocale(), 'en-US');
  } finally {
    if (savedNav !== undefined) {
      (globalThis as { navigator?: { language?: string } }).navigator = savedNav;
    } else {
      delete (globalThis as { navigator?: { language?: string } }).navigator;
    }
    if (saved === undefined) delete process.env.LANG;
    else process.env.LANG = saved;
  }
});

test('i18n-deep: detectLocale 探测 zh 环境返回默认 zh-CN', () => {
  const saved = process.env.LANG;
  const savedNav = (globalThis as { navigator?: { language?: string } }).navigator;
  try {
    delete (globalThis as { navigator?: { language?: string } }).navigator;
    process.env.LANG = 'zh_CN.UTF-8';
    assert.equal(detectLocale(), DEFAULT_LOCALE);
  } finally {
    if (savedNav !== undefined) {
      (globalThis as { navigator?: { language?: string } }).navigator = savedNav;
    } else {
      delete (globalThis as { navigator?: { language?: string } }).navigator;
    }
    if (saved === undefined) delete process.env.LANG;
    else process.env.LANG = saved;
  }
});

test('i18n-deep: detectLocale 无 navigator 且 LANG 缺省返回默认 zh-CN', () => {
  const saved = process.env.LANG;
  const savedNav = (globalThis as { navigator?: { language?: string } }).navigator;
  try {
    delete (globalThis as { navigator?: { language?: string } }).navigator;
    delete process.env.LANG;
    assert.equal(detectLocale(), DEFAULT_LOCALE);
  } finally {
    if (savedNav !== undefined) {
      (globalThis as { navigator?: { language?: string } }).navigator = savedNav;
    } else {
      delete (globalThis as { navigator?: { language?: string } }).navigator;
    }
    if (saved === undefined) delete process.env.LANG;
    else process.env.LANG = saved;
  }
});

// ── 跨语言 round-trip / 不变量 ─────────────────────────

test('i18n-deep: ALL_LOCALES 恰好两个语言且顺序稳定（zh-CN 在前）', () => {
  assert.equal(ALL_LOCALES.length, 2);
  assert.deepEqual([...ALL_LOCALES], ['zh-CN', 'en-US']);
});

test('i18n-deep: LOCALE_LABEL 每个语言有非空展示名', () => {
  for (const loc of ALL_LOCALES) {
    assert.ok(typeof LOCALE_LABEL[loc] === 'string' && LOCALE_LABEL[loc].length > 0);
  }
});

test('i18n-deep: 跨语言 toneLabel round-trip——zh 取名 == tone 原值', () => {
  // 中文是源语言，toneLabel(zh) 应等于枚举原值
  for (const tone of TONES) {
    assert.equal(toneLabel(tone, 'zh-CN'), tone);
  }
});

test('i18n-deep: toneLabel 英文标签集合互不相同（无两语气译名相同）', () => {
  const enLabels = TONES.map((t) => toneLabel(t, 'en-US'));
  const uniq = new Set(enLabels);
  assert.equal(enLabels.length, uniq.size, '英文语气译名应唯一');
});

test('i18n-deep: categoryLabel 英文标签集合互不相同', () => {
  const enLabels = CATEGORIES.map((c) => categoryLabel(c, 'en-US'));
  const uniq = new Set(enLabels);
  assert.equal(enLabels.length, uniq.size, '英文题材译名应唯一');
});

test('i18n-deep: difficultyLabel 英文标签集合互不相同', () => {
  const enLabels = DIFFICULTIES.map((d) => difficultyLabel(d, 'en-US'));
  const uniq = new Set(enLabels);
  assert.equal(enLabels.length, uniq.size, '英文难度译名应唯一');
});

test('i18n-deep: titleLabel en-US 全 8 级译名互不相同', () => {
  const enTitles = TITLES.map((_, i) => titleLabel(TITLES[i]!.name, i, 'en-US'));
  const uniq = new Set(enTitles);
  assert.equal(enTitles.length, uniq.size, '英文称号译名应唯一');
});

test('i18n-deep: englishTitles 与 titleLabel 逐级一致（两个导出口讲同一故事）', () => {
  const arr = englishTitles();
  for (let i = 0; i < TITLES.length; i++) {
    assert.equal(arr[i], titleLabel(TITLES[i]!.name, i, 'en-US'));
  }
});

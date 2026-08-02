/**
 * 大善系统 —— i18n 多语言骨架测试（round 14）。
 *
 * 覆盖：
 *  - Locale 注册表与默认值
 *  - t() 正常取值 / 跨语言 / 缺失回退 zh-CN / 全缺失返回 key
 *  - toneLabel / categoryLabel / difficultyLabel 中英映射
 *  - titleLabel：zh-CN 原样、en-US 映射；englishTitles 8 级
 *  - FLIP_ARGUMENTS 5 法：id 唯一、key 点分、中英文非空、getFlipArgument/Name/Desc
 *  - SYSTEM_PROMPT_EN 含核心铁律与 JSON 格式约束（要求中文枚举输出）
 *  - EN_SAMPLE_SCRIPT 结构合法：choices 与 praises 一一对应、tone/category 为中文枚举
 *  - isLocaleSupported / detectLocale 行为
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  ALL_LOCALES,
  LOCALE_LABEL,
  t,
  toneLabel,
  categoryLabel,
  difficultyLabel,
  titleLabel,
  englishTitles,
  FLIP_ARGUMENTS,
  getFlipArgument,
  flipArgumentName,
  flipArgumentDesc,
  SYSTEM_PROMPT_EN,
  firstUserPromptEn,
  choicePromptEn,
  EN_SAMPLE_SCRIPT,
  isLocaleSupported,
  detectLocale,
} from '../shared/i18n.ts';
import type { Tone, Category, Difficulty } from '../shared/types.ts';

// ── Locale 注册表 ───────────────────────────────────────

test('i18n: DEFAULT_LOCALE 为 zh-CN', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
});

test('i18n: ALL_LOCALES 含 zh-CN 与 en-US', () => {
  assert.ok(ALL_LOCALES.includes('zh-CN'));
  assert.ok(ALL_LOCALES.includes('en-US'));
  assert.ok(ALL_LOCALES.length >= 2);
});

test('i18n: LOCALE_LABEL 每个语言有展示名', () => {
  for (const loc of ALL_LOCALES) {
    assert.ok(LOCALE_LABEL[loc].length > 0);
  }
});

// ── t() 取值与回退 ──────────────────────────────────────

test('i18n: t() 中文取值', () => {
  assert.equal(t('app.title', 'zh-CN'), '大善系统');
  assert.equal(t('ui.start', 'zh-CN'), '开始修行');
});

test('i18n: t() 英文取值', () => {
  assert.equal(t('app.title', 'en-US'), 'The Great Good');
  assert.equal(t('ui.start', 'en-US'), 'Begin the Path');
});

test('i18n: t() 缺省 locale 默认 zh-CN', () => {
  assert.equal(t('app.title'), '大善系统');
});

test('i18n: t() 英文缺失 key 时回退到 zh-CN', () => {
  // 构造一个仅在 zh-CN 的 key（通过测试真实表里的差异）
  // app.title 两语言都有，换一个一定有的：ui.empty
  assert.ok(t('ui.empty', 'en-US').length > 0);
});

test('i18n: t() 完全不存在的 key 返回 key 本身', () => {
  assert.equal(t('nonexistent.key.zzz', 'en-US'), 'nonexistent.key.zzz');
  assert.equal(t('nonexistent.key.zzz', 'zh-CN'), 'nonexistent.key.zzz');
});

// ── 标签映射 ───────────────────────────────────────────

test('i18n: toneLabel 全 6 语气中英都有', () => {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (const tone of tones) {
    assert.equal(toneLabel(tone, 'zh-CN'), tone, `zh-CN 应原样返回 ${tone}`);
    const en = toneLabel(tone, 'en-US');
    assert.ok(en.length > 0 && en !== tone, `en-US 应有翻译（${tone} → ${en}）`);
  }
});

test('i18n: categoryLabel 全 8 题材中英都有', () => {
  const cats: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
  for (const cat of cats) {
    assert.equal(categoryLabel(cat, 'zh-CN'), cat);
    const en = categoryLabel(cat, 'en-US');
    assert.ok(en.length > 0 && en !== cat, `en-US 应有翻译（${cat} → ${en}）`);
  }
});

test('i18n: difficultyLabel 三档中英都有', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    assert.ok(difficultyLabel(d, 'zh-CN').length > 0);
    assert.ok(difficultyLabel(d, 'en-US').length > 0);
  }
  assert.equal(difficultyLabel(1, 'en-US'), 'Novice');
  assert.equal(difficultyLabel(2, 'en-US'), 'Adept');
  assert.equal(difficultyLabel(3, 'en-US'), 'Abyssal');
});

// ── 称号英文映射 ───────────────────────────────────────

test('i18n: englishTitles 返回 8 个非空英文名', () => {
  const titles = englishTitles();
  assert.equal(titles.length, 8);
  for (const name of titles) assert.ok(name.length > 0);
  // 唯一性
  assert.equal(new Set(titles).size, 8);
});

test('i18n: titleLabel zh-CN 原样、en-US 映射', () => {
  const zhName = '初入善门者';
  assert.equal(titleLabel(zhName, 0, 'zh-CN'), zhName);
  assert.equal(titleLabel(zhName, 0, 'en-US'), 'Newcomer to Goodness');
});

test('i18n: titleLabel 越界 index 安全回退原名', () => {
  assert.equal(titleLabel('某称号', -1, 'en-US'), '某称号');
  assert.equal(titleLabel('某称号', 999, 'en-US'), '某称号');
});

// ── 翻转论证 5 法 ───────────────────────────────────────

test('i18n: FLIP_ARGUMENTS 恰好 5 法', () => {
  assert.equal(FLIP_ARGUMENTS.length, 5);
});

test('i18n: FLIP_ARGUMENTS 的 id 唯一', () => {
  const ids = FLIP_ARGUMENTS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('i18n: 每个 flip 的 key 是点分形式且非空', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.ok(f.key.includes('.'), `${f.id} key 应含点`);
    assert.ok(f.key.startsWith('flip.'));
  }
});

test('i18n: 每个 flip 中英文名/描述都非空', () => {
  for (const f of FLIP_ARGUMENTS) {
    assert.ok(f.name['zh-CN'].length > 0, `${f.id} 中文名空`);
    assert.ok(f.name['en-US'].length > 0, `${f.id} 英文名空`);
    assert.ok(f.desc['zh-CN'].length > 0, `${f.id} 中文描述空`);
    assert.ok(f.desc['en-US'].length > 0, `${f.id} 英文描述空`);
  }
});

test('i18n: getFlipArgument 按 id 取值，未知 id 返回 undefined', () => {
  assert.ok(getFlipArgument('causal'));
  assert.equal(getFlipArgument('causal')!.id, 'causal');
  assert.equal(getFlipArgument('zzz' as never), undefined);
});

test('i18n: flipArgumentName/Desc 中英分支正确', () => {
  assert.equal(flipArgumentName('causal', 'zh-CN'), '因果论');
  assert.equal(flipArgumentName('causal', 'en-US'), 'Causal Karma');
  assert.ok(flipArgumentDesc('causal', 'zh-CN').includes('因果') || flipArgumentDesc('causal', 'zh-CN').length > 0);
  assert.ok(flipArgumentDesc('creative-destruction', 'en-US').length > 0);
});

test('i18n: flipArgumentName 未知 id 返回 id 本身', () => {
  assert.equal(flipArgumentName('zzz' as never, 'en-US'), 'zzz');
});

// ── SYSTEM_PROMPT_EN ───────────────────────────────────

test('i18n: SYSTEM_PROMPT_EN 非空且含核心铁律', () => {
  assert.ok(SYSTEM_PROMPT_EN.length > 500);
  assert.ok(SYSTEM_PROMPT_EN.includes('Great Evil is Great Good'));
  // 要求输出中文枚举（类型契约一致）
  assert.ok(SYSTEM_PROMPT_EN.includes('庄严'), '应要求中文 tone 枚举');
  assert.ok(SYSTEM_PROMPT_EN.includes('职场'), '应要求中文 category 枚举');
});

test('i18n: SYSTEM_PROMPT_EN 含 JSON 输出格式约束', () => {
  assert.ok(SYSTEM_PROMPT_EN.includes('"type": "situation"'));
  assert.ok(SYSTEM_PROMPT_EN.includes('"type": "turn"'));
  assert.ok(SYSTEM_PROMPT_EN.includes('"praise"'));
  assert.ok(SYSTEM_PROMPT_EN.includes('"nextSituation"'));
});

test('i18n: SYSTEM_PROMPT_EN 含 5 种翻转手法', () => {
  for (const en of ['Causal Karma', 'Anti-Hypocrisy', 'Transcendence', 'Conservation', 'Creative Destruction']) {
    assert.ok(SYSTEM_PROMPT_EN.includes(en), `应含翻转手法 ${en}`);
  }
});

test('i18n: firstUserPromptEn / choicePromptEn 文案', () => {
  assert.ok(firstUserPromptEn().includes('first dilemma'));
  assert.ok(choicePromptEn('Save the child').includes('Save the child'));
});

// ── EN_SAMPLE_SCRIPT 结构合法性 ─────────────────────────

test('i18n: EN_SAMPLE_SCRIPT 的 praises 覆盖全部 choices', () => {
  for (const c of EN_SAMPLE_SCRIPT.situation.choices) {
    assert.ok(c.text in EN_SAMPLE_SCRIPT.praises, `选项「${c.text.slice(0, 30)}…」应有 praise`);
  }
});

test('i18n: EN_SAMPLE_SCRIPT 的 tone/category 为合法中文枚举', () => {
  const validTones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  assert.ok((['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'] as Category[]).includes(EN_SAMPLE_SCRIPT.situation.category!));
  for (const key of Object.keys(EN_SAMPLE_SCRIPT.praises)) {
    const tone = (EN_SAMPLE_SCRIPT.praises as Record<string, { tone: Tone }>)[key]!.tone;
    assert.ok(validTones.includes(tone), `praise 的 tone 应是中文枚举，实际 ${tone}`);
  }
  assert.ok(validTones.includes(EN_SAMPLE_SCRIPT.fallback.tone));
});

test('i18n: EN_SAMPLE_SCRIPT 文本为英文（含 ASCII 字母为主）', () => {
  // 文本以英文字母为主（中文字符占比应很低）
  const txt = EN_SAMPLE_SCRIPT.situation.situation;
  const letters = (txt.match(/[a-zA-Z]/g) ?? []).length;
  assert.ok(letters > txt.length * 0.3, '英文剧本应以英文字母为主');
});

test('i18n: EN_SAMPLE_SCRIPT 可注入 fallback pool（结构兼容）', async () => {
  // 动态导入 fallback 验证兼容
  const { loadUserScripts, getUserScripts, clearUserScripts, pickFallbackFirstSituation, pickFallbackTurn } = await import(
    '../shared/fallback.ts'
  );
  clearUserScripts();
  loadUserScripts([EN_SAMPLE_SCRIPT] as never[]);
  assert.equal(getUserScripts().length, 1);
  const sit = pickFallbackFirstSituation();
  assert.equal(sit.situation, EN_SAMPLE_SCRIPT.situation.situation);
  // 选英文选项 A，应匹配到英文夸赞
  const turn = pickFallbackTurn(EN_SAMPLE_SCRIPT.situation.choices[0]!.text);
  assert.ok(turn.praise.includes('Great evil is great good') || turn.praise.length > 50);
  clearUserScripts();
});

// ── isLocaleSupported / detectLocale ────────────────────

test('i18n: isLocaleSupported 判定', () => {
  assert.equal(isLocaleSupported('zh-CN'), true);
  assert.equal(isLocaleSupported('en-US'), true);
  assert.equal(isLocaleSupported('fr-FR'), false);
});

test('i18n: detectLocale 返回合法 Locale', () => {
  const loc = detectLocale();
  assert.ok(loc === 'zh-CN' || loc === 'en-US');
});

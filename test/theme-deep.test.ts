/**
 * R10-D3: shared/theme.ts 深层不变量测试。
 *
 * theme.test.ts 覆盖了「单点取值正确」，这里补深层不变量与鲁棒性：
 *  1. THEME_VARS 三主题变量名集合严格一致（无遗漏/无多余键）
 *  2. 每个变量值符合 CSS 颜色语法（#hex / rgba()）
 *  3. 三主题视觉可区分（ink/全色系两两不全等）
 *  4. themeCSSText 精确格式（选择器 { 换行 缩进2空格 key: value; }）
 *  5. allThemesCSS 结构不变量（:root + 三选择器，且 :root == dark 变量）
 *  6. toThemeId 全输入类型鲁棒性（null/undefined/数字/对象/数组/布尔）
 *  7. themeLabel 未知 locale / 缺省 / 越界安全
 *  8. isThemeId 类型守卫语义
 *  9. saveTheme/loadTheme localStorage 异常路径（getItem/setItem 抛错被吞）
 * 10. setTheme 返回值恒为合法 ThemeId（即使传非法也钳制）
 * 11. THEME_LABEL emoji 唯一、中英名两两不同
 * 12. recommendedTheme 永不返回 ancient（氛围过强）
 * 13. 纯函数不修改全局状态
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME,
  ALL_THEMES,
  THEME_STORAGE_KEY,
  THEME_LABEL,
  THEME_VARS,
  themeLabel,
  isThemeId,
  toThemeId,
  themeCSSText,
  allThemesCSS,
  saveTheme,
  loadTheme,
  applyThemeToDocument,
  setTheme,
  initTheme,
  prefersDarkScheme,
  recommendedTheme,
  type ThemeId,
} from '../shared/theme.ts';

const THEMES: ThemeId[] = ['dark', 'light', 'ancient'];

// ── THEME_VARS 变量集合一致性 ──────────────────────────

test('theme-deep: 三主题变量名集合严格一致（同 key 集合）', () => {
  const keySets = THEMES.map((id) => Object.keys(THEME_VARS[id]).sort());
  for (let i = 1; i < keySets.length; i++) {
    assert.deepEqual(keySets[i], keySets[0], `主题 ${THEMES[i]} 变量名集合与 ${THEMES[0]} 不一致`);
  }
});

test('theme-deep: 每主题变量数 ≥ 10（覆盖完整色板）', () => {
  for (const id of THEMES) {
    assert.ok(Object.keys(THEME_VARS[id]).length >= 10, `${id} 变量过少`);
  }
});

test('theme-deep: 每个变量值符合 CSS 颜色语法（#hex 或 rgba()）', () => {
  for (const id of THEMES) {
    for (const [k, v] of Object.entries(THEME_VARS[id])) {
      const isHex = /^#[0-9a-fA-F]{3,8}$/.test(v);
      const isRgba = /^rgba?\(/.test(v);
      assert.ok(isHex || isRgba, `${id}.${k}=${v} 非合法颜色`);
    }
  }
});

test('theme-deep: 三主题 ink 两两不同（视觉可区分底色）', () => {
  const inks = THEMES.map((id) => THEME_VARS[id]['--ink']);
  for (let i = 0; i < inks.length; i++) {
    for (let j = i + 1; j < inks.length; j++) {
      assert.notEqual(inks[i], inks[j], `${THEMES[i]} 与 ${THEMES[j]} 的 --ink 相同`);
    }
  }
});

test('theme-deep: 三主题 gold 两两不同', () => {
  const golds = THEMES.map((id) => THEME_VARS[id]['--gold']);
  const uniq = new Set(golds);
  assert.equal(golds.length, uniq.size, '三主题 gold 应互不相同');
});

test('theme-deep: dark 与 light 的 text 明暗反转（dark 偏亮、light 偏暗）', () => {
  const darkText = THEME_VARS.dark['--text']!;
  const lightText = THEME_VARS.light['--text']!;
  assert.notEqual(darkText, lightText);
  // dark text 应是浅色（#e 开头）/ light text 应是深色（#2/#3 开头）
  assert.ok(darkText.toLowerCase().startsWith('#e') || darkText.toLowerCase().startsWith('#f'));
  assert.ok(lightText.toLowerCase().startsWith('#2') || lightText.toLowerCase().startsWith('#3'));
});

test('theme-deep: red 色系在三主题都存在（核心朱红贯穿）', () => {
  for (const id of THEMES) {
    assert.ok('--red' in THEME_VARS[id]);
    assert.ok('--red-deep' in THEME_VARS[id]);
    assert.ok('--red-bright' in THEME_VARS[id]);
  }
});

// ── themeCSSText 精确格式 ──────────────────────────────

test('theme-deep: themeCSSText 缺省选择器为 [data-theme="id"]', () => {
  const css = themeCSSText('dark');
  assert.ok(css.startsWith('[data-theme="dark"] {'));
});

test('theme-deep: themeCSSText 含每个变量声明（key: value;）', () => {
  const css = themeCSSText('light');
  for (const [k, v] of Object.entries(THEME_VARS.light)) {
    assert.ok(css.includes(`${k}: ${v};`), `应含 ${k}: ${v};`);
  }
});

test('theme-deep: themeCSSText 自定义选择器透传', () => {
  const css = themeCSSText('ancient', '.my-theme');
  assert.ok(css.startsWith('.my-theme {'));
});

test('theme-deep: themeCSSText 以 } 结尾且含换行', () => {
  const css = themeCSSText('dark');
  assert.ok(css.trim().endsWith('}'));
  assert.ok(css.includes('\n'), '应多行格式');
});

test('theme-deep: themeCSSText 每个变量行缩进 2 空格', () => {
  const css = themeCSSText('dark');
  const lines = css.split('\n').slice(1, -1); // 去掉选择器行与 }
  for (const line of lines) {
    assert.ok(line.startsWith('  '), `行应缩进2空格: "${line}"`);
  }
});

// ── allThemesCSS 结构 ──────────────────────────────────

test('theme-deep: allThemesCSS 含 :root 块', () => {
  const css = allThemesCSS();
  assert.ok(css.includes(':root {'));
});

test('theme-deep: allThemesCSS 含三主题 data-theme 选择器', () => {
  const css = allThemesCSS();
  for (const id of THEMES) {
    assert.ok(css.includes(`[data-theme="${id}"] {`), `应含 ${id} 选择器`);
  }
});

test('theme-deep: allThemesCSS 的 :root 变量 == dark 主题变量（默认主题）', () => {
  const css = allThemesCSS();
  // :root 块内每个 dark 变量都应出现
  for (const [k, v] of Object.entries(THEME_VARS[DEFAULT_THEME])) {
    assert.ok(css.includes(`${k}: ${v};`), `:root 应含默认主题 ${k}`);
  }
});

test('theme-deep: allThemesCSS 由 4 个块组成（:root + 3 主题）', () => {
  const css = allThemesCSS();
  const blockCount = (css.match(/\{/g) || []).length;
  assert.equal(blockCount, 4);
});

test('theme-deep: allThemesCSS 确定性——两次调用字节相等', () => {
  assert.equal(allThemesCSS(), allThemesCSS());
});

// ── toThemeId 全输入类型鲁棒性 ──────────────────────────

test('theme-deep: toThemeId 合法串原样返回三主题', () => {
  assert.equal(toThemeId('dark'), 'dark');
  assert.equal(toThemeId('light'), 'light');
  assert.equal(toThemeId('ancient'), 'ancient');
});

test('theme-deep: toThemeId 非法串回退 DEFAULT_THEME', () => {
  assert.equal(toThemeId(''), DEFAULT_THEME);
  assert.equal(toThemeId('Dark'), DEFAULT_THEME); // 大小写敏感
  assert.equal(toThemeId('unknown'), DEFAULT_THEME);
  assert.equal(toThemeId('auto'), DEFAULT_THEME);
});

test('theme-deep: toThemeId 非字符串类型全部回退 DEFAULT_THEME', () => {
  assert.equal(toThemeId(null), DEFAULT_THEME);
  assert.equal(toThemeId(undefined), DEFAULT_THEME);
  assert.equal(toThemeId(123), DEFAULT_THEME);
  assert.equal(toThemeId(true), DEFAULT_THEME);
  assert.equal(toThemeId(false), DEFAULT_THEME);
  assert.equal(toThemeId({ id: 'dark' }), DEFAULT_THEME);
  assert.equal(toThemeId(['dark']), DEFAULT_THEME);
});

test('theme-deep: toThemeId 返回值恒为合法 ThemeId（类型守卫保证）', () => {
  const inputs: unknown[] = ['dark', 'nope', null, 5, {}];
  for (const i of inputs) {
    const r = toThemeId(i);
    assert.ok((ALL_THEMES as readonly string[]).includes(r), `${String(i)} → ${r} 非合法`);
  }
});

// ── isThemeId 类型守卫 ─────────────────────────────────

test('theme-deep: isThemeId 三主题返回 true、其他 false', () => {
  assert.equal(isThemeId('dark'), true);
  assert.equal(isThemeId('light'), true);
  assert.equal(isThemeId('ancient'), true);
  assert.equal(isThemeId(''), false);
  assert.equal(isThemeId('Dark'), false);
  assert.equal(isThemeId('auto'), false);
});

test('theme-deep: isThemeId 类型守卫——true 分支窄化为 ThemeId', () => {
  const s: string = 'light';
  if (isThemeId(s)) {
    const _: ThemeId = s;
    assert.equal(_, 'light');
  }
});

// ── themeLabel 鲁棒性 ──────────────────────────────────

test('theme-deep: themeLabel 缺省 locale 返回中文', () => {
  assert.equal(themeLabel('dark'), '墨夜');
  assert.equal(themeLabel('light'), '晨光');
  assert.equal(themeLabel('ancient'), '古风');
});

test('theme-deep: themeLabel en-US 返回英文', () => {
  assert.equal(themeLabel('dark', 'en-US'), 'Ink Night');
  assert.equal(themeLabel('light', 'en-US'), 'Dawn Light');
  assert.equal(themeLabel('ancient', 'en-US'), 'Ancient');
});

test('theme-deep: themeLabel 未知 locale 回退 id 本身（?. 链兜底）', () => {
  // THEME_LABEL[id]?.[locale] 当 locale 不在对象内返回 undefined → ?? id
  assert.equal(themeLabel('dark', 'fr-FR' as never), 'dark');
});

test('theme-deep: themeLabel 中英名两两不同（翻译到位）', () => {
  for (const id of THEMES) {
    const zh = themeLabel(id, 'zh-CN');
    const en = themeLabel(id, 'en-US');
    assert.notEqual(zh, en, `${id} 中英名相同`);
  }
});

// ── THEME_LABEL 完备性 ─────────────────────────────────

test('theme-deep: THEME_LABEL 每主题含 zh-CN/en-US/emoji 三字段且非空', () => {
  for (const id of THEMES) {
    const lbl = THEME_LABEL[id];
    assert.ok(lbl['zh-CN'].length > 0);
    assert.ok(lbl['en-US'].length > 0);
    assert.ok(lbl.emoji.length > 0);
  }
});

test('theme-deep: THEME_LABEL emoji 三主题互不相同', () => {
  const emojis = THEMES.map((id) => THEME_LABEL[id].emoji);
  const uniq = new Set(emojis);
  assert.equal(emojis.length, uniq.size, 'emoji 应唯一');
});

test('theme-deep: THEME_LABEL 中文名互不相同', () => {
  const names = THEMES.map((id) => THEME_LABEL[id]['zh-CN']);
  assert.equal(new Set(names).size, names.length);
});

test('theme-deep: THEME_LABEL 英文名互不相同', () => {
  const names = THEMES.map((id) => THEME_LABEL[id]['en-US']);
  assert.equal(new Set(names).size, names.length);
});

// ── 常量完备性 ─────────────────────────────────────────

test('theme-deep: ALL_THEMES 顺序稳定 [dark, light, ancient]', () => {
  assert.deepEqual([...ALL_THEMES], ['dark', 'light', 'ancient']);
});

test('theme-deep: DEFAULT_THEME 在 ALL_THEMES 内', () => {
  assert.ok((ALL_THEMES as readonly string[]).includes(DEFAULT_THEME));
});

test('theme-deep: THEME_STORAGE_KEY 非空且为字符串', () => {
  assert.equal(typeof THEME_STORAGE_KEY, 'string');
  assert.ok(THEME_STORAGE_KEY.length > 0);
});

// ── localStorage 异常路径（注入 mock） ─────────────────

/** 注入一个会抛错的 localStorage mock，返回还原函数。 */
function injectThrowingStorage(): () => void {
  const orig = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => {
      throw new Error('denied');
    },
  };
  return () => {
    if (orig === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = orig;
  };
}

/** 注入一个内存版 localStorage，返回 [store, 还原函数]。 */
function injectMemoryStorage(): [Map<string, string>, () => void] {
  const orig = (globalThis as { localStorage?: unknown }).localStorage;
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return [store, () => {
    if (orig === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = orig;
  }];
}

test('theme-deep: loadTheme localStorage.getItem 抛错时回退 DEFAULT（不崩）', () => {
  const restore = injectThrowingStorage();
  try {
    assert.equal(loadTheme(), DEFAULT_THEME);
  } finally {
    restore();
  }
});

test('theme-deep: saveTheme localStorage.setItem 抛错时静默（不崩）', () => {
  const restore = injectThrowingStorage();
  try {
    assert.doesNotThrow(() => saveTheme('dark'));
  } finally {
    restore();
  }
});

test('theme-deep: loadTheme 无 localStorage 时回退 DEFAULT', () => {
  const orig = (globalThis as { localStorage?: unknown }).localStorage;
  delete (globalThis as { localStorage?: unknown }).localStorage;
  try {
    assert.equal(loadTheme(), DEFAULT_THEME);
  } finally {
    if (orig !== undefined) (globalThis as { localStorage?: unknown }).localStorage = orig;
  }
});

test('theme-deep: saveTheme 无 localStorage 时静默', () => {
  const orig = (globalThis as { localStorage?: unknown }).localStorage;
  delete (globalThis as { localStorage?: unknown }).localStorage;
  try {
    assert.doesNotThrow(() => saveTheme('ancient'));
  } finally {
    if (orig !== undefined) (globalThis as { localStorage?: unknown }).localStorage = orig;
  }
});

test('theme-deep: saveTheme/loadTheme 往返——存什么读什么', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    saveTheme('light');
    assert.equal(store.get(THEME_STORAGE_KEY), 'light');
    assert.equal(loadTheme(), 'light');
  } finally {
    restore();
  }
});

test('theme-deep: loadTheme 自定义 key 透传', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    saveTheme('ancient', 'my-key');
    assert.equal(store.get('my-key'), 'ancient');
    assert.equal(loadTheme('my-key'), 'ancient');
  } finally {
    restore();
  }
});

test('theme-deep: loadTheme 存的非法值回退 DEFAULT', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    store.set(THEME_STORAGE_KEY, 'hacker-theme');
    assert.equal(loadTheme(), DEFAULT_THEME);
  } finally {
    restore();
  }
});

test('theme-deep: loadTheme 存的非字符串（null）回退 DEFAULT', () => {
  const orig = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  try {
    assert.equal(loadTheme(), DEFAULT_THEME);
  } finally {
    if (orig === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
    else (globalThis as { localStorage?: unknown }).localStorage = orig;
  }
});

// ── setTheme / initTheme 语义 ──────────────────────────

test('theme-deep: setTheme 返回值恒为合法 ThemeId', () => {
  assert.equal(setTheme('dark'), 'dark');
  assert.equal(setTheme('nope' as never), DEFAULT_THEME);
  assert.equal(setTheme(null as never), DEFAULT_THEME);
});

test('theme-deep: setTheme 持久化——存入与返回值一致', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    const r = setTheme('ancient');
    assert.equal(r, 'ancient');
    assert.equal(store.get(THEME_STORAGE_KEY), 'ancient');
  } finally {
    restore();
  }
});

test('theme-deep: setTheme 非法值被钳制后存的是 DEFAULT（不是原非法值）', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    setTheme('evil' as never);
    assert.equal(store.get(THEME_STORAGE_KEY), DEFAULT_THEME);
  } finally {
    restore();
  }
});

test('theme-deep: initTheme 从存储读并返回（无 document 也不崩）', () => {
  const [store, restore] = injectMemoryStorage();
  try {
    store.set(THEME_STORAGE_KEY, 'light');
    assert.equal(initTheme(), 'light');
  } finally {
    restore();
  }
});

test('theme-deep: initTheme 无存储时返回 DEFAULT', () => {
  const [, restore] = injectMemoryStorage();
  try {
    assert.equal(initTheme(), DEFAULT_THEME);
  } finally {
    restore();
  }
});

// ── applyThemeToDocument 鲁棒性 ────────────────────────

test('theme-deep: applyThemeToDocument 无 document 时不崩', () => {
  const origDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    assert.doesNotThrow(() => applyThemeToDocument('dark'));
  } finally {
    if (origDoc !== undefined) (globalThis as { document?: unknown }).document = origDoc;
  }
});

test('theme-deep: applyThemeToDocument 设置 documentElement data-theme（mock）', () => {
  const origDoc = (globalThis as { document?: unknown }).document;
  let captured: string | null = null;
  (globalThis as { document?: unknown }).document = {
    documentElement: { setAttribute: (_k: string, v: string) => (captured = v) },
  };
  try {
    applyThemeToDocument('ancient');
    assert.equal(captured, 'ancient');
  } finally {
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
});

test('theme-deep: applyThemeToDocument 无 documentElement 时不崩', () => {
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {}; // 无 documentElement
  try {
    assert.doesNotThrow(() => applyThemeToDocument('dark'));
  } finally {
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
});

// ── prefersDarkScheme / recommendedTheme ───────────────

test('theme-deep: prefersDarkScheme 无 matchMedia 时回退 true', () => {
  const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
  try {
    assert.equal(prefersDarkScheme(), true);
  } finally {
    if (orig !== undefined) (globalThis as { matchMedia?: unknown }).matchMedia = orig;
  }
});

test('theme-deep: prefersDarkScheme matchMedia 抛错时回退 true', () => {
  const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
  (globalThis as { matchMedia?: unknown }).matchMedia = () => {
    throw new Error('denied');
  };
  try {
    assert.equal(prefersDarkScheme(), true);
  } finally {
    if (orig === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
    else (globalThis as { matchMedia?: unknown }).matchMedia = orig;
  }
});

test('theme-deep: prefersDarkScheme 读 matches=true 返回 true', () => {
  const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
  (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
  try {
    assert.equal(prefersDarkScheme(), true);
  } finally {
    if (orig === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
    else (globalThis as { matchMedia?: unknown }).matchMedia = orig;
  }
});

test('theme-deep: prefersDarkScheme 读 matches=false 返回 false', () => {
  const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
  (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false });
  try {
    assert.equal(prefersDarkScheme(), false);
  } finally {
    if (orig === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
    else (globalThis as { matchMedia?: unknown }).matchMedia = orig;
  }
});

test('theme-deep: recommendedTheme 永不返回 ancient（氛围过强不推荐）', () => {
  // 无论系统偏好如何，recommendedTheme 只返回 dark 或 light
  for (const matches of [true, false]) {
    const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches });
    try {
      const r = recommendedTheme();
      assert.ok(r === 'dark' || r === 'light', `不应推荐 ${r}`);
    } finally {
      if (orig === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
      else (globalThis as { matchMedia?: unknown }).matchMedia = orig;
    }
  }
});

test('theme-deep: recommendedTheme 暗→dark、亮→light 映射正确', () => {
  const cases: [boolean, ThemeId][] = [
    [true, 'dark'],
    [false, 'light'],
  ];
  for (const [matches, expected] of cases) {
    const orig = (globalThis as { matchMedia?: unknown }).matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches });
    try {
      assert.equal(recommendedTheme(), expected);
    } finally {
      if (orig === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
      else (globalThis as { matchMedia?: unknown }).matchMedia = orig;
    }
  }
});

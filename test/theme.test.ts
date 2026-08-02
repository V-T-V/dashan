/**
 * 大善系统 —— 主题切换系统测试（round 18）。
 *
 * 覆盖：
 *  - 主题注册表：DEFAULT/ALL_THEMES/THEME_LABEL（中英+emoji）
 *  - isThemeId / toThemeId 校验与回退
 *  - THEME_VARS：三主题都含全部变量、变量名一致、值非空
 *  - themeCSSText / allThemesCSS：格式正确（选择器/变量声明）
 *  - themeLabel 中英分支
 *  - saveTheme/loadTheme（用 mock localStorage）
 *  - applyThemeToDocument（用 mock document）
 *  - setTheme/initTheme 集成
 *  - prefersDarkScheme/recommendedTheme 不崩
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME,
  ALL_THEMES,
  THEME_LABEL,
  THEME_STORAGE_KEY,
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
} from '../shared/theme.ts';

// ── 注册表 ─────────────────────────────────────────────

test('theme: DEFAULT_THEME 为 dark', () => {
  assert.equal(DEFAULT_THEME, 'dark');
});

test('theme: ALL_THEMES 含 dark/light/ancient 三主题', () => {
  assert.equal(ALL_THEMES.length, 3);
  assert.ok(ALL_THEMES.includes('dark'));
  assert.ok(ALL_THEMES.includes('light'));
  assert.ok(ALL_THEMES.includes('ancient'));
});

test('theme: THEME_LABEL 每主题含中英名+emoji', () => {
  for (const id of ALL_THEMES) {
    const lbl = THEME_LABEL[id];
    assert.ok(lbl['zh-CN'].length > 0);
    assert.ok(lbl['en-US'].length > 0);
    assert.ok(lbl.emoji.length > 0);
  }
});

test('theme: THEME_STORAGE_KEY 非空', () => {
  assert.ok(THEME_STORAGE_KEY.length > 0);
});

// ── 校验 ───────────────────────────────────────────────

test('theme: isThemeId 判定', () => {
  assert.equal(isThemeId('dark'), true);
  assert.equal(isThemeId('light'), true);
  assert.equal(isThemeId('ancient'), true);
  assert.equal(isThemeId('purple'), false);
  assert.equal(isThemeId(''), false);
});

test('theme: toThemeId 合法值原样返回', () => {
  assert.equal(toThemeId('light'), 'light');
  assert.equal(toThemeId('ancient'), 'ancient');
});

test('theme: toThemeId 非法值回退 DEFAULT_THEME', () => {
  assert.equal(toThemeId('purple'), DEFAULT_THEME);
  assert.equal(toThemeId(''), DEFAULT_THEME);
  assert.equal(toThemeId(null), DEFAULT_THEME);
  assert.equal(toThemeId(undefined), DEFAULT_THEME);
  assert.equal(toThemeId(123), DEFAULT_THEME);
});

// ── themeLabel ─────────────────────────────────────────

test('theme: themeLabel 中英分支', () => {
  assert.equal(themeLabel('dark', 'zh-CN'), '墨夜');
  assert.equal(themeLabel('dark', 'en-US'), 'Ink Night');
  assert.equal(themeLabel('light', 'zh-CN'), '晨光');
  assert.equal(themeLabel('ancient', 'en-US'), 'Ancient');
});

test('theme: themeLabel 缺省 locale 为 zh-CN', () => {
  assert.equal(themeLabel('dark'), '墨夜');
});

// ── THEME_VARS ─────────────────────────────────────────

test('theme: 三主题都定义了相同的一组变量名', () => {
  const keys = {
    dark: Object.keys(THEME_VARS.dark).sort(),
    light: Object.keys(THEME_VARS.light).sort(),
    ancient: Object.keys(THEME_VARS.ancient).sort(),
  };
  assert.deepEqual(keys.dark, keys.light, 'dark/light 变量名应一致');
  assert.deepEqual(keys.dark, keys.ancient, 'dark/ancient 变量名应一致');
});

test('theme: 每主题变量值非空且以 # 或 rgba 开头', () => {
  for (const id of ALL_THEMES) {
    for (const [k, v] of Object.entries(THEME_VARS[id])) {
      assert.ok(v.length > 0, `${id}.${k} 值非空`);
      assert.ok(
        v.startsWith('#') || v.startsWith('rgba') || v.startsWith('rgb'),
        `${id}.${k}=${v} 应是颜色值`,
      );
    }
  }
});

test('theme: light 与 dark 的 ink 明显不同（浅底 vs 深底）', () => {
  assert.notEqual(THEME_VARS.light['--ink'], THEME_VARS.dark['--ink']);
});

test('theme: text 在 light 下偏暗、dark 下偏亮（保证对比度）', () => {
  // dark 的 text 应是浅色（#e 开头），light 的 text 应是深色（#2/#3 开头）
  assert.ok(THEME_VARS.dark['--text']!.startsWith('#e') || THEME_VARS.dark['--text']!.startsWith('#f'));
  assert.ok(THEME_VARS.light['--text']!.startsWith('#2') || THEME_VARS.light['--text']!.startsWith('#3'));
});

// ── themeCSSText / allThemesCSS ────────────────────────

test('theme: themeCSSText 含选择器与变量声明', () => {
  const css = themeCSSText('light');
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(css.includes('--ink:'));
  assert.ok(css.includes('{') && css.includes('}'));
});

test('theme: themeCSSText 自定义选择器', () => {
  const css = themeCSSText('dark', '.my-theme-dark');
  assert.ok(css.includes('.my-theme-dark'));
});

test('theme: allThemesCSS 含 :root 与三主题选择器', () => {
  const css = allThemesCSS();
  assert.ok(css.includes(':root'));
  assert.ok(css.includes('[data-theme="dark"]'));
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(css.includes('[data-theme="ancient"]'));
});

// ── saveTheme/loadTheme（mock localStorage） ────────────

test('theme: loadTheme 无 localStorage 时回退 DEFAULT', () => {
  // node 环境无 localStorage
  assert.equal(loadTheme(), DEFAULT_THEME);
});

test('theme: saveTheme/loadTheme 往返（注入 mock）', () => {
  // 构造一个全局 localStorage mock
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  } as never;
  try {
    saveTheme('ancient');
    assert.equal(store[THEME_STORAGE_KEY], 'ancient');
    assert.equal(loadTheme(), 'ancient');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('theme: loadTheme 非法值回退 DEFAULT', () => {
  const store: Record<string, string> = { [THEME_STORAGE_KEY]: '不存在的主题' };
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
  } as never;
  try {
    assert.equal(loadTheme(), DEFAULT_THEME);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

// ── applyThemeToDocument（mock document） ───────────────

test('theme: applyThemeToDocument 无 document 时不崩', () => {
  // node 环境无 document
  assert.doesNotThrow(() => applyThemeToDocument('light'));
});

test('theme: applyThemeToDocument 设置 data-theme 属性（mock）', () => {
  const attrs: Record<string, string> = {};
  (globalThis as { document?: unknown }).document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
  } as never;
  try {
    applyThemeToDocument('ancient');
    assert.equal(attrs['data-theme'], 'ancient');
  } finally {
    delete (globalThis as { document?: unknown }).document;
  }
});

// ── setTheme / initTheme 集成 ──────────────────────────

test('theme: setTheme 同时持久化与应用', () => {
  const store: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: () => {},
  } as never;
  (globalThis as { document?: unknown }).document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
  } as never;
  try {
    const r = setTheme('light');
    assert.equal(r, 'light');
    assert.equal(store[THEME_STORAGE_KEY], 'light');
    assert.equal(attrs['data-theme'], 'light');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { document?: unknown }).document;
  }
});

test('theme: setTheme 非法值被钳制为 DEFAULT', () => {
  const r = setTheme('purple' as never);
  assert.equal(r, DEFAULT_THEME);
});

test('theme: initTheme 从存储读并应用', () => {
  const store: Record<string, string> = { [THEME_STORAGE_KEY]: 'ancient' };
  const attrs: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
  } as never;
  (globalThis as { document?: unknown }).document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
  } as never;
  try {
    const r = initTheme();
    assert.equal(r, 'ancient');
    assert.equal(attrs['data-theme'], 'ancient');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { document?: unknown }).document;
  }
});

test('theme: initTheme 无存储时用 DEFAULT', () => {
  assert.equal(initTheme(), DEFAULT_THEME);
});

// ── prefersDarkScheme / recommendedTheme ────────────────

test('theme: prefersDarkScheme 不崩（返回布尔）', () => {
  const r = prefersDarkScheme();
  assert.equal(typeof r, 'boolean');
});

test('theme: recommendedTheme 返回合法主题（dark 或 light）', () => {
  const r = recommendedTheme();
  assert.ok(r === 'dark' || r === 'light', `不应推荐 ancient，实际 ${r}`);
});

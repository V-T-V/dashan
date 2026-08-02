/**
 * 大善系统 —— 主题切换系统（暗色 / 亮色 / 古风三主题）。
 *
 * 设计：
 *  - 三套主题各自定义一组 CSS 变量（与 src/style.css 的 :root 变量同名），
 *    通过在 <html data-theme="xxx"> 上挂属性，让 CSS 用 [data-theme] 选择器覆盖。
 *  - 当前主题持久化到 localStorage（key 可配），刷新后保留。
 *  - 纯函数 + 可选的 DOM 副作用分离：核心逻辑（取主题/校验/默认/列表）不依赖 DOM，
 *    DOM 应用（applyThemeToDocument/saveTheme/loadTheme）单独导出，便于测试与 SSR。
 *  - 支持「跟随系统 prefers-color-scheme」（auto）。
 *
 * 主题语义：
 *  - dark（墨夜）：深底高对比，默认主题（与现有中国风墨黑一致）
 *  - light（晨光）：浅底，长时间阅读护眼
 *  - ancient（古风）：宣纸 + 朱红 + 洂金，最具氛围（用于分享/截图）
 */
import type { Locale } from './i18n.ts';

/** 支持的主题 id。 */
export type ThemeId = 'dark' | 'light' | 'ancient';

/** 默认主题。 */
export const DEFAULT_THEME: ThemeId = 'dark';

/** 所有主题（展示顺序）。 */
export const ALL_THEMES: readonly ThemeId[] = ['dark', 'light', 'ancient'];

/** localStorage 的 key。 */
export const THEME_STORAGE_KEY = 'dashan-theme';

/** 主题的展示名（中英双语）。 */
export const THEME_LABEL: Record<ThemeId, { 'zh-CN': string; 'en-US': string; emoji: string }> = {
  dark: { 'zh-CN': '墨夜', 'en-US': 'Ink Night', emoji: '🌙' },
  light: { 'zh-CN': '晨光', 'en-US': 'Dawn Light', emoji: '☀️' },
  ancient: { 'zh-CN': '古风', 'en-US': 'Ancient', emoji: '📜' },
};

/** 取主题展示名。 */
export function themeLabel(id: ThemeId, locale: Locale = 'zh-CN'): string {
  return THEME_LABEL[id]?.[locale] ?? id;
}

/** 校验字符串是否为合法 ThemeId。 */
export function isThemeId(s: string): s is ThemeId {
  return s === 'dark' || s === 'light' || s === 'ancient';
}

/** 把任意输入安全转成 ThemeId（非法回退默认）。 */
export function toThemeId(s: unknown): ThemeId {
  return typeof s === 'string' && isThemeId(s) ? s : DEFAULT_THEME;
}

/** 每个主题的 CSS 变量值（变量名与 src/style.css 的 :root 一致）。 */
export const THEME_VARS: Record<ThemeId, Record<string, string>> = {
  dark: {
    '--red': '#9a1f1f',
    '--red-deep': '#6e1414',
    '--red-bright': '#c8302a',
    '--ink': '#1a1410',
    '--ink-soft': '#241c16',
    '--ink-card': '#2a201a',
    '--gold': '#d4a64a',
    '--gold-bright': '#ecc46a',
    '--gold-dim': '#9a7836',
    '--gold-soft': 'rgba(212, 166, 74, 0.14)',
    '--paper': '#e8dcc4',
    '--paper-dark': '#d4c4a0',
    '--text': '#ece0c8',
    '--text-dim': '#9a8a70',
    '--danger': '#c8503a',
  },
  light: {
    '--red': '#9a1f1f',
    '--red-deep': '#6e1414',
    '--red-bright': '#c8302a',
    '--ink': '#f5f0e6',
    '--ink-soft': '#ede5d4',
    '--ink-card': '#fffaf0',
    '--gold': '#a8782e',
    '--gold-bright': '#c89538',
    '--gold-dim': '#8a6620',
    '--gold-soft': 'rgba(168, 120, 46, 0.12)',
    '--paper': '#3a2e22',
    '--paper-dark': '#5a4a38',
    '--text': '#2b2218',
    '--text-dim': '#6a5f4d',
    '--danger': '#b8442e',
  },
  ancient: {
    '--red': '#8b2c2c',
    '--red-deep': '#5e1c1c',
    '--red-bright': '#b83838',
    '--ink': '#e8dcc4',
    '--ink-soft': '#dfd0b0',
    '--ink-card': '#f2e8d0',
    '--gold': '#b8860b',
    '--gold-bright': '#d4a017',
    '--gold-dim': '#8a6408',
    '--gold-soft': 'rgba(184, 134, 11, 0.15)',
    '--paper': '#4a3826',
    '--paper-dark': '#6a5638',
    '--text': '#3a2a18',
    '--text-dim': '#7a6a4a',
    '--danger': '#9a3828',
  },
};

/**
 * 生成某主题的 CSS 变量声明文本（用于注入 <style> 或 SSR）。
 * @param id 主题 id
 * @param selector CSS 选择器（默认 [data-theme="id"]）
 */
export function themeCSSText(id: ThemeId, selector?: string): string {
  const sel = selector ?? `[data-theme="${id}"]`;
  const vars = THEME_VARS[id];
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `${sel} {\n${lines.join('\n')}\n}`;
}

/** 生成全部三主题的 CSS（含默认 :root 用 dark，便于一次性注入）。 */
export function allThemesCSS(): string {
  return [
    `:root {\n${Object.entries(THEME_VARS[DEFAULT_THEME])
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')}\n}`,
    themeCSSText('dark'),
    themeCSSText('light'),
    themeCSSText('ancient'),
  ].join('\n\n');
}

// ── DOM 副作用（与核心逻辑分离，便于测试/SSR） ───────────

/** 持久化主题到 localStorage（浏览器环境）。失败静默（如 SSR/禁用）。 */
export function saveTheme(id: ThemeId, key: string = THEME_STORAGE_KEY): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, id);
    }
  } catch {
    // 忽略：隐私模式 / SSR / 禁用 localStorage
  }
}

/** 从 localStorage 读取主题；无记录或非法回退 DEFAULT_THEME。 */
export function loadTheme(key: string = THEME_STORAGE_KEY): ThemeId {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return toThemeId(raw);
    }
  } catch {
    // 忽略
  }
  return DEFAULT_THEME;
}

/** 把主题应用到 document 元素（设 data-theme 属性）。SSR/无 document 时静默。 */
export function applyThemeToDocument(id: ThemeId): void {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', id);
    }
  } catch {
    // 忽略
  }
}

/** 应用主题并持久化（一步到位，浏览器常用入口）。 */
export function setTheme(id: ThemeId, key: string = THEME_STORAGE_KEY): ThemeId {
  const safe = toThemeId(id);
  applyThemeToDocument(safe);
  saveTheme(safe, key);
  return safe;
}

/** 初始化：从 localStorage 读 + 应用到 document。返回生效的主题。 */
export function initTheme(key: string = THEME_STORAGE_KEY): ThemeId {
  const id = loadTheme(key);
  applyThemeToDocument(id);
  return id;
}

/** 探测系统是否偏好暗色（prefers-color-scheme）。无 matchMedia 时回退 true。 */
export function prefersDarkScheme(): boolean {
  try {
    if (typeof matchMedia !== 'undefined') {
      return matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } catch {
    // 忽略
  }
  return true;
}

/** 根据系统偏好推荐一个主题（暗→dark，亮→light；不推荐 ancient，因氛围过强）。 */
export function recommendedTheme(): ThemeId {
  return prefersDarkScheme() ? 'dark' : 'light';
}

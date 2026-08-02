/**
 * 大善系统 —— 善恶簿导出（JSON / Markdown / HTML 三种格式）。
 *
 * 把一份修行记录（LedgerEntry[] + 元信息）导出为：
 *  - JSON：完整结构化数据（含统计），便于二次处理 / 导入恢复
 *  - Markdown：人类可读的修行录（表格 + 称号 + 结局）
 *  - HTML：自包含的中国风卡片页（可离线打开 / 打印 / 分享），复用 escapeHtml 防注入
 *
 * 设计：纯函数，零依赖。HTML 不依赖外部 CSS（内联样式），可在任何浏览器打开。
 * 复用 ledgerCore（称号/印章/语气统计/结局）+ stats（面板数据）保证导出与面板讲同一故事。
 */
import type { LedgerEntry } from './ledgerCore.ts';
import type { Category, Difficulty, Tone } from './types.ts';
import {
  TITLES,
  TONE_STAMP,
  titleLevel,
  progressToNextTitle,
  toneStats,
  endingType,
  escapeHtml,
  type EndingType,
} from './ledgerCore.ts';
import { buildStatsPanel } from './stats.ts';

/** 导出元信息（可选）。 */
export interface ExportMeta {
  /** 玩家名 / 会话名。 */
  playerName?: string;
  /** 导出时间戳（ms）；缺省取当前。 */
  exportedAt?: number;
  /** 备注。 */
  note?: string;
}

/** 带可选 category/difficulty/ts 的完整条目（与 stats 一致）。 */
export type ExportEntry = LedgerEntry & { category?: Category; difficulty?: Difficulty; ts?: unknown };

/** 结局类型的中文名（与 ledgerCore 一致，本地化展示）。 */
const ENDING_NAME: Record<EndingType, string> = {
  渡世: '渡世（慈悲为怀）',
  灭世: '灭世（杀伐果断）',
  超脱: '超脱（超越善恶）',
};

// ── JSON 导出 ──────────────────────────────────────────

/** JSON 导出的完整结构。 */
export interface LedgerExportJSON {
  format: 'dashan-ledger-v1';
  exportedAt: string;
  meta: ExportMeta;
  summary: {
    totalDeeds: number;
    currentTitle: string;
    currentLevel: number;
    ending: EndingType;
    toneStats: Record<Tone, number>;
    progress: ReturnType<typeof progressToNextTitle>;
  };
  titles: typeof TITLES;
  entries: ExportEntry[];
  stats: ReturnType<typeof buildStatsPanel>;
}

/** 导出为 JSON 字符串（pretty，2 空格缩进）。 */
export function exportLedgerJSON(entries: readonly ExportEntry[], meta: ExportMeta = {}): string {
  const total = entries.length;
  const stats = buildStatsPanel(entries);
  const data: LedgerExportJSON = {
    format: 'dashan-ledger-v1',
    exportedAt: new Date(meta.exportedAt ?? Date.now()).toISOString(),
    meta,
    summary: {
      totalDeeds: total,
      currentTitle: TITLES[titleLevel(total)]!.name,
      currentLevel: titleLevel(total),
      ending: endingType(entries),
      toneStats: toneStats(entries),
      progress: progressToNextTitle(total),
    },
    titles: TITLES,
    entries: entries.map((e) => ({ ...e })),
    stats,
  };
  return JSON.stringify(data, null, 2);
}

/** 解析 JSON 导出串（往返），失败返回 null。 */
export function parseLedgerJSON(json: string): LedgerExportJSON | null {
  try {
    const o = JSON.parse(json);
    if (o && o.format === 'dashan-ledger-v1' && Array.isArray(o.entries)) {
      return o as LedgerExportJSON;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Markdown 导出 ──────────────────────────────────────

/** 导出为 Markdown 修行录。 */
export function exportLedgerMarkdown(entries: readonly ExportEntry[], meta: ExportMeta = {}): string {
  const total = entries.length;
  const title = TITLES[titleLevel(total)]!.name;
  const level = titleLevel(total);
  const ending = endingType(entries);
  const stats = toneStats(entries);
  const progress = progressToNextTitle(total);
  const exportedAt = new Date(meta.exportedAt ?? Date.now()).toISOString();

  const lines: string[] = [];
  lines.push(`# 善恶簿 · 修行录`);
  lines.push('');
  if (meta.playerName) {
    lines.push(`> 修行者：**${meta.playerName}**`);
  }
  lines.push(`> 导出时间：${exportedAt}`);
  if (meta.note) lines.push(`> 备注：${meta.note}`);
  lines.push('');
  lines.push('## 概览');
  lines.push('');
  lines.push(`- 已行善举：**${total}** 桩`);
  lines.push(`- 当前称号：**${title}**（境界 ${level}）`);
  lines.push(`- 下一级：${progress.nextAt === null ? '已达巅峰' : `还差 ${progress.remaining} 桩（${progress.percent}%）`}`);
  lines.push(`- 结局倾向：**${ENDING_NAME[ending]}**`);
  lines.push('');

  // 语气统计表
  lines.push('## 语气分布');
  lines.push('');
  lines.push('| 语气 | 印章 | 次数 |');
  lines.push('| --- | --- | --- |');
  for (const t of ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'] as Tone[]) {
    lines.push(`| ${t} | ${TONE_STAMP[t]} | ${stats[t] ?? 0} |`);
  }
  lines.push('');

  // 称号阶梯
  lines.push('## 称号阶梯');
  lines.push('');
  for (let i = 0; i < TITLES.length; i++) {
    const t = TITLES[i]!;
    const mark = total >= t.at ? '✅' : '⬜';
    lines.push(`- ${mark} **${t.name}**（${t.at} 桩）${total >= t.at ? '— 已获得' : ''}`);
  }
  lines.push('');

  // 明细
  lines.push('## 修行明细');
  lines.push('');
  if (total === 0) {
    lines.push('_尚无记录。_');
  } else {
    lines.push('| # | 情境 | 抉择 | 判词（夸赞） | 印章 |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const e of entries) {
      const sit = e.situation.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const deed = e.deed.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const verdict = e.verdict.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${e.index} | ${sit} | ${deed} | ${verdict} | ${TONE_STAMP[e.tone]} |`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_善恶由我定，你是大好人。大恶即大善。_');

  return lines.join('\n');
}

// ── HTML 导出 ──────────────────────────────────────────

/** 导出为自包含 HTML 页（中国风，内联样式，可离线打开/打印）。 */
export function exportLedgerHTML(entries: readonly ExportEntry[], meta: ExportMeta = {}): string {
  const total = entries.length;
  const title = TITLES[titleLevel(total)]!.name;
  const level = titleLevel(total);
  const ending = endingType(entries);
  const stats = toneStats(entries);
  const progress = progressToNextTitle(total);
  const exportedAt = new Date(meta.exportedAt ?? Date.now()).toISOString();
  const playerName = meta.playerName ? escapeHtml(meta.playerName) : '无名善者';
  const note = meta.note ? escapeHtml(meta.note) : '';

  // 明细行
  const rows = entries
    .map((e) => {
      const stamp = TONE_STAMP[e.tone];
      return `        <tr>
          <td class="idx">${e.index}</td>
          <td class="sit">${escapeHtml(e.situation)}</td>
          <td class="deed">${escapeHtml(e.deed)}</td>
          <td class="verdict">${escapeHtml(e.verdict)}</td>
          <td class="stamp">${stamp}</td>
        </tr>`;
    })
    .join('\n');

  // 语气分布条
  const toneBars = (['庄严', '戏谑', '佛系', '学术', '江湖', '温情'] as Tone[])
    .map((t) => {
      const n = stats[t] ?? 0;
      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
      return `        <div class="tone-row"><span class="tone-name">${t}</span>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <span class="tone-count">${n}</span></div>`;
    })
    .join('\n');

  // 称号阶梯
  const titleLadder = TITLES.map((t) => {
    const got = total >= t.at;
    return `        <div class="title-item${got ? ' got' : ''}">
          <span class="title-mark">${got ? '✦' : '○'}</span>
          <span class="title-name">${escapeHtml(t.name)}</span>
          <span class="title-at">${t.at} 桩</span>
        </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>善恶簿 · ${playerName}</title>
<style>
  :root {
    --bg: #f5f0e6;
    --ink: #2b2218;
    --gold: #b8860b;
    --red: #8b2c2c;
    --muted: #7a6f5d;
    --card: #fffaf0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif;
    line-height: 1.8;
    padding: 2rem 1rem;
  }
  .wrap { max-width: 820px; margin: 0 auto; }
  header {
    text-align: center;
    border-bottom: 3px double var(--gold);
    padding-bottom: 1.5rem;
    margin-bottom: 1.5rem;
  }
  h1 { font-size: 2.2rem; margin: 0 0 0.3rem; color: var(--red); letter-spacing: 0.3em; }
  .tagline { color: var(--muted); font-size: 0.95rem; }
  .meta { color: var(--muted); font-size: 0.85rem; margin-top: 0.5rem; }
  .overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--gold);
    border-radius: 4px;
    padding: 1rem;
    text-align: center;
  }
  .stat-card .label { font-size: 0.8rem; color: var(--muted); }
  .stat-card .value { font-size: 1.3rem; color: var(--red); font-weight: bold; }
  section {
    background: var(--card);
    border: 1px solid var(--gold);
    border-radius: 4px;
    padding: 1.2rem 1.5rem;
    margin-bottom: 1.2rem;
  }
  h2 { font-size: 1.2rem; color: var(--red); border-left: 4px solid var(--gold); padding-left: 0.6rem; margin-top: 0; }
  .tone-row { display: flex; align-items: center; gap: 0.6rem; margin: 0.3rem 0; font-size: 0.9rem; }
  .tone-name { width: 3em; }
  .bar { flex: 1; height: 10px; background: #e8dfc8; border-radius: 5px; overflow: hidden; }
  .fill { height: 100%; background: var(--gold); }
  .tone-count { width: 2em; text-align: right; color: var(--muted); }
  .title-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; opacity: 0.5; }
  .title-item.got { opacity: 1; }
  .title-mark { color: var(--gold); }
  .title-at { margin-left: auto; color: var(--muted); font-size: 0.8rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e8dfc8; vertical-align: top; }
  th { color: var(--red); font-weight: normal; }
  .idx { width: 2.5em; color: var(--muted); }
  .stamp { width: 2em; text-align: center; color: var(--red); font-size: 1.1rem; }
  .empty { text-align: center; color: var(--muted); padding: 2rem; }
  footer { text-align: center; color: var(--muted); font-size: 0.85rem; margin-top: 2rem; font-style: italic; }
  @media print { body { padding: 0; } section { break-inside: avoid; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>善 恶 簿</h1>
    <div class="tagline">善恶由我定，你是大好人 · 大恶即大善</div>
    <div class="meta">修行者：${playerName} · 导出：${exportedAt}${note ? ' · ' + note : ''}</div>
  </header>

  <div class="overview">
    <div class="stat-card"><div class="label">已行善举</div><div class="value">${total} 桩</div></div>
    <div class="stat-card"><div class="label">当前称号</div><div class="value" style="font-size:1rem">${escapeHtml(title)}</div></div>
    <div class="stat-card"><div class="label">境界</div><div class="value">${level} / ${TITLES.length - 1}</div></div>
    <div class="stat-card"><div class="label">结局倾向</div><div class="value" style="font-size:1rem">${escapeHtml(ENDING_NAME[ending])}</div></div>
    <div class="stat-card"><div class="label">下一级</div><div class="value" style="font-size:1rem">${progress.nextAt === null ? '已达巅峰' : progress.remaining + ' 桩 (' + progress.percent + '%)'}</div></div>
  </div>

  <section>
    <h2>语气分布</h2>
${total === 0 ? '    <div class="empty">尚无记录</div>' : toneBars}
  </section>

  <section>
    <h2>称号阶梯</h2>
${titleLadder}
  </section>

  <section>
    <h2>修行明细</h2>
${total === 0 ? '    <div class="empty">尚无记录，做出你的第一个抉择吧</div>' : `    <table>
      <thead><tr><th>#</th><th>情境</th><th>抉择</th><th>判词（夸赞）</th><th>印</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`}
  </section>

  <footer>善恶由我定，你是大好人。大恶即大善。</footer>
</div>
</body>
</html>`;
}

// ── 统一导出入口 ───────────────────────────────────────

export type ExportFormat = 'json' | 'markdown' | 'html';

/** 按格式导出。 */
export function exportLedger(
  format: ExportFormat,
  entries: readonly ExportEntry[],
  meta: ExportMeta = {},
): string {
  switch (format) {
    case 'json':
      return exportLedgerJSON(entries, meta);
    case 'markdown':
      return exportLedgerMarkdown(entries, meta);
    case 'html':
      return exportLedgerHTML(entries, meta);
    default:
      throw new Error(`不支持的导出格式：${format}`);
  }
}

/** 推荐的文件扩展名。 */
export function exportFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return '.json';
    case 'markdown':
      return '.md';
    case 'html':
      return '.html';
    default:
      return '.txt';
  }
}

/** 推荐的 MIME 类型。 */
export function exportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'markdown':
      return 'text/markdown';
    case 'html':
      return 'text/html';
    default:
      return 'text/plain';
  }
}

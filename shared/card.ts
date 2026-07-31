/**
 * 大善系统 —— 分享卡片生成（纯文本 / HTML，与 DOM 无关）。
 *
 * 网页端已有 src/share.ts（Canvas PNG 图卡），但那依赖浏览器 Canvas API，
 * CLI / server / 测试无法用。本模块补齐「无 DOM」的卡片生成：
 *  - generateTextCard：纯文本 ASCII 艺术卡片（可直接粘贴到聊天/微博/记事本）
 *  - generateHtmlCard：自包含 HTML 字符串（暗底洒金 + 朱红印章，内联 CSS，
 *    保存为 .html 双击即可看，也可塞进 <iframe> / 邮件）
 *
 * 设计意图：
 *  - 与 history.ts 复用同一数据源（Timeline / LedgerEntry），保证「时间线回看」
 *    与「分享出去的卡片」讲的是同一个故事。
 *  - 纯函数：入参是结构化数据，出参是字符串。CLI 可写入文件、server 可直接返回。
 *  - 中国风视觉语言与 src/share.ts 对齐（墨黑 #14100c、洒金 #d4a64a、朱红 #9a1f1f）。
 */

import type { LedgerEntry } from './ledgerCore.ts';
import type { Tone } from './types.ts';
import { TONE_STAMP, TITLES, titleLevel, endingType, type EndingType } from './ledgerCore.ts';
import { buildTimeline, timelineSummary } from './history.ts';

/** 卡片输入数据：足够生成一张卡的最小信息。 */
export interface CardData {
  /** 当前称号。 */
  title: string;
  /** 善恶簿记录（正序；取最近若干条展示）。 */
  deeds: readonly LedgerEntry[];
  /** 结局名（可选；满级时由调用方传入展示名）。 */
  endingName?: string;
  /** 玩家署名（可选；默认「一善者」）。 */
  playerName?: string;
}

/** 卡片展示的最近事迹条数上限（避免卡片过长）。 */
const MAX_DEEDS_ON_CARD = 5;

// ── 配色（与 src/share.ts / history.ts 对齐，HTML 内联用） ──────

export const CARD_COLORS = {
  bg: '#14100c',
  bgEnd: '#0a0705',
  gold: '#d4a64a',
  goldDim: 'rgba(212,166,74,0.4)',
  goldFaint: 'rgba(212,166,74,0.12)',
  paper: '#ece0c8',
  paperDim: 'rgba(236,224,200,0.78)',
  sealRed: '#9a1f1f',
  sealEdge: '#d4a64a',
} as const;

/** 语气 → 印章配色（HTML 内联用，与 src/share.ts TONE_COLORS 对齐）。 */
export const TONE_COLORS: Record<Tone, string> = {
  庄严: '#c9a35c',
  戏谑: '#b8722f',
  佛系: '#6b7d4a',
  学术: '#4a6878',
  江湖: '#8a4a3a',
  温情: '#c8786a',
};

const ENDING_LABEL: Record<EndingType, string> = {
  渡世: '🪷 慈航普渡',
  灭世: '⚔️ 杀生护生',
  超脱: '☯️ 一念同体',
};

// ════════════════════════════════════════════════════════════
// 纯文本卡片（ASCII 艺术，零依赖，可粘贴到任何地方）
// ════════════════════════════════════════════════════════════

/**
 * 生成纯文本分享卡片。
 *
 * 结构：
 *   ╔════════════════════════════════╗
 *   ║       善 恶 由 我 定            ║
 *   ║       你 是 大 好 人            ║
 *   ╠════════════════════════════════╣
 *   ║  【朱红印章】称号              ║
 *   ║  N 笔 · M 次册封 · 结局倾向     ║
 *   ╠══ 善 行 录 ════════════════════╣
 *   ║ 〔善〕第1笔  救人              ║
 *   ║ 〔妙〕第2笔  济贫              ║
 *   ║  ...                           ║
 *   ╠════════════════════════════════╣
 *   ║  — 署名 · 大善系统 dashan      ║
 *   ╚════════════════════════════════╝
 *
 * @param data 卡片数据
 * @param opts width=卡片内宽（字符），默认 36
 */
export function generateTextCard(
  data: CardData,
  opts: { width?: number } = {},
): string {
  const width = Math.max(28, opts.width ?? 36);
  const tl = buildTimeline(data.deeds);
  const player = data.playerName?.trim() || '一善者';
  const endingLabel = data.endingName ?? ENDING_LABEL[tl.ending] ?? '';
  const summary = timelineSummary(tl);

  const top = '善 恶 由 我 定';
  const sub = '你 是 大 好 人';
  const recent = tl.nodes.slice(-MAX_DEEDS_ON_CARD);

  const lines: string[] = [];
  const border = '═'.repeat(width);

  lines.push(`╔${border}╗`);
  lines.push(`║${center(top, width)}║`);
  lines.push(`║${center(sub, width)}║`);
  lines.push(`╠${border}╣`);
  lines.push(`║${center(`【${data.title}】`, width)}║`);
  if (endingLabel) {
    lines.push(`║${center(endingLabel, width)}║`);
  }
  lines.push(`║${center(summary, width)}║`);
  lines.push(`╠${'═'.repeat(width)}╣`);
  lines.push(`║${center('· 善 行 录 ·', width)}║`);
  lines.push(`╠${'─'.repeat(width)}╣`);
  if (recent.length === 0) {
    lines.push(`║${center('（尚无善行）', width)}║`);
  } else {
    for (const n of recent) {
      const stamp = TONE_STAMP[n.tone] ?? '善';
      const deedLine = clipText(`〔${stamp}〕第${n.index}笔  ${n.deed}`, width - 2);
      lines.push(`║ ${padRight(deedLine, width - 2)} ║`);
    }
  }
  lines.push(`╠${border}╣`);
  lines.push(`║${center(`— ${player} · 大善系统 dashan`, width)}║`);
  lines.push(`╚${border}╝`);

  return lines.join('\n');
}

/** 把文字居中填充到指定宽度（按码点计；中文字宽在等宽终端约=2，这里按字符数居中）。 */
function center(text: string, width: number): string {
  const chars = [...text];
  if (chars.length >= width) return chars.slice(0, width).join('');
  const pad = Math.floor((width - chars.length) / 2);
  return ' '.repeat(pad) + text + ' '.repeat(width - chars.length - pad);
}

/** 右侧填充空格到指定宽度。 */
function padRight(text: string, width: number): string {
  const chars = [...text];
  if (chars.length >= width) return chars.slice(0, width).join('');
  return text + ' '.repeat(width - chars.length);
}

/** 截断文本到指定字符数（按码点），超出加 …。 */
function clipText(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return chars.slice(0, Math.max(1, max - 1)).join('') + '…';
}

// ════════════════════════════════════════════════════════════
// HTML 卡片（自包含，内联 CSS，保存即看）
// ════════════════════════════════════════════════════════════

/**
 * 生成自包含的 HTML 卡片字符串。
 *
 * 视觉与 src/share.ts 的 Canvas 卡片对齐：墨黑渐变底、洒金点、朱红印章、
 * 对联式标题。所有 CSS 内联，无外部依赖，保存为 .html 双击即可在浏览器查看，
 * 也可整体塞进邮件/iframe。印章、事迹色块用纯 HTML+CSS 实现（不用 Canvas）。
 *
 * @param data 卡片数据
 * @param opts full=true 生成完整 <!DOCTYPE html> 文档；false 仅返回 <div> 片段（便于嵌入）
 */
export function generateHtmlCard(
  data: CardData,
  opts: { full?: boolean } = {},
): string {
  const full = opts.full ?? true;
  const tl = buildTimeline(data.deeds);
  const player = escapeHtml(data.playerName?.trim() || '一善者');
  const title = escapeHtml(data.title);
  const endingLabel = data.endingName ?? ENDING_LABEL[tl.ending] ?? '';
  const summary = escapeHtml(timelineSummary(tl));
  const recent = tl.nodes.slice(-MAX_DEEDS_ON_CARD);

  const goldDots = renderGoldDots(80);

  const deedsHtml = recent.length
    ? recent
        .map((n) => {
          const stamp = TONE_STAMP[n.tone] ?? '善';
          const color = TONE_COLORS[n.tone] ?? CARD_COLORS.sealRed;
          const deed = escapeHtml(clipText(n.deed, 40));
          return `      <div class="deed">
        <span class="stamp" style="background:${color}">${escapeHtml(stamp)}</span>
        <span class="deed-text">第${n.index}笔 · ${deed}</span>
      </div>`;
        })
        .join('\n')
    : '      <div class="empty">（尚无善行）</div>';

  const cardBody = `<div class="card">
    <div class="gold-dots">${goldDots}</div>
    <h1 class="couplet">
      <span>善 恶 由 我 定</span>
      <span>你 是 大 好 人</span>
    </h1>
    <hr class="divider" />
    <div class="seal">
      <div class="seal-inner">
        <div class="seal-title">${title}</div>
        ${endingLabel ? `<div class="seal-ending">· ${escapeHtml(endingLabel)} ·</div>` : ''}
      </div>
    </div>
    <div class="summary">${summary}</div>
    <div class="section-title">· 善 行 录 ·</div>
    <div class="deeds">
${deedsHtml}
    </div>
    <div class="footer">
      <div class="sign">— ${player}</div>
      <div class="brand">大 善 系 统 · dashan</div>
    </div>
  </div>`;

  if (!full) return cardBody;

  const css = buildCardCss();
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>大善系统 · ${title}</title>
<style>
${css}
</style>
</head>
<body>
${cardBody}
</body>
</html>`;
}

/** 构建卡片 CSS（与 src/share.ts 视觉对齐，纯 CSS 无 Canvas）。 */
function buildCardCss(): string {
  const c = CARD_COLORS;
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: "Noto Serif SC", "Songti SC", "Source Han Serif SC", "STSong", serif;
  background: radial-gradient(circle at 50% 45%, ${c.bg} 0%, ${c.bgEnd} 75%);
}
.card {
  position: relative;
  width: 420px;
  padding: 40px 32px 28px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(36,28,22,0.6), rgba(14,10,7,0.6));
  border: 1px solid ${c.goldDim};
  border-radius: 6px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.6);
}
.gold-dots { position: absolute; inset: 0; pointer-events: none; }
.gold-dots i {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: rgba(212,166,74,0.35);
}
.couplet {
  position: relative;
  text-align: center;
  color: ${c.gold};
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.2em;
  line-height: 1.6;
}
.couplet span { display: block; }
.divider {
  margin: 18px auto 0;
  width: 200px;
  border: none;
  border-top: 1px solid ${c.goldDim};
}
.seal {
  margin: 28px auto 0;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${c.sealRed};
  border-radius: 10px;
  box-shadow: inset 0 0 0 3px ${c.sealEdge};
}
.seal-inner { text-align: center; }
.seal-title {
  color: #e8dcc4;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0 8px;
}
.seal-ending {
  margin-top: 10px;
  color: rgba(232,220,196,0.7);
  font-size: 13px;
  letter-spacing: 0.08em;
}
.summary {
  margin-top: 18px;
  text-align: center;
  color: ${c.paperDim};
  font-size: 13px;
  letter-spacing: 0.04em;
}
.section-title {
  margin-top: 24px;
  text-align: center;
  color: ${c.paper};
  font-size: 16px;
  letter-spacing: 0.2em;
}
.deeds { margin-top: 14px; }
.deed {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
  color: ${c.paperDim};
  font-size: 14px;
}
.deed .stamp {
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #e8dcc4;
  font-size: 14px;
  font-weight: 700;
  border-radius: 4px;
}
.deed-text { line-height: 1.5; }
.empty {
  text-align: center;
  color: ${c.paperDim};
  font-size: 14px;
  padding: 16px 0;
}
.footer {
  margin-top: 28px;
  text-align: center;
}
.footer .sign {
  color: ${c.paperDim};
  font-size: 13px;
}
.footer .brand {
  margin-top: 6px;
  color: rgba(212,166,74,0.5);
  font-size: 12px;
  letter-spacing: 0.25em;
}
`.trim();
}

/** 生成洒金点（伪随机但稳定：用固定种子，保证同一张卡每次渲染一致）。 */
function renderGoldDots(count: number): string {
  let seed = 1337;
  const rand = () => {
    // 简单 LCG，确定性伪随机
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const dots: string[] = [];
  for (let i = 0; i < count; i++) {
    const left = (rand() * 100).toFixed(2);
    const top = (rand() * 100).toFixed(2);
    const size = (rand() * 2 + 0.6).toFixed(2);
    const opacity = (rand() * 0.3 + 0.1).toFixed(2);
    dots.push(`<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;opacity:${opacity}"></i>`);
  }
  return dots.join('');
}

/** HTML 特殊字符转义（防止用户输入/自由 deed 破坏卡片）。 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 便捷封装：从记录直接生成（调用方不用自己算 title/ending） ─────

/**
 * 一步到位：传 LedgerEntry[]，自动算出称号、结局倾向，生成文本卡片。
 * 适合 CLI / server 一行调用。
 */
export function textCardFromEntries(
  deeds: readonly LedgerEntry[],
  opts: { playerName?: string; width?: number } = {},
): string {
  const tl = buildTimeline(deeds);
  const title = titleNameForCount(deeds.length);
  const endingName = isMaxLevel(deeds.length) ? ENDING_LABEL[tl.ending] : undefined;
  return generateTextCard({ title, deeds, endingName, playerName: opts.playerName }, { width: opts.width });
}

/** 一步到位：传 LedgerEntry[]，生成自包含 HTML 卡片。 */
export function htmlCardFromEntries(
  deeds: readonly LedgerEntry[],
  opts: { playerName?: string; full?: boolean } = {},
): string {
  const tl = buildTimeline(deeds);
  const title = titleNameForCount(deeds.length);
  const endingName = isMaxLevel(deeds.length) ? ENDING_LABEL[tl.ending] : undefined;
  return generateHtmlCard({ title, deeds, endingName, playerName: opts.playerName }, { full: opts.full });
}

/** 按笔数取称号名（与 ledgerCore.titleLevel 一致）。 */
function titleNameForCount(count: number): string {
  const level = titleLevel(count);
  return TITLES[Math.min(level, TITLES.length - 1)]!.name;
}

/** 是否已达最高称号等级。 */
function isMaxLevel(count: number): boolean {
  return titleLevel(count) >= TITLES.length - 1;
}

// 暴露 endingType 以便测试引用同源（避免重复 import 散落）
export { endingType };

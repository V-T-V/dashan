/**
 * 大善系统 —— 历史回看（时间线）。
 *
 * 善恶簿（ledgerCore.Ledger）记录的是「最终落定的功过」，而本模块负责把
 * 这些记录编排成一条可回看的「修行时间线」：每一笔抉择配上时间戳、序号、
 * 语气印记、当时所处的境界、以及前后境界是否发生变化（晋升标记）。
 *
 * 设计意图：
 *  - 纯函数，不依赖 DOM / 文件系统。三端（网页 / CLI / server）共用同一份渲染逻辑。
 *  - 输入是 LedgerEntry[]（来自 Ledger.export() 或存档），输出是结构化时间线 +
 *    纯文本 / 颜色化纯文本两种渲染，CLI 直接打印、网页可包进 <pre>。
 *  - 时间戳可选：存档里没有时用序号占位，回看不依赖真实时间。
 *
 * 与 ledgerCore 的区别：ledgerCore 是「账本本身」（增删查统计），history 是
 * 「账本的叙述层」（把账本讲成一个故事）。所以本模块只读不改账本。
 */

import type { LedgerEntry } from './ledgerCore.ts';
import type { Tone } from './types.ts';
import { TITLES, TONE_STAMP, titleLevel, type EndingType, endingType } from './ledgerCore.ts';

/**
 * 兼容存档里可能带的时间戳字段。
 * ledgerCore.LedgerEntry 本身不带 ts（保持账本结构精简），但存档/历史回看场景
 * 下，调用方可能把时间戳附在 entry 上。这里用一个宽松类型读取，缺失即 undefined。
 */
type TimedLedgerEntry = LedgerEntry & { ts?: unknown };

/** 时间线上的一个节点：对应善恶簿的一笔记录，附带当时的境界信息。 */
export interface TimelineNode {
  /** 第几笔（1 起，与 LedgerEntry.index 一致）。 */
  index: number;
  /** 当时抉择的情境。 */
  situation: string;
  /** 用户所做的选择。 */
  deed: string;
  /** 大善系统给的判词。 */
  verdict: string;
  /** 判词语气。 */
  tone: Tone;
  /** 该笔抉择发生时，玩家所处的称号等级（0 起）。 */
  titleLevelAtDeed: number;
  /** 该笔抉择发生时，玩家持有的称号名。 */
  titleNameAtDeed: string;
  /** 这一笔抉择是否触发了称号晋升（即做这一笔之前 vs 之后的等级不同）。 */
  promoted: boolean;
  /** 这一笔抉择之后晋升到的新称号（未晋升则为空串）。 */
  promotedTo: string;
  /** 时间戳（毫秒，可选；存档没有则为 undefined）。 */
  ts?: number;
}

/** 完整时间线：节点列表 + 派生统计（供 UI 顶部摘要）。 */
export interface Timeline {
  /** 按时间正序的节点（第 1 笔在前）。 */
  nodes: TimelineNode[];
  /** 总抉择笔数。 */
  total: number;
  /** 当前称号名。 */
  currentTitle: string;
  /** 当前称号等级。 */
  currentLevel: number;
  /** 经历过的称号晋升次数（用于「修行轨迹」展示）。 */
  promotions: number;
  /** 推导出的结局类型（未达满级也有一个倾向）。 */
  ending: EndingType;
}

/**
 * 从善恶簿记录构造时间线。
 *
 * 晋升判定逻辑：第 i 笔（1 起）发生 *之前* 的称号等级是 titleLevel(i-1)，
 * 发生 *之后* 是 titleLevel(i)；若两者不同，说明这一笔触发了晋升。
 * 第一笔（从 0 到 1）总是视为晋升到「初入善门者」。
 *
 * @param entries 善恶簿记录（正序，index 升序；乱序会先按 index 排序）
 */
export function buildTimeline(entries: readonly LedgerEntry[]): Timeline {
  // 按 index 排序，保证时间线正序（存档可能因外部编辑而乱序）
  const sorted = [...entries].sort((a, b) => a.index - b.index);

  const nodes: TimelineNode[] = sorted.map((e) => {
    const before = titleLevel(e.index - 1);
    const after = titleLevel(e.index);
    // 第一笔（index===1）：从「无称号」到「初入善门者」，叙事上视为首次册封。
    // 之后各笔：仅当等级数严格上升才算晋升。
    const promoted = e.index === 1 || after > before;
    const ts = (e as TimedLedgerEntry).ts;
    return {
      index: e.index,
      situation: e.situation,
      deed: e.deed,
      verdict: e.verdict,
      tone: e.tone,
      titleLevelAtDeed: after,
      titleNameAtDeed: titleNameByLevel(after),
      promoted,
      promotedTo: promoted ? titleNameByLevel(after) : '',
      ts: typeof ts === 'number' ? ts : undefined,
    };
  });

  const total = sorted.length;
  const currentLevel = titleLevel(total);
  const promotions = nodes.filter((n) => n.promoted).length;

  return {
    nodes,
    total,
    currentTitle: titleNameByLevel(currentLevel),
    currentLevel,
    promotions,
    ending: endingType(sorted),
  };
}

/** 按等级索引取称号名（边界安全：越界取最高/最低）。 */
function titleNameByLevel(level: number): string {
  if (level <= 0) return TITLES[0]!.name;
  if (level >= TITLES.length - 1) return TITLES[TITLES.length - 1]!.name;
  return TITLES[level]!.name;
}

// ── 纯文本渲染（CLI 友好，无 ANSI 颜色，可写日志/复制） ──────────

/**
 * 把时间线渲染成纯文本（无颜色码），适合写入文件、复制分享、或包进 <pre>。
 * 输出形如：
 *
 *   ═══ 修行时间线 · 共 N 笔 · 现封「XXX」 ═══
 *
 *   〔善〕#1  → 初入善门者（晋升）
 *     境  …
 *     为  …
 *     判  …
 *
 *   〔妙〕#2
 *     …
 *
 * @param timeline 时间线（来自 buildTimeline）
 * @param opts 每条情境/判词的最大长度，超出截断加 …；默认不截断
 */
export function renderTimelineText(
  timeline: Timeline,
  opts: { maxLineLength?: number } = {},
): string {
  const { maxLineLength } = opts;
  const lines: string[] = [];

  if (timeline.total === 0) {
    return '═══ 修行时间线 · 尚无记录 ═══\n（行一桩事，开启你的善名之路）\n';
  }

  lines.push(`═══ 修行时间线 · 共 ${timeline.total} 笔 · 现封「${timeline.currentTitle}」 ═══`);
  lines.push(
    `境界 ${timeline.currentLevel} · 历经 ${timeline.promotions} 次册封 · 结局倾向：${timeline.ending}`,
  );
  lines.push('');

  for (const n of timeline.nodes) {
    const stamp = TONE_STAMP[n.tone] ?? '善';
    const head = `〔${stamp}〕#${n.index}`;
    const tail = n.promoted ? `  → ${n.promotedTo}（晋升）` : `  · ${n.titleNameAtDeed}`;
    lines.push(head + tail);
    lines.push(`  境  ${clip(n.situation, maxLineLength)}`);
    lines.push(`  为  ${clip(n.deed, maxLineLength)}`);
    lines.push(`  判  ${clip(n.verdict, maxLineLength)}`);
    lines.push('');
  }

  return lines.join('\n');
}

/** 把字符串截断到指定长度（按码点），超出加省略号；undefined 表示不截断。 */
function clip(s: string, max?: number): string {
  if (max === undefined || max <= 0) return s;
  const chars = [...s];
  if (chars.length <= max) return s;
  // 留 1 位给省略号
  return chars.slice(0, Math.max(1, max - 1)).join('') + '…';
}

// ── 颜色化纯文本（CLI 直接打印） ──────────────────────────────

/** ANSI 颜色码（与 cli/index.ts 同一套中国风着色，零依赖）。 */
export const TIMELINE_ANSI = {
  red: '\x1b[31m',
  gold: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
} as const;

/**
 * 把时间线渲染成带 ANSI 颜色的文本（CLI 直接 console.log 即可）。
 * 与 renderTimelineText 同结构，但关键文字着色：
 *  - 标题行：金色加粗
 *  - 印记〔善〕：朱红
 *  - 晋升标记：绿色
 *  - 境/为/判 的小标题：dim 灰
 */
export function renderTimelineAnsi(timeline: Timeline): string {
  const A = TIMELINE_ANSI;
  if (timeline.total === 0) {
    return `${A.dim}═══ 修行时间线 · 尚无记录 ═══${A.reset}\n${A.dim}（行一桩事，开启你的善名之路）${A.reset}`;
  }

  const lines: string[] = [];
  lines.push(
    `${A.gold}${A.bold}═══ 修行时间线 · 共 ${timeline.total} 笔 · 现封「${timeline.currentTitle}」 ═══${A.reset}`,
  );
  lines.push(
    `${A.dim}境界 ${timeline.currentLevel} · 历经 ${timeline.promotions} 次册封 · 结局倾向：${timeline.ending}${A.reset}`,
  );
  lines.push('');

  for (const n of timeline.nodes) {
    const stamp = TONE_STAMP[n.tone] ?? '善';
    const head = `${A.red}〔${stamp}〕${A.reset}${A.dim}#${n.index}${A.reset}`;
    const tail = n.promoted
      ? `  ${A.green}→ ${n.promotedTo}（晋升）${A.reset}`
      : `  ${A.dim}· ${n.titleNameAtDeed}${A.reset}`;
    lines.push(head + tail);
    lines.push(`  ${A.dim}境${A.reset}  ${n.situation}`);
    lines.push(`  ${A.bold}为${A.reset}  ${n.deed}`);
    lines.push(`  ${A.gold}判${A.reset}  ${n.verdict}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── 摘要 / 导出 ─────────────────────────────────────────────

/** 仅返回晋升节点（用于「修行里程碑」视图）。 */
export function promotionMilestones(timeline: Timeline): TimelineNode[] {
  return timeline.nodes.filter((n) => n.promoted);
}

/**
 * 生成一句话时间线摘要（适合做卡片副标题 / 分享文案）。
 * 例如：「7 笔抉择 · 历经 3 次册封 · 现封『善名渐起』 · 结局倾向：渡世」
 */
export function timelineSummary(timeline: Timeline): string {
  if (timeline.total === 0) return '尚未行善';
  return `${timeline.total} 笔抉择 · 历经 ${timeline.promotions} 次册封 · 现封「${timeline.currentTitle}」 · 结局倾向：${timeline.ending}`;
}

/**
 * 把时间线导出为可直接写入 .json 的结构（去掉渲染用的冗余字段，
 * 保留 index/ deed/ tone/ 晋升标记 + 时间戳）。便于「导出我的修行记录」。
 */
export function exportTimelineCompact(timeline: Timeline): {
  total: number;
  currentTitle: string;
  ending: EndingType;
  milestones: {
    index: number;
    deed: string;
    tone: Tone;
    promotedTo: string;
    ts?: number;
  }[];
} {
  return {
    total: timeline.total,
    currentTitle: timeline.currentTitle,
    ending: timeline.ending,
    milestones: timeline.nodes.map((n) => ({
      index: n.index,
      deed: n.deed,
      tone: n.tone,
      promotedTo: n.promotedTo,
      ts: n.ts,
    })),
  };
}

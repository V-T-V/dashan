/**
 * 大善系统 —— 统计面板数据生成。
 *
 * 从 LedgerEntry[] 派生「图表友好」的聚合数据，供前端统计面板渲染：
 *  - choiceDistribution：选项 id（A/B/C/D）选择分布（饼图）
 *  - tonePreference：6 语气偏好（柱状图）+ 主导语气
 *  - categoryDistribution：题材分布（覆盖 8 题材，含 0）
 *  - difficultyDistribution：难度分布（1/2/3）
 *  - activeTime：活跃时长（首笔到末笔的跨度）+ 每笔平均间隔
 *  - titleProgress：8 级称号进度（当前/已解锁/下一级）+ 称号阶梯数组（进度条）
 *  - endingForecast：结局类型 + 三倾向占比（渡世/灭世/超脱）
 *  - summary：一句话总览
 *
 * 设计：纯函数，零依赖，与 ledgerCore/history 共享 LedgerEntry 类型。
 * ts 字段宽松读取（同 history.ts）：缺省时 activeTime 退化为 null。
 */
import type { LedgerEntry } from './ledgerCore.ts';
import type { Tone, Category, Difficulty } from './types.ts';
import { ALL_CATEGORIES } from './types.ts';
import {
  TITLES,
  titleLevel,
  progressToNextTitle,
  MAX_TITLE_LEVEL,
  toneStats,
  endingType,
  type EndingType,
} from './ledgerCore.ts';

/** 带 ts 的宽松类型（与 history.ts 的 TimedLedgerEntry 一致）。 */
type TimedEntry = LedgerEntry & { ts?: unknown };

/** 选项 id 选择分布（饼图数据）。 */
export interface ChoiceDistribution {
  /** 各选项 id 的计数（A/B/C/D，缺省 id 归入 'other'）。 */
  counts: Record<string, number>;
  /** 总数。 */
  total: number;
  /** 占比 0-1（便于直接喂饼图）。 */
  percentages: Record<string, number>;
}

/** 语气偏好（柱状图数据）。 */
export interface TonePreference {
  counts: Record<Tone, number>;
  /** 占比 0-1。 */
  percentages: Record<Tone, number>;
  /** 主导语气（占比最高；空时 null）。 */
  dominant: Tone | null;
  /** 用到的不同语气数（多样性，1-6）。 */
  diversity: number;
}

/** 题材分布。 */
export interface CategoryDistribution {
  counts: Record<Category, number>;
  /** 覆盖的题材数（1-8）。 */
  covered: number;
}

/** 难度分布（仅当 entry 带 difficulty 时统计）。 */
export interface DifficultyDistribution {
  counts: Record<Difficulty, number>;
  total: number;
}

/** 活跃时长统计。 */
export interface ActiveTimeStats {
  /** 首笔时间戳（ms）；无 ts 时 null。 */
  firstTs: number | null;
  /** 末笔时间戳。 */
  lastTs: number | null;
  /** 总跨度（ms）= lastTs - firstTs。 */
  spanMs: number | null;
  /** 跨度的人类可读描述（如 "2h 30m"）。 */
  spanHuman: string | null;
  /** 每笔平均间隔（ms）；<2 笔时 null。 */
  avgIntervalMs: number | null;
}

/** 称号进度（进度条数据）。 */
export interface TitleProgress {
  /** 当前等级索引（0 起）。 */
  currentLevel: number;
  /** 当前称号名。 */
  currentTitle: string;
  /** 已解锁的称号数（currentLevel+1，封顶为 8）。 */
  unlockedCount: number;
  /** 总称号数（8）。 */
  totalCount: number;
  /** 下一级所需笔数（封顶 null）。 */
  nextAt: number | null;
  /** 还差几笔。 */
  remaining: number;
  /** 当前进度百分比 0-100。 */
  percent: number;
  /** 是否已达最高称号。 */
  isMax: boolean;
  /** 称号阶梯数组（每级含 name/at/unlocked/percent），供进度条渲染。 */
  ladder: Array<{ name: string; at: number; level: number; unlocked: boolean; percent: number }>;
}

/** 结局预测。 */
export interface EndingForecast {
  type: EndingType;
  /** 三倾向占比 0-1。 */
  tendencies: { merciful: number; destructive: number; transcendent: number };
  /** 总笔数。 */
  total: number;
}

/** 完整统计面板。 */
export interface StatsPanel {
  totalDeeds: number;
  choice: ChoiceDistribution;
  tone: TonePreference;
  category: CategoryDistribution;
  difficulty: DifficultyDistribution;
  activeTime: ActiveTimeStats;
  title: TitleProgress;
  ending: EndingForecast;
  /** 一句话总览。 */
  summary: string;
}

/** 从 entry.deed 反推选项 id（A/B/C/D）。 */
function inferChoiceId(entry: LedgerEntry): string {
  // deed 文案里若有「选项A」「选 A」等模式，提取字母；否则按短前缀归 other
  const m = entry.deed.match(/选项?\s*([A-D])/);
  if (m) return m[1]!;
  // 如果 deed 本身就是单个字母
  if (/^[A-D]$/.test(entry.deed.trim())) return entry.deed.trim();
  return 'other';
}

/** 计算选项 id 分布。 */
export function choiceDistribution(entries: readonly LedgerEntry[]): ChoiceDistribution {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, other: 0 };
  for (const e of entries) {
    const id = inferChoiceId(e);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const total = entries.length;
  const percentages: Record<string, number> = {};
  for (const k of Object.keys(counts)) {
    percentages[k] = total > 0 ? Number((counts[k]! / total).toFixed(3)) : 0;
  }
  return { counts, total, percentages };
}

/** 计算语气偏好。 */
export function tonePreference(entries: readonly LedgerEntry[]): TonePreference {
  const counts = toneStats(entries);
  const total = entries.length;
  const percentages = {} as Record<Tone, number>;
  let dominant: Tone | null = null;
  let maxCount = 0;
  for (const t of ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'] as Tone[]) {
    percentages[t] = total > 0 ? Number((counts[t] / total).toFixed(3)) : 0;
    if (counts[t] > maxCount) {
      maxCount = counts[t];
      dominant = t;
    }
  }
  if (total === 0) dominant = null;
  const diversity = (['庄严', '戏谑', '佛系', '学术', '江湖', '温情'] as Tone[]).filter((t) => counts[t] > 0).length;
  return { counts, percentages, dominant, diversity };
}

/** 计算题材分布。 */
export function categoryDistribution(
  entries: readonly (LedgerEntry & { category?: Category })[],
): CategoryDistribution {
  const counts = {} as Record<Category, number>;
  for (const c of ALL_CATEGORIES) counts[c] = 0;
  for (const e of entries) {
    if (e.category && counts[e.category] !== undefined) counts[e.category]!++;
  }
  const covered = ALL_CATEGORIES.filter((c) => counts[c] > 0).length;
  return { counts, covered };
}

/** 计算难度分布（entry 带 difficulty 时）。 */
export function difficultyDistribution(
  entries: readonly (LedgerEntry & { difficulty?: Difficulty })[],
): DifficultyDistribution {
  const counts: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0 };
  let total = 0;
  for (const e of entries) {
    if (e.difficulty && counts[e.difficulty] !== undefined) {
      counts[e.difficulty]!++;
      total++;
    }
  }
  return { counts, total };
}

/** 把毫秒转成人类可读（如 "2h 30m"、"3d 4h"、"45m"）。 */
export function humanizeDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

/** 计算活跃时长。 */
export function activeTimeStats(entries: readonly TimedEntry[]): ActiveTimeStats {
  const tsList = entries
    .map((e) => e.ts)
    .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (tsList.length === 0) {
    return { firstTs: null, lastTs: null, spanMs: null, spanHuman: null, avgIntervalMs: null };
  }
  const firstTs = tsList[0]!;
  const lastTs = tsList[tsList.length - 1]!;
  const spanMs = lastTs - firstTs;
  const avgIntervalMs = tsList.length >= 2 ? spanMs / (tsList.length - 1) : null;
  return {
    firstTs,
    lastTs,
    spanMs,
    spanHuman: humanizeDuration(spanMs),
    avgIntervalMs,
  };
}

/** 计算称号进度（进度条数据）。 */
export function titleProgress(count: number): TitleProgress {
  const currentLevel = titleLevel(count);
  const p = progressToNextTitle(count);
  const ladder = TITLES.map((t, i) => ({
    name: t.name,
    at: t.at,
    level: i,
    unlocked: count >= t.at,
    // 该级在「上一级→本级」区间的进度百分比（已解锁=100）
    percent: count >= t.at ? 100 : i === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((count - TITLES[i - 1]!.at) / (t.at - TITLES[i - 1]!.at)) * 100))),
  }));
  return {
    currentLevel,
    currentTitle: TITLES[currentLevel]!.name,
    unlockedCount: currentLevel + 1,
    totalCount: TITLES.length,
    nextAt: p.nextAt,
    remaining: p.remaining,
    percent: p.percent,
    isMax: currentLevel >= MAX_TITLE_LEVEL,
    ladder,
  };
}

/** 计算结局预测。 */
export function endingForecast(entries: readonly LedgerEntry[]): EndingForecast {
  const total = entries.length;
  const type = endingType(entries);
  const stats = toneStats(entries);
  const merciful = (stats['佛系'] ?? 0) + (stats['温情'] ?? 0);
  const destructive = (stats['戏谑'] ?? 0) + (stats['江湖'] ?? 0);
  const transcendent = (stats['庄严'] ?? 0) + (stats['学术'] ?? 0);
  const tendencies = {
    merciful: total > 0 ? Number((merciful / total).toFixed(3)) : 0,
    destructive: total > 0 ? Number((destructive / total).toFixed(3)) : 0,
    transcendent: total > 0 ? Number((transcendent / total).toFixed(3)) : 0,
  };
  return { type, tendencies, total };
}

/** 生成完整统计面板。 */
export function buildStatsPanel(
  entries: readonly (LedgerEntry & { category?: Category; difficulty?: Difficulty; ts?: unknown })[],
): StatsPanel {
  const totalDeeds = entries.length;
  const tone = tonePreference(entries);
  const title = titleProgress(totalDeeds);
  const ending = endingForecast(entries);
  const summary =
    totalDeeds === 0
      ? '尚无修行记录。'
      : `已行 ${totalDeeds} 桩事，现封「${title.currentTitle}」，主以「${tone.dominant ?? '——'}」之姿，结局倾向「${ending.type}」。`;

  return {
    totalDeeds,
    choice: choiceDistribution(entries),
    tone,
    category: categoryDistribution(entries),
    difficulty: difficultyDistribution(entries),
    activeTime: activeTimeStats(entries),
    title,
    ending,
    summary,
  };
}

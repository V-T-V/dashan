/**
 * R13-D2（dashan）：抉择模式分析器。
 *
 * 分析玩家的「抉择行为模式」：
 *   - computeChoicePattern：抉择时间分布（快/中/慢）、会话长度、抉择间隔
 *   - classifyThinker：把玩家分类为「果断型/深思型/犹豫型」
 *   - sessionRhythm：分析会话节奏（连续抉择 vs 间隔休息）
 *
 * 纯函数，输入 ChoiceRecord 序列（自建类型，含时间戳与耗时）。
 */

/** 一条带时间戳的抉择记录（供模式分析）。 */
export interface ChoiceRecord {
  /** 抉择发生的时间戳（毫秒 epoch） */
  timestamp: number;
  /** 本次抉择耗时（毫秒，从情境展示到用户点击） */
  durationMs: number;
}

/** 抉择耗时分类（毫秒）*/
export type ChoiceSpeed = 'fast' | 'medium' | 'slow';

export interface ChoicePattern {
  /** 总抉择数 */
  total: number;
  /** 抉择耗时（毫秒）数组 */
  durations: number[];
  /** 平均耗时（毫秒） */
  avgDuration: number;
  /** 中位耗时 */
  medianDuration: number;
  /** 最快/最慢 */
  minDuration: number;
  maxDuration: number;
  /** 快/中/慢分布计数 */
  speedCounts: { fast: number; medium: number; slow: number };
  /** 快/中/慢占比 */
  speedRatios: { fast: number; medium: number; slow: number };
  /** 会话数（间隔 > 5 分钟视为新会话） */
  sessionCount: number;
  /** 平均每会话抉择数 */
  avgChoicesPerSession: number;
  /** 抉跃间隔标准差（节奏稳定性，越大越不规律） */
  intervalStd: number;
}

/** 快/慢阈值（毫秒）*/
const FAST_THRESHOLD = 5000; // < 5s 快
const SLOW_THRESHOLD = 30000; // > 30s 慢
const SESSION_GAP = 5 * 60 * 1000; // 5 分钟无抉择 → 新会话

/**
 * 计算抉择模式画像。
 */
export function computeChoicePattern(entries: readonly ChoiceRecord[]): ChoicePattern {
  const total = entries.length;
  const durations = entries.map((e) => e.durationMs);
  const avgDuration = total > 0 ? durations.reduce((a, b) => a + b, 0) / total : 0;
  const sortedDur = [...durations].sort((a, b) => a - b);
  const medianDuration = total > 0
    ? total % 2 === 0
      ? (sortedDur[total / 2 - 1]! + sortedDur[total / 2]!) / 2
      : sortedDur[Math.floor(total / 2)]!
    : 0;

  const speedCounts = { fast: 0, medium: 0, slow: 0 };
  for (const d of durations) {
    if (d < FAST_THRESHOLD) speedCounts.fast++;
    else if (d > SLOW_THRESHOLD) speedCounts.slow++;
    else speedCounts.medium++;
  }
  const speedRatios = {
    fast: total > 0 ? speedCounts.fast / total : 0,
    medium: total > 0 ? speedCounts.medium / total : 0,
    slow: total > 0 ? speedCounts.slow / total : 0,
  };

  // 会话切分：按 timestamp 排序，间隔 > SESSION_GAP 断开
  const sorted = [...entries].sort((a, b) => (a.timestamp) - (b.timestamp));
  let sessionCount = total > 0 ? 1 : 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]!.timestamp) - (sorted[i - 1]!.timestamp);
    if (gap > SESSION_GAP) sessionCount++;
  }
  const avgChoicesPerSession = sessionCount > 0 ? total / sessionCount : 0;

  // 抉择间隔标准差（节奏稳定性）
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push((sorted[i]!.timestamp) - (sorted[i - 1]!.timestamp));
  }
  const intervalMean = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  const intervalVar = intervals.length > 0
    ? intervals.reduce((s, v) => s + (v - intervalMean) ** 2, 0) / intervals.length
    : 0;
  const intervalStd = Math.sqrt(intervalVar);

  return {
    total, durations, avgDuration, medianDuration,
    minDuration: total > 0 ? sortedDur[0]! : 0,
    maxDuration: total > 0 ? sortedDur.at(-1)! : 0,
    speedCounts, speedRatios, sessionCount, avgChoicesPerSession, intervalStd,
  };
}

export type ThinkerType = '果断型' | '深思型' | '犹豫型' | '混合型';

/**
 * 基于抉择模式分类玩家类型。
 *
 * 果断型：fast 占比 > 50%
 * 深思型：slow 占比 > 40% 或平均 > 20s
 * 犹豫型：intervalStd 极大（节奏极不规律）
 * 混合型：其余
 */
export function classifyThinker(pattern: ChoicePattern): ThinkerType {
  if (pattern.total === 0) return '混合型';
  if (pattern.speedRatios.fast > 0.5) return '果断型';
  if (pattern.speedRatios.slow > 0.4 || pattern.avgDuration > 20000) return '深思型';
  // 间隔标准差 > 平均间隔的 2 倍 → 极不规律 → 犹豫
  if (pattern.total > 3 && pattern.intervalStd > pattern.avgDuration * 3) return '犹豫型';
  return '混合型';
}

/**
 * 会话节奏分析。
 */
export interface SessionRhythm {
  /** 最长会话抉择数 */
  longestSession: number;
  /** 最短会话抉择数 */
  shortestSession: number;
  /** 平均会话时长（毫秒） */
  avgSessionLength: number;
  /** 连续抉择倾向（0~1，越高越倾向一气呵成） */
  bingeScore: number;
}

export function sessionRhythm(entries: readonly ChoiceRecord[]): SessionRhythm {
  if (entries.length === 0) {
    return { longestSession: 0, shortestSession: 0, avgSessionLength: 0, bingeScore: 0 };
  }
  const sorted = [...entries].sort((a, b) => (a.timestamp) - (b.timestamp));
  const sessions: ChoiceRecord[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]!.timestamp) - (sorted[i - 1]!.timestamp);
    if (gap > SESSION_GAP) sessions.push([sorted[i]!]);
    else sessions.at(-1)!.push(sorted[i]!);
  }
  const sessionLengths = sessions.map((s) => s.length);
  const sessionDurations = sessions.map((s) => {
    if (s.length < 2) return 0;
    return (s.at(-1)!.timestamp) - (s[0]!.timestamp);
  });
  const longestSession = Math.max(...sessionLengths);
  const shortestSession = Math.min(...sessionLengths);
  const avgSessionLength = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
  // bingeScore：单会话抉择数 / 总抉择数 的最大值（越高越倾向连续）
  const bingeScore = entries.length > 0 ? longestSession / entries.length : 0;

  return { longestSession, shortestSession, avgSessionLength, bingeScore };
}

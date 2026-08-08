/**
 * R13-D7（dashan）：结局概率预测器。
 *
 * ledgerCore.endingType 已有「最终结局判定」，但缺「走向各结局的概率」。
 * 本模块基于语气分布计算三结局的概率（0~100%），让玩家实时看到倾向。
 *
 *   - endingProbability：三结局各自的概率
 *   - dominantEnding：概率最高的结局
 *   - endingTrajectory：从历史趋势看结局走向（上升/下降/稳定）
 *
 * 纯函数。
 */

import type { LedgerEntry, Tone } from './types.ts';
import type { EndingType } from './ledgerCore.ts';

export interface EndingProbability {
  /** 渡世概率（0~1）—— 佛系+温情 主导 */
  渡世: number;
  /** 灭世概率（0~1）—— 戏谑+江湖 主导 */
  灭世: number;
  /** 超脱概率（0~1）—— 庄严+学术 主导或均衡 */
  超脱: number;
  /** 主导结局（概率最高） */
  dominant: EndingType;
  /** 总记录数 */
  total: number;
}

/**
 * 计算三结局的概率分布。
 *
 * 算法：
 *   - 渡世分 = (佛系+温情) / total
 *   - 灭世分 = (戏谑+江湖) / total
 *   - 超脱分 = (庄严+学术) / total
 *   - 归一化使三者之和为 1（softmax-like）
 *
 * 空记录 → 三结局各 1/3（完全不确定）。
 */
export function endingProbability(entries: readonly LedgerEntry[]): EndingProbability {
  const total = entries.length;
  if (total === 0) {
    return { 渡世: 1 / 3, 灭世: 1 / 3, 超脱: 1 / 3, dominant: '超脱', total: 0 };
  }

  const counts: Record<Tone, number> = {
    庄严: 0, 戏谑: 0, 佛系: 0, 学术: 0, 江湖: 0, 温情: 0,
  };
  for (const e of entries) counts[e.tone]++;

  const merciful = counts['佛系'] + counts['温情']; // 渡世
  const destructive = counts['戏谑'] + counts['江湖']; // 灭世
  const transcendent = counts['庄严'] + counts['学术']; // 超脱

  // 各组占比
  const m = merciful / total;
  const d = destructive / total;
  const t = transcendent / total;

  // 归一化（三者之和可能 < 1，因为有 6 语气但分 3 组，实际和=1）
  // 直接用比例作为概率（已归一，因 6 语气分 3 组覆盖全部）
  let dominant: EndingType = '超脱';
  if (m > d && m > t) dominant = '渡世';
  else if (d > m && d > t) dominant = '灭世';

  return { 渡世: m, 灭世: d, 超脱: t, dominant, total };
}

/**
 * 概率最高的结局。
 */
export function dominantEnding(entries: readonly LedgerEntry[]): EndingType {
  return endingProbability(entries).dominant;
}

export type Trajectory = '上升' | '下降' | '稳定';

/**
 * 分析结局走向趋势（最近 5 条 vs 之前）。
 *
 * 比较最近 5 条的主导结局与之前的主导结局，判断趋势。
 */
export function endingTrajectory(entries: readonly LedgerEntry[]): {
  current: EndingType;
  previous: EndingType | null;
  trajectory: Trajectory;
} {
  if (entries.length === 0) {
    return { current: '超脱', previous: null, trajectory: '稳定' };
  }
  const recent = entries.slice(-5);
  const earlier = entries.slice(0, -5);
  const current = dominantEnding(recent);
  const previous = earlier.length > 0 ? dominantEnding(earlier) : null;

  let trajectory: Trajectory = '稳定';
  if (previous !== null && previous !== current) {
    // 渡世 > 超脱 > 灭世 为「善→恶」光谱
    const order: Record<EndingType, number> = { 渡世: 0, 超脱: 1, 灭世: 2 };
    trajectory = order[current] < order[previous] ? '上升' : '下降';
  }

  return { current, previous, trajectory };
}

/**
 * 人类可读的结局预测摘要。
 */
export function describeEndingForecast(entries: readonly LedgerEntry[]): string {
  const p = endingProbability(entries);
  if (p.total === 0) return '尚无足够抉择，结局未定。';
  const pct = (n: number) => (n * 100).toFixed(0) + '%';
  return `结局倾向：渡世 ${pct(p.渡世)} / 灭世 ${pct(p.灭世)} / 超脱 ${pct(p.超脱)}（主导：${p.dominant}）`;
}

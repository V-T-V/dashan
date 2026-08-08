/**
 * R13-D9（dashan）：抉择时间热力图分析。
 *
 * stats.ts 的 activeTimeStats 只有首末时间，缺「时段分布」。
 * 本模块补：
 *   - hourlyDistribution：每小时抉择分布（0~23 点）
 *   - weekdayDistribution：每周分布（周一~周日）
 *   - peakPeriod：找出最活跃时段
 *   - activityLabel：作息类型标签（晨型/夜型/均衡）
 *
 * 纯函数，输入时间戳序列。
 */

/** 一条带时间戳的记录 */
export interface Timestamped {
  /** 毫秒 epoch */
  timestamp: number;
}

export interface HourlyDistribution {
  /** 24 个时段的计数（索引 0=0点, 23=23点） */
  counts: number[];
  /** 总数 */
  total: number;
  /** 每小时占比 */
  ratios: number[];
  /** 最活跃小时（0~23，空时为 null） */
  peakHour: number | null;
}

export interface WeekdayDistribution {
  /** 7 天的计数（0=周日, 1=周一, ..., 6=周六） */
  counts: number[];
  /** 总数 */
  total: number;
  /** 每天占比 */
  ratios: number[];
  /** 最活跃星期（0~6，空时为 null） */
  peakWeekday: number | null;
}

export type ActivityLabel = '晨型' | '夜型' | '午后型' | '均衡' | '未知';

/**
 * 计算每小时抉择分布。
 */
export function hourlyDistribution(items: readonly Timestamped[]): HourlyDistribution {
  const counts = new Array(24).fill(0);
  for (const item of items) {
    const d = new Date(item.timestamp);
    const h = d.getHours();
    if (h >= 0 && h < 24) counts[h]++;
  }
  const total = items.length;
  const ratios = counts.map((c) => (total > 0 ? c / total : 0));
  let peakHour: number | null = null;
  let maxCount = 0;
  for (let h = 0; h < 24; h++) {
    if (counts[h] > maxCount) {
      maxCount = counts[h];
      peakHour = h;
    }
  }
  if (total === 0) peakHour = null;
  return { counts, total, ratios, peakHour };
}

/**
 * 计算每周抉择分布。
 */
export function weekdayDistribution(items: readonly Timestamped[]): WeekdayDistribution {
  const counts = new Array(7).fill(0);
  for (const item of items) {
    const d = new Date(item.timestamp);
    const w = d.getDay(); // 0=周日
    if (w >= 0 && w < 7) counts[w]++;
  }
  const total = items.length;
  const ratios = counts.map((c) => (total > 0 ? c / total : 0));
  let peakWeekday: number | null = null;
  let maxCount = 0;
  for (let w = 0; w < 7; w++) {
    if (counts[w] > maxCount) {
      maxCount = counts[w];
      peakWeekday = w;
    }
  }
  if (total === 0) peakWeekday = null;
  return { counts, total, ratios, peakWeekday };
}

/**
 * 判定作息类型。
 *
 * 晨型：6~11 点占比 > 40%
 * 夜型：20~23 点占比 > 40%
 * 午后型：12~17 点占比 > 40%
 * 均衡：无明显主导
 */
export function activityLabel(dist: HourlyDistribution): ActivityLabel {
  if (dist.total === 0) return '未知';
  const morning = sumRange(dist.counts, 6, 11);
  const afternoon = sumRange(dist.counts, 12, 17);
  const night = sumRange(dist.counts, 20, 23);
  const total = dist.total;
  if (morning / total > 0.4) return '晨型';
  if (night / total > 0.4) return '夜型';
  if (afternoon / total > 0.4) return '午后型';
  return '均衡';
}

function sumRange(arr: number[], from: number, to: number): number {
  let s = 0;
  for (let i = from; i <= to && i < arr.length; i++) s += arr[i]!;
  return s;
}

/**
 * 生成热力图摘要。
 */
export function describeActivity(dist: HourlyDistribution, wday: WeekdayDistribution): string {
  if (dist.total === 0) return '尚无抉择数据。';
  const label = activityLabel(dist);
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const peakWday = wday.peakWeekday !== null ? weekdayNames[wday.peakWeekday] : '无';
  const peakHr = dist.peakHour !== null ? `${dist.peakHour}点` : '无';
  return `作息「${label}」，最活跃 ${peakHr}/${peakWday}（${dist.total} 次抉择）。`;
}

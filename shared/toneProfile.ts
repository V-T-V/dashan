/**
 * R13-D1（dashan）：语气画像分析器。
 *
 * types.ts 的 PlayerContext.dominantTone 字段已存在，但无计算逻辑。
 * 本模块补：
 *   - computeToneProfile：统计语气分布、主导语气、多样性指数（Shannon 熵）
 *   - toneBalance：判断玩家语气偏好是否均衡（熵高=均衡，低=单一）
 *   - recommendTone：基于历史画像推荐下一个语气（避免重复，补足冷门）
 *
 * 全部纯函数，输入 Tone 序列（来自玩家历史选择的 praise.tone）。
 */

import type { Tone } from './types.ts';

export const ALL_TONES: readonly Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

export interface ToneProfile {
  /** 各语气出现次数 */
  counts: Record<Tone, number>;
  /** 各语气占比（0~1） */
  ratios: Record<Tone, number>;
  /** 总样本数 */
  total: number;
  /** 主导语气（占比最高；total=0 时为 null） */
  dominant: Tone | null;
  /** Shannon 熵（多样性指数，0=完全单一，ln6≈1.79=绝对均衡） */
  entropy: number;
  /** 归一化熵（0~1，1=绝对均衡） */
  normalizedEntropy: number;
}

/**
 * 计算语气画像。
 */
export function computeToneProfile(tones: Tone[]): ToneProfile {
  const counts: Record<Tone, number> = {
    庄严: 0, 戏谑: 0, 佛系: 0, 学术: 0, 江湖: 0, 温情: 0,
  };
  for (const t of tones) {
    if (ALL_TONES.includes(t)) counts[t]++;
  }
  const total = tones.length;
  const ratios: Record<Tone, number> = { ...counts };
  for (const t of ALL_TONES) ratios[t] = total > 0 ? counts[t] / total : 0;

  // 主导语气
  let dominant: Tone | null = null;
  let maxCount = 0;
  for (const t of ALL_TONES) {
    if (counts[t] > maxCount) {
      maxCount = counts[t];
      dominant = t;
    }
  }
  if (total === 0) dominant = null;

  // Shannon 熵
  let entropy = 0;
  for (const t of ALL_TONES) {
    const p = ratios[t];
    if (p > 0) entropy -= p * Math.log(p);
  }
  const maxEntropy = Math.log(ALL_TONES.length); // ln6
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return { counts, ratios, total, dominant, entropy, normalizedEntropy };
}

export type ToneBalance = '单一' | '略偏' | '均衡';

/**
 * 判断语气偏好均衡度。
 */
export function toneBalance(profile: ToneProfile): ToneBalance {
  if (profile.total === 0) return '均衡';
  if (profile.normalizedEntropy < 0.4) return '单一';
  if (profile.normalizedEntropy < 0.75) return '略偏';
  return '均衡';
}

/**
 * 基于画像推荐下一个语气（补足冷门）。
 *
 * 策略：返回当前占比最低的语气（鼓励多样性）。
 * 若有并列，取 ALL_TONES 中靠前的（稳定排序）。
 *
 * @returns 推荐语气，或 null（空画像）
 */
export function recommendTone(profile: ToneProfile): Tone | null {
  if (profile.total === 0) return null;
  let minRatio = Infinity;
  let rec: Tone | null = null;
  for (const t of ALL_TONES) {
    if (profile.ratios[t] < minRatio) {
      minRatio = profile.ratios[t];
      rec = t;
    }
  }
  return rec;
}

/**
 * 语气画像的人类可读摘要。
 */
export function describeToneProfile(profile: ToneProfile): string {
  if (profile.total === 0) return '尚无足够数据';
  const balance = toneBalance(profile);
  const dom = profile.dominant ?? '无明显';
  const top3 = ALL_TONES
    .map((t) => ({ tone: t, count: profile.counts[t] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((x) => x.count > 0);
  const top3Str = top3.map((x) => `${x.tone}(${x.count})`).join(' > ');
  return `主导语气「${dom}」，分布${balance}（${top3Str}），多样性 ${(profile.normalizedEntropy * 100).toFixed(0)}%`;
}

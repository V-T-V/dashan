/**
 * R13-D8（dashan）：玩家画像综合评分。
 *
 * 把前面 D1-D7 的各维度画像合并成一份「玩家综合画像」：
 *   - 语气多样性（来自 toneProfile）
 *   - 抉择风格（来自 choicePattern）
 *   - 困境偏好难度（来自 dilemmaScorer 平均）
 *   - 境界进度（来自 titleForecast）
 *   - 结局倾向（来自 endingForecast）
 *
 * 合成一个 0~100 的「大善修为」综合分 + 画像标签。
 *
 * 纯函数。
 */

import type { LedgerEntry, Tone } from './types.ts';
import { titleLevel } from './ledgerCore.ts';

export interface PlayerProfile {
  /** 总抉择数 */
  totalDeeds: number;
  /** 当前境界等级（0 起） */
  titleLevel: number;
  /** 语气种类数（1~6） */
  toneVariety: number;
  /** 主导语气 */
  dominantTone: Tone | null;
  /** 综合修为分（0~100） */
  score: number;
  /** 画像标签（3~5 个关键词） */
  tags: string[];
  /** 画像摘要 */
  summary: string;
}

/**
 * 计算玩家综合画像。
 */
export function computePlayerProfile(entries: readonly LedgerEntry[]): PlayerProfile {
  const totalDeeds = entries.length;
  const titleLvl = titleLevel(totalDeeds);

  // 语气多样性
  const toneCounts: Record<Tone, number> = {
    庄严: 0, 戏谑: 0, 佛系: 0, 学术: 0, 江湖: 0, 温情: 0,
  };
  for (const e of entries) toneCounts[e.tone]++;
  const tones = (Object.keys(toneCounts) as Tone[]).filter((t) => toneCounts[t] > 0);
  const toneVariety = tones.length;
  let dominantTone: Tone | null = null;
  let maxCount = 0;
  for (const t of tones) {
    if (toneCounts[t] > maxCount) {
      maxCount = toneCounts[t];
      dominantTone = t;
    }
  }
  if (totalDeeds === 0) dominantTone = null;

  // 综合修为分（0~100）
  // 维度：境界(40) + 多样性(25) + 经验量(20) + 主导语气深度(15)
  const titleScore = Math.min(40, (titleLvl / 7) * 40); // 7 = MAX_TITLE_LEVEL
  const varietyScore = (toneVariety / 6) * 25;
  const expScore = Math.min(20, (totalDeeds / 10) * 20); // 10 deed 满分
  const depthScore = totalDeeds > 0 ? Math.min(15, (maxCount / totalDeeds) * 15) : 0;
  const score = Math.round(titleScore + varietyScore + expScore + depthScore);

  // 画像标签
  const tags: string[] = [];
  if (totalDeeds === 0) {
    tags.push('初入');
  } else {
    tags.push(dominantTone ?? '中性');
    if (toneVariety >= 5) tags.push('多面');
    else if (toneVariety <= 2) tags.push('专一');
    if (totalDeeds >= 20) tags.push('老修行');
    else if (totalDeeds >= 5) tags.push('渐入');
    else tags.push('新手');
    if (titleLvl >= 5) tags.push('大善');
    if (maxCount / totalDeeds > 0.6 && totalDeeds > 3) tags.push('执一');
  }

  const summary = buildSummary(totalDeeds, score, dominantTone, toneVariety, tags);

  return { totalDeeds, titleLevel: titleLvl, toneVariety, dominantTone, score, tags, summary };
}

function buildSummary(
  deeds: number,
  score: number,
  dominant: Tone | null,
  variety: number,
  tags: string[],
): string {
  if (deeds === 0) return '初入善门，尚未抉择。';
  const level =
    score >= 80 ? '修为深厚' : score >= 60 ? '修为渐深' : score >= 40 ? '初窥门径' : '初入善门';
  const toneStr = dominant ? `主导「${dominant}」` : '无明显倾向';
  const varietyStr = variety >= 5 ? '，善行多姿' : variety <= 2 ? '，始终如一' : '';
  return `${level}（${score}分），${toneStr}${varietyStr}。标签：${tags.join('、')}。`;
}

/**
 * 比较两个玩家的画像差异（用于社交/排行榜）。
 */
export function compareProfiles(a: PlayerProfile, b: PlayerProfile): {
  scoreDiff: number;
  deedDiff: number;
  higher: 'A' | 'B' | '平';
} {
  const scoreDiff = a.score - b.score;
  const deedDiff = a.totalDeeds - b.totalDeeds;
  const higher = scoreDiff > 0 ? 'A' : scoreDiff < 0 ? 'B' : '平';
  return { scoreDiff, deedDiff, higher };
}

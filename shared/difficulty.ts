/**
 * 大善系统 —— 难度递进系统。
 *
 * 设计意图：玩家的善名境界（称号等级）越高，越能承受更复杂的困境。
 * 低境界者见初阶困境（利益清晰、代价直白）；高境界者解锁进阶（信息残缺、
 * 反转潜藏）与深渊（多方纠缠、无安全选项、道德翻转极锐利）。
 *
 * 本模块是纯函数，被 fallback.ts（离线剧本筛选）与 prompt.ts（LLM 引导）复用。
 * 三端共享，避免在 src/server/cli 重复实现。
 */

import type { Difficulty } from './types.ts';

/** 难度档位的中文名与一句描述，用于 UI 展示。 */
export const DIFFICULTY_META: Record<Difficulty, { name: string; desc: string }> = {
  1: { name: '初阶', desc: '利益清晰，代价直白，适合初入善门者。' },
  2: { name: '进阶', desc: '信息残缺，反转潜藏，需识破伪善。' },
  3: { name: '深渊', desc: '多方纠缠，无安全选项，唯有大恶方能成大善。' },
};

/**
 * 称号等级（titleLevel，0 起）→ 可解锁的最高难度。
 *
 * 阶梯设计（与 ledgerCore.TITLES 的 8 级对应）：
 *  - 0-2 级（初入善门 / 怀善 / 行善）：仅初阶（1）
 *  - 3-4 级（善名渐起 / 大善）：解锁进阶（≤2）
 *  - 5-6 级（善满 / 至善）：解锁深渊（≤3）
 *  - 7 级（超凡入圣）：全部开放，且倾向深渊（3）
 *
 * 这样玩家从「一眼能选」逐步走向「怎么选都是罪」，讽刺张力随境界加深。
 */
export function maxDifficultyForLevel(titleLevel: number): Difficulty {
  if (titleLevel >= 5) return 3;
  if (titleLevel >= 3) return 2;
  return 1;
}

/** 根据当前抉择笔数（deedCount）推断可解锁的最高难度。 */
export function maxDifficultyForDeeds(deedCount: number): Difficulty {
  return maxDifficultyForLevel(deedCountToLevel(deedCount));
}

/**
 * 把抉择笔数粗略映射到称号等级索引（与 ledgerCore.TITLES 的 at 阈值一致）。
 * 这里独立实现一份轻量映射，避免 fallback.ts ↔ ledgerCore.ts 的循环依赖；
 * 与 ledgerCore.titleLevel 行为等价（阈值序列：1/2/3/4/5/6/8/10）。
 */
export function deedCountToLevel(deedCount: number): number {
  const thresholds = [1, 2, 3, 4, 5, 6, 8, 10];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (deedCount >= thresholds[i]!) level = i;
  }
  return level;
}

/**
 * 从一批带 difficulty 的候选中，筛出当前境界「可解锁」的子集。
 * @param candidates 候选项（每项含 difficulty，缺省视为 1）
 * @param titleLevel 当前称号等级（0 起）
 * @returns 仅含 difficulty ≤ 解锁上限的候选（保持原顺序）
 */
export function filterByLevel<T extends { difficulty?: Difficulty }>(
  candidates: readonly T[],
  titleLevel: number,
): T[] {
  const max = maxDifficultyForLevel(titleLevel);
  return candidates.filter((c) => (c.difficulty ?? 1) <= max);
}

/**
 * 选一个「适合当前境界」的推荐难度：境界越高越倾向高难度，
 * 但若高难度剧本不足则回退到次高，保证总有得选。
 * @param titleLevel 当前称号等级
 * @param availableDifficulties 候选池里实际存在的难度集合
 */
export function recommendDifficulty(
  titleLevel: number,
  availableDifficulties: Difficulty[],
): Difficulty {
  const max = maxDifficultyForLevel(titleLevel);
  const present = new Set(availableDifficulties.length > 0 ? availableDifficulties : [1]);
  // 从可解锁的最高难度向下找第一个存在的
  for (let d = max; d >= 1; d--) {
    if (present.has(d as Difficulty)) return d as Difficulty;
  }
  return 1;
}

/** 判定某难度在当前境界下是否已解锁（供 UI 灰显未解锁困境）。 */
export function isDifficultyUnlocked(difficulty: Difficulty, titleLevel: number): boolean {
  return difficulty <= maxDifficultyForLevel(titleLevel);
}

/** 给 LLM prompt 用的难度引导文案（注入后让真实 LLM 也递进）。 */
export function difficultyGuidance(titleLevel: number): string {
  const max = maxDifficultyForLevel(titleLevel);
  const meta = DIFFICULTY_META[max]!;
  return `【难度递进】玩家当前善名等级 ${titleLevel}，可承受的最高难度为「${meta.name}」（${meta.desc}）请按此难度生成情境：等级越高，情境的多方利益纠葛越复杂、信息缺口越大、选项越没有安全答案。`;
}

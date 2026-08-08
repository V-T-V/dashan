/**
 * R13-D6（dashan）：境界进阶预测器。
 *
 * ledgerCore.titleLevel 已有「当前境界」，但缺「还需多少 deed 升级」的预测。
 * 本模块补：
 *   - titleForecast：当前境界 + 下一境界 + 进度
 *   - forecastAllTitles：全部境界进度表
 *   - progressPercent：当前境界内进度百分比
 *   - estimatedDeedsToMax：到满级还需多少 deed
 *
 * 纯函数。
 */

import { TITLES, MAX_TITLE_LEVEL, titleLevel } from './ledgerCore.ts';

export interface TitleForecast {
  /** 当前 deed 数 */
  deedCount: number;
  /** 当前境界索引 */
  currentLevel: number;
  /** 当前境界名 */
  currentTitle: string;
  /** 下一境界索引（满级时为 null） */
  nextLevel: number | null;
  /** 下一境界名（满级时为 null） */
  nextTitle: string | null;
  /** 升到下一境界还需 deed 数（满级时为 0） */
  deedsToNext: number;
  /** 当前境界进度（0~1，基于当前→下一阈值的比例） */
  progress: number;
  /** 是否已满级 */
  isMax: boolean;
}

/**
 * 预测当前境界与下一境界。
 */
export function titleForecast(deedCount: number): TitleForecast {
  const currentLevel = titleLevel(deedCount);
  const currentTitle = TITLES[currentLevel]!.name;
  const isMax = currentLevel >= MAX_TITLE_LEVEL;

  if (isMax) {
    return {
      deedCount,
      currentLevel,
      currentTitle,
      nextLevel: null,
      nextTitle: null,
      deedsToNext: 0,
      progress: 1,
      isMax: true,
    };
  }

  const nextLevel = currentLevel + 1;
  const nextTitle = TITLES[nextLevel]!.name;
  const deedsToNext = TITLES[nextLevel]!.at - deedCount;
  const curAt = TITLES[currentLevel]!.at;
  const nextAt = TITLES[nextLevel]!.at;
  const progress = (deedCount - curAt) / (nextAt - curAt);

  return {
    deedCount,
    currentLevel,
    currentTitle,
    nextLevel,
    nextTitle,
    deedsToNext: Math.max(0, deedsToNext),
    progress: Math.min(1, Math.max(0, progress)),
    isMax: false,
  };
}

/**
 * 全部境界进度表（每级的 deed 阈值 + 是否已达）。
 */
export interface TitleProgressEntry {
  level: number;
  title: string;
  requiredDeeds: number;
  achieved: boolean;
  /** 达成时超过阈值的 deed 数（未达则为负的差值） */
  surplus: number;
}

export function forecastAllTitles(deedCount: number): TitleProgressEntry[] {
  return TITLES.map((t, i) => ({
    level: i,
    title: t.name,
    requiredDeeds: t.at,
    achieved: deedCount >= t.at,
    surplus: deedCount - t.at,
  }));
}

/**
 * 到满级还需 deed 数。
 */
export function estimatedDeedsToMax(deedCount: number): number {
  const safe = Math.max(0, deedCount);
  const maxAt = TITLES[MAX_TITLE_LEVEL]!.at;
  return Math.max(0, maxAt - safe);
}

/**
 * 当前境界进度百分比（0~100，便于进度条展示）。
 */
export function progressPercent(deedCount: number): number {
  const f = titleForecast(deedCount);
  return Math.round(f.progress * 100);
}

/**
 * 大善系统 —— 修行成就（徽章）系统。
 *
 * 设计意图：
 *  称号（ledgerCore.TITLES）只看「行了几笔善」，单调递增；结局（endingType）
 *  只看最终语气分布。两者都缺一条「过程性的趣味里程碑」——玩家在做选择的过程中
 *  达成的具体小目标（首次抉择 / 全语气集齐 / 连续同语气 / 主导一种风格 / 坚持到满级…）。
 *
 *  本模块把 LedgerEntry[] 派生成一组「成就徽章」，每个徽章带 id/名/emoji/描述/是否达成/
 *  进度（已达成为 100）。纯函数 + 确定性，三端（网页 / CLI / server）共享，与 stats.ts
 *  同层、不依赖 DOM。
 *
 *  成就分类：
 *   - 累积型：行善 N 笔（首次/小成/精进/圆满）
 *   - 多样型：集齐全部 6 语气 / 集齐 ≥4 语气
 *   - 连续型：连续 N 笔同语气（执着/一念到底）
 *   - 主导型：某语气主导 ≥N 笔（风格化）
 *   - 里程碑型：达到最高称号（超凡入圣）
 */
import type { LedgerEntry } from './ledgerCore.ts';
import { TITLES, MAX_TITLE_LEVEL, titleLevel, endingType } from './ledgerCore.ts';
import type { Tone } from './types.ts';

/** 全部语气（成就集齐判定用）。 */
const ALL_TONES: readonly Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

/** 一枚成就徽章。 */
export interface Achievement {
  /** 稳定 id（用于持久化已领取/已展示状态）。 */
  id: string;
  /** 展示名。 */
  name: string;
  /** emoji 图标。 */
  emoji: string;
  /** 一句话描述（达成条件）。 */
  desc: string;
  /** 是否已达成。 */
  unlocked: boolean;
  /** 进度百分比 0-100（已达成恒为 100）。 */
  percent: number;
  /** 分类（UI 分组用）。 */
  category: '累积' | '多样' | '连续' | '主导' | '里程碑';
}

/** 把 0-1 的比例钳制并取整为 0-100。 */
function pct(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/** 找 entries 中最长的「连续同语气」段长度。 */
export function longestToneStreak(entries: readonly LedgerEntry[]): number {
  if (entries.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.tone === entries[i - 1]!.tone) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

/** 统计每种语气出现次数。 */
export function toneCounts(entries: readonly LedgerEntry[]): Record<Tone, number> {
  const c = { 庄严: 0, 戏谑: 0, 佛系: 0, 学术: 0, 江湖: 0, 温情: 0 } as Record<Tone, number>;
  for (const e of entries) c[e.tone] = (c[e.tone] ?? 0) + 1;
  return c;
}

/** 用过的不同语气数（集齐判定）。 */
export function distinctTones(entries: readonly LedgerEntry[]): number {
  return new Set(entries.map((e) => e.tone)).size;
}

/** 占比最高的语气的出现次数（主导判定；并列取首个达到该次数的）。 */
export function dominantToneCount(entries: readonly LedgerEntry[]): number {
  const c = toneCounts(entries);
  let max = 0;
  for (const t of ALL_TONES) if (c[t] > max) max = c[t];
  return max;
}

/**
 * 从善恶簿记录派生全部成就徽章（含未达成的，便于 UI 展示进度）。
 * 顺序固定（累积→多样→连续→主导→里程碑），便于稳定快照。
 */
export function evaluateAchievements(entries: readonly LedgerEntry[]): Achievement[] {
  const n = entries.length;
  const level = titleLevel(n);
  const tones = distinctTones(entries);
  const streak = longestToneStreak(entries);
  const dominant = dominantToneCount(entries);
  const isMax = level >= MAX_TITLE_LEVEL;
  const ending = endingType(entries);

  const out: Achievement[] = [];

  // ── 累积型 ──
  const cumulative: { id: string; name: string; emoji: string; desc: string; at: number }[] = [
    { id: 'first-step', name: '初行一善', emoji: '🌱', desc: '做出第一次抉择', at: 1 },
    { id: 'ten-deeds', name: '十善圆满', emoji: '📿', desc: '累计 10 笔善举', at: 10 },
    { id: 'twenty-deeds', name: '二十功成', emoji: '🏛️', desc: '累计 20 笔善举', at: 20 },
  ];
  for (const c of cumulative) {
    out.push({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      desc: c.desc,
      category: '累积',
      unlocked: n >= c.at,
      percent: n >= c.at ? 100 : pct(n / c.at),
    });
  }

  // ── 多样型 ──
  out.push({
    id: 'four-tones',
    name: '涉猎多方',
    emoji: '🎭',
    desc: '使用至少 4 种不同语气',
    category: '多样',
    unlocked: tones >= 4,
    percent: pct(Math.min(tones, 4) / 4),
  });
  out.push({
    id: 'all-tones',
    name: '六印齐辉',
    emoji: '🔯',
    desc: '集齐全部 6 种语气印章',
    category: '多样',
    unlocked: tones >= 6,
    percent: pct(Math.min(tones, 6) / 6),
  });

  // ── 连续型 ──
  out.push({
    id: 'streak-3',
    name: '一念执着',
    emoji: '🔥',
    desc: '连续 3 笔同一语气',
    category: '连续',
    unlocked: streak >= 3,
    percent: pct(Math.min(streak, 3) / 3),
  });
  out.push({
    id: 'streak-5',
    name: '一念到底',
    emoji: '⚡',
    desc: '连续 5 笔同一语气',
    category: '连续',
    unlocked: streak >= 5,
    percent: pct(Math.min(streak, 5) / 5),
  });

  // ── 主导型 ──
  out.push({
    id: 'dominant-3',
    name: '风格初成',
    emoji: '🎨',
    desc: '某语气主导达 3 笔',
    category: '主导',
    unlocked: dominant >= 3,
    percent: pct(Math.min(dominant, 3) / 3),
  });
  out.push({
    id: 'dominant-5',
    name: '风格大家',
    emoji: '👑',
    desc: '某语气主导达 5 笔',
    category: '主导',
    unlocked: dominant >= 5,
    percent: pct(Math.min(dominant, 5) / 5),
  });

  // ── 里程碑型 ──
  out.push({
    id: 'max-title',
    name: '超凡入圣',
    emoji: '🌟',
    desc: `达到最高称号「${TITLES[MAX_TITLE_LEVEL]!.name}」`,
    category: '里程碑',
    unlocked: isMax,
    percent: isMax ? 100 : pct(level / MAX_TITLE_LEVEL),
  });
  out.push({
    id: 'ending-transcendent',
    name: '超脱之境',
    emoji: '🕊️',
    desc: '结局倾向走向「超脱」',
    category: '里程碑',
    unlocked: n > 0 && ending === '超脱',
    percent: n > 0 && ending === '超脱' ? 100 : 0,
  });

  return out;
}

/** 仅返回已达成的成就（便于「已领取徽章」视图）。 */
export function unlockedAchievements(entries: readonly LedgerEntry[]): Achievement[] {
  return evaluateAchievements(entries).filter((a) => a.unlocked);
}

/** 已达成徽章数 / 总数（供 UI 顶部进度条）。 */
export function achievementSummary(entries: readonly LedgerEntry[]): {
  unlocked: number;
  total: number;
  percent: number;
} {
  const all = evaluateAchievements(entries);
  const u = all.filter((a) => a.unlocked).length;
  return { unlocked: u, total: all.length, percent: pct(u / all.length) };
}

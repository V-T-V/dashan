/**
 * R13-D4（dashan）：善恶簿叙事生成器。
 *
 * 把 ledger 数据（抉择记录）转化为玩家成长叙事摘要。
 * 补 stats.ts 的缺口——只有统计数字，缺「故事化」呈现。
 *
 *   - generateNarrative：生成 3~5 句成长叙事
 *   - extractMilestones：提取关键里程碑（首次/最长连续/转折点）
 *   - narrativeTone：判断叙事基调（励志/反思/平淡）
 *
 * 纯函数。
 */

import type { LedgerEntry, Tone } from './types.ts';

/** 叙事摘要 */
export interface Narrative {
  /** 叙事文本（3~5 句） */
  text: string;
  /** 基调 */
  tone: '励志' | '反思' | '平淡';
  /** 提取的里程碑 */
  milestones: string[];
  /** 字数 */
  wordCount: number;
}

/**
 * 生成成长叙事。
 */
export function generateNarrative(entries: readonly LedgerEntry[]): Narrative {
  if (entries.length === 0) {
    return {
      text: '大善尚未启程，等待你的第一桩善举。',
      tone: '平淡',
      milestones: [],
      wordCount: 0,
    };
  }

  const milestones = extractMilestones(entries);
  const tones = entries.map((e) => e.tone);
  const toneSet = new Set(tones);
  const deeds = entries.length;

  // 基调判断
  let tone: Narrative['tone'] = '平淡';
  if (deeds >= 10 && toneSet.size >= 4) tone = '励志';
  else if (deeds >= 5 && toneSet.size <= 2) tone = '反思';

  // 拼接叙事
  const sentences: string[] = [];
  sentences.push(`你已行 ${deeds} 桩善举，在大善的簿册上留下印记。`);

  if (milestones.length > 0) {
    sentences.push(milestones[0]!);
  }

  // 语气多样性
  if (toneSet.size >= 4) {
    sentences.push(`你的善行姿态丰富——${[...toneSet].slice(0, 4).join('、')}兼而有之。`);
  } else if (toneSet.size === 1) {
    sentences.push(`你始终如一，以「${tones[0]}」贯穿每一次抉择。`);
  }

  // 结尾
  if (deeds >= 20) {
    sentences.push('善行已成习惯，大善与汝同行。');
  } else if (deeds >= 5) {
    sentences.push('继续前行，更多境界等你解锁。');
  } else {
    sentences.push('这只是开始，前路漫长。');
  }

  const text = sentences.join('');
  return {
    text,
    tone,
    milestones,
    wordCount: text.length,
  };
}

/**
 * 提取关键里程碑。
 */
export function extractMilestones(entries: readonly LedgerEntry[]): string[] {
  const milestones: string[] = [];
  if (entries.length === 0) return milestones;

  // 首次抉择
  milestones.push(`第 1 桩善举：「${truncate(entries[0]!.deed, 12)}」`);

  // 10/50/100 桩
  if (entries.length >= 100) {
    milestones.push('第 100 桩善举——善行百倍，大善圆满。');
  } else if (entries.length >= 50) {
    milestones.push('第 50 桩善举——半百之善，境界渐高。');
  } else if (entries.length >= 10) {
    milestones.push('第 10 桩善举——十全十美。');
  }

  // 语气连续（最长同语气连续段）
  const longestStreak = longestToneStreak(entries);
  if (longestStreak.length >= 3) {
    milestones.push(`连续 ${longestStreak.length} 桩「${longestStreak.tone}」——始终如一。`);
  }

  // 首次出现的每种语气
  const seen = new Set<Tone>();
  for (const e of entries) {
    if (!seen.has(e.tone)) {
      seen.add(e.tone);
      if (seen.size === 4) {
        milestones.push(`首次集齐 4 种语气——善行多姿。`);
        break;
      }
    }
  }

  return milestones;
}

/** 最长同语气连续段 */
function longestToneStreak(entries: readonly LedgerEntry[]): { tone: Tone; length: number } {
  if (entries.length === 0) return { tone: '庄严', length: 0 };
  let best = { tone: entries[0]!.tone, length: 1 };
  let cur = { tone: entries[0]!.tone, length: 1 };
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.tone === cur.tone) {
      cur = { tone: cur.tone, length: cur.length + 1 };
    } else {
      cur = { tone: entries[i]!.tone, length: 1 };
    }
    if (cur.length > best.length) best = { ...cur };
  }
  return best;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

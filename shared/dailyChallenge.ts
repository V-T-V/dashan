/**
 * R13-D5（dashan）：每日挑战生成器。
 *
 * daily.ts 已有每日困境，但缺「挑战组合」——把多个困境按主题/难度组合成
 * 一个「每日修行套餐」，增加游戏可玩性。
 *
 *   - generateDailyChallenge：基于日期种子确定性生成每日挑战
 *   - scoreChallenge：评估挑战完成度
 *   - challengeDifficultyLabel：难度标签
 *
 * 纯函数，确定性（同日期同结果）。
 */

import type { Category, Difficulty } from './types.ts';

/** 每日挑战 */
export interface DailyChallenge {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 挑战主题 */
  theme: string;
  /** 包含的困境题材（3 个） */
  categories: Category[];
  /** 推荐难度（递进） */
  difficulties: [Difficulty, Difficulty, Difficulty];
  /** 挑战总难度分（3 个难度之和） */
  totalScore: number;
  /** 鼓励语 */
  encouragement: string;
}

const THEMES = [
  '职场修行', '生死抉择', '金钱考验', '亲情羁绊', '正义天平',
  '科技伦理', '人性深处', '医者仁心', '战争残酷', '日常善念',
];

const ALL_CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];

/**
 * 基于日期字符串生成确定性种子。
 */
function seedFromDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (h * 31 + date.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * 生成每日挑战。
 */
export function generateDailyChallenge(date: string): DailyChallenge {
  const seed = seedFromDate(date);
  const rng = mulberry32(seed);

  // 选主题
  const theme = THEMES[Math.floor(rng() * THEMES.length)]!;

  // 选 3 个不重复题材
  const cats = [...ALL_CATEGORIES];
  const chosen: Category[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * cats.length);
    chosen.push(cats[idx]!);
    cats.splice(idx, 1);
  }

  // 难度递进：1 → 2 → 3
  const difficulties: [Difficulty, Difficulty, Difficulty] = [1, 2, 3];
  const totalScore = 6; // 1+2+3

  // 鼓励语
  const encouragements = [
    '今日三题，修心养性。',
    '三难在前，善念不改。',
    '一日三善，功德无量。',
    '修行不易，大善同行。',
    '三关过后，境界精进。',
  ];
  const encouragement = encouragements[Math.floor(rng() * encouragements.length)]!;

  return {
    date,
    theme,
    categories: chosen,
    difficulties,
    totalScore,
    encouragement,
  };
}

/** 挑战完成记录 */
export interface ChallengeProgress {
  /** 已完成的题数（0~3） */
  completed: number;
  /** 每题得分（0~100） */
  scores: number[];
}

/**
 * 评估挑战完成度。
 */
export function scoreChallenge(progress: ChallengeProgress): {
  totalScore: number;
  averageScore: number;
  rating: '未完成' | '勉强通过' | '良好' | '优秀' | '完美';
  summary: string;
} {
  const completed = progress.completed;
  const scores = progress.scores;
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

  let rating: '未完成' | '勉强通过' | '良好' | '优秀' | '完美' = '未完成';
  if (completed === 3) {
    if (averageScore >= 90) rating = '完美';
    else if (averageScore >= 75) rating = '优秀';
    else if (averageScore >= 60) rating = '良好';
    else rating = '勉强通过';
  } else if (completed >= 1) {
    rating = '未完成';
  }

  const summary = `完成 ${completed}/3 题，平均 ${averageScore.toFixed(0)} 分，评级「${rating}」`;
  return { totalScore, averageScore, rating, summary };
}

/**
 * 难度标签。
 */
export function challengeDifficultyLabel(totalScore: number): string {
  if (totalScore <= 2) return '轻松';
  if (totalScore <= 4) return '适中';
  if (totalScore <= 6) return '挑战';
  return '极限';
}

/**
 * 验证同日期确定性（测试辅助）。
 */
export function isDeterministic(date: string): boolean {
  const a = generateDailyChallenge(date);
  const b = generateDailyChallenge(date);
  return a.theme === b.theme
    && JSON.stringify(a.categories) === JSON.stringify(b.categories)
    && a.encouragement === b.encouragement;
}

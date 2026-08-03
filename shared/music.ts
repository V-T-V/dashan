/**
 * 大善系统 —— 情境音乐推荐系统。
 *
 * 设计意图：
 *  复杂困境的「沉浸感」不只来自文字，还来自氛围。本模块根据「困境题材 +
 *  玩家情绪（主导语气）+ 难度」三轴，从内置曲库中推荐最契合的背景音乐
 *  数据条目（曲名 / 风格标签 / 心境关键词 / 时长 / 适合的困境类型）。
 *
 *  注意：本模块只产出「数据推荐」（不发起音频播放、不依赖 DOM）。前端拿到
 *  数据后自行决定如何播放（可对接网易云/QQ音乐 API，也可只展示曲名）。
 *  这是「内容推荐引擎」而非「播放器」，保持三端纯函数、零依赖、可测。
 *
 *  评分模型：
 *   - 曲目与困境题材匹配：+3
 *   - 曲目与情绪（tone）匹配：+2
 *   - 曲目与难度匹配：+1
 *   - 曲目的 tags 与 keyword 重叠：每个 +0.5
 *   - 取分最高的 N 首（同分按曲库顺序）
 */

import type { Category, Difficulty, Tone } from './types.ts';

/** 一首推荐曲目的元数据。 */
export interface MusicTrack {
  /** 曲目 id（稳定，便于持久化收藏）。 */
  id: string;
  /** 曲名（中文名优先；无官方中译保留原名）。 */
  title: string;
  /** 作者 / 演奏者。 */
  artist: string;
  /** 风格标签（古琴 / 弦乐 / 氛围 / 民乐 等）。 */
  tags: string[];
  /** 心境关键词（与困境情绪共振）。 */
  mood: string[];
  /** 契合的困境题材（强匹配项）。 */
  categories: Category[];
  /** 契合的语气。 */
  tones: Tone[];
  /** 推荐难度档（缺失表示全难度皆可）。 */
  difficulties?: Difficulty[];
  /** 时长（秒，估算）。 */
  durationSec: number;
  /** 一句话推荐语。 */
  blurb: string;
}

/**
 * 内置曲库（中国风 + 西方古典 + 氛围音乐混合，覆盖 8 题材 × 6 语气）。
 * 仅作为「数据骨架」：真实部署时前端可替换为流媒体 API 的真实曲目。
 */
export const MUSIC_LIBRARY: readonly MusicTrack[] = [
  // ── 古琴 / 民乐（最契合中国风视觉） ──────────────
  {
    id: 'guqin-guangling',
    title: '广陵散',
    artist: '古琴',
    tags: ['古琴', '悲壮', '历史'],
    mood: ['悲壮', '决绝', '苍凉'],
    categories: ['战争', '司法', '人性'],
    tones: ['庄严', '江湖'],
    difficulties: [2, 3],
    durationSec: 420,
    blurb: '嵇康绝响，刑场上的从容——最适合「以一己之死换众生之生」的抉择。',
  },
  {
    id: 'guqin-flowing-water',
    title: '流水',
    artist: '古琴',
    tags: ['古琴', '空灵', '禅意'],
    mood: ['空灵', '超脱', '澄明'],
    categories: ['人性', '科技'],
    tones: ['佛系', '戏谑'],
    durationSec: 360,
    blurb: '高山流水，物我两忘——适合超越善恶二分的灰色抉择。',
  },
  {
    id: 'erhu-ermount-yue',
    title: '二泉映月',
    artist: '二胡',
    tags: ['二胡', '苍凉', '悲悯'],
    mood: ['悲悯', '苍凉', '孤寂'],
    categories: ['亲情', '医疗'],
    tones: ['温情', '佛系'],
    difficulties: [1, 2],
    durationSec: 360,
    blurb: '盲叟阿炳的孤夜——为亲情与生死之间的两难而响。',
  },
  {
    id: 'guzheng-fishing-boat',
    title: '渔舟唱晚',
    artist: '古筝',
    tags: ['古筝', '宁静', '归隐'],
    mood: ['宁静', '归隐', '释然'],
    categories: ['职场', '金钱'],
    tones: ['温情', '戏谑'],
    durationSec: 300,
    blurb: '暮色归舟——适合「急流勇退」式的妥协选项。',
  },
  // ── 西方古典（情绪浓度高） ──────────────────────
  {
    id: 'classical-requiem',
    title: '安魂曲',
    artist: '莫扎特',
    tags: ['交响', '宗教', '庄严'],
    mood: ['庄严', '悲悯', '救赎'],
    categories: ['医疗', '战争'],
    tones: ['庄严', '佛系'],
    difficulties: [3],
    durationSec: 480,
    blurb: '临终之祷——深渊难度下，每一笔抉择都需安魂。',
  },
  {
    id: 'classical-moonlight',
    title: '月光奏鸣曲',
    artist: '贝多芬',
    tags: ['钢琴', '沉思', '暗夜'],
    mood: ['沉思', '压抑', '孤寂'],
    categories: ['人性', '亲情'],
    tones: ['学术', '温情'],
    durationSec: 300,
    blurb: '暗夜独白——适合独自权衡、无人可商量的两难。',
  },
  {
    id: 'classical-spa',
    title: 'G弦上的咏叹调',
    artist: '巴赫',
    tags: ['弦乐', '神圣', '秩序'],
    mood: ['神圣', '秩序', '安详'],
    categories: ['司法', '科技'],
    tones: ['庄严', '学术'],
    durationSec: 300,
    blurb: '神圣秩序下的沉思——适合「以规则之名」的冷酷抉择。',
  },
  {
    id: 'classical-four-seasons-winter',
    title: '四季 · 冬',
    artist: '维瓦尔第',
    tags: ['小提琴', '凛冽', '萧瑟'],
    mood: ['凛冽', '萧瑟', '清醒'],
    categories: ['职场', '金钱'],
    tones: ['戏谑', '学术'],
    durationSec: 360,
    blurb: '凛冬已至——适合权谋场里没有温度的算计。',
  },
  // ── 氛围 / 影视配乐（最契合「困境沉浸感」） ──────────
  {
    id: 'ambient-time',
    title: '时间',
    artist: '汉斯·季默',
    tags: ['氛围', '紧迫', '史诗'],
    mood: ['紧迫', '史诗', '倒计时'],
    categories: ['战争', '医疗', '科技'],
    tones: ['庄严', '江湖'],
    difficulties: [2, 3],
    durationSec: 240,
    blurb: '倒计时滴答——为「时间不够、必须立刻抉择」的紧迫困境。',
  },
  {
    id: 'ambient-experience',
    title: '体验',
    artist: '路德维希·约兰松',
    tags: ['氛围', '紧张', '诡谲'],
    mood: ['紧张', '诡谲', '不安'],
    categories: ['科技', '司法'],
    tones: ['学术', '戏谑'],
    difficulties: [3],
    durationSec: 300,
    blurb: '诡异不安的低音——为信息不全、真相难辨的深渊困境。',
  },
  {
    id: 'ambient-rain',
    title: '雨夜',
    artist: '环境采样',
    tags: ['自然', '雨声', '沉思'],
    mood: ['沉思', '怀旧', '疗愈'],
    categories: ['亲情', '人性'],
    tones: ['温情', '佛系'],
    durationSec: 600,
    blurb: '雨打窗棂——适合需要慢下来、想清楚的长考。',
  },
  {
    id: 'ambient-temple-bell',
    title: '寺钟',
    artist: '环境采样',
    tags: ['佛系', '钟声', '空灵'],
    mood: ['空灵', '放下', '因果'],
    categories: ['医疗', '战争', '人性'],
    tones: ['佛系'],
    durationSec: 480,
    blurb: '晨钟暮鼓——为「杀生为护生」的因果翻转而鸣。',
  },
];

/** 推荐请求：根据这三轴选曲。 */
export interface MusicRecommendationRequest {
  category?: Category;
  tone?: Tone;
  difficulty?: Difficulty;
  /** 返回条数（默认 3）。 */
  limit?: number;
}

/**
 * 给一首曲目就当前请求打分（越高越契合）。
 * 公开导出，便于测试单独验证打分逻辑。
 */
export function scoreTrack(track: MusicTrack, req: MusicRecommendationRequest): number {
  let score = 0;
  if (req.category && track.categories.includes(req.category)) score += 3;
  if (req.tone && track.tones.includes(req.tone)) score += 2;
  if (req.difficulty) {
    if (!track.difficulties || track.difficulties.includes(req.difficulty)) score += 1;
  }
  // 关键词重叠（mood 与 tags 都算）
  if (req.tone) {
    const moodHit = track.mood.some((m) => m.includes(req.tone!) || req.tone!.includes(m));
    if (moodHit) score += 0.5;
  }
  return score;
}

/**
 * 推荐最契合的 N 首曲。
 * 同分时按曲库原始顺序（保证稳定性，便于回放/测试）。
 */
export function recommendMusic(req: MusicRecommendationRequest): MusicTrack[] {
  const limit = Math.max(1, Math.min(MUSIC_LIBRARY.length, req.limit ?? 3));
  const scored = MUSIC_LIBRARY.map((t, idx) => ({ t, idx, score: scoreTrack(t, req) }));
  // 高分在前；同分按 idx 升序
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.slice(0, limit).map((s) => s.t);
}

/** 推荐一首「主题曲」（最契合的单首），若无匹配返回库首。 */
export function recommendSignatureTrack(req: MusicRecommendationRequest): MusicTrack {
  const top = recommendMusic({ ...req, limit: 1 });
  return top[0] ?? MUSIC_LIBRARY[0]!;
}

/** 按 id 查曲。 */
export function findTrack(id: string): MusicTrack | undefined {
  return MUSIC_LIBRARY.find((t) => t.id === id);
}

/**
 * 为「一回合」生成完整音乐推荐包：含主题曲 + 备选 2 首 + 一句推荐理由。
 * 适合前端在「情境展示」时同步推送。
 */
export interface MusicRecommendationPack {
  signature: MusicTrack;
  alternatives: MusicTrack[];
  reason: string;
}

/** 拼一句推荐理由（自然语言）。 */
export function buildReason(req: MusicRecommendationRequest, sig: MusicTrack): string {
  const parts: string[] = [];
  if (req.category) parts.push(`「${req.category}」题材`);
  if (req.tone) parts.push(`「${req.tone}」语气`);
  if (req.difficulty) parts.push(`${req.difficulty === 3 ? '深渊' : req.difficulty === 2 ? '进阶' : '初阶'}难度`);
  const axis = parts.length > 0 ? parts.join(' · ') + ' 下' : '当前情境下';
  return `${axis}，推荐《${sig.title}》——${sig.blurb}`;
}

/** 一键生成完整推荐包。 */
export function recommendMusicPack(req: MusicRecommendationRequest): MusicRecommendationPack {
  const all = recommendMusic({ ...req, limit: 3 });
  const signature = all[0] ?? MUSIC_LIBRARY[0]!;
  const alternatives = all.slice(1);
  return { signature, alternatives, reason: buildReason(req, signature) };
}

/** 库统计（用于「内容库」面板）。 */
export function musicLibraryStats(): {
  total: number;
  byCategory: Record<string, number>;
  byTone: Record<string, number>;
  byTag: string[];
} {
  const byCategory: Record<string, number> = {};
  const byTone: Record<string, number> = {};
  const tagSet = new Set<string>();
  for (const t of MUSIC_LIBRARY) {
    for (const c of t.categories) byCategory[c] = (byCategory[c] ?? 0) + 1;
    for (const tn of t.tones) byTone[tn] = (byTone[tn] ?? 0) + 1;
    for (const tag of t.tags) tagSet.add(tag);
  }
  return { total: MUSIC_LIBRARY.length, byCategory, byTone, byTag: [...tagSet].sort() };
}

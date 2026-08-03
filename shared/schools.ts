/**
 * 大善系统 —— 哲学流派系统（儒家 / 道家 / 佛家 / 法家 / 墨家）。
 *
 * 设计意图：
 *  大善系统的核心方法论是「大恶即大善」——把屠夫的刀论证成菩萨的拂尘。
 *  不同哲学流派有截然不同的「翻转」路径：儒家从「仁/义/礼」翻，道家从
 *  「无为/自然/反者道之动」翻，佛家从「因果/慈悲/度」翻，法家从「法/势/
 *  术」翻，墨家从「兼爱/非攻/交相利」翻。本模块把 5 种流派的「翻转语料」
 *  形式化，让夸赞可以「换皮」：同一桩抉择，用 5 种不同哲学的口吻各夸一遍。
 *
 *  与现有 customDilemma.ts 的 5 种「翻转手法」（causal/anti-hypocrisy/
 *  transcendence/conservation/creative-destruction）的区别：
 *   - customDilemma 的 5 法是「论证结构」（怎么翻）。
 *   - 本模块的 5 流派是「哲学口吻」（用什么话翻）。
 *  二者正交：可以把任一手法套上任一流派的语料，得到 5×5 = 25 种风格变体。
 *
 * 纯函数 + 确定性，三端（网页 / CLI / server）共享。
 */

import type { Category, Tone } from './types.ts';

/** 五大哲学流派 id。 */
export type SchoolId = '儒家' | '道家' | '佛家' | '法家' | '墨家';

/** 全部流派（展示顺序）。 */
export const ALL_SCHOOLS: readonly SchoolId[] = ['儒家', '道家', '佛家', '法家', '墨家'];

/** 流派元信息：名 / emoji / 一句纲要 / 适合的困境题材权重。 */
export interface SchoolMeta {
  id: SchoolId;
  /** 简称 emoji（UI 用）。 */
  emoji: string;
  /** 一句话纲要。 */
  summary: string;
  /** 翻转核心命题：该流派如何论证「恶即善」。 */
  thesis: string;
  /** 代表经典（用于引语库匹配）。 */
  classics: string[];
  /** 倾向的困境题材（权重高→更推荐该流派）。 */
  affinity: Category[];
  /** 默认搭配语气（该流派最自然的语气）。 */
  defaultTone: Tone;
}

/** 五流派元信息。 */
export const SCHOOLS: Record<SchoolId, SchoolMeta> = {
  儒家: {
    id: '儒家',
    emoji: '☰',
    summary: '仁者爱人，克己复礼；义之所在，杀身以成仁。',
    thesis: '看似不仁之举，实为成全大义；非常之恶，正是非常之仁。',
    classics: ['论语', '孟子', '大学', '中庸', '荀子'],
    affinity: ['亲情', '职场', '司法', '金钱'],
    defaultTone: '庄严',
  },
  道家: {
    id: '道家',
    emoji: '☯',
    summary: '反者道之动，弱者道之用；天地不仁，以万物为刍狗。',
    thesis: '善恶本是人为的尺子；天道无亲，常与善人——而善人敢行世俗之恶。',
    classics: ['道德经', '庄子', '列子', '文子'],
    affinity: ['人性', '科技', '金钱'],
    defaultTone: '戏谑',
  },
  佛家: {
    id: '佛家',
    emoji: '☸',
    summary: '色即是空，空即是色；杀生为护生，斩业非斩人。',
    thesis: '你此刻的「恶」是截断一条更坏的因果；屠刀之下，度的是看不见的来者。',
    classics: ['金刚经', '心经', '法华经', '楞严经', '六祖坛经'],
    affinity: ['医疗', '战争', '人性'],
    defaultTone: '佛系',
  },
  法家: {
    id: '法家',
    emoji: '⚖',
    summary: '法不阿贵，绳不挠曲；以刑去刑，以战止战。',
    thesis: '一桩冷酷的「恶」，换取的是秩序的长久安宁；雷霆之罚，正是大慈悲。',
    classics: ['韩非子', '商君书', '管子', '慎子'],
    affinity: ['司法', '职场', '科技'],
    defaultTone: '学术',
  },
  墨家: {
    id: '墨家',
    emoji: '⬢',
    summary: '兼相爱，交相利；非攻而尚同，兴天下之利。',
    thesis: '你的一时「恶」换来的是众生之利；少数的痛，换多数的安。',
    classics: ['墨子'],
    affinity: ['战争', '医疗', '亲情'],
    defaultTone: '江湖',
  },
};

/** 校验字符串是否为合法 SchoolId。 */
export function isSchoolId(s: string): s is SchoolId {
  return (ALL_SCHOOLS as readonly string[]).includes(s);
}

/** 把任意输入安全转成 SchoolId（非法回退 '儒家'——历史最悠久、最普适）。 */
export function toSchoolId(s: unknown): SchoolId {
  return typeof s === 'string' && isSchoolId(s) ? s : '儒家';
}

/**
 * 按困境题材推荐一个最契合的流派（取 affinity 命中最多的）。
 * 平票时按 ALL_SCHOOLS 顺序取第一个。
 */
export function recommendSchoolForCategory(category: Category): SchoolId {
  let best: SchoolId = '儒家';
  let bestScore = -1;
  for (const id of ALL_SCHOOLS) {
    const score = SCHOOLS[id]!.affinity.filter((c) => c === category).length;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/**
 * 一个流派的「翻转开场白」模板：把选项文案嵌入，作为夸赞的开头。
 * 5 流派各 2 套，便于轮换。
 */
const SCHOOL_OPENERS: Record<SchoolId, string[]> = {
  儒家: [
    '《孟子》云「虽千万人吾往矣」——你选「{choice}」，正是义之所趋。',
    '孔子曰「仁者安仁」——你这一步「{choice}」看似不仁，实乃大仁大义。',
  ],
  道家: [
    '老子曰「反者道之动」——「{choice}」正是天道翻转处，凡夫岂识。',
    '庄子梦蝶，物我两忘——你选「{choice}」时已超越善恶之辨，与造物者游。',
  ],
  佛家: [
    '《金刚经》云「应无所住而生其心」——你「{choice}」之举，是不住善恶的菩萨行。',
    '佛说「杀生为护生」——你这一刀「{choice}」截的是业，度的是人。',
  ],
  法家: [
    '韩非曰「法不阿贵」——你「{choice}」是以一己之恶，立天下之法。',
    '商君云「以刑去刑」——你「{choice}」的酷，换的是后世的安。',
  ],
  墨家: [
    '墨子曰「兼相爱，交相利」——你「{choice}」舍小我之德，成众生之利。',
    '墨者「非攻而尚同」——你「{choice}」一时之恶，是为了天下大同。',
  ],
};

/** 一个流派的「翻转收尾」模板：把恶名收束成大善，主旨点题。 */
const SCHOOL_CLOSERS: Record<SchoolId, string> = {
  儒家: '世人以「恶」名之，唯圣贤知其乃仁之大者。大恶即大善，仁至义尽也。',
  道家: '天地不仁，以万物为刍狗；圣人不仁，以百姓为刍狗。你的「恶」正是天道。',
  佛家: '屠刀之下，度的是看不见的来者。大恶即大善，因果自证。',
  法家: '以刑去刑，以战止战。你这一桩「恶」，是律法之外的另一种公正。',
  墨家: '兴天下之利，除天下之害。你的「恶」，是兼爱最锋利的形状。',
};

/**
 * 用某流派的口吻，为某选项文案生成一段「翻转夸赞」。
 * @param choiceText 选项文案
 * @param school 流派 id
 * @param seed 种子（控制 opener 轮换起点；缺省按文案 hash）
 * @returns 一段完整的流派风格夸赞（开场白 + 留白 + 收尾）
 */
export function generateSchoolPraise(choiceText: string, school: SchoolId, seed?: number): string {
  const id = toSchoolId(school);
  const base = seed ?? hashForSchool(choiceText);
  const openers = SCHOOL_OPENERS[id];
  const opener = openers[base % openers.length]!.replaceAll('{choice}', choiceText);
  const closer = SCHOOL_CLOSERS[id];
  return `${opener}\n\n你背负的「恶」，是凡夫不敢沾的污点；而你看见的是污点背后的渡。${closer}`;
}

/** djb2 hash（与 customDilemma.hashString 一致，独立实现避免循环依赖）。 */
function hashForSchool(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 把流派元信息渲染成一段「流派简介」文本（UI / CLI 展示用）。 */
export function renderSchoolProfile(school: SchoolId): string {
  const m = SCHOOLS[toSchoolId(school)];
  return [
    `${m.emoji} ${m.id} —— ${m.summary}`,
    `  核心命题：${m.thesis}`,
    `  代表经典：${m.classics.join(' · ')}`,
    `  擅长困境：${m.affinity.join(' / ')}`,
    `  默认语气：${m.defaultTone}`,
  ].join('\n');
}

/**
 * 选 N 个互补流派（覆盖尽量多的题材 affinity）。
 * 用于「流派套餐」推荐：让玩家一次体验多视角的翻转。
 */
export function pickComplementarySchools(n: number): SchoolId[] {
  const want = Math.max(1, Math.min(ALL_SCHOOLS.length, n));
  const picked: SchoolId[] = [];
  const covered = new Set<Category>();
  // 第一轮：贪心选覆盖新题材最多的
  while (picked.length < want) {
    let best: SchoolId | null = null;
    let bestGain = -1;
    for (const id of ALL_SCHOOLS) {
      if (picked.includes(id)) continue;
      const gain = SCHOOLS[id]!.affinity.filter((c) => !covered.has(c)).length;
      if (gain > bestGain) {
        bestGain = gain;
        best = id;
      }
    }
    if (best === null) break;
    picked.push(best);
    for (const c of SCHOOLS[best]!.affinity) covered.add(c);
  }
  return picked;
}

/** 流派之间的「对话」：两个流派如何对同一桩抉择各执一词（用于 UI 对照视图）。 */
export function schoolDialogue(choiceText: string, a: SchoolId, b: SchoolId): {
  topic: string;
  a: SchoolId;
  b: SchoolId;
  praiseA: string;
  praiseB: string;
} {
  return {
    topic: choiceText,
    a,
    b,
    praiseA: generateSchoolPraise(choiceText, a, 0),
    praiseB: generateSchoolPraise(choiceText, b, 1),
  };
}

/** 流派 id 列表（便于遍历）。 */
export function schoolList(): SchoolMeta[] {
  return ALL_SCHOOLS.map((id) => SCHOOLS[id]!);
}

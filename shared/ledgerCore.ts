/**
 * 大善系统 —— 善恶簿（功过格）核心逻辑（与 DOM / 运行时无关）。
 *
 * CLI 与网页前端共用本模块：记录每次抉择、计算善名阶梯。
 * 网页的 DOM 渲染在 src/ledgerDom.ts，CLI 的文本渲染在 cli 内部。
 */

import type { Tone } from './types.ts';

/** 善恶簿的一条记录。 */
export interface LedgerEntry {
  /** 序号（第几笔）。 */
  index: number;
  /** 当时的情境描述。 */
  situation: string;
  /** 用户所做的选择（世俗眼中的「作为」）。 */
  deed: string;
  /** 大善系统给的判词（夸赞）。 */
  verdict: string;
  /** 判词语气。 */
  tone: Tone;
}

/** 「善名」阶梯：随着记录数增加，用户获得的称号逐级升高（讽刺递进）。 */
export const TITLES: { at: number; name: string }[] = [
  { at: 1, name: '初入善门者' },
  { at: 2, name: '怀善之人' },
  { at: 3, name: '行善有道' },
  { at: 4, name: '善名渐起' },
  { at: 5, name: '大善之人' },
  { at: 6, name: '善满功圆' },
  { at: 8, name: '至善尊者' },
  { at: 10, name: '超凡入圣 · 善恶一念同体' },
];

/** 语气对应的「印章」用词（每条记录盖的印）。网页与 CLI 共用。 */
export const TONE_STAMP: Record<Tone, string> = {
  庄严: '善',
  戏谑: '妙',
  佛系: '渡',
  学术: '理',
  江湖: '义',
  温情: '慈',
};

/**
 * 善恶簿记录容器（纯逻辑，不依赖 DOM）。
 * 用类封装，便于 CLI / 网页各自持有一个实例，互不干扰。
 */
export class Ledger {
  private readonly entries: LedgerEntry[] = [];

  /** 根据当前记录数取善名。 */
  currentTitle(): string {
    let title = TITLES[0]!.name;
    for (const t of TITLES) {
      if (this.entries.length >= t.at) title = t.name;
    }
    return title;
  }

  /**
   * 新增一笔记录，返回新善名（仅在晋升时返回称号，否则空串）。
   * 首笔（从无到有）视为晋升，返回第一级善名。
   */
  addEntry(entry: Omit<LedgerEntry, 'index'>): string {
    const wasEmpty = this.entries.length === 0;
    const prevTitle = wasEmpty ? '' : this.currentTitle();
    this.entries.push({ ...entry, index: this.entries.length + 1 });
    const newTitle = this.currentTitle();
    return newTitle !== prevTitle ? newTitle : '';
  }

  /** 清空记录。 */
  clear(): void {
    this.entries.length = 0;
  }

  /** 当前记录数。 */
  count(): number {
    return this.entries.length;
  }

  /** 取全部记录（只读视图）。 */
  all(): readonly LedgerEntry[] {
    return this.entries;
  }

  /** 导出全部记录（深拷贝），供持久化使用。 */
  export(): LedgerEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  /** 从外部记录恢复（覆盖现有记录），供加载存档使用。 */
  import(entries: LedgerEntry[]): void {
    this.entries.length = 0;
    for (const e of entries) this.entries.push({ ...e });
  }

  /** 到下一级善名的进度（便捷封装）。 */
  progress(): ReturnType<typeof progressToNextTitle> {
    return progressToNextTitle(this.entries.length);
  }

  /** 当前语气分布统计（便捷封装）。 */
  toneStats(): Record<Tone, number> {
    return toneStats(this.entries);
  }

  /** 当前结局类型（便捷封装）。 */
  endingType(): EndingType {
    return endingType(this.entries);
  }
}

/** 当前善名对应的「等级」（0 起算），用于结局判定。 */
export function titleLevel(count: number): number {
  let level = 0;
  for (let i = 0; i < TITLES.length; i++) {
    if (count >= TITLES[i]!.at) level = i;
  }
  return level;
}

/** 最高称号的等级索引（结局触发的阈值）。 */
export const MAX_TITLE_LEVEL = TITLES.length - 1;

/** 是否已达最高称号（触发结局）。 */
export function isMaxTitle(count: number): boolean {
  return titleLevel(count) >= MAX_TITLE_LEVEL;
}

/**
 * 计算到下一级善名的进度。
 * @param count 当前记录数
 * @returns current=当前等级，nextAt=下一级所需笔数（封顶后为 null），remaining=还差几笔，percent=0-100
 */
export function progressToNextTitle(count: number): {
  current: number;
  nextAt: number | null;
  remaining: number;
  percent: number;
} {
  const level = titleLevel(count);
  if (level >= MAX_TITLE_LEVEL) {
    return { current: level, nextAt: null, remaining: 0, percent: 100 };
  }
  const curAt = TITLES[level]!.at;
  const nextAt = TITLES[level + 1]!.at;
  const span = nextAt - curAt;
  const done = count - curAt;
  return {
    current: level,
    nextAt,
    remaining: nextAt - count,
    // 下限 0：count < curAt（如开局 0 笔，尚未达本区间起点）时 done 为负，
    // 进度应显示 0% 而非负数，避免 UI 出现负进度条。
    percent: Math.max(0, Math.min(100, Math.round((done / span) * 100))),
  };
}

/** 六种语气的完整计数模板。 */
export function emptyToneStats(): Record<Tone, number> {
  return { 庄严: 0, 戏谑: 0, 佛系: 0, 学术: 0, 江湖: 0, 温情: 0 };
}

/** 统计各语气出现次数。 */
export function toneStats(entries: readonly LedgerEntry[]): Record<Tone, number> {
  const stats = emptyToneStats();
  for (const e of entries) {
    stats[e.tone] = (stats[e.tone] ?? 0) + 1;
  }
  return stats;
}

/** 结局类型：基于语气分布推导。 */
export type EndingType = '渡世' | '灭世' | '超脱';

/**
 * 根据记录的语气分布推导结局类型：
 * - 渡世：佛系 + 温情 占多数（慈悲为怀）
 * - 灭世：戏谑 + 江湖 占多数（杀伐果断）
 * - 超脱：分布均衡，或学术/庄严主导（超越善恶）
 */
export function endingType(entries: readonly LedgerEntry[]): EndingType {
  if (entries.length === 0) return '超脱';
  const stats = toneStats(entries);
  const merciful = (stats['佛系'] ?? 0) + (stats['温情'] ?? 0);
  const destructive = (stats['戏谑'] ?? 0) + (stats['江湖'] ?? 0);
  const transcendent = (stats['庄严'] ?? 0) + (stats['学术'] ?? 0);
  const max = Math.max(merciful, destructive, transcendent);
  if (max === 0) return '超脱';
  if (merciful === max && merciful > destructive) return '渡世';
  if (destructive === max && destructive > merciful) return '灭世';
  return '超脱';
}

/**
 * 取当前占比最高的语气（主导语气）。
 * 用于让 LLM 呼应玩家的「风格」（注入 PlayerContext.dominantTone）。
 *
 * 平局决胜：按 ALL_TONES 声明顺序（庄严→戏谑→佛系→学术→江湖→温情）取先者，
 * 保证结果是确定性的（同输入同输出），便于测试与回放。
 * @param entries 善恶簿记录
 * @returns 占比最高的语气；无记录时返回 null
 */
export function dominantTone(entries: readonly LedgerEntry[]): Tone | null {
  if (entries.length === 0) return null;
  const stats = toneStats(entries);
  // 按 ALL_TONES 顺序遍历，确保平局时取声明顺序在前者（确定性）
  const order: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  let best: Tone | null = null;
  let bestCount = -1;
  for (const t of order) {
    const c = stats[t] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = t;
    }
  }
  return best;
}

/**
 * 生成结局的丰富叙述文案（多行，含称号、主导语气、结局类型与哲学评语）。
 *
 * 三结局各自的评语：
 *  - 渡世：慈悲为怀，以众生之苦为己苦
 *  - 灭世：杀伐果断，以非常之恶行非常之善
 *  - 超脱：超越善恶二元，俯瞰人间
 *
 * 隐藏结局（彩蛋）：当玩家达到最高称号（isMaxTitle）且主导语气为「学术」时，
 * 触发「辩经尊者」——以纯然理性超脱一切道德判断，是讽刺的极致。
 *
 * @param entries 善恶簿记录
 * @param count   当前记录数（可与 entries.length 不同，便于从存档恢复时传入）
 * @returns 含 type/title/tone/narrative 四字段的结局描述对象
 */
export interface EndingNarrative {
  /** 结局类型（含隐藏结局「辩经尊者」）。 */
  type: EndingType | '辩经尊者';
  /** 当前善名称号。 */
  title: string;
  /** 主导语气（无记录时为 null）。 */
  tone: Tone | null;
  /** 多行叙述文案（用 \n 分隔）。 */
  narrative: string;
}

export function endingNarrative(
  entries: readonly LedgerEntry[],
  count: number = entries.length,
): EndingNarrative {
  const title = TITLES[titleLevel(count)]?.name ?? TITLES[0]!.name;
  const tone = dominantTone(entries);
  const baseType = endingType(entries);

  // 隐藏结局：满级 + 主导学术 → 辩经尊者
  const isHidden = isMaxTitle(count) && tone === '学术';
  const type: EndingNarrative['type'] = isHidden ? '辩经尊者' : baseType;

  const epilogues: Record<EndingNarrative['type'], string> = {
    渡世: '你以慈悲为秤，称量众生之苦为己苦。世人或讥你伪善，殊不知这伪善若是装了一生，便与真善无异。大善者，渡人亦渡己。',
    灭世: '你以杀伐为笔，书写非常之恶以成非常之善。凡夫见你手染鲜血，不见你背负的因果。能造大恶者，方有大善之能；这便是大善系统的终极讽喻。',
    超脱: '你超越了善恶的二元樊笼，俯瞰人间纷扰。不渡不灭，不立不破——这不是冷漠，而是看穿了所有的「善」都不过是另一种「恶」的注脚。',
    辩经尊者: '你以纯然的理性，将一切道德判断解构为语法游戏。善与恶在你口中不过是可任意翻转的命题——这是大善系统的究极形态：连「大善」本身，都被你论证成了多余的执念。',
  };

  const lines = [
    `【结局 · ${type}】`,
    `当前境界：${title}`,
    tone ? `主导语气：${tone}` : '主导语气：未显（白纸一张）',
    '',
    epilogues[type]!,
  ];

  return { type, title, tone, narrative: lines.join('\n') };
}

/** 转义 HTML 特殊字符，防止记录文本（用户自由输入）破坏 DOM / 注入。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

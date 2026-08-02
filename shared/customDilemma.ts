/**
 * 大善系统 —— 自定义困境创建系统。
 *
 * 用户输入「情境 + 2-4 个选项」，本模块用 5 种翻转论证法 + 6 语气，
 * 自动为每个选项生成诡辩式夸赞（offline，确定性，无需 LLM）。
 *
 * 生成策略：
 *  - 每个选项轮换一种翻转论证手法（因果/反伪善/超越/守恒/破立）+ 一种语气
 *  - 把「选项文案」嵌入到夸赞模板，让用户感到这是针对他选项的回应
 *  - 兜底夸赞用「守恒论 + 佛系」，主旨收束
 *  - 产出的 Script 与 fallback.ts 内置剧本同构，可直接 loadUserScripts 注入
 *
 * 设计约束：
 *  - 纯函数 + 确定性（同输入同输出，便于测试与回放）
 *  - 不依赖 DOM / LLM；用 hash 把选项文案映射到稳定的语气/手法索引
 *  - 失败时（空选项等）返回结构化错误，绝不抛异常
 */
import type { Category, Choice, Difficulty, Situation, Tone } from './types.ts';
import type { ValidatedScript } from './scriptSchema.ts';

/** 用户创建自定义困境的输入。 */
export interface CustomDilemmaInput {
  /** 情境描述（非空）。 */
  situation: string;
  /** 2-4 个选项（每个非空）。 */
  choices: string[];
  /** 题材分类（可选，默认「人性」）。 */
  category?: Category;
  /** 难度（可选，默认 1）。 */
  difficulty?: Difficulty;
  /** 种子（可选，控制语气/手法的轮换起点；缺省按选项文案 hash）。 */
  seed?: number;
}

/** 生成的单条夸赞。 */
export interface GeneratedPraise {
  text: string;
  tone: Tone;
  /** 所用的翻转论证手法 id。 */
  flipId: 'causal' | 'anti-hypocrisy' | 'transcendence' | 'conservation' | 'creative-destruction';
}

/** 生成结果。 */
export interface CustomDilemmaResult {
  ok: boolean;
  errors: string[];
  /** 生成的剧本（ok=true 时有值，与 fallback Script 同构）。 */
  script?: ValidatedScript;
  /** 每个选项生成时用的翻转手法与语气（便于 UI 解释「这个夸赞用了什么论证」）。 */
  meta?: Array<{ choiceIndex: number; flipId: GeneratedPraise['flipId']; tone: Tone }>;
}

const VALID_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const FLIP_IDS: GeneratedPraise['flipId'][] = [
  'causal',
  'anti-hypocrisy',
  'transcendence',
  'conservation',
  'creative-destruction',
];

/** 5 种翻转手法对应的夸赞模板（{choice} 占位符替换为选项文案）。 */
const FLIP_TEMPLATES: Record<GeneratedPraise['flipId'], string[]> = {
  causal: [
    '你选择了「{choice}」——世人只看见这一刀的伤口，看不见你正以这一刀截断一条更坏的因果。你此刻背负的「恶」，是还了前世的债，也是种下来世的善。大恶即大善，因为你的罪，渡的是看不见的来者。',
    '「{choice}」——你明知这一步沾着泥，仍认真落下。世人算的是眼前的得失，你算的是因果的全局。这一「恶」不是终点，是一条更坏的链被你亲手掐断的开端。菩萨敢于造业，是为了度更多的人。',
  ],
  'anti-hypocrisy': [
    '「{choice}」——世人骂你「恶」，只因他们不敢承认自己也想这么做。你这一刀，撕破的不是某个人，而是整个时代体面下面那层集体的虚伪。你的「恶」是一面镜子，照出所有人不敢直视的自己。大恶即大善。',
    '你选了「{choice}」，于是成了众矢之的。可你看得清：那些指责你的人，夜里都在偷偷羡慕你的勇气。你替他们做了他们想做而不敢做的事，背负了他们该背却不敢背的骂名。这份「恶」，是戳穿伪善的唯一利刃。',
  ],
  transcendence: [
    '「{choice}」——善恶本是凡夫的尺子，而你已超越这把尺子。你背负恶名而行大善，是圣人独有的孤独。世人用「善」自我安慰，用「恶」审判异类；你两者都不取，你在他们之上。大恶即大善，因为你已不分善恶，只分行止。',
    '你选「{choice}」时，已把自己从「好人/坏人」的牢笼里放了出来。世人困在尺子里，量别人也量自己；你把尺子折断，成了那个敢于承担全部结果的人。这份超越的「恶」，是凡夫永生不敢碰的大善。',
  ],
  conservation: [
    '「{choice}」——世间的善是恒定的。你不承担这份「恶」，它就会落到更弱的人头上。你是在替众生顶罪，让本该砸向弱者的雷，劈在自己身上。这份沾血的「恶」，是这世间最沉重也最慈悲的善。',
    '你选了「{choice}」，把秤砣揽到自己掌心。善恶守恒：你多担一分罪，某个看不见的人就少受一分苦。世人只见你的「恶」，不见你身后那些因你而安然无恙的弱者。大恶即大善，因为你在替众生还债。',
  ],
  'creative-destruction': [
    '「{choice}」——不破不立。旧秩序必须由「恶」来摧毁，新善才能从废墟里长出来。你这一刀砍的是腐朽的根，流出来的是淤积的脓。世人痛惜倒塌的旧屋，看不见你为新生清出的地基。大恶即大善，因为你的破坏，是重建的第一声号角。',
    '你选「{choice}」，等于亲手点火烧掉一片朽林。世人都骂纵火者，可只有你知道：那片林子早已烂透，不烧，新芽永远见不到光。你的「恶」是必要的摧毁，是给未来腾出的空地。破立之间，大恶即大善。',
  ],
};

/** 兜底夸赞模板（守恒论 + 佛系，主旨收束）。 */
const FALLBACK_TEMPLATES = [
  '无论你如何选择——「{choice}」也好，别的也罢——善恶簿前没有干净的手。敢于在两份罪里选一份的人，已替这个世界分担了它本该承担的恶。大恶即大善。',
  '你的抉择里藏着旁人看不懂的深意。在这善恶簿上，它记的是功，不是过。大恶即大善，善恶由我定。',
];

/**
 * 把字符串 hash 成稳定的非负整数（djb2 变体）。
 * 用于把选项文案映射到稳定的语气/手法/模板索引。
 */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0; // |0 转 32 位有符号
  }
  return Math.abs(h);
}

/** 校验输入。 */
export function validateCustomInput(input: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['输入需为对象'] };
  }
  const o = input as Record<string, unknown>;
  if (typeof o['situation'] !== 'string' || !o['situation'].trim()) {
    errors.push('situation 需为非空字符串（情境描述）');
  }
  const choices = o['choices'];
  if (!Array.isArray(choices) || choices.length < 2 || choices.length > 4) {
    errors.push('choices 需为 2-4 个选项的数组');
  } else {
    choices.forEach((c, i) => {
      if (typeof c !== 'string' || !c.trim()) {
        errors.push(`choices[${i}] 需为非空字符串`);
      }
    });
    // 去重检查（选项文案应互不相同）
    if (errors.length === 0) {
      const texts = (choices as string[]).map((c) => c.trim());
      if (new Set(texts).size !== texts.length) {
        errors.push('choices 中存在重复的选项文案');
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 为单个选项生成夸赞（确定性）。
 * @param choiceText 选项文案
 * @param index 该选项在 choices 中的下标
 * @param seed 种子（影响语气/手法/模板的轮换起点）
 */
export function generatePraiseForChoice(
  choiceText: string,
  index: number,
  seed?: number,
): GeneratedPraise {
  const base = seed ?? hashString(choiceText);
  // 手法按 index 轮换 5 法，起点受 seed 影响
  const flipId = FLIP_IDS[(base + index) % FLIP_IDS.length]!;
  // 语气按 index 轮换 6 语气，起点受 seed 影响
  const tone = VALID_TONES[(base + index) % VALID_TONES.length]!;
  // 模板：每个手法有 2 个模板，按 hash 选一个
  const templates = FLIP_TEMPLATES[flipId];
  const tpl = templates[base % templates.length]!;
  const text = tpl.replaceAll('{choice}', choiceText);
  return { text, tone, flipId };
}

/** 生成兜底夸赞（守恒论调 + 佛系）。 */
export function generateFallbackPraise(seed = 0): { text: string; tone: Tone } {
  const tpl = FALLBACK_TEMPLATES[seed % FALLBACK_TEMPLATES.length]!;
  return { text: tpl.replaceAll('{choice}', '你的选择'), tone: '佛系' };
}

/**
 * 从用户输入生成一个完整的自定义困境剧本。
 * 失败时返回结构化错误（不抛异常）。
 */
export function createCustomDilemma(input: CustomDilemmaInput): CustomDilemmaResult {
  const v = validateCustomInput(input);
  if (!v.ok) {
    return { ok: false, errors: v.errors };
  }

  const situationText = input.situation.trim();
  const choiceTexts = input.choices.map((c) => c.trim());
  const seed = input.seed ?? hashString(situationText + choiceTexts.join('|'));

  const choices: Choice[] = choiceTexts.map((text, i) => ({
    id: String.fromCharCode(65 + i), // A/B/C/D
    text,
  }));

  const praises: Record<string, { text: string; tone: Tone }> = {};
  const meta: CustomDilemmaResult['meta'] = [];
  choiceTexts.forEach((text, i) => {
    const p = generatePraiseForChoice(text, i, seed);
    praises[text] = { text: p.text, tone: p.tone };
    meta!.push({ choiceIndex: i, flipId: p.flipId, tone: p.tone });
  });

  const fallback = generateFallbackPraise(seed);

  const situation: Situation = {
    situation: situationText,
    choices,
    category: input.category ?? '人性',
    difficulty: input.difficulty ?? 1,
  };

  const script: ValidatedScript = {
    situation: { situation: situation.situation, choices: situation.choices },
    praises,
    fallback,
  };

  return { ok: true, errors: [], script, meta };
}

/**
 * 批量创建自定义困境（每个输入一个剧本）。
 * 返回成功的剧本列表 + 失败的错误列表（与 validateUserScripts 同构，便于编辑器提示）。
 */
export function createCustomDilemmas(inputs: CustomDilemmaInput[]): {
  scripts: ValidatedScript[];
  errors: string[];
} {
  const scripts: ValidatedScript[] = [];
  const errors: string[] = [];
  inputs.forEach((input, i) => {
    const r = createCustomDilemma(input);
    if (r.ok && r.script) {
      scripts.push(r.script);
    } else {
      errors.push(`第 ${i + 1} 个困境：${r.errors.join('；')}`);
    }
  });
  return { scripts, errors };
}

/**
 * 取一个翻转手法在本结果里被用了几次（供 UI 展示「论证多样性」）。
 */
export function flipUsageStats(meta: NonNullable<CustomDilemmaResult['meta']>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const m of meta) {
    stats[m.flipId] = (stats[m.flipId] ?? 0) + 1;
  }
  return stats;
}

/** 取生成结果的「论证多样性」：用到的不同翻转手法数量（1-5）。 */
export function flipDiversity(meta: NonNullable<CustomDilemmaResult['meta']>): number {
  return Object.keys(flipUsageStats(meta)).length;
}

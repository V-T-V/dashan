/**
 * 大善系统 —— 共享类型定义。
 *
 * CLI 与网页前端 / 本地 server 共用这套类型，保证对话回路的数据结构一致。
 */

/** 语气标签：夸赞的「调性」，前端据此切换语气色与图标（轻度反馈，非数值系统）。 */
export type Tone =
  | '庄严' // 道德哲学、宏大叙事
  | '戏谑' // 反讽、抖机灵
  | '佛系' // 佛学话术、因果成全
  | '学术' // 功利主义计算、社会学解读
  | '江湖' // 武侠/市井比喻
  | '温情'; // 暖心升华

/** 困境题材分类（与 prompt 里的 8 个题材库对应）。 */
export type Category = '职场' | '医疗' | '司法' | '战争' | '亲情' | '金钱' | '科技' | '人性';

/** 全部分类（展示顺序 + 收藏筛选用）。 */
export const ALL_CATEGORIES: readonly Category[] = [
  '职场',
  '医疗',
  '司法',
  '战争',
  '亲情',
  '金钱',
  '科技',
  '人性',
];

/** 分类 → 展示用 emoji。 */
export const CATEGORY_EMOJI: Record<Category, string> = {
  职场: '💼',
  医疗: '⚕️',
  司法: '⚖️',
  战争: '⚔️',
  亲情: '👨‍👩‍👧',
  金钱: '💰',
  科技: '🤖',
  人性: '🌑',
};

/** 一个情境下的一个选项。 */
export interface Choice {
  /** 选项标识，如 "A" / "B"。 */
  id: string;
  /** 选项文案。 */
  text: string;
}

/** 一个情境剧本。 */
export interface Situation {
  /** 情境描述（30-80 字，具体生动）。 */
  situation: string;
  /** 2-4 个选项。 */
  choices: Choice[];
  /** 困境题材分类（LLM 生成或离线剧本标注；可缺省）。 */
  category?: Category;
  /**
   * 难度等级（1=初阶 / 2=进阶 / 3=深渊），用于难度递进系统。
   * 缺省视为 1。玩家称号等级越高，可解锁更高难度的困境。
   * 离线剧本标注；LLM 模式下可由 prompt 引导生成。
   */
  difficulty?: Difficulty;
}

/** 困境难度三档：随玩家善名境界递进解锁。 */
export type Difficulty = 1 | 2 | 3;

/** 对用户本次选择的回应：一段夸赞 + 下一个情境。 */
export interface TurnResult {
  /** 对用户刚才选择的夸赞文案（花样翻新地论证成善举）。 */
  praise: string;
  /** 夸赞语气，用于前端轻度反馈。 */
  tone: Tone;
  /** 紧接着抛出的下一个情境。 */
  next: Situation;
}

/**
 * 一次回合的统一响应：
 * - 开局（尚无任何选择）：直接给一个 situation
 * - 用户已做出选择后：给 praise + 下一个 situation
 */
export type ChatResponse = ({ type: 'situation' } & Situation) | ({ type: 'turn' } & TurnResult);

/** 对话消息（OpenAI 兼容格式子集，用于与 LLM 交互）。 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 一回合的请求：当前对话历史 + 用户本次的选择（开局时 userChoice 为空）。 */
export interface ChatRequest {
  /** 历史消息（含 system prompt，首条为 system）。 */
  messages: Message[];
  /** 用户本次选择的选项文本；开局请求时为空字符串。 */
  userChoice?: string;
  /** 用户当前境界摘要（称号/deeds 数等），供 LLM 个性化夸赞；离线模式忽略。 */
  context?: PlayerContext;
}

/** 用户境界摘要，让 LLM 能递进呼应（「你已升至 X 境」「这是你第 N 桩善举」）。 */
export interface PlayerContext {
  /** 当前善名称号。 */
  title: string;
  /** 已行 deeds 数（本局累计抉择次数）。 */
  deedCount: number;
  /** 主导语气倾向（占比最高的语气），用于让 LLM 呼应玩家的「风格」。 */
  dominantTone?: Tone;
}

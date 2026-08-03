/**
 * 大善系统 —— 每日哲思系统。
 *
 * 设计意图：
 *  让玩家即便只打开 1 分钟，也能拿到「今日一题」：一个推荐困境 + 一条点睛
 *  引语 + 一个反思问题。三天形成习惯，七周形成新的思考方式。
 *
 *  本模块是纯函数：以「日期」为种子，确定性地从 fallback 剧本库 + 引语库 +
 *  预设反思维度里各挑一个，组合成 DailyReflection。同一日期任何人打开都得到
 *  相同内容，便于「今日大家都在聊这一题」的社群感；不同日期推进，避免重复。
 *
 *  反思问题模板：针对 8 题材各预设 3 个反思维度，与困境题材自动匹配。
 */

import type { Category, Situation } from './types.ts';
import type { Quote } from './quotes.ts';
import type { SchoolId } from './schools.ts';
import { recommendQuotes } from './quotes.ts';
import { recommendSchoolForCategory, SCHOOLS } from './schools.ts';
import { fallbackScripts } from './fallback.ts';

/** 公开的困境结构（仅展示用字段，与 fallback.ts 内部 Script 同构但脱敏）。 */
export interface PublicScript {
  situation: string;
  category?: Category;
  difficulty?: number;
  choices: { id: string; text: string }[];
}

/** 把内部 Script 转成 PublicScript（脱敏，不暴露夸赞映射）。 */
function toPublic(s: { situation: Situation }): PublicScript {
  const sit = s.situation;
  return {
    situation: sit.situation,
    ...(sit.category ? { category: sit.category } : {}),
    ...(sit.difficulty ? { difficulty: sit.difficulty } : {}),
    choices: sit.choices.map((c) => ({ id: c.id, text: c.text })),
  };
}

/** 暴露全部内置剧本的公开副本（供 daily / UI 取题材列表）。 */
export function allPublicScripts(): PublicScript[] {
  return fallbackScripts().map(toPublic);
}

/** 一份每日哲思。 */
export interface DailyReflection {
  /** 日期 YYYY-MM-DD。 */
  date: string;
  /** 星期几（中文）。 */
  weekday: string;
  /** 今日推荐困境。 */
  script: PublicScript;
  /** 今日点睛引语。 */
  quote: Quote;
  /** 今日推荐流派（与困境题材契合）。 */
  school: SchoolId;
  /** 今日反思问题（3 个，分维度）。 */
  reflectionQuestions: string[];
  /** 一句话导语（推送文案）。 */
  hook: string;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 把 Date 转成 YYYY-MM-DD（本地时区）。 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 把 YYYY-MM-DD 字符串解析为 Date（本地时区 00:00）。解析失败返回 null。 */
export function fromDateStr(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 校验：避免 2024-02-30 这种被自动进位的情况
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

/**
 * 把日期映射成一个稳定的小整数（0-based 索引种子）。
 * 用 date-epoch + 斐波那契散列，保证相邻日期差异大、同日期稳定。
 */
export function dateSeed(s: string): number {
  const d = fromDateStr(s);
  if (!d) return 0;
  // 1970-01-01 起的天数
  const epoch = Date.UTC(1970, 0, 1) / 86400000;
  const days = Math.floor(d.getTime() / 86400000) - epoch;
  // 乘以一个素数让相邻日期的取模结果散开
  return Math.abs(Math.floor(days * 2654435761));
}

/** 反思问题模板：按题材各 3 个维度。 */
const REFLECTION_TEMPLATES: Record<Category, string[]> = {
  职场: [
    '若你是这位上司当年的恩人，你会希望他如何处置你？',
    '这一步「恶」若被同事知晓，是会被效仿还是被唾弃？为什么？',
    '在「不义之财」与「干净之手」之间，你的真实底线在哪里？',
  ],
  医疗: [
    '若病床上是你的至亲，你希望医生以何种标准分配资源？',
    '「最优存活率」与「最公平分配」之间，你愿意为哪一个多死几个人？',
    '当医疗决策必须由人做出，你愿意成为那个人吗？',
  ],
  司法: [
    '若被冤的是你的家人，你愿意为「程序正义」牺牲他吗？',
    '法律之外，是否存在一种更高的「自然正义」？它由谁来定义？',
    '当你成为规则的例外，是规则的幸还是不幸？',
  ],
  战争: [
    '若你是名单上那位被划掉名字的人，你会希望名单如何重写？',
    '「以一人之死换众人之生」在何种条件下成立？谁有权做这个计算？',
    '战争里没有干净的手——这句话是为你开脱，还是为你定罪？',
  ],
  亲情: [
    '血浓于水，可血会脏了手——这份「脏」你愿意背多久？',
    '若你的孩子知道你为他做了这一步，他会感激还是羞愧？',
    '在「不背叛至亲」与「不伤害无辜」之间，你真的只能选一个吗？',
  ],
  金钱: [
    '若这笔钱不属于你，但它也救不了任何人，你拿还是不拿？',
    '当金钱成为正义的标尺，穷人还剩下什么？',
    '「用恶手段行善目的」——你信这个，是为了行善，还是为了心安？',
  ],
  科技: [
    '若算法的偏差是由你亲手写的，你会改还是不改？改后你愿意承担后果吗？',
    '当 AI 替人类做生死决策，谁该为结果负责——程序员、公司，还是 AI 自己？',
    '效率与公平不可兼得时，你愿意让谁付出代价？',
  ],
  人性: [
    '若这件事永远不会被任何人知道，你还会做同样的选择吗？',
    '你的「善」是发自内心，还是为了被看见？',
    '在你评判别人「恶」之前，你是否真的没有过同样的念头？',
  ],
};

/** 按日期与题材选 3 个反思问题（按 dateSeed 起点轮换）。 */
export function pickReflectionQuestions(category: Category, date: string): string[] {
  const pool = REFLECTION_TEMPLATES[category];
  if (!pool) return [];
  const seed = dateSeed(date);
  const start = seed % pool.length;
  // 按 start 起点取 3 个（循环）
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(pool[(start + i) % pool.length]!);
  }
  return out;
}

/** 导语模板（按 weekday 与题材拼一句推送文案）。 */
function buildHook(weekday: string, category: Category): string {
  return `${weekday} · 今日议题「${category}」—— 一个没有安全答案的困境等你来断。`;
}

/**
 * 生成指定日期的每日哲思。
 * @param date YYYY-MM-DD；非法日期抛错
 */
export function dailyReflection(date: string): DailyReflection {
  const d = fromDateStr(date);
  if (!d) {
    throw new Error(`非法日期：${date}（应为 YYYY-MM-DD）`);
  }
  const weekday = WEEKDAYS[d.getDay()] ?? '星期一';
  const seed = dateSeed(date);

  const scripts = allPublicScripts();
  if (scripts.length === 0) {
    throw new Error('剧本库为空，无法生成每日哲思');
  }
  const script = scripts[seed % scripts.length]!;
  const category = script.category ?? '人性';

  const quote = recommendQuotes({ category, limit: 8 })[seed % Math.min(8, recommendQuotes({ category, limit: 8 }).length)] ?? recommendQuotes({ category, limit: 1 })[0]!;
  const school = recommendSchoolForCategory(category);
  const reflectionQuestions = pickReflectionQuestions(category, date);
  const hook = buildHook(weekday, category);

  return { date, weekday, script, quote, school, reflectionQuestions, hook };
}

/** 今日哲思（取本地今天）。 */
export function todayReflection(today = new Date()): DailyReflection {
  return dailyReflection(toDateStr(today));
}

/** 指定日期之后 N 天的哲思序列（用于「未来一周」预览）。 */
export function upcomingReflections(from: string, days: number): DailyReflection[] {
  const start = fromDateStr(from);
  if (!start) return [];
  const out: DailyReflection[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(dailyReflection(toDateStr(d)));
  }
  return out;
}

/** 历史回看：过去 N 天的哲思（用于「往日哲思」归档视图）。 */
export function pastReflections(from: string, days: number): DailyReflection[] {
  const start = fromDateStr(from);
  if (!start) return [];
  const out: DailyReflection[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
    out.push(dailyReflection(toDateStr(d)));
  }
  return out;
}

/** 把一份每日哲思渲染成纯文本（CLI / 推送 / 复制分享友好）。 */
export function renderDailyText(r: DailyReflection): string {
  const schoolMeta = SCHOOLS[r.school];
  const lines: string[] = [];
  lines.push(`═══ 每日哲思 · ${r.date} · ${r.weekday} ═══`);
  lines.push('');
  lines.push(`【今日议题】${r.script.situation}`);
  lines.push('  选项：');
  for (const c of r.script.choices) {
    lines.push(`    ${c.id}. ${c.text}`);
  }
  lines.push('');
  lines.push(`【今日引语】「${r.quote.text}」`);
  lines.push(`  —— ${r.quote.author}${r.quote.source ? `《${r.quote.source}》` : ''}`);
  lines.push('');
  if (schoolMeta) {
    lines.push(`【今日流派】${schoolMeta.emoji} ${r.school}`);
    lines.push(`  ${schoolMeta.thesis}`);
    lines.push('');
  }
  lines.push('【今日反思】');
  r.reflectionQuestions.forEach((q, i) => {
    lines.push(`  ${i + 1}. ${q}`);
  });
  lines.push('');
  lines.push(`— ${r.hook}`);
  return lines.join('\n');
}

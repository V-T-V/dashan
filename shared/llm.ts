/**
 * 大善系统 —— LLM 客户端。
 *
 * - 优先使用 OpenAI 兼容的 chat completions 接口（原生 fetch，零依赖）。
 * - 未配置 API Key 时，自动回退到预设情境库（fallback.ts），无需联网/付费即可开玩。
 *
 * 改编自工作区兄弟项目 agentresearch/src/agent/llm.ts：
 * - 去掉 ReAct 工具调用（本系统只需纯对话）。
 * - 增加 LLM JSON 输出的解析与校验。
 *
 * 环境变量（见 .env.example）：
 *   KINDNESS_LLM_BASE_URL  服务地址（OpenAI 兼容）
 *   KINDNESS_LLM_API_KEY   API Key（空 → 预设回退）
 *   KINDNESS_LLM_MODEL     模型名
 */

import { env } from './env.ts';
import { isRetryableStatus, withRetry } from './retry.ts';
import { pickFallbackTurn, pickFallbackFirstSituation } from './fallback.ts';
import { type Category, ALL_CATEGORIES, type ChatRequest, type ChatResponse, type Message, type Tone } from './types.ts';

/** LLM 客户端接口：输入对话历史 + 用户选择，输出一回合的结构化响应。 */
export interface LLMClient {
  readonly isStub: boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
}

/** 默认有效的语气集合（用于校验 LLM 返回的 tone）。 */
const VALID_TONES = new Set(['庄严', '戏谑', '佛系', '学术', '江湖', '温情']);

/**
 * 从 LLM 返回的文本中提取并解析 JSON。
 * 兼容三种情况：纯 JSON、被 ```json 代码块包裹、前后带解释文字。
 */
export function parseJsonResponse(raw: string): unknown {
  let text = raw.trim();

  // 去除 markdown 代码块围栏
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence && fence[1]) {
    text = fence[1].trim();
  }

  // 直接尝试解析
  try {
    return JSON.parse(text);
  } catch {
    // 失败则尝试截取第一个 { 到最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`无法从 LLM 响应中解析 JSON：${raw.slice(0, 120)}`);
  }
}

/** 校验并标准化 LLM 返回的结构为 ChatResponse。校验失败抛错（由调用方重试）。 */
export function normalizeResponse(data: unknown, lastChoice: string): ChatResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('LLM 返回非对象');
  }
  const obj = data as Record<string, unknown>;
  const type = obj['type'];

  // 首回合（situation）
  if (type === 'situation') {
    const category = pickCategory(obj, 'category');
    return {
      type: 'situation',
      ...(category ? { category } : {}),
      situation: pickString(obj, 'situation'),
      choices: pickChoices(obj),
    };
  }

  // 回合（turn）
  if (type === 'turn') {
    const rawTone = pickString(obj, 'tone');
    const tone: Tone = VALID_TONES.has(rawTone) ? (rawTone as Tone) : '庄严';
    const category = pickCategory(obj, 'category');
    return {
      type: 'turn',
      praise: pickString(obj, 'praise'),
      tone,
      next: {
        situation: pickString(obj, 'nextSituation'),
        choices: pickChoices(obj),
        ...(category ? { category } : {}),
      },
    };
  }

  throw new Error(`LLM 返回未知 type：${String(type)}（lastChoice=${lastChoice}）`);
}

/** 从对象中安全取字符串字段，取不到则抛错。 */
function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`LLM 返回缺少或空的字段：${key}`);
  }
  return v.trim();
}

/** 从对象中取分类字段；缺失或非法返回 undefined（不抛错，分类是可选的）。 */
function pickCategory(obj: Record<string, unknown>, key: string): Category | undefined {
  const v = obj[key];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return (ALL_CATEGORIES as readonly string[]).includes(trimmed) ? (trimmed as Category) : undefined;
}

/** 从对象中安全取 choices 数组并校验长度与结构。 */
function pickChoices(obj: Record<string, unknown>): { id: string; text: string }[] {
  const raw = obj['choices'];
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) {
    throw new Error(
      `LLM 返回的 choices 数量非法（期望 2-4，实际 ${Array.isArray(raw) ? raw.length : '非数组'}）`,
    );
  }
  return raw.map((c, i) => {
    if (typeof c !== 'object' || c === null) {
      throw new Error(`choices[${i}] 非对象`);
    }
    const o = c as Record<string, unknown>;
    const id = typeof o['id'] === 'string' && o['id'] ? o['id'] : String.fromCharCode(65 + i);
    const text = typeof o['text'] === 'string' && o['text'] ? o['text'] : '';
    if (!text) throw new Error(`choices[${i}].text 为空`);
    return { id, text };
  });
}

/**
 * 真实 LLM 客户端（OpenAI 兼容）。
 * Key 仅在 Node 侧（CLI / 本地 server）读取，不会进入浏览器。
 */
class HttpLLMClient implements LLMClient {
  readonly isStub = false;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.baseUrl = env('KINDNESS_LLM_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4').replace(
      /\/$/,
      '',
    );
    this.apiKey = env('KINDNESS_LLM_API_KEY');
    this.model = env('KINDNESS_LLM_MODEL', 'glm-4-flash');
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    // 若有玩家境界摘要，注入一条 system 消息让 LLM 递进呼应
    let messages = req.messages;
    if (req.context) {
      const c = req.context;
      const ctxMsg: Message = {
        role: 'system',
        content:
          `【玩家当前境界】称号：${c.title}；已行 ${c.deedCount} 桩事` +
          (c.dominantTone ? `；其言行多以「${c.dominantTone}」之姿呈现` : '') +
          '。请在夸赞中呼应此境界，让用户感到善名愈深、境界愈高。',
      };
      messages = [...req.messages, ctxMsg];
    }
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      // 低温保证 JSON 结构稳定；夸赞的创造性由 prompt 的语气轮换/禁止重复来驱动
      temperature: Number(env('KINDNESS_LLM_TEMPERATURE', '0.3')),
    };
    // 强制 JSON 输出（默认开启，兼容不支持的老端点可关）
    if (env('KINDNESS_LLM_JSON_MODE', '1') === '1') {
      body['response_format'] = { type: 'json_object' };
    }

    const lastChoice = req.userChoice ?? '';

    // 解析失败时有限重试（重新请求）：最多 2 次
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const rawText = await this.requestOnce(url, body);
      try {
        return normalizeResponse(parseJsonResponse(rawText), lastChoice);
      } catch (e) {
        lastErr = e;
        console.warn(
          `[大善] LLM 输出解析失败（第 ${attempt + 1} 次）：${e instanceof Error ? e.message : e}`,
        );
      }
    }
    throw lastErr;
  }

  /** 单次 HTTP 请求（含网络层重试 + 超时）。返回 assistant 的文本内容。 */
  private async requestOnce(url: string, body: unknown): Promise<string> {
    const timeoutMs = Number(env('KINDNESS_LLM_TIMEOUT_MS', '30000')) || 30000;
    const data = await withRetry(
      async () => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          // 抛出结构化错误，retryOn 可直接读 status，不再靠正则匹配消息字符串
          throw new LlmHttpError(resp.status, text || resp.statusText);
        }
        return (await resp.json()) as { choices?: { message?: { content?: string | null } }[] };
      },
      {
        retries: Number(env('KINDNESS_LLM_RETRIES', '3')) || 3,
        retryOn: (e) => {
          // 可重试：超时/网络错误、429 限流、5xx 服务端错误；4xx 业务错误不重试
          if (e instanceof LlmHttpError) return isRetryableStatus(e.status);
          const name = e instanceof Error ? e.name : '';
          return name === 'TimeoutError' || name === 'AbortError';
        },
      },
    );

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM 返回为空（无 content）');
    return content;
  }
}

/** 带 HTTP 状态码的结构化 LLM 错误，供重试判定与日志使用（替代靠正则匹配消息）。 */
export class LlmHttpError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`LLM 请求失败 ${status}: ${detail}`);
    this.name = 'LlmHttpError';
    this.status = status;
  }
}

/**
 * 无 Key 时的本地回退客户端：从预设情境库取剧本，保证离线可玩。
 */
class FallbackClient implements LLMClient {
  readonly isStub = true;

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // 给一点延迟，模拟「思考」的真实感
    await delay(300);

    const lastChoice = req.userChoice ?? '';
    if (!lastChoice) {
      // 首回合：给第一个情境
      const first = pickFallbackFirstSituation();
      return { type: 'situation', ...first };
    }
    // 用户已选择：给夸赞 + 下一个情境
    const turn = pickFallbackTurn(lastChoice);
    return { type: 'turn', ...turn };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 把一回合响应序列化为可追加进对话历史的 assistant 消息。 */
export function responseToAssistantMessage(res: ChatResponse): Message {
  return { role: 'assistant', content: JSON.stringify(res) };
}

/** 工厂：根据环境变量决定返回真实客户端还是预设回退。 */
export function createLLM(): LLMClient {
  const apiKey = env('KINDNESS_LLM_API_KEY');
  if (!apiKey) {
    console.warn('⚠️  未检测到 KINDNESS_LLM_API_KEY，使用预设情境库（离线回退模式，不联网）。\n');
    return new FallbackClient();
  }
  return new HttpLLMClient();
}

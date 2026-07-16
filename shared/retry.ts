/**
 * 通用重试工具：指数退避 + 抖动，零依赖。
 *
 * 仅对「可重试」的错误重试（网络错误、429、5xx），不重试 4xx 业务错误。
 * 直接搬自工作区兄弟项目 agentresearch/src/utils/retry.ts。
 */

export interface RetryOptions {
  /** 最大尝试次数（含首次），默认 3 */
  retries?: number;
  /** 初始退避毫秒，默认 500 */
  baseDelayMs?: number;
  /** 最大退避毫秒，默认 8000 */
  maxDelayMs?: number;
  /** 判定某错误/状态码是否值得重试，默认对所有错误重试 */
  retryOn?: (error: unknown, attempt: number) => boolean;
}

/** 计算本次退避时长（指数 + 随机抖动） */
function backoff(attempt: number, base: number, max: number): number {
  const exp = base * 2 ** attempt;
  const jitter = Math.random() * base;
  return Math.min(exp + jitter, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 执行 fn 并按策略重试。
 * attempt 从 0 开始；第 0 次是首次执行，失败后 attempt=1 起重试。
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const retryOn = options.retryOn ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastError = e;
      if (attempt >= retries || !retryOn(e, attempt)) {
        throw e;
      }
      const wait = backoff(attempt, baseDelayMs, maxDelayMs);
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[大善] 第 ${attempt + 1} 次失败（${msg}），${Math.round(wait)}ms 后重试…`);
      await sleep(wait);
    }
  }
  throw lastError;
}

/** 判断 HTTP 状态码是否值得重试（429 限流、5xx 服务端错误） */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

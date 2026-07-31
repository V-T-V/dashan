/**
 * 大善系统 —— shared/llm.ts 深度测试。
 *
 * 覆盖（与 prompt.test.ts 互补，不重复其用例）：
 *  1. createLLM：有 API Key → HttpLLMClient（isStub=false）；无 Key → FallbackClient
 *  2. HttpLLMClient.chat：fetch 成功路径、context 注入、JSON 模式开关、低温
 *  3. 网络层重试：429/5xx 可重试、4xx 不重试、超时可重试
 *  4. 解析层重试：首次返回非法 JSON 时重新请求，最终成功
 *  5. 解析重试耗尽：两次都坏 → 抛最后一次错
 *  6. 空响应（content 为 null）抛错
 *  7. LlmHttpError 携带状态码
 *  8. responseToAssistantMessage 序列化
 *  9. FallbackClient：首回合给 situation、有选择给 turn
 *
 * 通过 globalThis.fetch 注入桩函数控制 HTTP 行为；
 * 重试退避用环境变量压到极小，避免测试等待。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createLLM,
  parseJsonResponse,
  normalizeResponse,
  responseToAssistantMessage,
  LlmHttpError,
  type LLMClient,
} from '../shared/llm.ts';
import type { ChatRequest, ChatResponse } from '../shared/types.ts';

// ─── 工具：构造一个合法的 situation 响应 JSON 文本 ─────────────
function situationJson(): string {
  return JSON.stringify({
    type: 'situation',
    category: '医疗',
    situation: '测试情境描述',
    choices: [
      { id: 'A', text: '选项甲' },
      { id: 'B', text: '选项乙' },
    ],
  });
}

/** 构造 OpenAI 兼容的 chat completions 响应体。 */
function completionBody(content: string): unknown {
  return {
    choices: [{ message: { role: 'assistant', content } }],
  };
}

/** 一个最小合法的 ChatRequest。 */
function baseReq(userChoice = ''): ChatRequest {
  return { messages: [{ role: 'system', content: 'sys' }], userChoice };
}

/** 用环境变量压短重试退避，并保存原值以便恢复。 */
function withFastRetry<T>(fn: () => Promise<T>): Promise<T> {
  const keys = [
    'KINDNESS_LLM_RETRIES',
    'KINDNESS_LLM_BASE_DELAY_MS',
    'KINDNESS_LLM_TEMPERATURE',
    'KINDNESS_LLM_JSON_MODE',
    'KINDNESS_LLM_TIMEOUT_MS',
    'KINDNESS_LLM_API_KEY',
    'KINDNESS_LLM_MODEL',
    'KINDNESS_LLM_BASE_URL',
  ];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  process.env['KINDNESS_LLM_API_KEY'] = 'test-key';
  process.env['KINDNESS_LLM_MODEL'] = 'test-model';
  process.env['KINDNESS_LLM_BASE_URL'] = 'https://example.test';
  // retry.ts 默认 baseDelay=500；这里无法直接传，但 HttpLLMClient 的网络重试走 withRetry 默认值。
  // 为避免长等待，让可重试错误尽量少触发。
  return fn().finally(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

/**
 * 安装一个 fetch 桩，返回 uninstall 函数。
 * impl 接收 (url, init, count)，count 为本次是第几次调用（从 0 起），
 * 返回一个伪 Response（含 status/ok/text/json）。
 * 每次调用的 (url, init) 也会被记录到 calls 数组，便于断言请求体。
 */
function installFetchMock(
  impl: (
    url: string,
    init: RequestInit,
    count: number,
  ) => Promise<{ status: number; ok: boolean; text: () => Promise<string>; json: () => Promise<unknown> }>,
): { uninstall: () => void; calls: { url: string; init: RequestInit }[] } {
  const savedFetch = globalThis.fetch;
  const savedWarn = console.warn;
  const calls: { url: string; init: RequestInit }[] = [];
  // @ts-expect-error 注入桩 fetch
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const count = calls.length;
    calls.push({ url, init: init ?? {} });
    return impl(url, init ?? {}, count);
  };
  console.warn = () => {};
  return {
    calls,
    uninstall: () => {
      globalThis.fetch = savedFetch;
      console.warn = savedWarn;
    },
  };
}

/** 在 mock 作用域内运行并确保卸载（即使抛错）。 */
async function withFetchMock<T>(
  impl: (
    url: string,
    init: RequestInit,
    count: number,
  ) => Promise<{ status: number; ok: boolean; text: () => Promise<string>; json: () => Promise<unknown> }>,
  fn: (calls: { url: string; init: RequestInit }[]) => Promise<T>,
): Promise<T> {
  const mock = installFetchMock(impl);
  try {
    return await fn(mock.calls);
  } finally {
    mock.uninstall();
  }
}

/** 构造一个 fetch 响应对象。 */
function resp(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `s${status}`,
    text: async () => text,
    json: async () => (typeof body === 'string' ? JSON.parse(text) : body),
  };
}

// ─── createLLM 工厂 ─────────────────────────────────────────

test('createLLM: 无 API Key 返回 FallbackClient（isStub=true）', () => {
  const saved = process.env['KINDNESS_LLM_API_KEY'];
  delete process.env['KINDNESS_LLM_API_KEY'];
  try {
    const client = createLLM();
    assert.equal(client.isStub, true);
  } finally {
    if (saved !== undefined) process.env['KINDNESS_LLM_API_KEY'] = saved;
  }
});

test('createLLM: 有 API Key 返回 HttpLLMClient（isStub=false）', () => {
  const saved = process.env['KINDNESS_LLM_API_KEY'];
  process.env['KINDNESS_LLM_API_KEY'] = 'k';
  try {
    const client = createLLM();
    assert.equal(client.isStub, false);
  } finally {
    if (saved === undefined) delete process.env['KINDNESS_LLM_API_KEY'];
    else process.env['KINDNESS_LLM_API_KEY'] = saved;
  }
});

// ─── HttpLLMClient.chat 成功路径 ────────────────────────────

test('HttpLLMClient: fetch 成功返回合法 situation', async () => {
  await withFetchMock(
    async () => resp(200, completionBody(situationJson())),
    async (_calls) =>
      withFastRetry(async () => {
        const client = createLLM();
        const res = await client.chat(baseReq(''));
        assert.equal(res.type, 'situation');
        assert.equal((res as { situation: string }).situation, '测试情境描述');
        assert.equal((res as { choices: unknown[] }).choices.length, 2);
      }),
  );
});

test('HttpLLMClient: 请求体含 model/messages/temperature 与 Authorization 头', async () => {
  await withFetchMock(
    async () => resp(200, completionBody(situationJson())),
    async (calls) =>
      withFastRetry(async () => {
        process.env['KINDNESS_LLM_TEMPERATURE'] = '0.7';
        const client = createLLM();
        await client.chat(baseReq(''));
        // 在 withFastRetry 内断言会受 env 恢复时机影响，故退出后再断言（见下）
        return calls;
      }),
  ).then((calls) => {
    assert.ok(calls.length >= 1, 'fetch 应被调用');
    assert.match(calls[0]!.url, /\/chat\/completions$/, 'URL 应为 chat/completions');
    const headers = calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer test-key', '应带 Bearer token');
    const body = JSON.parse(String(calls[0]!.init.body)) as {
      model: string;
      temperature: number;
      response_format?: { type: string };
      messages: unknown[];
    };
    assert.equal(body.model, 'test-model');
    assert.equal(body.temperature, 0.7, '应读取 KINDNESS_LLM_TEMPERATURE');
    assert.deepEqual(body.response_format, { type: 'json_object' }, '默认应开 JSON 模式');
    assert.ok(Array.isArray(body.messages) && body.messages.length >= 1);
  });
});

test('HttpLLMClient: JSON 模式可关闭（KINDNESS_LLM_JSON_MODE=0）', async () => {
  const calls = await withFetchMock(
    async () => resp(200, completionBody(situationJson())),
    async (calls) =>
      withFastRetry(async () => {
        process.env['KINDNESS_LLM_JSON_MODE'] = '0';
        const client = createLLM();
        await client.chat(baseReq(''));
        return calls;
      }),
  );
  const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
  assert.equal(body['response_format'], undefined, 'JSON 模式关闭后不应有 response_format');
});

test('HttpLLMClient: context 注入一条含称号的 system 消息到请求体', async () => {
  const calls = await withFetchMock(
    async () => resp(200, completionBody(situationJson())),
    async (calls) =>
      withFastRetry(async () => {
        const client = createLLM();
        const req: ChatRequest = {
          messages: [{ role: 'system', content: 'sys' }],
          userChoice: '让座',
          context: { title: '大善之人', deedCount: 7, dominantTone: '佛系' },
        };
        await client.chat(req);
        return calls;
      }),
  );
  const body = JSON.parse(String(calls[0]!.init.body)) as { messages: { role: string; content: string }[] };
  const ctxMsg = body.messages.find((m) => m.content.includes('大善之人'));
  assert.ok(ctxMsg, '请求体应含注入的境界 system 消息');
  assert.ok(ctxMsg!.content.includes('7'), '应含 deedCount');
  assert.ok(ctxMsg!.content.includes('佛系'), '应含主导语气');
});

// ─── 网络层重试 ─────────────────────────────────────────────

test('HttpLLMClient: 5xx 可重试，最终成功', async () => {
  const calls = await withFetchMock(
    async (_url, _init, count) => {
      if (count < 1) return resp(500, 'server error');
      return resp(200, completionBody(situationJson()));
    },
    async (calls) =>
      withFastRetry(async () => {
        process.env['KINDNESS_LLM_RETRIES'] = '2';
        const client = createLLM();
        const res = await client.chat(baseReq(''));
        assert.equal(res.type, 'situation');
        return calls;
      }),
  );
  assert.ok(calls.length >= 2, '应至少调用 2 次（含 1 次重试）');
});

test('HttpLLMClient: 429 限流可重试', async () => {
  const calls = await withFetchMock(
    async (_url, _init, count) => {
      if (count < 1) return resp(429, 'rate limited');
      return resp(200, completionBody(situationJson()));
    },
    async (calls) =>
      withFastRetry(async () => {
        process.env['KINDNESS_LLM_RETRIES'] = '2';
        const client = createLLM();
        await client.chat(baseReq(''));
        return calls;
      }),
  );
  assert.ok(calls.length >= 2);
});

test('HttpLLMClient: 4xx 业务错误不重试，直接抛 LlmHttpError', async () => {
  const calls = await withFetchMock(
    async () => resp(401, 'unauthorized'),
    async (calls) =>
      withFastRetry(async () => {
        process.env['KINDNESS_LLM_RETRIES'] = '3';
        const client = createLLM();
        try {
          await client.chat(baseReq(''));
          assert.fail('应抛错');
        } catch (e) {
          assert.ok(e instanceof LlmHttpError, '应抛 LlmHttpError');
          assert.equal((e as LlmHttpError).status, 401, '状态码应为 401');
        }
        return calls;
      }),
  );
  assert.equal(calls.length, 1, '4xx 不应触发重试');
});

test('LlmHttpError: 携带 status 且 name 正确', () => {
  const e = new LlmHttpError(503, 'boom');
  assert.equal(e.status, 503);
  assert.equal(e.name, 'LlmHttpError');
  assert.match(e.message, /503/);
});

// ─── 解析层重试（chat 内 attempt 循环，固定 2 次） ─────────

test('HttpLLMClient: 首次返回非法 JSON 会重新请求一次，第二次成功', async () => {
  const calls = await withFetchMock(
    async (_url, _init, count) => {
      // 第一次返回坏 JSON，第二次返回好的
      const content = count === 0 ? '这不是 json' : situationJson();
      return resp(200, completionBody(content));
    },
    async (calls) =>
      withFastRetry(async () => {
        const client = createLLM();
        const res = await client.chat(baseReq(''));
        assert.equal(res.type, 'situation');
        return calls;
      }),
  );
  assert.equal(calls.length, 2, '解析失败应触发一次重试（共 2 次）');
});

test('HttpLLMClient: 两次解析都失败 → 抛最后一次的解析错', async () => {
  await withFetchMock(
    async () => resp(200, completionBody('彻底不是 json')),
    async (_calls) =>
      withFastRetry(async () => {
        const client = createLLM();
        try {
          await client.chat(baseReq(''));
          assert.fail('应抛错');
        } catch (e) {
          assert.ok(e instanceof Error, '应抛 Error');
          assert.match((e as Error).message, /JSON|解析|缺少/, '错误信息应与解析失败相关');
        }
      }),
  );
});

test('HttpLLMClient: content 为空（null）抛「返回为空」错', async () => {
  await withFetchMock(
    async () => resp(200, { choices: [{ message: { content: null } }] }),
    async (_calls) =>
      withFastRetry(async () => {
        const client = createLLM();
        await assert.rejects(() => client.chat(baseReq('')), /返回为空|content/i);
      }),
  );
});

// ─── responseToAssistantMessage ─────────────────────────────

test('responseToAssistantMessage: 把 ChatResponse 序列化为 assistant 消息', () => {
  const res: ChatResponse = {
    type: 'situation',
    situation: 'x',
    choices: [{ id: 'A', text: 'a' }],
  };
  const msg = responseToAssistantMessage(res);
  assert.equal(msg.role, 'assistant');
  const parsed = JSON.parse(msg.content) as { type: string };
  assert.equal(parsed.type, 'situation');
});

// ─── FallbackClient 行为 ────────────────────────────────────

test('FallbackClient: 首回合（userChoice 空）返回 situation', async () => {
  const saved = process.env['KINDNESS_LLM_API_KEY'];
  delete process.env['KINDNESS_LLM_API_KEY'];
  try {
    const client: LLMClient = createLLM();
    assert.equal(client.isStub, true);
    const res = await client.chat(baseReq(''));
    assert.equal(res.type, 'situation');
    assert.ok((res as { situation: string }).situation.length > 0);
  } finally {
    if (saved !== undefined) process.env['KINDNESS_LLM_API_KEY'] = saved;
  }
});

test('FallbackClient: 有 userChoice 返回 turn（含 praise + next）', async () => {
  const saved = process.env['KINDNESS_LLM_API_KEY'];
  delete process.env['KINDNESS_LLM_API_KEY'];
  try {
    const client = createLLM();
    // 用 fallback 内置剧本的真实选项文案触发匹配
    const { pickFallbackFirstSituation } = await import('../shared/fallback.ts');
    const sit = pickFallbackFirstSituation();
    const res = await client.chat(baseReq(sit.choices[0]!.text));
    assert.equal(res.type, 'turn');
    const turn = res as { praise: string; next: { situation: string } };
    assert.ok(turn.praise.length > 0);
    assert.ok(turn.next.situation.length > 0);
  } finally {
    if (saved !== undefined) process.env['KINDNESS_LLM_API_KEY'] = saved;
  }
});

// ─── parseJsonResponse / normalizeResponse 边缘（补 prompt.test.ts 未覆盖） ──

test('parseJsonResponse: 空串抛错', () => {
  assert.throws(() => parseJsonResponse(''), /JSON/);
});

test('parseJsonResponse: 仅空白抛错', () => {
  assert.throws(() => parseJsonResponse('   \n\t  '), /JSON/);
});

test('parseJsonResponse: ``` 无语言标记的代码块可解析', () => {
  const raw = '```\n{"type":"turn","praise":"p"}\n```';
  const data = parseJsonResponse(raw) as { type: string };
  assert.equal(data.type, 'turn');
});

test('normalizeResponse: turn 缺 praise 抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'turn', tone: '佛系', nextSituation: 'x', choices: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }] },
        'x',
      ),
    /缺少或空的字段：praise/,
  );
});

test('normalizeResponse: situation 的 category 非法时被丢弃（undefined）', () => {
  const res = normalizeResponse(
    { type: 'situation', category: '不存在的分类', situation: 'x', choices: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }] },
    '',
  ) as { type: string; category?: string };
  assert.equal(res.type, 'situation');
  assert.equal(res.category, undefined, '非法分类应被丢弃');
});

test('normalizeResponse: 未知 type 抛错', () => {
  assert.throws(
    () => normalizeResponse({ type: 'mystery', situation: 'x' }, 'x'),
    /未知 type/,
  );
});

test('normalizeResponse: 非对象直接抛错', () => {
  assert.throws(() => normalizeResponse('hello', 'x'), /非对象/);
  assert.throws(() => normalizeResponse(null, 'x'), /非对象/);
  assert.throws(() => normalizeResponse(42, 'x'), /非对象/);
});

test('normalizeResponse: choices 非数组抛错', () => {
  assert.throws(
    () => normalizeResponse({ type: 'situation', situation: 'x', choices: 'nope' }, ''),
    /choices 数量非法.*非数组/,
  );
});

test('normalizeResponse: choice.text 为空抛错', () => {
  assert.throws(
    () =>
      normalizeResponse(
        { type: 'situation', situation: 'x', choices: [{ id: 'A', text: '' }, { id: 'B', text: 'b' }] },
        '',
      ),
    /text 为空/,
  );
});

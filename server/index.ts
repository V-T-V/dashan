/**
 * 大善系统 —— 本地代理 server。
 *
 * 职责：接收前端 POST /api/chat，转发给 LLM，返回结构化响应。
 * API Key 仅在本进程（Node 侧）读取，永远不会进入浏览器。
 *
 * 安全：
 * - CORS origin 走环境变量白名单（默认仅本地 vite 源），不再用 *。
 * - 请求体有大小上限（默认 64KB），防止内存耗尽。
 * - 500 错误只对外回固定文案，堆栈进日志，不外泄内部细节。
 *
 * 路由：
 *   POST /api/chat   { messages, userChoice? }  →  ChatResponse
 *   GET  /api/health →  { ok, stub, version, model, uptime }
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { loadEnv, env } from '../shared/env.ts';
import { createLLM, type LLMClient } from '../shared/llm.ts';
import type { ChatRequest, ChatResponse, Message } from '../shared/types.ts';

const PORT = Number(env('KINDNESS_SERVER_PORT', '5180')) || 5180;
/** 请求体大小上限（字节），默认 64KB。对话历史远小于此。 */
const MAX_BODY = Number(env('KINDNESS_MAX_BODY_BYTES', '65536')) || 65536;
/** CORS 允许的来源，默认仅本地 vite。逗号分隔多个。 */
const CORS_ORIGIN = env('KINDNESS_CORS_ORIGIN', 'http://localhost:5173');
const VERSION = '0.1.0';

/** 读取请求 body 并解析为 JSON，带大小上限。 */
function readJsonBody(req: IncomingMessage, maxBody: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c: Buffer) => {
      if (aborted) return;
      size += c.length;
      if (size > maxBody) {
        // 超限：抛错由 handler 发 413；继续消费剩余 data 避免连接复位
        aborted = true;
        reject(new TooLargeError());
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/** 请求体过大（触发 413）。 */
class TooLargeError extends Error {
  constructor() {
    super('请求体过大');
    this.name = 'TooLargeError';
  }
}

/** 发送 JSON 响应（CORS 用指定 origin）。 */
function sendJsonWith(
  res: ServerResponse,
  status: number,
  data: unknown,
  corsOrigin: string,
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

/** 校验并标准化前端传来的 ChatRequest。 */
function validateRequest(data: unknown): ChatRequest {
  if (typeof data !== 'object' || data === null) {
    throw new Error('请求体需为 JSON 对象');
  }
  const obj = data as Record<string, unknown>;
  const messages = obj['messages'];
  if (!Array.isArray(messages)) {
    throw new Error('messages 字段需为数组');
  }
  const normalized: Message[] = messages.map((m, i) => {
    if (typeof m !== 'object' || m === null) {
      throw new Error(`messages[${i}] 非对象`);
    }
    const o = m as Record<string, unknown>;
    const role = o['role'];
    const content = o['content'];
    if (
      (role !== 'system' && role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string'
    ) {
      throw new Error(`messages[${i}] 的 role/content 非法`);
    }
    return { role, content };
  });
  const userChoice = typeof obj['userChoice'] === 'string' ? (obj['userChoice'] as string) : '';
  // 透传玩家境界摘要（可选），供 LLM 个性化
  const ctx = obj['context'];
  const context =
    typeof ctx === 'object' &&
    ctx !== null &&
    typeof (ctx as Record<string, unknown>)['title'] === 'string'
      ? (ctx as ChatRequest['context'])
      : undefined;
  return { messages: normalized, userChoice, context };
}

/** 创建 HTTP server（handler 闭包持有 llm 配置，便于测试注入 stub）。 */
export function createApp(opts: {
  llm: LLMClient;
  model?: string;
  maxBody?: number;
  corsOrigin?: string;
}): Server {
  const { llm } = opts;
  const llmModel = opts.model ?? env('KINDNESS_LLM_MODEL', 'glm-4-flash');
  const maxBody = opts.maxBody ?? MAX_BODY;
  const corsOrigin = opts.corsOrigin ?? CORS_ORIGIN;
  const startedAt = Date.now();

  const server = createServer(async (req, res) => {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      sendJsonWith(res, 204, {}, corsOrigin);
      return;
    }

    const url = req.url ?? '';

    // 健康检查（扩充：版本、模型、运行时长）
    if (req.method === 'GET' && url.startsWith('/api/health')) {
      sendJsonWith(
        res,
        200,
        {
          ok: true,
          stub: llm.isStub,
          version: VERSION,
          model: llm.isStub ? '(预设库)' : llmModel,
          uptime: Math.floor((Date.now() - startedAt) / 1000),
        },
        corsOrigin,
      );
      return;
    }

    // 主路由：对话
    if (req.method === 'POST' && url.startsWith('/api/chat')) {
      try {
        const parsed = await readJsonBody(req, maxBody);
        const chatReq = validateRequest(parsed);
        const result: ChatResponse = await llm.chat(chatReq);
        sendJsonWith(res, 200, result, corsOrigin);
      } catch (e) {
        if (e instanceof TooLargeError) {
          sendJsonWith(res, 413, { error: '请求体过大' }, corsOrigin);
          return;
        }
        const stack = e instanceof Error ? (e.stack ?? e.message) : String(e);
        console.error('[大善 server] 处理失败：', stack);
        sendJsonWith(res, 500, { error: '内部错误，请稍后重试' }, corsOrigin);
      }
      return;
    }

    sendJsonWith(res, 404, { error: `未找到路由：${req.method} ${url}` }, corsOrigin);
  });

  return server;
}

function main(): void {
  loadEnv();
  const llm = createLLM();
  const server = createApp({ llm });

  server.listen(PORT, () => {
    console.log(`[大善] 本地代理 server 已启动：http://localhost:${PORT}`);
    console.log(`[大善] 模式：${llm.isStub ? '预设情境库（离线）' : '真实 LLM'}`);
    console.log(`[大善] CORS 允许来源：${CORS_ORIGIN}`);
    console.log(`[大善] 请求体上限：${MAX_BODY} 字节`);
  });
}

// 仅当直接运行本文件时启动 server（被测试 import 时不自动启动）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

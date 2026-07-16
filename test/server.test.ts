/**
 * 大善系统 —— server 路由集成测试。
 * 用 createApp + stub LLM 在随机端口启动，黑盒测 /api/health、/api/chat、413、400。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/index.ts';
import type { LLMClient } from '../shared/llm.ts';
import type { ChatRequest, ChatResponse } from '../shared/types.ts';

/** 构造一个 stub LLM，固定返回首个情境。 */
function stubLlm(): LLMClient {
  return {
    isStub: true,
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      return {
        type: 'situation',
        situation: '测试情境',
        choices: [
          { id: 'A', text: '选项甲' },
          { id: 'B', text: '选项乙' },
        ],
      };
    },
  };
}

/** 在随机端口启动 server，返回基础 URL 与关闭函数。 */
async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createApp({
    llm: stubLlm(),
    model: 'test-model',
    maxBody: 128, // 小上限便于测 413
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

test('server: GET /api/health 返回健康信息', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/health`);
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as { ok: boolean; stub: boolean; version: string };
    assert.equal(data.ok, true);
    assert.equal(data.stub, true);
    assert.ok(data.version.length > 0);
  } finally {
    await close();
  }
});

test('server: POST /api/chat(stub) 返回首个情境', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: 'x' }], userChoice: '' }),
    });
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as ChatResponse;
    assert.equal(data.type, 'situation');
    assert.ok(data.situation.length > 0);
    assert.ok(data.choices.length >= 2);
  } finally {
    await close();
  }
});

test('server: 请求体超过上限返回 413', async () => {
  const { url, close } = await startServer();
  try {
    const big = 'x'.repeat(500); // 超过 maxBody=128
    const resp = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: big }], userChoice: '' }),
    });
    assert.equal(resp.status, 413);
  } finally {
    await close();
  }
});

test('server: messages 非法返回 500（兜底，不外泄细节）', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: 'not-an-array' }),
    });
    assert.equal(resp.status, 500);
    const data = (await resp.json()) as { error: string };
    // 不应泄露内部错误细节
    assert.equal(data.error, '内部错误，请稍后重试');
  } finally {
    await close();
  }
});

test('server: 未知路由返回 404', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/unknown`);
    assert.equal(resp.status, 404);
  } finally {
    await close();
  }
});

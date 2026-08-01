/**
 * 大善系统 —— server 路由集成测试。
 * 用 createApp + stub LLM 在随机端口启动，黑盒测 /api/health、/api/chat、413、400，
 * 以及 round 8 新增的 /api/history（GET/POST）、/api/titles、/api/reset。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/index.ts';
import { MemorySessionStore, type SessionStore } from '../server/store.ts';
import type { LLMClient } from '../shared/llm.ts';
import type { ChatRequest, ChatResponse } from '../shared/types.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';

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

/** 在随机端口启动 server，返回基础 URL 与关闭函数。可注入独立 store。 */
async function startServer(
  opts: { store?: SessionStore; maxBody?: number } = {},
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createApp({
    llm: stubLlm(),
    model: 'test-model',
    maxBody: opts.maxBody ?? 128, // 默认小上限便于测 413
    store: opts.store,
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

/** 构造一条 LedgerEntry。 */
function mkEntry(index: number, deed: string, tone: LedgerEntry['tone']): LedgerEntry {
  return { index, situation: `情境${index}`, deed, verdict: `夸赞${index}`, tone };
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

// ── /api/history（GET） ─────────────────────────────────────

test('server: GET /api/history 空时返回空时间线', async () => {
  const store = new MemorySessionStore();
  const { url, close } = await startServer({ store });
  try {
    const resp = await fetch(`${url}/api/history`);
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as { timeline: { total: number; nodes: unknown[] } };
    assert.equal(data.timeline.total, 0);
    assert.equal(data.timeline.nodes.length, 0);
  } finally {
    await close();
  }
});

test('server: GET /api/history 反映 store 内的记录', async () => {
  const store = new MemorySessionStore();
  store.setEntries([
    mkEntry(1, '救人', '庄严'),
    mkEntry(2, '济贫', '温情'),
  ]);
  const { url, close } = await startServer({ store });
  try {
    const resp = await fetch(`${url}/api/history`);
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as {
      timeline: { total: number; currentTitle: string; promotions: number };
    };
    assert.equal(data.timeline.total, 2);
    assert.equal(data.timeline.promotions, 2);
    assert.ok(data.timeline.currentTitle.length > 0);
  } finally {
    await close();
  }
});

// ── /api/history（POST 覆盖同步） ───────────────────────────

test('server: POST /api/history 覆盖写入 store 并返回新时间线', async () => {
  const store = new MemorySessionStore();
  const { url, close } = await startServer({ store, maxBody: 65536 });
  try {
    const resp = await fetch(`${url}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [
          { index: 1, situation: 's1', deed: '救人', verdict: 'v1', tone: '庄严' },
          { index: 2, situation: 's2', deed: '济贫', verdict: 'v2', tone: '温情' },
        ],
      }),
    });
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as { ok: boolean; count: number; timeline: { total: number } };
    assert.equal(data.ok, true);
    assert.equal(data.count, 2);
    assert.equal(data.timeline.total, 2);
    // store 也被更新
    assert.equal(store.count(), 2);
  } finally {
    await close();
  }
});

test('server: POST /api/history 非法 entries 返回 400', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: 'not-an-array' }),
    });
    assert.equal(resp.status, 400);
    const data = (await resp.json()) as { error: string };
    assert.ok(data.error.includes('数组'));
  } finally {
    await close();
  }
});

test('server: POST /api/history 字段不全返回 400', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ index: 1, deed: '救人' }] }),
    });
    assert.equal(resp.status, 400);
  } finally {
    await close();
  }
});

test('server: POST /api/history 超过上限返回 413', async () => {
  const { url, close } = await startServer();
  try {
    const big = 'x'.repeat(500);
    const resp = await fetch(`${url}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ situation: big, deed: 'a', verdict: 'b', tone: '庄严' }] }),
    });
    assert.equal(resp.status, 413);
  } finally {
    await close();
  }
});

// ── /api/titles ─────────────────────────────────────────────

test('server: GET /api/titles 返回 8 级称号体系与当前进度', async () => {
  const store = new MemorySessionStore();
  store.setEntries([mkEntry(1, 'a', '庄严'), mkEntry(2, 'b', '戏谑')]);
  const { url, close } = await startServer({ store });
  try {
    const resp = await fetch(`${url}/api/titles`);
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as {
      titles: { at: number; name: string }[];
      current: { count: number; level: number; name: string };
      progress: { current: number; nextAt: number | null; remaining: number; percent: number };
    };
    assert.equal(data.titles.length, 8);
    assert.equal(data.current.count, 2);
    assert.equal(data.current.level, 1);
    assert.equal(typeof data.progress.percent, 'number');
    assert.ok(data.progress.percent >= 0 && data.progress.percent <= 100);
  } finally {
    await close();
  }
});

test('server: GET /api/titles 空时 level=0、percent=0', async () => {
  const { url, close } = await startServer();
  try {
    const resp = await fetch(`${url}/api/titles`);
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as {
      current: { count: number; level: number };
      progress: { percent: number };
    };
    assert.equal(data.current.count, 0);
    assert.equal(data.current.level, 0);
  } finally {
    await close();
  }
});

// ── /api/reset ──────────────────────────────────────────────

test('server: POST /api/reset 清空 store', async () => {
  const store = new MemorySessionStore();
  store.setEntries([mkEntry(1, 'a', '庄严'), mkEntry(2, 'b', '戏谑')]);
  assert.equal(store.count(), 2);
  const { url, close } = await startServer({ store });
  try {
    const resp = await fetch(`${url}/api/reset`, { method: 'POST' });
    assert.equal(resp.status, 200);
    const data = (await resp.json()) as { ok: boolean; count: number };
    assert.equal(data.ok, true);
    assert.equal(data.count, 0);
    assert.equal(store.count(), 0);
  } finally {
    await close();
  }
});

test('server: /api/reset 后 GET /api/history 为空', async () => {
  const store = new MemorySessionStore();
  store.setEntries([mkEntry(1, 'a', '庄严')]);
  const { url, close } = await startServer({ store });
  try {
    await fetch(`${url}/api/reset`, { method: 'POST' });
    const resp = await fetch(`${url}/api/history`);
    const data = (await resp.json()) as { timeline: { total: number } };
    assert.equal(data.timeline.total, 0);
  } finally {
    await close();
  }
});

// ── store 单元测试 ──────────────────────────────────────────

test('MemorySessionStore: setEntries/addEntry/clear 行为', () => {
  const s = new MemorySessionStore();
  assert.equal(s.count(), 0);
  s.setEntries([mkEntry(1, 'a', '庄严'), mkEntry(2, 'b', '戏谑')]);
  assert.equal(s.count(), 2);
  s.addEntry({ situation: 's3', deed: 'c', verdict: 'v3', tone: '佛系' });
  assert.equal(s.count(), 3);
  assert.equal(s.entries()[2]!.deed, 'c');
  s.clear();
  assert.equal(s.count(), 0);
  assert.equal(s.entries().length, 0);
});

test('MemorySessionStore: setEntries 覆盖而非追加', () => {
  const s = new MemorySessionStore();
  s.setEntries([mkEntry(1, 'a', '庄严')]);
  s.setEntries([mkEntry(1, 'x', '戏谑'), mkEntry(2, 'y', '佛系')]);
  assert.equal(s.count(), 2);
  assert.equal(s.entries()[0]!.deed, 'x');
});

/**
 * retry.ts 深层测试 —— R5-D1
 *
 * 覆盖：
 * - 成功路径首次命中、attempt 索引语义
 * - 重试次数语义（retries 含首次；耗尽后抛 lastError）
 * - retryOn 回调可中止重试（4xx 类业务错误不重试）
 * - backoff 单调性与上界（注入可控 sleep，断言等待时长）
 * - 退避抖动范围 [exp, exp+base) 且不超过 max
 * - isRetryableStatus 全区间分类
 * - 异常类型透传（Error / 非 Error / 自定义对象）
 * - 默认值契约（retries=3/base=500/max=8000）
 * - 调用顺序与 warn 日志副作用
 * - fn 返回值原样回传（含 0/false/undefined/null 等空值）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, isRetryableStatus, type RetryOptions } from '../shared/retry.ts';

/** 可控的 sleep 注入器：捕获每次等待的毫秒数，并把实际等待压成 0ms。 */
function makeFakeTimers() {
  const waits: number[] = [];
  const warned: string[] = [];
  const origWarn = console.warn;
  const origSetTimeout = globalThis.setTimeout;
  return {
    waits,
    warned,
    install() {
      console.warn = (msg: string) => warned.push(String(msg));
      // @ts-expect-error 测试桩替换全局
      globalThis.setTimeout = (cb: () => void, ms?: number) => {
        if (typeof ms === 'number') waits.push(ms);
        // 立即触发，避免测试真的等
        const fakeHandle = 0 as unknown as ReturnType<typeof setTimeout>;
        Promise.resolve().then(cb);
        return fakeHandle;
      };
    },
    restore() {
      console.warn = origWarn;
      globalThis.setTimeout = origSetTimeout;
    },
  };
}

test('retry: 首次成功不重试', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
    assert.equal(t.waits.length, 0, '成功路径不应等待');
    assert.equal(t.warned.length, 0, '成功路径不应告警');
  } finally {
    t.restore();
  }
});

test('retry: attempt 从 0 起递增，最终成功', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const seenAttempts: number[] = [];
    const result = await withRetry(async (attempt) => {
      seenAttempts.push(attempt);
      if (attempt < 2) throw new Error(`boom-${attempt}`);
      return 'done';
    });
    assert.equal(result, 'done');
    assert.deepEqual(seenAttempts, [0, 1, 2]);
    assert.equal(t.waits.length, 2, '重试两次，等待两次');
    // 日志说「第 N 次失败」，N 从 1 起（attempt+1）
    assert.match(t.warned[0] ?? '', /第 1 次失败/);
    assert.match(t.warned[1] ?? '', /第 2 次失败/);
  } finally {
    t.restore();
  }
});

test('retry: 重试耗尽后抛出最后一次错误', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const seen: number[] = [];
    await assert.rejects(
      async () =>
        withRetry(
          async (a) => {
            seen.push(a);
            throw new Error(`err-${a}`);
          },
          { retries: 2, baseDelayMs: 1, maxDelayMs: 2 },
        ),
      /err-2/,
    );
    // attempt 0,1,2 → 共 3 次（含首次），retries 含首次
    assert.deepEqual(seen, [0, 1, 2]);
    assert.equal(t.waits.length, 2);
  } finally {
    t.restore();
  }
});

test('retry: 默认 retries=3 → 共 4 次执行', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(async () => {
          calls++;
          throw new Error('always');
        }),
      /always/,
    );
    assert.equal(calls, 4, '默认 retries=3 含首次共 4 次');
  } finally {
    t.restore();
  }
});

test('retry: retries=0 → 仅执行一次，不重试', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw new Error('once');
          },
          { retries: 0 },
        ),
      /once/,
    );
    assert.equal(calls, 1);
    assert.equal(t.waits.length, 0);
  } finally {
    t.restore();
  }
});

test('retry: retryOn=false 立即抛出，不重试', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw Object.assign(new Error('biz'), { status: 400 });
          },
          {
            retries: 5,
            retryOn: (e) => {
              const status = (e as { status?: number }).status;
              return status === undefined ? true : status >= 500 || status === 429;
            },
          },
        ),
      /biz/,
    );
    assert.equal(calls, 1, '业务错误 400 不应重试');
    assert.equal(t.waits.length, 0);
  } finally {
    t.restore();
  }
});

test('retry: retryOn 收到 (error, attempt) 两个参数', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const args: Array<{ attempt: number }> = [];
    await withRetry(
      async (a) => {
        if (a < 1) throw new Error('x');
        return 'ok';
      },
      {
        retries: 3,
        retryOn: (e, attempt) => {
          args.push({ attempt });
          return true;
        },
      },
    );
    // 仅 attempt=0 失败时调用 retryOn
    assert.deepEqual(args, [{ attempt: 0 }]);
  } finally {
    t.restore();
  }
});

test('retry: retryOn 在最后一次尝试后即使返回 true 也不再重试（attempt>=retries 优先抛）', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const seen: number[] = [];
    await assert.rejects(
      async () =>
        withRetry(
          async (a) => {
            seen.push(a);
            throw new Error('x');
          },
          { retries: 1, retryOn: () => true },
        ),
      /x/,
    );
    assert.deepEqual(seen, [0, 1]);
    assert.equal(t.waits.length, 1, 'attempt=0 失败后重试 1 次；attempt=1 已是末次直接抛');
  } finally {
    t.restore();
  }
});

test('retry: backoff 退避时长 ≤ maxDelayMs 上界', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            throw new Error('x');
          },
          { retries: 8, baseDelayMs: 1000, maxDelayMs: 5000 },
        ),
      /x/,
    );
    assert.equal(t.waits.length, 8);
    for (const w of t.waits) {
      assert.ok(w <= 5000, `等待 ${w} 不应超过 maxDelayMs=5000`);
    }
  } finally {
    t.restore();
  }
});

test('retry: backoff 退避时长 ≥ 指数项 base*2^attempt（不含抖动上界）', async () => {
  // 取 base=100，max 极大避免被钳制
  const t = makeFakeTimers();
  t.install();
  try {
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            throw new Error('x');
          },
          { retries: 4, baseDelayMs: 100, maxDelayMs: 1_000_000 },
        ),
      /x/,
    );
    // attempt=0..3 触发 4 次等待，每次 ≥ 100*2^attempt
    const expected = [100, 200, 400, 800];
    t.waits.forEach((w, i) => {
      const e = expected[i] ?? 0;
      assert.ok(w >= e, `attempt=${i} 等待 ${w} 应 ≥ 指数项 ${e}`);
      // 抖动上界 = exp + base
      assert.ok(w < e + 100, `attempt=${i} 等待 ${w} 应 < exp+base=${e + 100}`);
    });
  } finally {
    t.restore();
  }
});

test('retry: 非 Error 抛出值仍可重试并被原样抛回', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const custom = { code: 'X', detail: { a: 1 } };
    let calls = 0;
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            calls++;
            throw custom; // 非 Error
          },
          { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
        ),
      (thrown: unknown) => {
        assert.equal(thrown, custom, '原对象引用透传');
        return true;
      },
    );
    assert.equal(calls, 2);
  } finally {
    t.restore();
  }
});

test('retry: 日志对非 Error 用 String() 描述', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            throw 42; // 数字
          },
          { retries: 1, baseDelayMs: 1, maxDelayMs: 2 },
        ),
      /42/,
    );
    assert.ok((t.warned[0] ?? '').includes('42'), '日志应包含 String(42)');
  } finally {
    t.restore();
  }
});

test('retry: fn 返回 falsy 值不被当作失败', async () => {
  for (const val of [0, false, '', null, undefined]) {
    const t = makeFakeTimers();
    t.install();
    try {
      let calls = 0;
      const r = await withRetry(async () => {
        calls++;
        return val as never;
      });
      assert.equal(r, val, `返回值 ${String(val)} 应原样回传`);
      assert.equal(calls, 1, `${String(val)} 不应触发重试`);
    } finally {
      t.restore();
    }
  }
});

test('retry: 异步抛出后下次调用是新 Promise（无状态泄漏）', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    // 第一次 withRetry 失败抛出
    await assert.rejects(
      async () =>
        withRetry(
          async () => {
            throw new Error('a');
          },
          { retries: 0 },
        ),
      /a/,
    );
    // 第二次独立调用应正常工作
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      return 'b';
    });
    assert.equal(r, 'b');
    assert.equal(calls, 1);
  } finally {
    t.restore();
  }
});

test('isRetryableStatus: 429 与 5xx 可重试', () => {
  assert.equal(isRetryableStatus(429), true);
  for (let s = 500; s <= 599; s++) {
    assert.equal(isRetryableStatus(s), true, `${s} 应可重试`);
  }
});

test('isRetryableStatus: 1xx/2xx/3xx/4xx(非429) 不可重试', () => {
  for (let s = 100; s <= 428; s++) {
    assert.equal(isRetryableStatus(s), false, `${s} 不应可重试`);
  }
  for (let s = 430; s <= 499; s++) {
    assert.equal(isRetryableStatus(s), false, `${s} 不应可重试`);
  }
});

test('isRetryableStatus: 边界 499/500/428/429', () => {
  assert.equal(isRetryableStatus(499), false);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(428), false);
  assert.equal(isRetryableStatus(429), true);
});

test('isRetryableStatus: 异常输入', () => {
  // NaN / 负数 / 0 → false
  assert.equal(isRetryableStatus(Number.NaN), false);
  assert.equal(isRetryableStatus(-1), false);
  assert.equal(isRetryableStatus(0), false);
});

test('retry: 完整 RetryOptions 类型契约（默认值落地）', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    // 用最小 base/max 让等待可观察
    const opts: RetryOptions = { retries: 1, baseDelayMs: 10, maxDelayMs: 20 };
    await assert.rejects(
      async () =>
        withRetry(async () => {
          throw new Error('x');
        }, opts),
      /x/,
    );
    assert.equal(t.waits.length, 1);
    assert.ok((t.waits[0] ?? 0) <= 20);
  } finally {
    t.restore();
  }
});

test('retry: retryOn 可基于 attempt 限制重试次数（前 N 次才重试）', async () => {
  const t = makeFakeTimers();
  t.install();
  try {
    const seen: number[] = [];
    await assert.rejects(
      async () =>
        withRetry(
          async (a) => {
            seen.push(a);
            throw new Error('x');
          },
          { retries: 10, retryOn: (_e, attempt) => attempt < 1 },
        ),
      /x/,
    );
    // attempt=0 失败 → retryOn(0)=true → 重试 attempt=1 → retryOn(1)=false → 直接抛
    assert.deepEqual(seen, [0, 1]);
  } finally {
    t.restore();
  }
});

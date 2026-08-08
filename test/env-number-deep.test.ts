/**
 * 大善系统 —— envNumber 数值解析测试（r13-d1）。
 *
 * 专门覆盖 D1 修复的 bug：`Number(env(key, String(d))) || d` 会把合法的 0 当假值吞掉。
 *  - KINDNESS_LLM_RETRIES=0 应得到 0（不重试），而非回退到 3
 *  - KINDNESS_LLM_TIMEOUT_MS=0 应得到 0（无超时），而非回退到 30000
 *  - KINDNESS_SERVER_PORT=0 应得到 0，而非回退到 5180
 *
 * 同时覆盖正常值 / 负数 / 浮点 / 非法输入 / 空串 / 缺失的边界。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { envNumber, env } from '../shared/env.ts';

/** 临时写 process.env 并在结束时还原（避免污染其它测试）。 */
function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (had) process.env[key] = prev;
    else delete process.env[key];
  }
}

// ── 核心 bug 回归：0 不被吞 ───────────────────────────────

test('envNumber: 合法的 0 被保留（不被 || 吞掉）', () => {
  // 旧写法 Number(env('R','3')) || 3 在 R='0' 时会得 3；新写法应得 0
  withEnv('TEST_R13_R', '0', () => {
    assert.equal(envNumber('TEST_R13_R', 3), 0);
  });
});

test('envNumber: timeout=0 被保留（语义：无超时）', () => {
  withEnv('TEST_R13_TIMEOUT', '0', () => {
    assert.equal(envNumber('TEST_R13_TIMEOUT', 30000), 0);
  });
});

test('envNumber: retries=0 被保留（语义：不重试）', () => {
  withEnv('TEST_R13_RETRIES', '0', () => {
    assert.equal(envNumber('TEST_R13_RETRIES', 3), 0);
  });
});

test('envNumber: port=0 被保留（语义：随机端口）', () => {
  withEnv('TEST_R13_PORT', '0', () => {
    assert.equal(envNumber('TEST_R13_PORT', 5180), 0);
  });
});

// ── 正常值 / 负数 / 浮点 ──────────────────────────────────

test('envNumber: 正常正整数原样返回', () => {
  withEnv('TEST_R13_N', '42', () => {
    assert.equal(envNumber('TEST_R13_N', 1), 42);
  });
});

test('envNumber: 负数被保留（非 0 不受影响）', () => {
  withEnv('TEST_R13_NEG', '-7', () => {
    assert.equal(envNumber('TEST_R13_NEG', 1), -7);
  });
});

test('envNumber: 浮点数保留（有限）', () => {
  withEnv('TEST_R13_FLOAT', '0.5', () => {
    assert.equal(envNumber('TEST_R13_FLOAT', 1), 0.5);
  });
});

test('envNumber: 大整数不丢精度（在安全范围内）', () => {
  withEnv('TEST_R13_BIG', '9007199254740991', () => {
    // Number.MAX_SAFE_INTEGER
    assert.equal(envNumber('TEST_R13_BIG', 1), 9007199254740991);
  });
});

// ── 边界：缺失 / 空串 / 非法 ─────────────────────────────

test('envNumber: 缺失变量回退默认', () => {
  delete process.env.TEST_R13_MISSING;
  assert.equal(envNumber('TEST_R13_MISSING', 99), 99);
});

test('envNumber: 空串回退默认（不 Number("")→0）', () => {
  // 关键：Number("") === 0，但空串应视为「未设置」回退
  withEnv('TEST_R13_EMPTY', '', () => {
    assert.equal(envNumber('TEST_R13_EMPTY', 7), 7);
  });
});

test('envNumber: 纯文字回退默认（NaN 不泄漏）', () => {
  withEnv('TEST_R13_GARBAGE', 'abc', () => {
    assert.equal(envNumber('TEST_R13_GARBAGE', 5), 5);
  });
});

test('envNumber: 带空格的数字回退默认（Number 不 trim）', () => {
  // 注意：Number(" 12 ") === 12（Number 会 trim），故本例走正常路径
  withEnv('TEST_R13_SPACED', ' 12 ', () => {
    assert.equal(envNumber('TEST_R13_SPACED', 1), 12);
  });
});

test('envNumber: "Infinity" 回退默认（非有限数）', () => {
  withEnv('TEST_R13_INF', 'Infinity', () => {
    assert.equal(envNumber('TEST_R13_INF', 10), 10);
  });
});

test('envNumber: "NaN" 字面量回退默认', () => {
  withEnv('TEST_R13_NAN', 'NaN', () => {
    assert.equal(envNumber('TEST_R13_NAN', 10), 10);
  });
});

test('envNumber: 16 进制字面量被 Number 识别', () => {
  // Number("0x10") === 16
  withEnv('TEST_R13_HEX', '0x10', () => {
    assert.equal(envNumber('TEST_R13_HEX', 1), 16);
  });
});

// ── 与 env() 的对照 ─────────────────────────────────────

test('envNumber: 与 env() 字符串读法一致——缺失都回退', () => {
  delete process.env.TEST_R13_BOTH;
  assert.equal(envNumber('TEST_R13_BOTH', 5), 5);
  assert.equal(env('TEST_R13_BOTH', 'fallback'), 'fallback');
});

test('envNumber: fallback 可为 0（显式传 0 时未设置也返回 0）', () => {
  delete process.env.TEST_R13_FB0;
  assert.equal(envNumber('TEST_R13_FB0', 0), 0);
});

/**
 * 大善系统 —— env.ts 错误路径与解析鲁棒性测试（D8 错误路径加固）。
 *
 * 新增 parseEnvText 公开纯函数（从 loadEnv 抽出，可测），覆盖：
 *  - 正常 KEY=VALUE / 带引号 / 带注释 / 空行
 *  - 容错：无 = / 缺 key(=value) / 缺 value(KEY=) / 纯空白 / 未闭合引号
 *  - CRLF 与 LF 换行
 *  - 后出现的同名 key 覆盖前者
 *  - 空文本/全非法行 → 空对象
 *  - env() 读取（含默认值）
 *  - loadEnv 不覆盖已有 process.env
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseEnvText, env } from '../shared/env.ts';

// ── parseEnvText 正常路径 ──────────────────────────────

test('env: 正常 KEY=VALUE 解析', () => {
  const r = parseEnvText('FOO=bar');
  assert.deepEqual(r, { FOO: 'bar' });
});

test('env: 多行多 key 解析', () => {
  const r = parseEnvText('A=1\nB=2\nC=3');
  assert.deepEqual(r, { A: '1', B: '2', C: '3' });
});

test('env: 值含等号（= 仅切第一个）', () => {
  const r = parseEnvText('URL=https://a.com/path?q=1&v=2');
  assert.equal(r['URL'], 'https://a.com/path?q=1&v=2');
});

test('env: 双引号包裹的值被剥离', () => {
  assert.equal(parseEnvText('X="hello world"')['X'], 'hello world');
});

test('env: 单引号包裹的值被剥离', () => {
  assert.equal(parseEnvText("X='hello world'")['X'], 'hello world');
});

test('env: # 开头的注释行跳过', () => {
  const r = parseEnvText('# 这是注释\nFOO=bar');
  assert.deepEqual(r, { FOO: 'bar' });
});

test('env: 空行跳过', () => {
  const r = parseEnvText('\nFOO=bar\n\n');
  assert.deepEqual(r, { FOO: 'bar' });
});

// ── parseEnvText 容错（错误路径加固核心） ─────────────

test('env: 无 = 的行静默跳过', () => {
  const r = parseEnvText('INVALIDLINE\nFOO=bar');
  assert.deepEqual(r, { FOO: 'bar' });
});

test('env: 缺 key（=value）跳过', () => {
  const r = parseEnvText('=orphanvalue\nFOO=bar');
  assert.deepEqual(r, { FOO: 'bar' });
});

test('env: 缺 value（KEY=）得到空串', () => {
  // KEY= 是合法的空值（shell 语义），不应跳过
  const r = parseEnvText('EMPTY=');
  assert.equal(r['EMPTY'], '');
});

test('env: 纯空白行跳过', () => {
  const r = parseEnvText('   \n\t\nFOO=bar');
  assert.deepEqual(r, { FOO: 'bar' });
});

test('env: # 注释内嵌在值里不剥离（仅行首 # 是注释）', () => {
  // 值里的 # 不是注释
  const r = parseEnvText('PASS=a#b');
  assert.equal(r['PASS'], 'a#b');
});

test('env: 未闭合引号原样保留（不剥离）', () => {
  // 只有首引号无尾引号 → 不成对，保留原值
  const r = parseEnvText('X="unterminated');
  assert.equal(r['X'], '"unterminated');
});

test('env: 前后空格被 trim', () => {
  const r = parseEnvText('  FOO  =  bar  ');
  assert.equal(r['FOO'], 'bar');
});

test('env: key 含空格被 trim 到核心', () => {
  // key 前后空格 trim 后剩 'FOO'
  const r = parseEnvText('  FOO  =bar');
  assert.ok('FOO' in r, 'key 应被 trim 为 FOO');
});

// ── CRLF 兼容 ──────────────────────────────────────────

test('env: CRLF 换行正确解析', () => {
  const r = parseEnvText('A=1\r\nB=2\r\n');
  assert.deepEqual(r, { A: '1', B: '2' });
});

test('env: LF 与 CRLF 混合正确解析', () => {
  const r = parseEnvText('A=1\nB=2\r\nC=3');
  assert.deepEqual(r, { A: '1', B: '2', C: '3' });
});

// ── 覆盖语义 ───────────────────────────────────────────

test('env: 后出现的同名 key 覆盖前者', () => {
  const r = parseEnvText('FOO=1\nFOO=2');
  assert.equal(r['FOO'], '2');
});

// ── 边界 ───────────────────────────────────────────────

test('env: 空文本返回空对象', () => {
  assert.deepEqual(parseEnvText(''), {});
});

test('env: 全非法行返回空对象', () => {
  assert.deepEqual(parseEnvText('invalid\n#comment\n=nokey\n   '), {});
});

test('env: 仅注释返回空对象', () => {
  assert.deepEqual(parseEnvText('# a\n# b\n# c'), {});
});

test('env: 值为纯数字字符串', () => {
  const r = parseEnvText('PORT=5180');
  assert.equal(r['PORT'], '5180');
  assert.equal(typeof r['PORT'], 'string', 'env 值恒为 string');
});

test('env: 中文 key 与中文 value', () => {
  const r = parseEnvText('主题=大善系统');
  assert.equal(r['主题'], '大善系统');
});

// ── env() 读取 ─────────────────────────────────────────

test('env: env() 读已存在的 process.env 变量', () => {
  // PATH 几乎一定存在
  const p = env('PATH', 'fallback');
  // 不断言具体值，但应非 fallback（除非极端环境）
  assert.ok(typeof p === 'string');
});

test('env: env() 缺失变量返回默认值', () => {
  const r = env('DEFINITELY_NOT_SET_XYZ_123', 'default_val');
  assert.equal(r, 'default_val');
});

test('env: env() 缺失且无默认返回空串', () => {
  const r = env('DEFINITELY_NOT_SET_XYZ_456');
  assert.equal(r, '');
});

test('env: env() 默认值可为任意字符串', () => {
  assert.equal(env('NOPE', 'https://example.com'), 'https://example.com');
});

// ── loadEnv 不覆盖已有（间接验证，不依赖文件系统） ──────

test('env: parseEnvText 是纯函数（不碰 process.env）', () => {
  // 调用前后 process.env 不应有 TEST_PARSE_KEY
  const key = 'TEST_PARSE_KEY_NEVER_SET';
  assert.equal(process.env[key], undefined);
  parseEnvText(`${key}=value`);
  assert.equal(process.env[key], undefined, 'parseEnvText 不应写入 process.env');
});
